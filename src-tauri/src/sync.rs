use nostr_sdk::prelude::*;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tokio::sync::RwLock;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncSettings {
    pub local_relay: Option<String>,
    pub remote_relays: Vec<String>,
    pub pubkey: Option<String>,
    pub nsec: Option<String>,
    pub interval_minutes: u64,
    pub enabled: bool,
    pub only_contacts: bool,
    pub last_sync_timestamp: Option<u64>,
    pub interested_contact_pubkeys: Vec<String>,
}

impl Default for SyncSettings {
    fn default() -> Self {
        Self {
            local_relay: None,
            remote_relays: Vec::new(),
            pubkey: None,
            nsec: None,
            interval_minutes: 5,
            enabled: false,
            only_contacts: true,
            last_sync_timestamp: None,
            interested_contact_pubkeys: Vec::new(),
        }
    }
}
