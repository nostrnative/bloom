use crate::SyncSettingsState;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_nostrnative::relay::RelaySettings;

#[tauri::command]
pub async fn update_reminder_settings(settings: serde_json::Value) -> Result<String, String> {
    // For now, just return success. This can be implemented later.
    tracing::info!("Reminder settings updated: {:?}", settings);
    Ok("Reminder settings updated".to_string())
}

#[tauri::command]
pub async fn start_blossom_server(handle: AppHandle, port: u16) -> Result<u16, String> {
    crate::http_server::start_server(handle, port).await
}

#[tauri::command]
pub async fn start_relay_service(
    handle: AppHandle,
    port: u16,
    sync_settings_state: State<'_, SyncSettingsState>,
) -> Result<u16, String> {
    let (pubkey, kinds, allowed_pubkeys, tagged_pubkeys, enable_search) = {
        let settings_guard = sync_settings_state.settings.read().await;
        (
            settings_guard.pubkey.clone(),
            settings_guard.relay_allowed_kinds.clone(),
            settings_guard.relay_allowed_pubkeys.clone(),
            settings_guard.relay_allowed_tagged_pubkeys.clone(),
            settings_guard.relay_enable_search,
        )
    };

    let relay_dir = handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("relay");

    let _ = std::fs::create_dir_all(&relay_dir);
    let db_path = relay_dir.to_string_lossy().to_string();

    let settings = RelaySettings {
        relay_allowed_kinds: Some(kinds),
        relay_allowed_pubkeys: Some(allowed_pubkeys),
        relay_allowed_tagged_pubkeys: Some(tagged_pubkeys),
        relay_enable_search: Some(enable_search),
    };

    // Use stop_relay_core as a way to ensure we can start fresh if needed,
    // or just let start_relay_core handle its internal state.
    // If start_relay_core fails with "already running", we'll treat it as success.

    // Proactively stop the relay to clear any existing lock or handle.
    let _ = tauri_plugin_nostrnative::relay::stop_relay_core().await;
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    match tauri_plugin_nostrnative::relay::start_relay_core(
        port,
        &db_path,
        pubkey.as_deref(),
        Some(settings),
    )
    .await
    {
        Ok(_) => {
            let mut settings_guard = sync_settings_state.settings.write().await;
            settings_guard.relay_port = port;
            settings_guard.relay_enabled = true;
            Ok(port)
        }
        Err(e) => {
            tracing::error!("Relay start error: {}", e);
            let err_msg = e.to_lowercase();
            // EXPLICIT check for "address already in use" and "os error 48"
            if err_msg.contains("already running")
                || err_msg.contains("address already in use")
                || err_msg.contains("addrinuse")
                || err_msg.contains("os error 48")
                || err_msg.contains("code: 48")
            {
                Err("PORT_IN_USE".to_string())
            } else {
                Err(e)
            }
        }
    }
}

#[tauri::command]
pub async fn toggle_relay(
    handle: AppHandle,
    enabled: bool,
    port: u16,
    sync_settings_state: State<'_, SyncSettingsState>,
) -> Result<String, String> {
    if enabled {
        let _ = start_relay_service(handle, port, sync_settings_state).await?;
        Ok("Relay started".to_string())
    } else {
        let mut settings_guard = sync_settings_state.settings.write().await;
        settings_guard.relay_enabled = false;
        tracing::info!("Stopping relay");
        let _ = tauri_plugin_nostrnative::relay::stop_relay_core().await;
        Ok("Relay stopped".to_string())
    }
}

