mod commands;
mod http_server;
mod mobile;
mod storage;
mod sync;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use std::sync::Arc;
use sync::SyncSettings;
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
            commands::app::clear_blossom_content,
            commands::app::clear_relay_content,
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
