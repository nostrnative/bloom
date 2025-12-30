use tauri::State;
use crate::SyncSettingsState;

#[tauri::command]
pub async fn update_reminder_settings(settings: serde_json::Value) -> Result<String, String> {
    // For now, just return success. This can be implemented later.
    tracing::info!("Reminder settings updated: {:?}", settings);
    Ok("Reminder settings updated".to_string())
}

#[tauri::command]
pub async fn update_sync_settings(
    settings: serde_json::Value,
    sync_settings_state: State<'_, SyncSettingsState>,
) -> Result<String, String> {
    // Update the sync settings state
    if let Some(enabled) = settings.get("enabled").and_then(|v| v.as_bool()) {
        let mut settings_guard = sync_settings_state.settings.write().await;
        settings_guard.enabled = enabled;
        tracing::info!("Sync settings updated: enabled={}", enabled);
    }
    Ok("Sync settings updated".to_string())
}

#[tauri::command]
pub async fn trigger_sync() -> Result<String, String> {
    // For now, just return success. This can be implemented later.
    tracing::info!("Manual sync triggered");
    Ok("Sync triggered".to_string())
}