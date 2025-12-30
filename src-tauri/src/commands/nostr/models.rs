use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
pub struct CalendarEventRequest {
    pub title: String,
    pub description: Option<String>,
    pub start: i64,
    pub end: Option<i64>,
    pub location: Option<String>,
    pub is_all_day: bool,
    pub identifier: String, // d-tag
    pub reminder_minutes: Option<i64>,
    pub old_event_id: Option<String>,
    pub calendar_id: Option<String>,
    pub color: Option<String>,
    pub p_tags: Option<Vec<String>>,
    pub is_private: Option<bool>,
    pub parent: Option<String>,
    pub freq: Option<String>,
    pub until: Option<i64>,
    pub use_different_timestamp: Option<bool>,
}

#[derive(Deserialize, Debug)]
pub struct CalendarRequest {
    pub name: String,
    pub description: Option<String>,
    pub identifier: String, // d-tag
}

#[derive(Serialize, Deserialize)]
pub struct Contact {
    pub pubkey: String,
    pub alias: Option<String>,
}

#[derive(Serialize)]
pub struct UserProfile {
    pub pubkey: String,
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub about: Option<String>,
    pub picture: Option<String>,
    pub banner: Option<String>,
    pub website: Option<String>,
    pub nip05: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct EventResponse {
    pub id: String,
    pub pubkey: String,
    pub created_at: i64,
    pub kind: u16,
    pub tags: Vec<Vec<String>>,
    pub content: String,
    pub is_private: bool,
}
