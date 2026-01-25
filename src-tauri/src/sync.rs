#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncSettings {
    pub local_relay: Option<String>,
    pub remote_relays: Vec<String>,
    pub pubkey: Option<String>,
    pub interval_minutes: u64,
    pub enabled: bool,
    pub relay_enabled: bool,
    pub relay_port: u16,
    pub relay_allowed_kinds: Vec<u16>,
    pub relay_allowed_pubkeys: Vec<String>,
    pub relay_allowed_tagged_pubkeys: Vec<String>,
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
            interval_minutes: 5,
            enabled: false,
            relay_enabled: true,
            relay_port: 4870,
            relay_allowed_kinds: Vec::new(),
            relay_allowed_pubkeys: Vec::new(),
            relay_allowed_tagged_pubkeys: Vec::new(),
            only_contacts: true,
            last_sync_timestamp: None,
            interested_contact_pubkeys: Vec::new(),
        }
    }
}
