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
            let handle = app.handle();
            let sync_settings_state = handle.state::<SyncSettingsState>();
            let settings_clone = sync_settings_state.inner().clone();

            let handle_for_server = handle.clone();
            tauri::async_runtime::spawn(async move {
                http_server::start_server(handle_for_server).await;
            });

            let handle_for_relay = handle.clone();
            tauri::async_runtime::spawn(async move {
                let settings = settings_clone.settings.read().await;
                if settings.relay_enabled {
                    let relay_dir = handle_for_relay
                        .path()
                        .app_local_data_dir()
                        .unwrap_or_default()
                        .join("relay");
                    let _ = std::fs::create_dir_all(&relay_dir);
                    let db_path = relay_dir.to_string_lossy().to_string();

                    let relay_settings = tauri_plugin_nostrnative::relay::RelaySettings {
                        relay_allowed_kinds: Some(settings.relay_allowed_kinds.clone()),
                        relay_allowed_pubkeys: Some(settings.relay_allowed_pubkeys.clone()),
                        relay_allowed_tagged_pubkeys: Some(settings.relay_allowed_tagged_pubkeys.clone()),
                    };

                    let _ = tauri_plugin_nostrnative::relay::start_relay_core(
                        settings.relay_port,
                        &db_path,
                        settings.pubkey.as_deref(),
                        Some(relay_settings),
                    )
                    .await;
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
