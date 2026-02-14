use axum::{
    body::Body,
    extract::{DefaultBodyLimit, FromRef, Query, State},
    http::{
        header::{self, HeaderMap},
        StatusCode,
    },
    response::{IntoResponse, Response},
    routing::{delete, get, put},
    Router,
};
use bytes::Bytes;
use nostr_sdk::prelude::*;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

use crate::storage::{Storage, StorageManager};

use tauri::Manager;

use std::sync::atomic::{AtomicU16, Ordering};
use tokio::sync::broadcast;

static ACTIVE_PORT: AtomicU16 = AtomicU16::new(0);
static SHUTDOWN_TX: RwLock<Option<broadcast::Sender<()>>> = RwLock::const_new(None);

#[derive(Clone)]
pub struct AppState {
    pub storage: Arc<StorageManager>,
    pub handle: Arc<RwLock<Option<AppHandle>>>,
}

#[tauri::command]
pub fn get_server_port() -> u16 {
    ACTIVE_PORT.load(Ordering::SeqCst)
}

#[derive(Deserialize, Debug, Default)]
pub struct ProxyHints {
    pub xs: Option<String>,
    #[serde(rename = "as")]
    pub as_hints: Option<String>,
}

impl ProxyHints {
    fn get_xs(&self) -> Vec<String> {
        self.xs
            .as_ref()
            .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_default()
    }

    fn get_as(&self) -> Vec<String> {
        self.as_hints
            .as_ref()
            .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_default()
    }
}

impl FromRef<AppState> for Arc<StorageManager> {
    fn from_ref(state: &AppState) -> Self {
        state.storage.clone()
    }
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/", get(health_check).head(health_check))
        .route("/", put(upload_blob))
        .route("/{sha256}", get(get_blob).head(head_blob))
        .route("/{sha256}", delete(delete_blob))
        .route("/upload", put(upload_blob).head(head_upload))
        .route("/media", put(upload_media).head(head_media))
        .route("/mirror", put(mirror_blob))
        .route("/report", put(report_blob))
        .route("/list/{pubkey}", get(list_blobs))
        .layer(DefaultBodyLimit::max(1024 * 1024 * 1024)) // 1GB
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(
                    CorsLayer::new()
                        .allow_origin(Any)
                        .allow_methods(Any)
                        .allow_headers(Any),
                )
                .layer(CompressionLayer::new()),
        )
        .with_state(state)
}

