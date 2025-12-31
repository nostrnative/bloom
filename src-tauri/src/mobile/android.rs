use jni::JNIEnv;
use jni::objects::JClass;
use jni::sys::jint;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::runtime::Runtime;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use crate::http_server;
use crate::storage::StorageManager;
use std::sync::Arc;
use std::path::PathBuf;

static RUNNING: AtomicBool = AtomicBool::new(false);
static RUNTIME: Lazy<Mutex<Option<Runtime>>> = Lazy::new(|| Mutex::new(None));

#[no_mangle]
#[allow(non_snake_case)]
pub extern "C" fn Java_com_blossom_server_BlossomService_startRustServer(
    _env: JNIEnv,
    _class: JClass,
    port: jint,
) {
    if RUNNING.load(Ordering::SeqCst) {
        return;
    }

    RUNNING.store(true, Ordering::SeqCst);

    let rt = Runtime::new().expect("Failed to create tokio runtime");
    
    rt.spawn(async move {
        tracing::info!("Background Blossom server starting on port {}...", port);
        
        // Android specific storage path - ideally passed from Kotlin
        let storage_dir = PathBuf::from("/data/data/com.blossom.server/files/blobs");
        if let Err(e) = std::fs::create_dir_all(&storage_dir) {
            tracing::error!("Failed to create storage directory: {}", e);
            return;
        }

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
