mod auth;
mod commands;
mod http_server;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run_app() {
    init_logging();

    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                http_server::start_server(handle).await;
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
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::app::update_reminder_settings,
            commands::app::update_sync_settings,
            commands::app::trigger_sync,
            commands::nostr::verify_nsec,
            commands::nostr::parse_pubkey,
            commands::nostr::generate_new_nsec,
            commands::nostr::fetch_calendar_events,
            commands::nostr::publish_calendar_event,
            commands::nostr::publish_batch_calendar_events,
            commands::nostr::delete_calendar_event,
            commands::nostr::fetch_contact_list,
            commands::nostr::update_contact_list,
            commands::nostr::fetch_profiles,
            commands::nostr::send_direct_message,
            commands::nostr::fetch_calendars,
            commands::nostr::publish_calendar,
            commands::nostr::delete_calendar,
            commands::nostr::fetch_rsvps,
            commands::nostr::fetch_user_rsvps,
            commands::nostr::fetch_received_rsvps,
            commands::nostr::publish_rsvp
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