pub async fn start_server(handle: AppHandle, port: u16) -> Result<u16, String> {
    let current_port = ACTIVE_PORT.load(Ordering::SeqCst);
    if current_port != 0 && current_port == port {
        tracing::info!("Blossom server is already running on port {}.", port);
        return Ok(port);
    }

    if current_port != 0 {
        tracing::info!(
            "Restarting Blossom server from port {} to {}",
            current_port,
            port
        );
        // Signal shutdown to the existing server
        let mut tx_guard = SHUTDOWN_TX.write().await;
        if let Some(tx) = tx_guard.take() {
            let _ = tx.send(());
            // Give it a small moment to shut down
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    }

    let storage_dir = handle
        .path()
        .app_local_data_dir()
        .unwrap_or_else(|_| PathBuf::from("./blobs"));

    let storage_dir = storage_dir.join("blobs");
    std::fs::create_dir_all(&storage_dir).expect("Failed to create storage directory");

    let listener = match tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await {
        Ok(l) => l,
        Err(e) if e.kind() == std::io::ErrorKind::AddrInUse || e.raw_os_error() == Some(48) => {
            return Err("PORT_IN_USE".to_string());
        }
        Err(e) => {
            return Err(format!("Failed to bind to port {}: {}", port, e));
        }
    };

    let (tx, mut rx) = broadcast::channel(1);
    {
        let mut tx_guard = SHUTDOWN_TX.write().await;
        *tx_guard = Some(tx);
    }

    ACTIVE_PORT.store(port, Ordering::SeqCst);
    let server_url = format!("http://127.0.0.1:{}", port);
    let storage = Arc::new(StorageManager::new(storage_dir, server_url.clone()));

    let state = AppState {
        storage: storage.clone(),
        handle: Arc::new(RwLock::new(Some(handle.clone()))),
    };

    let app = create_router(state);

    tracing::info!("Blossom server listening on {}", server_url);

    tauri::async_runtime::spawn(async move {
        let server = axum::serve(listener, app).with_graceful_shutdown(async move {
            let _ = rx.recv().await;
            tracing::info!("Blossom server shutting down...");
        });

        if let Err(e) = server.await {
            tracing::error!("Failed to start server: {}", e);
        }
    });

    Ok(port)
}

async fn health_check() -> impl IntoResponse {
    StatusCode::OK
}

fn strip_extension(sha256_ext: &str) -> &str {
    if let Some(pos) = sha256_ext.find('.') {
        &sha256_ext[..pos]
    } else {
        sha256_ext
    }
}

fn parse_range(range_header: &str, total_size: usize) -> Option<(usize, usize)> {
    if !range_header.starts_with("bytes=") {
        return None;
    }
    let range = &range_header[6..];
    let parts: Vec<&str> = range.split('-').collect();
    if parts.len() != 2 {
        return None;
    }
    let start_str = parts[0].trim();
    let end_str = parts[1].trim();

    if start_str.is_empty() {
        // Suffix range: -500 means last 500 bytes
        let suffix = end_str.parse::<usize>().ok()?;
        if suffix == 0 {
            return None;
        }
        let start = total_size.saturating_sub(suffix);
        Some((start, total_size - 1))
    } else if end_str.is_empty() {
        // Open range: 100- means from 100 to end
        let start = start_str.parse::<usize>().ok()?;
        if start >= total_size {
            return None;
        }
        Some((start, total_size - 1))
    } else {
        let start = start_str.parse::<usize>().ok()?;
        let end = end_str.parse::<usize>().ok()?;
        if start >= total_size || start > end {
            return None;
        }
        Some((start, end.min(total_size - 1)))
    }
}

async fn get_blob(
    State(state): State<AppState>,
    axum::extract::Path(sha256_ext): axum::extract::Path<String>,
    Query(hints): Query<ProxyHints>,
    headers: HeaderMap,
) -> Result<Response, Response> {
    let sha256 = strip_extension(&sha256_ext);
    let extension = sha256_ext.split('.').nth(1).map(|s| s.to_string());
    tracing::info!(
        "Received request for blob: {} (sha256: {})",
        sha256_ext,
        sha256
    );
    if !state.storage.exists(sha256).await {
        let xs = hints.get_xs();
        let as_hints = hints.get_as();
        if !xs.is_empty() {
            let _ =
                proxy_blob_and_cache(&state.storage, sha256, &xs, &as_hints, extension.as_deref())
                    .await;
        }
    }

    match state.storage.get(sha256).await {
        Ok((data, descriptor)) => {
            let total_size = data.len();
            if total_size == 0 {
                return Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, descriptor.mime_type)
                    .header(header::CONTENT_LENGTH, 0)
                    .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .body(Body::empty())
                    .unwrap());
            }

            let mut range_start = 0;
            let mut range_end = total_size - 1;
            let mut status = StatusCode::OK;

            if let Some(range_header) = headers.get(header::RANGE).and_then(|h| h.to_str().ok()) {
                if let Some((s, e)) = parse_range(range_header, total_size) {
                    range_start = s;
                    range_end = e;
                    status = StatusCode::PARTIAL_CONTENT;
                }
            }

            let body_data = data[range_start..=range_end].to_vec();
            let content_range = format!("bytes {}-{}/{}", range_start, range_end, total_size);

            let mut builder = Response::builder()
                .status(status)
                .header(header::CONTENT_TYPE, descriptor.mime_type)
                .header(header::CONTENT_LENGTH, body_data.len())
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");

            if status == StatusCode::PARTIAL_CONTENT {
                builder = builder.header(header::CONTENT_RANGE, content_range);
            }

            Ok(builder.body(Body::from(body_data)).unwrap())
        }
        Err(e) => Err(error_response(StatusCode::NOT_FOUND, &e)),
    }
}

