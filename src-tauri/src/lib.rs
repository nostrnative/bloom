mod commands;
mod http_server;
mod mobile;
mod storage;
mod sync;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use std::sync::Arc;
use sync::SyncSettings;
#[cfg(desktop)]
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
        .manage(SyncSettingsState {
            settings: Arc::new(RwLock::new(SyncSettings::default())),
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_nostrnative::init())
        .setup(|_app| {
            #[cfg(desktop)]
            {
                use tauri::image::Image;
                use tauri::menu::{MenuBuilder, MenuItemBuilder};
                use tauri::tray::TrayIconBuilder;

                let show = MenuItemBuilder::with_id("show", "Show Bloom").build(_app)?;
                let quit = MenuItemBuilder::with_id("quit", "Quit Bloom").build(_app)?;
                let menu = MenuBuilder::new(_app).items(&[&show, &quit]).build()?;

                let icon = Image::from_path("icons/blostr-transparent.png").unwrap_or_else(|_| {
                    Image::from_bytes(include_bytes!("../icons/blostr-transparent.png"))
                        .expect("failed to load tray icon")
                });

                TrayIconBuilder::new()
                    .icon(icon)
                    .menu(&menu)
                    .tooltip("Bloom")
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                #[cfg(target_os = "macos")]
                                let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .build(_app)?;
            }

            Ok(())
        })
        .on_window_event(|_window, _event| {
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = _event {
                let _ = _window.hide();
                #[cfg(target_os = "macos")]
                let _ = _window
                    .app_handle()
                    .set_activation_policy(tauri::ActivationPolicy::Accessory);
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            http_server::get_server_port,
            commands::app::start_blossom_server,
            commands::app::start_relay_service,
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
                .unwrap_or_else(|_| "bloom=debug,tower_http=debug,axum=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
}
