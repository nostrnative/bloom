use nostr_sdk::prelude::*;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tokio::sync::RwLock;

const SYNC_KINDS: &[u16] = &[31922, 31923, 31924, 31925, 5, 3, 0];

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

#[derive(Clone, Default)]
struct RelaySyncState {
    local_last_synced: Option<u64>,
    remote_last_synced: Option<u64>,
}

#[derive(Clone)]
pub struct SyncManager {
    settings: Arc<RwLock<SyncSettings>>,
    relay_states: Arc<RwLock<HashMap<String, RelaySyncState>>>,
}

impl SyncManager {
    pub fn new() -> Self {
        Self {
            settings: Arc::new(RwLock::new(SyncSettings::default())),
            relay_states: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn update_settings(&self, new_settings: SyncSettings) {
        let mut settings = self.settings.write().await;
        *settings = new_settings;
    }

    pub async fn manual_sync(&self, app: AppHandle) -> Result<(), String> {
        let current_settings = self.settings.read().await.clone();

        if !current_settings.enabled {
            return Err("Sync is disabled".to_string());
        }
        if current_settings.local_relay.is_none() {
            return Err("Local relay not configured".to_string());
        }
        if current_settings.pubkey.is_none() || current_settings.nsec.is_none() {
            return Err("Nostr credentials not configured".to_string());
        }

        let local_relay = current_settings.local_relay.unwrap();
        let remote_relays = current_settings.remote_relays;
        let pubkey_str = current_settings.pubkey.unwrap();
        let nsec = current_settings.nsec.unwrap();
        let interested_pks = current_settings.interested_contact_pubkeys;

        let public_key = PublicKey::from_hex(&pubkey_str).map_err(|e| e.to_string())?;
        let interested_public_keys: Vec<PublicKey> = interested_pks
            .iter()
            .filter_map(|pk| PublicKey::from_hex(pk).ok())
            .collect();

        self.perform_bidirectional_sync(
            &app,
            &local_relay,
            &remote_relays,
            &nsec,
            public_key,
            interested_public_keys,
        )
        .await
    }

    pub async fn run_loop(&self, _app: AppHandle) {
        let mut interval = tokio::time::interval(Duration::from_secs(60));

        loop {
            interval.tick().await;
            let current_settings = self.settings.read().await.clone();

            if !current_settings.enabled
                || current_settings.local_relay.is_none()
                || current_settings.pubkey.is_none()
                || current_settings.nsec.is_none()
            {
                continue;
            }

            let local_relay = current_settings.local_relay.unwrap();
            let remote_relays = current_settings.remote_relays;
            let pubkey_str = current_settings.pubkey.unwrap();
            let nsec = current_settings.nsec.unwrap();
            let interested_pks = current_settings.interested_contact_pubkeys;

            let desired_duration = Duration::from_secs(current_settings.interval_minutes * 60);
            if interval.period() != desired_duration && desired_duration.as_secs() > 0 {
                interval = tokio::time::interval(desired_duration);
                interval.tick().await;
            }

            if let Ok(public_key) = PublicKey::from_hex(&pubkey_str) {
                let interested_public_keys: Vec<PublicKey> = interested_pks
                    .iter()
                    .filter_map(|pk| PublicKey::from_hex(pk).ok())
                    .collect();

                let _ = self
                    .perform_bidirectional_sync(
                        &_app,
                        &local_relay,
                        &remote_relays,
                        &nsec,
                        public_key,
                        interested_public_keys,
                    )
                    .await;
            }
        }
    }

    async fn perform_bidirectional_sync(
        &self,
        app: &AppHandle,
        local_relay: &str,
        remote_relays: &[String],
        nsec: &str,
        public_key: PublicKey,
        interested_contact_pubkeys: Vec<PublicKey>,
    ) -> Result<(), String> {
        let local_available = self.check_relay_available(local_relay).await;
        let mut max_timestamp = 0;

        // 1. Fetch contact list from ANY available relay first
        let mut all_relays_to_check = vec![local_relay.to_string()];
        all_relays_to_check.extend(remote_relays.iter().cloned());

        let ephemeral_keys = Keys::generate();
        let client = self
            .get_client_with_keys(&ephemeral_keys, &all_relays_to_check)
            .await?;

        let mut contact_pks = std::collections::HashSet::new();
        // Always include interested contacts
        for pk in interested_contact_pubkeys {
            contact_pks.insert(pk);
        }

        let contact_list_filter = Filter::new()
            .author(public_key)
            .kind(Kind::ContactList)
            .limit(1);

        if let Ok(contact_events) = client
            .fetch_events(contact_list_filter, Duration::from_secs(10))
            .await
        {
            if let Some(event) = contact_events.first() {
                for tag in event.tags.iter() {
                    let t = tag.clone().to_vec();
                    if t.len() >= 2 && t[0] == "p" {
                        if let Ok(pk) = PublicKey::from_hex(&t[1]) {
                            contact_pks.insert(pk);
                        }
                    }
                }
            }
        }
        let contact_pks = Arc::new(contact_pks);

        if local_available {
            let mut states = self.relay_states.write().await;
            states
                .entry(local_relay.to_string())
                .or_insert_with(RelaySyncState::default);
            drop(states);

            let mut success = true;
            let mut current_ts = 0;

            match self
                .sync_local_to_remotes(
                    local_relay,
                    remote_relays,
                    nsec,
                    public_key,
                    contact_pks.clone(),
                )
                .await
            {
                Ok(ts) => current_ts = current_ts.max(ts),
                Err(_) => success = false,
            }

            for remote_relay in remote_relays {
                match self
                    .sync_missing_to_local(
                        local_relay,
                        remote_relay,
                        nsec,
                        public_key,
                        local_available,
                        contact_pks.clone(),
                    )
                    .await
                {
                    Ok(ts) => current_ts = current_ts.max(ts),
                    Err(_) => success = false,
                }
            }

            if success {
                max_timestamp = current_ts;
            }
        } else {
            let remote_available = self.check_any_remote_available(remote_relays).await;
            if remote_available {
                for remote_relay in remote_relays {
                    if let Ok(ts) = self
                        .fetch_from_remote_to_cache(
                            remote_relay,
                            nsec,
                            public_key,
                            contact_pks.clone(),
                        )
                        .await
                    {
                        max_timestamp = max_timestamp.max(ts);
                    }
                }
            }
        }

        if max_timestamp > 0 {
            let mut settings = self.settings.write().await;
            settings.last_sync_timestamp = Some(max_timestamp);
            use tauri::Emitter;
            let _ = app.emit("sync-completed", max_timestamp);
        }

        Ok(())
    }

    async fn check_relay_available(&self, relay_url: &str) -> bool {
        let keys = Keys::generate();
        let client = Client::new(keys);

        if client.add_relay(relay_url).await.is_ok() {
            client.connect().await;

            let timeout = Duration::from_secs(3);
            tokio::time::timeout(timeout, async {
                let filter = Filter::new().kind(Kind::Metadata).limit(1);
                client.fetch_events(filter, Duration::from_secs(2)).await
            })
            .await
            .is_ok()
        } else {
            false
        }
    }

    async fn check_any_remote_available(&self, relays: &[String]) -> bool {
        for relay in relays {
            if self.check_relay_available(relay).await {
                return true;
            }
        }
        false
    }

    async fn sync_local_to_remotes(
        &self,
        local_relay: &str,
        remote_relays: &[String],
        nsec: &str,
        public_key: PublicKey,
        contact_pks: Arc<std::collections::HashSet<PublicKey>>,
    ) -> Result<u64, String> {
        let keys = Keys::parse(nsec).map_err(|e| e.to_string())?;
        let mut max_ts = 0;

        let (local_events, _) = self
            .fetch_events_with_last_synced(
                local_relay,
                &public_key,
                local_relay,
                contact_pks.clone(),
            )
            .await?;

        for event in &local_events {
            max_ts = max_ts.max(event.created_at.as_secs());
        }

        let local_events_map: HashMap<String, Event> = local_events
            .into_iter()
            .filter(|e| SYNC_KINDS.contains(&e.kind.as_u16()))
            .map(|e| (e.id.to_hex(), e))
            .collect();

        for remote_relay in remote_relays {
            {
                let mut states = self.relay_states.write().await;
                states
                    .entry(remote_relay.to_string())
                    .or_insert_with(RelaySyncState::default);
            }

            let (remote_events, _) = self
                .fetch_events_with_last_synced(
                    remote_relay,
                    &public_key,
                    remote_relay,
                    contact_pks.clone(),
                )
                .await?;

            for event in &remote_events {
                max_ts = max_ts.max(event.created_at.as_secs());
            }

            let remote_ids: std::collections::HashSet<String> =
                remote_events.iter().map(|e| e.id.to_hex()).collect();

            let missing: Vec<Event> = local_events_map
                .values()
                .filter(|e| !remote_ids.contains(&e.id.to_hex()))
                .cloned()
                .collect();

            if !missing.is_empty() {
                let client = self
                    .get_client_with_keys(&keys, &[remote_relay.to_string()])
                    .await?;
                for event in &missing {
                    let _ = client.send_event(event).await;
                }

                let mut states = self.relay_states.write().await;
                if let Some(state) = states.get_mut(remote_relay) {
                    state.local_last_synced = Some(Timestamp::now().as_secs());
                }
            }
        }

        let mut states = self.relay_states.write().await;
        if let Some(state) = states.get_mut(local_relay) {
            state.local_last_synced = Some(Timestamp::now().as_secs());
        }

        Ok(max_ts)
    }

    async fn sync_missing_to_local(
        &self,
        local_relay: &str,
        remote_relay: &str,
        nsec: &str,
        public_key: PublicKey,
        local_available: bool,
        contact_pks: Arc<std::collections::HashSet<PublicKey>>,
    ) -> Result<u64, String> {
        if !local_available {
            return Ok(0);
        }

        let keys = Keys::parse(nsec).map_err(|e| e.to_string())?;
        let mut max_ts = 0;

        let (local_events, _) = self
            .fetch_events_with_last_synced(
                local_relay,
                &public_key,
                local_relay,
                contact_pks.clone(),
            )
            .await?;

        for event in &local_events {
            max_ts = max_ts.max(event.created_at.as_secs());
        }

        let (remote_events, _) = self
            .fetch_events_with_last_synced(
                remote_relay,
                &public_key,
                remote_relay,
                contact_pks.clone(),
            )
            .await?;

        for event in &remote_events {
            max_ts = max_ts.max(event.created_at.as_secs());
        }

        let local_ids: std::collections::HashSet<String> =
            local_events.iter().map(|e| e.id.to_hex()).collect();

        let remote_events_map: HashMap<String, Event> = remote_events
            .into_iter()
            .map(|e| (e.id.to_hex(), e))
            .collect();

        let missing: Vec<Event> = remote_events_map
            .values()
            .filter(|e| !local_ids.contains(&e.id.to_hex()))
            .cloned()
            .collect();

        if !missing.is_empty() {
            let client = self
                .get_client_with_keys(&keys, &[local_relay.to_string()])
                .await?;
            for event in &missing {
                let _ = client.send_event(event).await;
            }

            let mut states = self.relay_states.write().await;
            if let Some(state) = states.get_mut(local_relay) {
                state.remote_last_synced = Some(Timestamp::now().as_secs());
            }
        }

        Ok(max_ts)
    }

    async fn fetch_relay_events(
        &self,
        client: &Client,
        public_key: &PublicKey,
        last_sync_timestamp: Option<u64>,
        contact_pks: Arc<std::collections::HashSet<PublicKey>>,
    ) -> Result<Vec<Event>, String> {
        let mut authors = vec![*public_key];
        authors.extend(contact_pks.iter().cloned());

        let mut sync_filter = Filter::new()
            .authors(authors)
            .kinds(SYNC_KINDS.iter().map(|&k| Kind::from(k)));

        let mut invite_filter = Filter::new()
            .kinds([Kind::from(31922), Kind::from(31923)])
            .pubkey(*public_key);

        if let Some(since) = last_sync_timestamp {
            sync_filter = sync_filter.since(Timestamp::from(since));
            invite_filter = invite_filter.since(Timestamp::from(since));
        }

        let mut events: Vec<Event> = client
            .fetch_events(sync_filter, Duration::from_secs(20))
            .await
            .map_err(|e| e.to_string())?
            .into_iter()
            .collect();

        if let Ok(invites) = client
            .fetch_events(invite_filter, Duration::from_secs(10))
            .await
        {
            events.extend(invites);
        }

        Ok(events)
    }

    async fn fetch_events_with_last_synced(
        &self,
        relay_url: &str,
        public_key: &PublicKey,
        _relay_id: &str,
        contact_pks: Arc<std::collections::HashSet<PublicKey>>,
    ) -> Result<(Vec<Event>, Option<u64>), String> {
        let keys = Keys::generate();
        let client = self
            .get_client_with_keys(&keys, &[relay_url.to_string()])
            .await?;

        let settings = self.settings.read().await.clone();
        let events = self
            .fetch_relay_events(
                &client,
                public_key,
                settings.last_sync_timestamp,
                contact_pks,
            )
            .await?;

        Ok((events, settings.last_sync_timestamp))
    }

    async fn fetch_from_remote_to_cache(
        &self,
        relay_url: &str,
        _nsec: &str,
        public_key: PublicKey,
        contact_pks: Arc<std::collections::HashSet<PublicKey>>,
    ) -> Result<u64, String> {
        let keys = Keys::generate();
        let client = self
            .get_client_with_keys(&keys, &[relay_url.to_string()])
            .await?;

        let settings = self.settings.read().await.clone();
        let events = self
            .fetch_relay_events(
                &client,
                &public_key,
                settings.last_sync_timestamp,
                contact_pks,
            )
            .await?;

        let mut max_ts = 0;
        for event in &events {
            max_ts = max_ts.max(event.created_at.as_secs());
        }

        let mut states = self.relay_states.write().await;
        if let Some(state) = states.get_mut(relay_url) {
            state.remote_last_synced = Some(Timestamp::now().as_secs());
        }

        Ok(max_ts)
    }

    async fn get_client_with_keys(&self, keys: &Keys, relays: &[String]) -> Result<Client, String> {
        let client = Client::new(keys.clone());
        for relay in relays {
            client.add_relay(relay).await.map_err(|e| e.to_string())?;
        }
        client.connect().await;
        Ok(client)
    }
}
