use crate::SyncSettingsState;
use nostr_sdk::prelude::*;

pub fn parse_public_key(pk: &str) -> Result<PublicKey, String> {
    match PublicKey::from_hex(pk) {
        Ok(p) => Ok(p),
        Err(_) => PublicKey::from_bech32(pk).map_err(|e| e.to_string()),
    }
}

pub async fn get_client(keys: &Keys, relays: &[String]) -> Result<Client, String> {
    let client = Client::new(keys.clone());
    for relay in relays {
        client.add_relay(relay).await.map_err(|e| e.to_string())?;
    }
    client.connect().await;
    Ok(client)
}

pub async fn get_prioritized_relays(
    sync_settings_state: &tauri::State<'_, SyncSettingsState>,
    relays: &[String],
) -> Vec<String> {
    let settings = sync_settings_state.settings.read().await;
    if let (Some(local_relay), true) = (settings.local_relay.clone(), settings.enabled) {
        let mut result = vec![local_relay.clone()];
        result.extend(relays.iter().filter(|r| *r != &local_relay).cloned());
        result
    } else {
        relays.to_vec()
    }
}