#[tauri::command]
pub async fn update_sync_settings(
    handle: AppHandle,
    settings: serde_json::Value,
    sync_settings_state: State<'_, SyncSettingsState>,
) -> Result<String, String> {
    // Update the sync settings state and detect if relay settings changed
    let relay_needs_restart = {
        let mut settings_guard = sync_settings_state.settings.write().await;
        let mut changed = false;

        if let Some(enabled) = settings.get("enabled").and_then(|v| v.as_bool()) {
            settings_guard.enabled = enabled;
            tracing::info!("Sync settings updated: enabled={}", enabled);
        }
        if let Some(relay_enabled) = settings.get("relay_enabled").and_then(|v| v.as_bool()) {
            if settings_guard.relay_enabled != relay_enabled {
                settings_guard.relay_enabled = relay_enabled;
                changed = true;
            }
        }
        if let Some(relay_port) = settings.get("relay_port").and_then(|v| v.as_u64()) {
            let new_port = relay_port as u16;
            if settings_guard.relay_port != new_port {
                settings_guard.relay_port = new_port;
                changed = true;
            }
        }
        if let Some(relay_enable_search) = settings.get("relay_enable_search").and_then(|v| v.as_bool()) {
            if settings_guard.relay_enable_search != relay_enable_search {
                settings_guard.relay_enable_search = relay_enable_search;
                changed = true;
            }
        }
        if let Some(kinds) = settings
            .get("relay_allowed_kinds")
            .and_then(|v| v.as_array())
        {
            let new_kinds: Vec<u16> = kinds
                .iter()
                .filter_map(|v| v.as_u64().map(|k| k as u16))
                .collect();
            if settings_guard.relay_allowed_kinds != new_kinds {
                settings_guard.relay_allowed_kinds = new_kinds;
                changed = true;
            }
        }
        if let Some(pubkeys) = settings
            .get("relay_allowed_pubkeys")
            .and_then(|v| v.as_array())
        {
            let new_pubkeys: Vec<String> = pubkeys
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();
            if settings_guard.relay_allowed_pubkeys != new_pubkeys {
                settings_guard.relay_allowed_pubkeys = new_pubkeys;
                changed = true;
            }
        }
        if let Some(tagged) = settings
            .get("relay_allowed_tagged_pubkeys")
            .and_then(|v| v.as_array())
        {
            let new_tagged: Vec<String> = tagged
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();
            if settings_guard.relay_allowed_tagged_pubkeys != new_tagged {
                settings_guard.relay_allowed_tagged_pubkeys = new_tagged;
                changed = true;
            }
        }
        changed && settings_guard.relay_enabled
    };

    // After updating state, if relay needs restart, apply new policies
    if relay_needs_restart {
        let (port, pubkey, kinds, allowed_pubkeys, tagged_pubkeys, enable_search) = {
            let s = sync_settings_state.settings.read().await;
            (
                s.relay_port,
                s.pubkey.clone(),
                s.relay_allowed_kinds.clone(),
                s.relay_allowed_pubkeys.clone(),
                s.relay_allowed_tagged_pubkeys.clone(),
                s.relay_enable_search,
            )
        };

        tracing::info!("Restarting relay to apply new settings on port {}", port);
        let _ = tauri_plugin_nostrnative::relay::stop_relay_core().await;
        // Give it a moment to release the port
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        let relay_dir = handle
            .path()
            .app_local_data_dir()
            .map_err(|e| e.to_string())?
            .join("relay");
        let db_path = relay_dir.to_string_lossy().to_string();

        let relay_settings = RelaySettings {
            relay_allowed_kinds: Some(kinds),
            relay_allowed_pubkeys: Some(allowed_pubkeys),
            relay_allowed_tagged_pubkeys: Some(tagged_pubkeys),
            relay_enable_search: Some(enable_search),
        };

        let _ = tauri_plugin_nostrnative::relay::start_relay_core(
            port,
            &db_path,
            pubkey.as_deref(),
            Some(relay_settings),
        )
        .await;
    }

    Ok("Sync settings updated".to_string())
}

#[tauri::command]
pub async fn trigger_sync() -> Result<String, String> {
    // For now, just return success. This can be implemented later.
    tracing::info!("Manual sync triggered");
    Ok("Sync triggered".to_string())
}

#[tauri::command]
pub async fn clear_blossom_content(handle: AppHandle) -> Result<String, String> {
    let storage_dir = handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("storage");

    if storage_dir.exists() {
        std::fs::remove_dir_all(&storage_dir).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&storage_dir).map_err(|e| e.to_string())?;
    }
    tracing::info!("Blossom content cleared");
    Ok("Blossom content cleared".to_string())
}

#[tauri::command]
pub async fn clear_relay_content(handle: AppHandle) -> Result<String, String> {
    let _ = tauri_plugin_nostrnative::relay::stop_relay_core().await;

    let relay_dir = handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("relay");

    if relay_dir.exists() {
        std::fs::remove_dir_all(&relay_dir).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&relay_dir).map_err(|e| e.to_string())?;
    }

    tracing::info!("Relay content cleared");
    Ok("Relay content cleared".to_string())
}
