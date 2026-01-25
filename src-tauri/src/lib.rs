mod commands;
mod http_server;
mod mobile;
mod storage;
mod sync;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use std::sync::Arc;
use sync::SyncSettings;
use tauri::Manager;
use tokio::sync::RwLock;

#[derive(Clone)]
struct SyncSettingsState {
    settings: Arc<RwLock<SyncSettings>>,
}

#[tauri::command]
fn restart_app_instance(handle: tauri::AppHandle) {
    handle.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run_app() {
    init_logging();

    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                http_server::start_server(handle.clone()).await;
            });

            let relay_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let relay_dir = relay_handle
                    .path()
                    .app_local_data_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("./relay"))
                    .join("relay");

                if let Ok(_) = std::fs::create_dir_all(&relay_dir) {
                    let db_path = relay_dir.to_string_lossy().to_string();
                    // We can't easily access the state here before .manage is called,
                    // but we can use the default port for now or wait for the frontend to trigger.
                    // However, we should check if relay is enabled by default.
                    let _ = tauri_plugin_nostrnative::relay::start_relay_core(4870, &db_path).await;
                }
            });

            Ok(())
        })
        .manage(SyncSettingsState {
            settings: Arc::new(RwLock::new(SyncSettings::default())),
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_nostrnative::init())
        .invoke_handler(tauri::generate_handler![
            http_server::get_server_port,
            commands::app::update_reminder_settings,
            commands::app::update_sync_settings,
            commands::app::trigger_sync,
            commands::app::toggle_relay,
            restart_app_instance
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn init_logging() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "blossom=debug,tower_http=debug,axum=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
}
