use tauri::{AppHandle, Manager, State};
use crate::SyncSettingsState;

#[tauri::command]
pub async fn update_reminder_settings(settings: serde_json::Value) -> Result<String, String> {
    // For now, just return success. This can be implemented later.
    tracing::info!("Reminder settings updated: {:?}", settings);
    Ok("Reminder settings updated".to_string())
}

#[tauri::command]
pub async fn toggle_relay(
    handle: AppHandle,
    enabled: bool,
    port: u16,
    sync_settings_state: State<'_, SyncSettingsState>,
) -> Result<String, String> {
    // Update state
    {
        let mut settings_guard = sync_settings_state.settings.write().await;
        settings_guard.relay_enabled = enabled;
        settings_guard.relay_port = port;
    }

    if enabled {
        let relay_dir = handle
            .path()
            .app_local_data_dir()
            .map_err(|e| e.to_string())?
            .join("relay");

        let _ = std::fs::create_dir_all(&relay_dir);
        let db_path = relay_dir.to_string_lossy().to_string();

        tracing::info!("Starting relay on port {}", port);
        let _ = tauri_plugin_nostrnative::relay::start_relay_core(port, &db_path).await;
        Ok("Relay started".to_string())
    } else {
        tracing::info!("Stopping relay");
        let _ = tauri_plugin_nostrnative::relay::stop_relay_core().await;
        Ok("Relay stopped".to_string())
    }
}

#[tauri::command]
pub async fn update_sync_settings(
    settings: serde_json::Value,
    sync_settings_state: State<'_, SyncSettingsState>,
) -> Result<String, String> {
    // Update the sync settings state
    let mut settings_guard = sync_settings_state.settings.write().await;
    if let Some(enabled) = settings.get("enabled").and_then(|v| v.as_bool()) {
        settings_guard.enabled = enabled;
        tracing::info!("Sync settings updated: enabled={}", enabled);
    }
    if let Some(relay_enabled) = settings.get("relay_enabled").and_then(|v| v.as_bool()) {
        settings_guard.relay_enabled = relay_enabled;
    }
    if let Some(relay_port) = settings.get("relay_port").and_then(|v| v.as_u64()) {
        settings_guard.relay_port = relay_port as u16;
    }
    Ok("Sync settings updated".to_string())
}

#[tauri::command]
pub async fn trigger_sync() -> Result<String, String> {
    // For now, just return success. This can be implemented later.
    tracing::info!("Manual sync triggered");
    Ok("Sync triggered".to_string())
}