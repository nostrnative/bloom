use crate::http_server;
use crate::storage::StorageManager;
use jni::objects::{JClass, JString};
use jni::sys::jint;
use jni::JNIEnv;
use once_cell::sync::Lazy;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use tokio::runtime::Runtime;

static RUNNING: AtomicBool = AtomicBool::new(false);
static RUNTIME: Lazy<Mutex<Option<Runtime>>> = Lazy::new(|| Mutex::new(None));

#[no_mangle]
#[allow(non_snake_case)]
pub extern "C" fn Java_com_blossom_server_BlossomService_startRustServer(
    mut env: JNIEnv,
    _class: JClass,
    port: jint,
    base_path: JString,
) {
    if RUNNING.load(Ordering::SeqCst) {
        return;
    }

    let base_path_str: String = env
        .get_string(&base_path)
        .expect("Couldn't get java string!")
        .into();

    RUNNING.store(true, Ordering::SeqCst);

    let rt = Runtime::new().expect("Failed to create tokio runtime");

    // Use dynamic storage paths from Kotlin
    let files_dir = PathBuf::from(base_path_str);
    let storage_dir = files_dir.join("blobs");
    let relay_dir = files_dir.join("relay");

    if let Err(e) = std::fs::create_dir_all(&storage_dir) {
        tracing::error!("Failed to create storage directory: {}", e);
    }

    if let Err(e) = std::fs::create_dir_all(&relay_dir) {
        tracing::error!("Failed to create relay directory: {}", e);
    }

    // Spawn Relay Server
    let relay_dir_clone = relay_dir.clone();
    rt.spawn(async move {
        let db_path = relay_dir_clone.to_string_lossy().to_string();
        tracing::info!("Starting background relay at {}", db_path);
        let _ = tauri_plugin_nostrnative::relay::start_relay_core(4870, &db_path).await;
    });

    // Spawn Blossom Server
    rt.spawn(async move {
        tracing::info!("Background Blossom server starting on port {}...", port);

        let server_url = format!("http://0.0.0.0:{}", port);
        let storage = Arc::new(StorageManager::new(storage_dir, server_url.clone()));

        // Minimal state for background server (no AppHandle)
        let state = http_server::AppState {
            storage: storage.clone(),
            handle: Arc::new(tokio::sync::RwLock::new(None)),
        };

        let app = http_server::create_router(state);

        let addr = format!("0.0.0.0:{}", port);
        let listener = match tokio::net::TcpListener::bind(&addr).await {
            Ok(l) => {
                http_server::set_active_port(port as u16);
                l
            }
            Err(e) => {
                tracing::error!("Failed to bind to {}: {}", addr, e);
                return;
            }
        };

        tracing::info!("Blossom background server listening on {}", addr);

        if let Err(e) = axum::serve(listener, app).await {
            tracing::error!("Server error: {}", e);
        }

        RUNNING.store(false, Ordering::SeqCst);
    });

    let mut runtime_guard = RUNTIME.lock().unwrap();
    *runtime_guard = Some(rt);
}

#[no_mangle]
#[allow(non_snake_case)]
pub extern "C" fn Java_com_blossom_server_BlossomService_stopRustServer(
    _env: JNIEnv,
    _class: JClass,
) {
    RUNNING.store(false, Ordering::SeqCst);
    let mut runtime_guard = RUNTIME.lock().unwrap();
    if let Some(rt) = runtime_guard.take() {
        rt.shutdown_background();
    }
}

// cashuBo2F0gaJhaUgAUAVQ8ElBRmFwhqNhYRkCAGFzeEAwYWRmMDU0MDkyNzdiMGQ0NTFiNmNmMWNmMmQzMDAyY2E5YjllMmZjOGVmZTczZDM3ZTI1MDg0NTY0ODljNzE1YWNYIQIhsWmVgAR-Z7o43ZIuRTolGfZ4Xr4auicaZjoLZgtw3KNhYRkBAGFzeEA1MWFhNWRkOTUwNWZmNTlhNzBjMTUxYzBhMTZhOTcxNTg2MWRlYzQzYzkyZTU4MzA2YmVjZWY4MDFhZjhhZjlmYWNYIQLh4k3RLcJ9i-LjgJo_RSI9SuqUmjbz3Ttfkadh37n2NqNhYRiAYXN4QGI5ZTNkZThlYTMyMTQxYmQ1YjNhYmI2ODMxYzM2NTczYTk4M2JmZDI2ODBlOTFkZWVhM2RjYzEzY2I1Y2Y1NDlhY1ghArImmHR_xaoyFesmwMz8msqlfwnlS4NF3tD4pU_Wl0_wo2FhGEBhc3hANmYwNzY5OTEyZjdlYWM5NTA3MTIzNDg2Y2EwNjBhNmNjNWFhYmM2MzllYmE2ZTgxZGQwZWNkMDVmMjJlMTgzYmFjWCEDVTytcPGBHyAUMUkj5RJpvkd-SiNtFVmX3_CIdOz8akyjYWEYIGFzeEA3MzViOWI1ZDAzOWRkMWEwNWQ4YTQzZTJjNjk3ZmExOGI2ZWRhYjM5MTNlYzFjMjM5YjRmNGU5YTYxYjUxMzlhYWNYIQLRJ8TykwA4bAMkrgwz37acyrmd1p8SXsFaTJte9jkJ5qNhYQhhc3hANjY3MjM4OGU3OWM2ZTE3NmUzOGRmMjMwZGY2YmY2OTY2NmM4Mjg5OWEyNWM5M2IxM2JkN2M1YmU3NDYwYzA0Y2FjWCEDyvyGuvhFxv63-3OB11G0mEMljX9iydyRec9LJ5PmV0FhbXgiaHR0cHM6Ly9taW50Lm1pbmliaXRzLmNhc2gvQml0Y29pbmF1Y3NhdA
