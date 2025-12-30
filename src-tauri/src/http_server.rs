use axum::{
    body::Body,
    extract::{FromRef, State},
    http::{
        header::{self, HeaderMap, HeaderValue},
        StatusCode,
    },
    response::{IntoResponse, Response},
    routing::{delete, get, head, put},
    Router,
};
use axum::response::sse::{self, Sse};
use bytes::Bytes;
use futures::stream::{self, Stream};
use serde::Deserialize;
use std::convert::Infallible;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

use crate::auth::{parse_authorization_header, validate_and_verify_auth};
use crate::storage::{BlobDescriptor, Storage, StorageManager};

use tauri::Manager;

#[derive(Clone)]
pub struct AppState {
    pub storage: Arc<StorageManager>,
    pub handle: Arc<RwLock<Option<AppHandle>>>,
}

impl FromRef<AppState> for Arc<StorageManager> {
    fn from_ref(state: &AppState) -> Self {
        state.storage.clone()
    }
}

pub async fn start_server(handle: AppHandle) {
    let storage_dir = handle
        .path()
        .app_local_data_dir()
        .unwrap_or_else(|_| PathBuf::from("./blobs"));

    let storage_dir = storage_dir.join("blobs");
    std::fs::create_dir_all(&storage_dir).expect("Failed to create storage directory");

    let server_url = "http://localhost:8080".to_string();
    let storage = Arc::new(StorageManager::new(storage_dir, server_url.clone()));

    let state = AppState {
        storage: storage.clone(),
        handle: Arc::new(RwLock::new(Some(handle.clone()))),
    };

    let app = Router::new()
        .route("/{sha256}", get(get_blob).head(head_blob))
        .route("/{sha256}", delete(delete_blob))
        .route("/upload", put(upload_blob).head(head_upload))
        .route("/media", put(upload_media).head(head_media))
        .route("/mirror", put(mirror_blob))
        .route("/report", put(report_blob))
        .route("/list/{pubkey}", get(list_blobs))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
                .layer(CompressionLayer::new()),
        )
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .expect("Failed to bind to address");

    tracing::info!("Blossom server listening on http://0.0.0.0:8080");

    axum::serve(listener, app)
        .await
        .expect("Failed to start server");
}

async fn get_blob(
    State(state): State<AppState>,
    axum::extract::Path(sha256): axum::extract::Path<String>,
    headers: HeaderMap,
) -> Result<Response, Response> {
    if !state.storage.exists(&sha256).await {
        return Err(error_response(StatusCode::NOT_FOUND, "Blob not found"));
    }

    let auth_header = headers.get(header::AUTHORIZATION);
    if let Some(auth) = auth_header {
        if let Ok(auth_str) = auth.to_str() {
            if let Ok(event) = parse_authorization_header(auth_str) {
                if let Err(e) = validate_and_verify_auth(&event, Some("get"), Some(&sha256)) {
                    return Err(error_response(
                        StatusCode::from_u16(e.http_status).unwrap_or(StatusCode::UNAUTHORIZED),
                        &e.message,
                    ));
                }
            }
        }
    }

    match state.storage.get(&sha256).await {
        Ok((data, descriptor)) => {
            let mut response = Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, descriptor.mime_type)
                .header(header::CONTENT_LENGTH, descriptor.size)
                .header(header::ACCEPT_RANGES, "bytes")
                .body(Body::from(data))
                .unwrap();

            Ok(response)
        }
        Err(e) => Err(error_response(StatusCode::INTERNAL_SERVER_ERROR, &e)),
    }
}