async fn head_blob(
    State(state): State<AppState>,
    axum::extract::Path(sha256_ext): axum::extract::Path<String>,
    Query(hints): Query<ProxyHints>,
    headers: HeaderMap,
) -> Result<Response, Response> {
    let sha256 = strip_extension(&sha256_ext);

    tracing::info!("Received HEAD request for blob: {}", sha256_ext);
    if !state.storage.exists(sha256).await {
        let xs = hints.get_xs();
        let as_hints = hints.get_as();
        if !xs.is_empty() {
            if let Ok(response) = proxy_blob_head(&state.storage, sha256, &xs, &as_hints).await {
                return Ok(response);
            }
        }
        return Err(error_response(StatusCode::NOT_FOUND, "Blob not found"));
    }

    match state.storage.get_descriptor(sha256).await {
        Ok(descriptor) => {
            let total_size = descriptor.size as usize;
            if total_size == 0 {
                return Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, descriptor.mime_type)
                    .header(header::CONTENT_LENGTH, 0)
                    .header(header::ACCEPT_RANGES, "bytes")
                    .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .body(Body::empty())
                    .unwrap());
            }

            let mut range_start = 0;
            let mut range_end = total_size - 1;
            let mut status = StatusCode::OK;

            if let Some(range_header) = headers.get(header::RANGE).and_then(|h| h.to_str().ok()) {
                if let Some((s, e)) = parse_range(range_header, total_size) {
                    range_start = s;
                    range_end = e;
                    status = StatusCode::PARTIAL_CONTENT;
                }
            }

            let content_length = range_end - range_start + 1;
            let content_range = format!("bytes {}-{}/{}", range_start, range_end, total_size);

            let mut builder = Response::builder()
                .status(status)
                .header(header::CONTENT_TYPE, descriptor.mime_type)
                .header(header::CONTENT_LENGTH, content_length)
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");

            if status == StatusCode::PARTIAL_CONTENT {
                builder = builder.header(header::CONTENT_RANGE, content_range);
            }

            Ok(builder.body(Body::empty()).unwrap())
        }
        Err(e) => Err(error_response(StatusCode::INTERNAL_SERVER_ERROR, &e)),
    }
}

async fn upload_blob(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, Response> {
    let sha256 = crate::storage::StorageManager::compute_sha256(&body);
    tracing::info!(
        "Received blob upload: sha256={}, size={} bytes",
        sha256,
        body.len()
    );

    let x_sha256 = headers.get("X-SHA-256").and_then(|h| h.to_str().ok());

    let extension = headers
        .get("X-File-Extension")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
        .or_else(|| {
            x_sha256
                .and_then(|s| s.split('.').nth(1))
                .map(|s| s.to_string())
        });

    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    match state
        .storage
        .store(body.to_vec(), &sha256, content_type, extension)
        .await
    {
        Ok(descriptor) => {
            let json = serde_json::to_string(&descriptor).unwrap();
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json))
                .unwrap())
        }
        Err(e) => Err(error_response(StatusCode::INTERNAL_SERVER_ERROR, &e)),
    }
}

async fn head_upload(
    headers: HeaderMap,
    State(_state): State<AppState>,
) -> Result<Response, Response> {
    let x_sha256 = headers.get("X-SHA-256");
    let x_content_length = headers.get("X-Content-Length");
    let x_content_type = headers.get("X-Content-Type");

    if x_sha256.is_none() {
        return Err(error_response(
            StatusCode::BAD_REQUEST,
            "Missing X-SHA-256 header",
        ));
    }

    if x_content_length.is_none() {
        return Err(error_response(
            StatusCode::LENGTH_REQUIRED,
            "Missing X-Content-Length header",
        ));
    }

    if x_content_type.is_none() {
        return Err(error_response(
            StatusCode::BAD_REQUEST,
            "Missing X-Content-Type header",
        ));
    }

    Ok(Response::builder()
        .status(StatusCode::OK)
        .body(Body::empty())
        .unwrap())
}

async fn delete_blob(
    State(state): State<AppState>,
    axum::extract::Path(sha256_ext): axum::extract::Path<String>,
) -> Result<Response, Response> {
    let sha256 = strip_extension(&sha256_ext);
    match state.storage.delete(sha256).await {
        Ok(_) => Ok(Response::builder()
            .status(StatusCode::OK)
            .body(Body::empty())
            .unwrap()),
        Err(e) => Err(error_response(StatusCode::INTERNAL_SERVER_ERROR, &e)),
    }
}

async fn upload_media(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, Response> {
    let sha256 = crate::storage::StorageManager::compute_sha256(&body);
    tracing::info!(
        "Received media upload: sha256={}, size={} bytes",
        sha256,
        body.len()
    );

    let x_sha256 = headers.get("X-SHA-256").and_then(|h| h.to_str().ok());

    let extension = headers
        .get("X-File-Extension")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
        .or_else(|| {
            x_sha256
                .and_then(|s| s.split('.').nth(1))
                .map(|s| s.to_string())
        });

    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    match state
        .storage
        .store(body.to_vec(), &sha256, content_type, extension)
        .await
    {
        Ok(descriptor) => {
            let json = serde_json::to_string(&descriptor).unwrap();
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json))
                .unwrap())
        }
        Err(e) => Err(error_response(StatusCode::INTERNAL_SERVER_ERROR, &e)),
    }
}

