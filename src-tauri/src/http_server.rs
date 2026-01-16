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

static ACTIVE_PORT: AtomicU16 = AtomicU16::new(0);

#[derive(Clone)]
pub struct AppState {
    pub storage: Arc<StorageManager>,
    pub handle: Arc<RwLock<Option<AppHandle>>>,
}

#[tauri::command]
pub fn get_server_port() -> u16 {
    ACTIVE_PORT.load(Ordering::SeqCst)
}

pub fn set_active_port(port: u16) {
    ACTIVE_PORT.store(port, Ordering::SeqCst);
}

#[derive(Deserialize, Debug)]
pub struct ProxyHints {
    #[serde(default)]
    pub xs: Vec<String>,
    #[serde(rename = "as", default)]
    pub as_hints: Vec<String>,
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

pub async fn start_server(handle: AppHandle) {
    let storage_dir = handle
        .path()
        .app_local_data_dir()
        .unwrap_or_else(|_| PathBuf::from("./blobs"));

    let storage_dir = storage_dir.join("blobs");
    std::fs::create_dir_all(&storage_dir).expect("Failed to create storage directory");

    let ports = [24242, 3838];
    let mut listener = None;
    let mut active_port = 0;

    for port in ports {
        match tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await {
            Ok(l) => {
                listener = Some(l);
                active_port = port;
                break;
            }
            Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
                tracing::warn!("Port {} in use, trying next...", port);
                continue;
            }
            Err(e) => {
                tracing::error!("Failed to bind to port {}: {}", port, e);
            }
        }
    }

    let listener = match listener {
        Some(l) => l,
        None => {
            tracing::error!("Could not bind to any port (24242, 3838).");
            return;
        }
    };

    ACTIVE_PORT.store(active_port, Ordering::SeqCst);
    let server_url = format!("http://127.0.0.1:{}", active_port);
    let storage = Arc::new(StorageManager::new(storage_dir, server_url.clone()));

    let state = AppState {
        storage: storage.clone(),
        handle: Arc::new(RwLock::new(Some(handle.clone()))),
    };

    let app = create_router(state);

    tracing::info!("Blossom server listening on {}", server_url);