async fn head_blob(
    State(state): State<AppState>,
    axum::extract::Path(sha256): axum::extract::Path<String>,
    headers: HeaderMap,
) -> Result<Response, Response> {
    if !state.storage.exists(&sha256).await {
        return Err(error_response(StatusCode::NOT_FOUND, "Blob not found"));
    }

    let auth_header = headers.get(header::AUTHORIZATION);
    if let Some(auth) = auth_header {
        if let Ok(auth_str) = auth.to_str() {
            if let Ok(event) = parse_authorization_header(auth_str) {
                if let Err(e) = validate_and_verify_auth(&event, Some("get"), Some(&sha256)) {
                    return Err(error_response(
                        StatusCode::from_u16(e.http_status).unwrap_or(StatusCode::UNAUTHORIZED),
                        &e.message,
                    ));
                }
            }
        }
    }

    match state.storage.get_descriptor(&sha256).await {
        Ok(descriptor) => {
            let response = Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, descriptor.mime_type)
                .header(header::CONTENT_LENGTH, descriptor.size)
                .header(header::ACCEPT_RANGES, "bytes")
                .body(Body::empty())
                .unwrap();

            Ok(response)
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

    let auth_header = headers.get(header::AUTHORIZATION);
    if let Some(auth) = auth_header {
        if let Ok(auth_str) = auth.to_str() {
            if let Ok(event) = parse_authorization_header(auth_str) {
                if let Err(e) = validate_and_verify_auth(&event, Some("upload"), Some(&sha256)) {
                    return Err(error_response(
                        StatusCode::from_u16(e.http_status).unwrap_or(StatusCode::UNAUTHORIZED),
                        &e.message,
                    ));
                }
            }
        }
    }

    match state.storage.store(body.to_vec(), &sha256).await {
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
    axum::extract::Path(sha256): axum::extract::Path<String>,
    headers: HeaderMap,
) -> Result<Response, Response> {
    let auth_header = headers.get(header::AUTHORIZATION);
    if auth_header.is_none() {
        return Err(error_response(StatusCode::UNAUTHORIZED, "Authorization required"));
    }

    if let Ok(auth_str) = auth_header.unwrap().to_str() {
        if let Ok(event) = parse_authorization_header(auth_str) {
            if let Err(e) = validate_and_verify_auth(&event, Some("delete"), Some(&sha256)) {
                return Err(error_response(
                    StatusCode::from_u16(e.http_status).unwrap_or(StatusCode::UNAUTHORIZED),
                    &e.message,
                ));
            }
        } else {
            return Err(error_response(StatusCode::UNAUTHORIZED, "Invalid authorization"));
        }
    } else {
        return Err(error_response(StatusCode::UNAUTHORIZED, "Invalid authorization"));
    }

    match state.storage.delete(&sha256).await {
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

    let auth_header = headers.get(header::AUTHORIZATION);
    if let Some(auth) = auth_header {
        if let Ok(auth_str) = auth.to_str() {
            if let Ok(event) = parse_authorization_header(auth_str) {
                if let Err(e) = validate_and_verify_auth(&event, Some("media"), Some(&sha256)) {
                    return Err(error_response(
                        StatusCode::from_u16(e.http_status).unwrap_or(StatusCode::UNAUTHORIZED),
                        &e.message,
                    ));
                }
            }
        }
    }

    match state.storage.store(body.to_vec(), &sha256).await {
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

#[derive(Deserialize)]
struct MirrorRequest {
    url: String,
}

async fn mirror_blob(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Json(req): axum::extract::Json<MirrorRequest>,
) -> Result<Response, Response> {
    let auth_header = headers.get(header::AUTHORIZATION);
    if auth_header.is_none() {
        return Err(error_response(StatusCode::UNAUTHORIZED, "Authorization required"));
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    let response = client
        .get(&req.url)
        .send()
        .await
        .map_err(|e| error_response(StatusCode::BAD_GATEWAY, &e.to_string()))?;

    let data = response
        .bytes()
        .await
        .map_err(|e| error_response(StatusCode::BAD_GATEWAY, &e.to_string()))?;

    let sha256 = crate::storage::StorageManager::compute_sha256(&data);

    if let Ok(auth_str) = auth_header.unwrap().to_str() {
        if let Ok(event) = parse_authorization_header(auth_str) {
            if let Err(e) = validate_and_verify_auth(&event, Some("upload"), Some(&sha256)) {
                return Err(error_response(
                    StatusCode::from_u16(e.http_status).unwrap_or(StatusCode::UNAUTHORIZED),
                    &e.message,
                ));
            }
        }
    }

    match state.storage.store(data.to_vec(), &sha256).await {
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
    axum::extract::Path(_pubkey): axum::extract::Path<String>,
) -> Result<Response, Response> {
    let blobs: Vec<BlobDescriptor> = Vec::new();
    let json = serde_json::to_string(&blobs).unwrap();

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json))
        .unwrap())
}

fn error_response(status: StatusCode, message: &str) -> Response {
    Response::builder()
        .status(status)
        .header("X-Reason", message)
        .body(Body::from(message.to_string()))
        .unwrap()
}