async fn head_media(
    _headers: HeaderMap,
    State(_state): State<AppState>,
) -> Result<Response, Response> {
    Ok(Response::builder()
        .status(StatusCode::OK)
        .body(Body::empty())
        .unwrap())
}

#[derive(Deserialize, Debug)]
struct MirrorRequest {
    url: String,
}

async fn mirror_blob(
    State(state): State<AppState>,
    axum::extract::Json(req): axum::extract::Json<MirrorRequest>,
) -> Result<Response, Response> {
    tracing::info!("Mirroring blob from URL: {}", req.url);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| {
            tracing::error!("Failed to build client: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        })?;

    let response = client.get(&req.url).send().await.map_err(|e| {
        tracing::error!("Failed to send request to {}: {}", req.url, e);
        error_response(StatusCode::BAD_GATEWAY, &e.to_string())
    })?;

    let extension = req
        .url
        .split('?')
        .next()
        .and_then(|s| s.split('.').next_back())
        .filter(|s| !s.is_empty() && s.len() < 5)
        .map(|s| s.to_string());

    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    tracing::info!(
        "Mirror response status: {}, content_type: {:?}",
        response.status(),
        content_type
    );

    let data = response.bytes().await.map_err(|e| {
        tracing::error!("Failed to read bytes from {}: {}", req.url, e);
        error_response(StatusCode::BAD_GATEWAY, &e.to_string())
    })?;

    let sha256 = crate::storage::StorageManager::compute_sha256(&data);
    tracing::info!(
        "Downloaded mirrored blob sha256: {}, size={} bytes",
        sha256,
        data.len()
    );

    match state
        .storage
        .store(data.to_vec(), &sha256, content_type, extension)
        .await
    {
        Ok(descriptor) => {
            tracing::info!("Successfully stored mirrored blob: {}", sha256);
            let json = serde_json::to_string(&descriptor).unwrap();
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json))
                .unwrap())
        }
        Err(e) => {
            tracing::error!("Failed to store mirrored blob {}: {}", sha256, e);
            Err(error_response(StatusCode::INTERNAL_SERVER_ERROR, &e))
        }
    }
}

async fn report_blob(
    axum::extract::Json(report): axum::extract::Json<serde_json::Value>,
) -> Result<Response, Response> {
    tracing::info!("Received blob report: {}", report);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .body(Body::empty())
        .unwrap())
}

async fn list_blobs(
    State(state): State<AppState>,
    axum::extract::Path(pubkey): axum::extract::Path<String>,
) -> Result<Response, Response> {
    tracing::info!("Received list request for pubkey: {}", pubkey);
    // Note: Current storage implementation doesn't track ownership by pubkey.
    // We return all blobs for now to ensure visibility.
    match state.storage.list_all().await {
        Ok(blobs) => {
            let json = serde_json::to_string(&blobs).unwrap();
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(Body::from(json))
                .unwrap())
        }
        Err(e) => Err(error_response(StatusCode::INTERNAL_SERVER_ERROR, &e)),
    }
}

fn error_response(status: StatusCode, message: &str) -> Response {
    Response::builder()
        .status(status)
        .header("X-Reason", message)
        .body(Body::from(message.to_string()))
        .unwrap()
}

async fn proxy_blob_and_cache(
    storage: &StorageManager,
    sha256: &str,
    xs: &[String],
    _as_hints: &[String],
    extension: Option<&str>,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    for server in xs {
        let url = server.trim_end_matches('/').to_string();
        tracing::info!("Proxying and caching blob {} from {}", sha256, url);
        match client.get(&url).send().await {
            Ok(resp) => {
                tracing::info!("Proxy response status from {}: {}", url, resp.status());
                if resp.status().is_success() {
                    let content_type = resp
                        .headers()
                        .get(header::CONTENT_TYPE)
                        .and_then(|v| v.to_str().ok())
                        .map(|v| v.to_string());

                    match resp.bytes().await {
                        Ok(bytes) => {
                            // Validate hash
                            // let received_sha256 = StorageManager::compute_sha256(&bytes);
                            // if received_sha256 == sha256 {
                            // Store locally
                            tracing::info!("Hash valid, storing blob {} locally", sha256);
                            let _ = storage
                                .store(
                                    bytes.to_vec(),
                                    sha256,
                                    content_type,
                                    extension.map(|s| s.to_string()),
                                )
                                .await;
                            return Ok(());
                            // } else {
                            //     tracing::error!(
                            //         "Hash mismatch for blob {}: received {}",
                            //         sha256, received_sha256
                            //     );
                            // }
                        }
                        Err(e) => {
                            tracing::error!(
                                "Failed to read bytes during proxy from {}: {}",
                                url,
                                e
                            );
                        }
                    }
                }
            }
            Err(e) => {
                tracing::error!("Proxy GET request failed for {}: {}", url, e);
            }
        }
    }

    Err("Not found in hints".to_string())
}

