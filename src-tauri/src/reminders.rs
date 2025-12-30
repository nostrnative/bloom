use nostr_sdk::prelude::*;
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tokio::sync::RwLock;

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct ReminderSettings {
    pub pubkey: Option<String>,
    pub relays: Vec<String>,
    pub interval_minutes: u64,
    pub enabled: bool,
    pub only_contacts: bool,
}

impl Default for ReminderSettings {
    fn default() -> Self {
        Self {
            pubkey: None,
            relays: Vec::new(),
            interval_minutes: 1,
            enabled: false,
            only_contacts: true,
        }
    }
}

#[derive(Clone)]
pub struct ReminderManager {
    settings: Arc<RwLock<ReminderSettings>>,
    notified_events: Arc<RwLock<HashSet<String>>>,
}

impl ReminderManager {
    pub fn new() -> Self {
        Self {
            settings: Arc::new(RwLock::new(ReminderSettings::default())),
            notified_events: Arc::new(RwLock::new(HashSet::new())),
        }
    }

    pub async fn update_settings(&self, new_settings: ReminderSettings) {
        let mut settings = self.settings.write().await;
        *settings = new_settings;
    }

    pub async fn run_loop(&self, app: AppHandle) {
        let mut interval = tokio::time::interval(Duration::from_secs(60));

        loop {
            interval.tick().await;

            let current_settings = self.settings.read().await.clone();

            if !current_settings.enabled || current_settings.pubkey.is_none() {
                continue;
            }

            let pubkey_str = current_settings.pubkey.unwrap();
            let relays = current_settings.relays;

            let desired_duration = Duration::from_secs(current_settings.interval_minutes * 60);
            if interval.period() != desired_duration && desired_duration.as_secs() > 0 {
                interval = tokio::time::interval(desired_duration);
                interval.tick().await;
            }

            if let Ok(public_key) = PublicKey::from_hex(&pubkey_str) {
                if let Ok(client) = self.get_client(&relays).await {
                    let owned_filter = Filter::new()
                        .authors(vec![public_key])
                        .kinds([Kind::from(31922), Kind::from(31923)]);

                    let invite_filter = Filter::new()
                        .kinds([Kind::from(31922), Kind::from(31923)])
                        .pubkey(public_key);

                    let mut events: Vec<Event> = client
                        .fetch_events(owned_filter, Duration::from_secs(10))
                        .await
                        .unwrap_or_default()
                        .into_iter()
                        .collect();

                    if let Ok(invites) = client
                        .fetch_events(invite_filter, Duration::from_secs(10))
                        .await
                    {
                        events.extend(invites);
                    }

                    if current_settings.only_contacts {
                        let mut contact_pks = HashSet::new();
                        contact_pks.insert(public_key);

                        // Fetch contact list to filter invitations
                        let contact_list_filter = Filter::new()
                            .author(public_key)
                            .kind(Kind::ContactList)
                            .limit(1);

                        if let Ok(contacts) = client
                            .fetch_events(contact_list_filter, Duration::from_secs(5))
                            .await
                        {
                            if let Some(contact_event) = contacts.first() {
                                for tag in contact_event.tags.iter() {
                                    let t = tag.clone().to_vec();
                                    if t.len() >= 2 && t[0] == "p" {
                                        if let Ok(pk) = PublicKey::from_hex(&t[1]) {
                                            contact_pks.insert(pk);
                                        }
                                    }
                                }
                            }
                        }

                        events.retain(|e| {
                            if e.pubkey == public_key {
                                return true;
                            }
                            contact_pks.contains(&e.pubkey)
                        });
                    }

                    if !events.is_empty() {
                        let now = Timestamp::now().as_secs();
                        let mut notified = self.notified_events.write().await;

                        for event in events {
                            let mut start_time: Option<u64> = None;
                            let mut reminder_minutes: Option<u64> = None;
                            let mut title = "Untitled Event".to_string();

                            for tag in event.tags.iter() {
                                let t = tag.clone().to_vec();
                                if t.len() >= 2 {
                                    match t[0].as_str() {
                                        "start" => start_time = t[1].parse().ok(),
                                        "reminder" => reminder_minutes = t[1].parse().ok(),
                                        "title" => title = t[1].clone(),
                                        _ => {}
                                    }
                                }
                            }

                            if let (Some(start), Some(reminder)) = (start_time, reminder_minutes) {
                                let reminder_time = start.saturating_sub(reminder * 60);
                                let event_id = event.id.to_hex();

                                if now >= reminder_time
                                    && now < start + 300
                                    && !notified.contains(&event_id)
                                {
                                    let _ = app
                                        .notification()
                                        .builder()
                                        .title("Event Reminder")
                                        .body(format!(
                                            "'{}' starts in {} minutes!",
                                            title, reminder
                                        ))
                                        .show();

                                    notified.insert(event_id);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    async fn get_client(&self, relays: &[String]) -> Result<Client, String> {
        let keys = Keys::generate();
        let client = Client::new(keys);
        for relay in relays {
            client.add_relay(relay).await.map_err(|e| e.to_string())?;
        }
        client.connect().await;
        Ok(client)
    }
}
