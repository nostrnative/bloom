use nostr_sdk::prelude::*;
use std::time::Duration;

use super::models::{Contact, UserProfile};
use super::utils::{get_client, get_prioritized_relays, parse_public_key};
use crate::SyncSettingsState;

#[tauri::command]
pub async fn fetch_profiles(
    pubkeys: Vec<String>,
    relays: Vec<String>,
    sync_settings_state: tauri::State<'_, SyncSettingsState>,
) -> Result<Vec<UserProfile>, String> {
    let prioritized_relays = get_prioritized_relays(&sync_settings_state, &relays).await;
    let mut pks = Vec::new();
    for pk in pubkeys {
        if let Ok(p) = parse_public_key(&pk) {
            pks.push(p);
        }
    }

    if pks.is_empty() {
        return Ok(Vec::new());
    }

    let ephemeral_keys = Keys::generate();
    let client = get_client(&ephemeral_keys, &prioritized_relays).await?;

    let filter = Filter::new().authors(pks).kind(Kind::Metadata);

    let events = client
        .fetch_events(filter, Duration::from_secs(10))
        .await
        .map_err(|e| e.to_string())?;

    let mut profiles = Vec::new();
    for event in events {
        if let Ok(content) = serde_json::from_str::<serde_json::Value>(&event.content) {
            profiles.push(UserProfile {
                pubkey: event.pubkey.to_hex(),
                name: content["name"].as_str().map(|s| s.to_string()),
                display_name: content["display_name"].as_str().map(|s| s.to_string()),
                about: content["about"].as_str().map(|s| s.to_string()),
                picture: content["picture"].as_str().map(|s| s.to_string()),
                banner: content["banner"].as_str().map(|s| s.to_string()),
                website: content["website"].as_str().map(|s| s.to_string()),
                nip05: content["nip05"].as_str().map(|s| s.to_string()),
            });
        }
    }

    Ok(profiles)
}

#[tauri::command]
pub async fn fetch_contact_list(
    pubkey: String,
    relays: Vec<String>,
    sync_settings_state: tauri::State<'_, SyncSettingsState>,
) -> Result<Vec<Contact>, String> {
    let public_key = parse_public_key(&pubkey)?;
    let prioritized_relays = get_prioritized_relays(&sync_settings_state, &relays).await;
    let ephemeral_keys = Keys::generate();
    let client = get_client(&ephemeral_keys, &prioritized_relays).await?;

    let filter = Filter::new()
        .authors(vec![public_key])
        .kind(Kind::ContactList);

    let events = client
        .fetch_events(filter, Duration::from_secs(10))
        .await
        .map_err(|e| e.to_string())?;

    let mut events: Vec<_> = events.into_iter().collect();

    // Sort by created_at descending to get the most recent
    events.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    if let Some(event) = events.first() {
        let contacts: Vec<Contact> = event
            .tags
            .iter()
            .filter_map(|tag| {
                let t = tag.clone().to_vec();
                if t.len() >= 2 && t[0] == "p" {
                    let pubkey = t[1].clone();
                    let alias = if t.len() >= 4 {
                        Some(t[3].clone())
                    } else {
                        None
                    };
                    Some(Contact { pubkey, alias })
                } else {
                    None
                }
            })
            .collect();
        Ok(contacts)
    } else {
        // If no contact list found (Kind 3), return empty list
        // NIP-02 says: "If a user has no contact list, it should be treated as an empty list."
        Ok(Vec::new())
    }
}

#[tauri::command]
pub async fn update_contact_list(
    nsec: String,
    relays: Vec<String>,
    contacts: Vec<Contact>,
) -> Result<String, String> {
    let keys = Keys::parse(&nsec).map_err(|e| e.to_string())?;
    let client = get_client(&keys, &relays).await?;

    let mut tags = Vec::new();
    let mut seen_pubkeys = std::collections::HashSet::new();

    for contact in contacts {
        if let Ok(pubkey) = parse_public_key(&contact.pubkey) {
            let hex = pubkey.to_hex();

            if seen_pubkeys.contains(&hex) {
                continue;
            }
            seen_pubkeys.insert(hex.clone());

            tags.push(
                Tag::parse(vec![
                    "p".to_string(),
                    hex,
                    "".to_string(),
                    contact.alias.unwrap_or_default(),
                ])
                .map_err(|e| e.to_string())?,
            );
        }
    }

    let event_builder = EventBuilder::new(Kind::ContactList, "").tags(tags);

    let event_id = client
        .send_event_builder(event_builder)
        .await
        .map_err(|e| e.to_string())?;

    Ok(event_id.to_hex())
}