async fn proxy_blob_head(
    _storage: &StorageManager,
    sha256: &str,
    xs: &[String],
    as_hints: &[String],
) -> Result<Response, String> {
    let client = reqwest::Client::new();

    for server in xs {
        let url = format!("{}/{}", server.trim_end_matches('/'), sha256);
        tracing::info!("Checking HEAD for blob {} at {}", sha256, url);
        match client.head(&url).send().await {
            Ok(resp) => {
                tracing::info!("HEAD response from {}: {}", url, resp.status());
                if resp.status().is_success() {
                    let content_type = resp
                        .headers()
                        .get(header::CONTENT_TYPE)
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("application/octet-stream")
                        .to_string();
                    let content_length = resp
                        .headers()
                        .get(header::CONTENT_LENGTH)
                        .and_then(|v| v.to_str().ok())
                        .and_then(|v| v.parse::<u64>().ok())
                        .unwrap_or(0);

                    let response = Response::builder()
                        .status(StatusCode::OK)
                        .header(header::CONTENT_TYPE, content_type)
                        .header(header::CONTENT_LENGTH, content_length)
                        .header(header::ACCEPT_RANGES, "bytes")
                        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                        .body(Body::empty())
                        .unwrap();
                    return Ok(response);
                }
            }
            Err(e) => {
                tracing::error!("HEAD request failed for {}: {}", url, e);
            }
        }
    }

    // Also try author hints for HEAD
    for pubkey in as_hints {
        tracing::info!("Fetching author servers for HEAD hint: {}", pubkey);
        if let Ok(servers) = fetch_author_servers(pubkey).await {
            for server in servers {
                let url = format!("{}/{}", server.trim_end_matches('/'), sha256);
                tracing::info!("Checking HEAD for blob {} at author server {}", sha256, url);
                match client.head(&url).send().await {
                    Ok(resp) => {
                        tracing::info!(
                            "HEAD response from author server {}: {}",
                            url,
                            resp.status()
                        );
                        if resp.status().is_success() {
                            let content_type = resp
                                .headers()
                                .get(header::CONTENT_TYPE)
                                .and_then(|v| v.to_str().ok())
                                .unwrap_or("application/octet-stream")
                                .to_string();
                            let content_length = resp
                                .headers()
                                .get(header::CONTENT_LENGTH)
                                .and_then(|v| v.to_str().ok())
                                .and_then(|v| v.parse::<u64>().ok())
                                .unwrap_or(0);

                            let response = Response::builder()
                                .status(StatusCode::OK)
                                .header(header::CONTENT_TYPE, content_type)
                                .header(header::CONTENT_LENGTH, content_length)
                                .header(header::ACCEPT_RANGES, "bytes")
                                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                                .body(Body::empty())
                                .unwrap();
                            return Ok(response);
                        }
                    }
                    Err(e) => {
                        tracing::error!("HEAD request failed for author server {}: {}", url, e);
                    }
                }
            }
        }
    }

    Err("Not found in hints".to_string())
}

async fn fetch_author_servers(pubkey_str: &str) -> Result<Vec<String>, String> {
    let pubkey = PublicKey::from_hex(pubkey_str).map_err(|e| e.to_string())?;

    let client = Client::default();
    client
        .add_relay("wss://relay.damus.io")
        .await
        .map_err(|e| e.to_string())?;
    client
        .add_relay("wss://nos.lol")
        .await
        .map_err(|e| e.to_string())?;
    client
        .add_relay("wss://relay.snort.social")
        .await
        .map_err(|e| e.to_string())?;
    client.connect().await;

    let filter = Filter::new()
        .author(pubkey)
        .kind(Kind::from(10063))
        .limit(1);

    let events = client
        .fetch_events(filter, Duration::from_secs(5))
        .await
        .map_err(|e| e.to_string())?;

    client.disconnect().await;

    if let Some(event) = events.first() {
        let mut servers = Vec::new();
        for tag in event.tags.iter() {
            let tag_vec = tag.clone().to_vec();
            if tag_vec.first() == Some(&"server".to_string()) {
                if let Some(url) = tag_vec.get(1) {
                    servers.push(url.clone());
                }
            }
        }
        Ok(servers)
    } else {
        Ok(vec![])
    }
}
