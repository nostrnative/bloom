use nostr_sdk::prelude::*;
use std::borrow::Cow;
use std::time::Duration;

use super::models::EventResponse;
use super::utils::{get_client, get_prioritized_relays, parse_public_key};
use crate::SyncSettingsState;

#[tauri::command]
pub async fn fetch_rsvps(
    event_coordinate: String,
    relays: Vec<String>,
    sync_settings_state: tauri::State<'_, SyncSettingsState>,
) -> Result<Vec<EventResponse>, String> {
    let prioritized_relays = get_prioritized_relays(&sync_settings_state, &relays).await;
    let keys = Keys::generate();
    let client = get_client(&keys, &prioritized_relays).await?;

    // Try to determine if input is an ID or coordinate
    let filter = if event_coordinate.contains(':') {
        Filter::new()
            .kind(Kind::from(31925))
            .custom_tag(SingleLetterTag::lowercase(Alphabet::A), event_coordinate)
    } else {
        // Assume it's an event ID
        if let Ok(event_id) = EventId::from_hex(&event_coordinate) {
            Filter::new().kind(Kind::from(31925)).event(event_id)
        } else {
            return Err("Invalid event ID".to_string());
        }
    };

    let events = client
        .fetch_events(filter, Duration::from_secs(10))
        .await
        .map_err(|e| e.to_string())?;

    let response = events
        .into_iter()
        .map(|e| EventResponse {
            id: e.id.to_hex(),
            pubkey: e.pubkey.to_hex(),
            created_at: e.created_at.as_secs() as i64,
            kind: e.kind.as_u16(),
            tags: e.tags.iter().map(|t| t.clone().to_vec()).collect(),
            content: e.content.to_string(),
            is_private: false,
        })
        .collect();

    Ok(response)
}

#[tauri::command]
pub async fn fetch_user_rsvps(
    pubkey: String,
    relays: Vec<String>,
    sync_settings_state: tauri::State<'_, SyncSettingsState>,
) -> Result<Vec<EventResponse>, String> {
    let prioritized_relays = get_prioritized_relays(&sync_settings_state, &relays).await;
    let pk = parse_public_key(&pubkey)?;

    // Use ephemeral keys for reading
    let keys = Keys::generate();
    let client = get_client(&keys, &prioritized_relays).await?;

    let filter = Filter::new().kind(Kind::from(31925)).author(pk).limit(1000);

    let events = client
        .fetch_events(filter, Duration::from_secs(10))
        .await
        .map_err(|e| e.to_string())?;

    let response = events
        .into_iter()
        .map(|e| EventResponse {
            id: e.id.to_hex(),
            pubkey: e.pubkey.to_hex(),
            created_at: e.created_at.as_secs() as i64,
            kind: e.kind.as_u16(),
            tags: e.tags.iter().map(|t| t.clone().to_vec()).collect(),
            content: e.content.to_string(),
            is_private: false,
        })
        .collect();

    Ok(response)
}

#[tauri::command]
pub async fn fetch_received_rsvps(
    pubkey: String,
    relays: Vec<String>,
    sync_settings_state: tauri::State<'_, SyncSettingsState>,
) -> Result<Vec<EventResponse>, String> {
    let prioritized_relays = get_prioritized_relays(&sync_settings_state, &relays).await;
    let pk = parse_public_key(&pubkey)?;

    // Use ephemeral keys for reading
    let keys = Keys::generate();
    let client = get_client(&keys, &prioritized_relays).await?;

    let filter = Filter::new().kind(Kind::from(31925)).pubkey(pk).limit(1000);

    let events = client
        .fetch_events(filter, Duration::from_secs(10))
        .await
        .map_err(|e| e.to_string())?;

    let response = events
        .into_iter()
        .map(|e| EventResponse {
            id: e.id.to_hex(),
            pubkey: e.pubkey.to_hex(),
            created_at: e.created_at.as_secs() as i64,
            kind: e.kind.as_u16(),
            tags: e.tags.iter().map(|t| t.clone().to_vec()).collect(),
            content: e.content.to_string(),
            is_private: false,
        })
        .collect();

    Ok(response)
}

#[tauri::command]
pub async fn publish_rsvp(
    nsec: String,
    relays: Vec<String>,
    event_coordinate: String,
    status: String,
    event_author: Option<String>,
) -> Result<String, String> {
    let keys = Keys::parse(&nsec).map_err(|e| e.to_string())?;
    let client = get_client(&keys, &relays).await?;

    let mut tags = Vec::new();

    // Check if it's a coordinate or ID
    if event_coordinate.contains(':') {
        tags.push(Tag::custom(
            TagKind::Custom(Cow::Borrowed("a")),
            vec![event_coordinate],
        ));
    } else {
        tags.push(Tag::custom(
            TagKind::Custom(Cow::Borrowed("e")),
            vec![event_coordinate],
        ));
    }

    tags.push(Tag::custom(
        TagKind::Custom(Cow::Borrowed("status")),
        vec![status],
    ));

    if let Some(author) = event_author {
        tags.push(Tag::custom(
            TagKind::Custom(Cow::Borrowed("p")),
            vec![author],
        ));
    }

    // Add identifier (d tag)
    let identifier = Keys::generate().public_key().to_hex();
    tags.push(Tag::identifier(identifier));

    let event_builder = EventBuilder::new(Kind::from(31925), "").tags(tags);

    let event_id = client
        .send_event_builder(event_builder)
        .await
        .map_err(|e| e.to_string())?;

    Ok(event_id.to_hex())
}