    if let Err(e) = axum::serve(listener, app).await {
        tracing::error!("Failed to start server: {}", e);
    }
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

async fn get_blob(
    State(state): State<AppState>,
    axum::extract::Path(sha256_ext): axum::extract::Path<String>,
    Query(hints): Query<ProxyHints>,
    headers: HeaderMap,
) -> Result<Response, Response> {
    let sha256 = strip_extension(&sha256_ext);

    if !state.storage.exists(sha256).await {
        // If not found locally, try proxying if hints are provided
        if !hints.xs.is_empty() || !hints.as_hints.is_empty() {
            if let Ok(response) = proxy_blob(&state.storage, sha256, &hints).await {
                return Ok(response);
            }
        }
        return Err(error_response(StatusCode::NOT_FOUND, "Blob not found"));
    }

    match state.storage.get(sha256).await {
        Ok((data, descriptor)) => {
            let mut status = StatusCode::OK;
            let mut range_start = 0;
            let mut range_end = data.len();

            if let Some(range_header) = headers.get(header::RANGE) {
                if let Ok(range_str) = range_header.to_str() {
                    if range_str.starts_with("bytes=") {
                        let parts: Vec<&str> = range_str[6..].split('-').collect();
                        if parts.len() == 2 {
                            let start = parts[0].parse::<usize>().unwrap_or(0);
                            let end = parts[1].parse::<usize>().unwrap_or(data.len() - 1);

                            if start < data.len() {
                                range_start = start;
                                range_end = (end + 1).min(data.len());
                                status = StatusCode::PARTIAL_CONTENT;
                            }
                        }
                    }
                }
            }

            let body_data = data[range_start..range_end].to_vec();
            let content_range = format!("bytes {}-{}/{}", range_start, range_end - 1, data.len());

            let mut builder = Response::builder()
                .status(status)
                .header(header::CONTENT_TYPE, descriptor.mime_type)
                .header(header::CONTENT_LENGTH, body_data.len())
                .header(header::ACCEPT_RANGES, "bytes");

            if status == StatusCode::PARTIAL_CONTENT {
                builder = builder.header(header::CONTENT_RANGE, content_range);
            }

            Ok(builder.body(Body::from(body_data)).unwrap())
        }
        Err(e) => Err(error_response(StatusCode::INTERNAL_SERVER_ERROR, &e)),
    }
}

async fn head_blob(
    State(state): State<AppState>,
    axum::extract::Path(sha256_ext): axum::extract::Path<String>,
    Query(hints): Query<ProxyHints>,
    headers: HeaderMap,
) -> Result<Response, Response> {
    let sha256 = strip_extension(&sha256_ext);

    if !state.storage.exists(sha256).await {
        // For HEAD, we could also proxy but it might be overkill just to check existence.
        if !hints.xs.is_empty() || !hints.as_hints.is_empty() {
            if let Ok(response) = proxy_blob_head(&state.storage, sha256, &hints).await {
                return Ok(response);
            }
        }
        return Err(error_response(StatusCode::NOT_FOUND, "Blob not found"));
    }

    match state.storage.get_descriptor(sha256).await {
        Ok(descriptor) => {
            let mut status = StatusCode::OK;
            let mut range_start = 0;
            let mut range_end = descriptor.size as usize;

            if let Some(range_header) = headers.get(header::RANGE) {
                if let Ok(range_str) = range_header.to_str() {
                    if range_str.starts_with("bytes=") {
                        let parts: Vec<&str> = range_str[6..].split('-').collect();
                        if parts.len() == 2 {
                            let start = parts[0].parse::<usize>().unwrap_or(0);
                            let end = parts[1]
                                .parse::<usize>()
                                .unwrap_or(descriptor.size as usize - 1);

                            if start < descriptor.size as usize {
                                range_start = start;
                                range_end = (end + 1).min(descriptor.size as usize);
                                status = StatusCode::PARTIAL_CONTENT;
                            }
                        }
                    }
                }
            }

            let content_length = range_end - range_start;
            let content_range = format!(
                "bytes {}-{}/{}",
                range_start,
                range_end - 1,
                descriptor.size
            );

            let mut builder = Response::builder()
                .status(status)
                .header(header::CONTENT_TYPE, descriptor.mime_type)
                .header(header::CONTENT_LENGTH, content_length)
                .header(header::ACCEPT_RANGES, "bytes");

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

    println!("{:?}", headers);
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    match state
        .storage
        .store(body.to_vec(), &sha256, content_type)
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

    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    match state
        .storage
        .store(body.to_vec(), &sha256, content_type)
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
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    let response = client
        .get(&req.url)
        .send()
        .await
        .map_err(|e| error_response(StatusCode::BAD_GATEWAY, &e.to_string()))?;

    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    let data = response
        .bytes()
        .await
        .map_err(|e| error_response(StatusCode::BAD_GATEWAY, &e.to_string()))?;

    let sha256 = crate::storage::StorageManager::compute_sha256(&data);

    match state
        .storage
        .store(data.to_vec(), &sha256, content_type)
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
    axum::extract::Path(_pubkey): axum::extract::Path<String>,
) -> Result<Response, Response> {
    match state.storage.list_all().await {
        Ok(blobs) => {
            let json = serde_json::to_string(&blobs).unwrap();
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/json")
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

async fn proxy_blob(
    storage: &StorageManager,
    sha256: &str,
    hints: &ProxyHints,
) -> Result<Response, String> {
    let client = reqwest::Client::new();

    // 1. Try xs hints
    for server in &hints.xs {
        let url = format!("{}/{}", server.trim_end_matches('/'), sha256);
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                let content_type = resp
                    .headers()
                    .get(header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("application/octet-stream")
                    .to_string();

                if let Ok(bytes) = resp.bytes().await {
                    // Validate hash
                    let received_sha256 = StorageManager::compute_sha256(&bytes);
                    if received_sha256 == sha256 {
                        // Store locally
                        let _ = storage
                            .store(bytes.to_vec(), sha256, Some(content_type.clone()))
                            .await;

                        let response = Response::builder()
                            .status(StatusCode::OK)
                            .header(header::CONTENT_TYPE, content_type)
                            .header(header::CONTENT_LENGTH, bytes.len())
                            .header(header::ACCEPT_RANGES, "bytes")
                            .body(Body::from(bytes))
                            .unwrap();
                        return Ok(response);
                    }
                }
            }
        }
    }

    // 2. Try as hints (author pubkeys)
    for pubkey in &hints.as_hints {
        if let Ok(servers) = fetch_author_servers(pubkey).await {
            for server in servers {
                let url = format!("{}/{}", server.trim_end_matches('/'), sha256);
                if let Ok(resp) = client.get(&url).send().await {
                    if resp.status().is_success() {
                        let content_type = resp
                            .headers()
                            .get(header::CONTENT_TYPE)
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or("application/octet-stream")
                            .to_string();

                        if let Ok(bytes) = resp.bytes().await {
                            let received_sha256 = StorageManager::compute_sha256(&bytes);
                            if received_sha256 == sha256 {
                                let _ = storage
                                    .store(bytes.to_vec(), sha256, Some(content_type.clone()))
                                    .await;

                                let response = Response::builder()
                                    .status(StatusCode::OK)
                                    .header(header::CONTENT_TYPE, content_type)
                                    .header(header::CONTENT_LENGTH, bytes.len())
                                    .header(header::ACCEPT_RANGES, "bytes")
                                    .body(Body::from(bytes))
                                    .unwrap();
                                return Ok(response);
                            }
                        }
                    }
                }
            }
        }
    }

    Err("Not found in hints".to_string())
}

async fn proxy_blob_head(
    _storage: &StorageManager,
    sha256: &str,
    hints: &ProxyHints,
) -> Result<Response, String> {
    let client = reqwest::Client::new();

    for server in &hints.xs {
        let url = format!("{}/{}", server.trim_end_matches('/'), sha256);
        if let Ok(resp) = client.head(&url).send().await {
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
                    .body(Body::empty())
                    .unwrap();
                return Ok(response);
            }
        }
    }

    Err("Not found in hints".to_string())
}

async fn fetch_author_servers(_pubkey: &str) -> Result<Vec<String>, String> {
    // Stub for now
    Ok(vec![])
}
