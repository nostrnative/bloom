use serde::{Deserialize, Serialize};
use base64::Engine;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizationEvent {
    pub id: String,
    pub pubkey: String,
    pub kind: u64,
    pub content: String,
    pub created_at: u64,
    pub tags: Vec<Vec<String>>,
    pub sig: String,
}

#[derive(Debug, Clone)]
pub struct AuthError {
    pub message: String,
    pub http_status: u16,
}

impl AuthError {
    pub fn new(message: String, http_status: u16) -> Self {
        Self { message, http_status }
    }
}

pub fn parse_authorization_header(header: &str) -> Result<AuthorizationEvent, AuthError> {
    let parts: Vec<&str> = header.splitn(2, ' ').collect();
    if parts.len() != 2 {
        return Err(AuthError::new("Invalid Authorization header format".to_string(), 401));
    }

    let scheme = parts[0];
    if scheme != "Nostr" && scheme != "nostr" {
        return Err(AuthError::new("Invalid authorization scheme".to_string(), 401));
    }

    let base64_data = parts[1];
    let json_bytes = base64::prelude::BASE64_STANDARD
        .decode(base64_data)
        .map_err(|_| AuthError::new("Invalid base64 encoding".to_string(), 401))?;

    let json_str = String::from_utf8(json_bytes)
        .map_err(|_| AuthError::new("Invalid UTF-8 in authorization data".to_string(), 401))?;

    let event: AuthorizationEvent = serde_json::from_str(&json_str)
        .map_err(|e| AuthError::new(format!("Invalid event JSON: {}", e), 401))?;

    Ok(event)
}

pub fn validate_auth_event(
    event: &AuthorizationEvent,
    required_verb: Option<&str>,
    required_hash: Option<&str>,
) -> Result<(), AuthError> {
    if event.kind != 24242 {
        return Err(AuthError::new("Invalid event kind, must be 24242".to_string(), 401));
    }

    let now = chrono::Utc::now().timestamp() as u64;
    if event.created_at > now {
        return Err(AuthError::new("created_at is in the future".to_string(), 401));
    }

    let expiration = event
        .tags
        .iter()
        .find(|tag| tag.len() >= 2 && tag[0] == "expiration")
        .and_then(|tag| tag.get(1))
        .and_then(|s| s.parse::<u64>().ok());

    if let Some(exp) = expiration {
        if exp <= now {
            return Err(AuthError::new("Authorization event has expired".to_string(), 401));
        }
    } else {
        return Err(AuthError::new("Missing expiration tag".to_string(), 401));
    }

    let verb = event
        .tags
        .iter()
        .find(|tag| tag.len() >= 2 && tag[0] == "t")
        .and_then(|tag| tag.get(1));

    if let Some(required) = required_verb {
        if verb.as_ref().map(|s| s.as_str()) != Some(required) {
            return Err(AuthError::new(format!("Invalid verb, expected: {}", required), 401));
        }
    }

    if let Some(required_hash) = required_hash {
        let required_hash_string = required_hash.to_string();
        let has_matching_hash = event
            .tags
            .iter()
            .filter(|tag| tag.len() >= 2 && tag[0] == "x")
            .any(|tag| tag.get(1) == Some(&required_hash_string));

        if !has_matching_hash {
            return Err(AuthError::new(
                "Authorization event missing required x tag matching blob hash".to_string(),
                401,
            ));
        }
    }

    Ok(())
}

pub fn verify_event_signature(_event: &AuthorizationEvent) -> Result<(), AuthError> {
    // TODO: Implement signature verification
    Ok(())
}

pub fn validate_and_verify_auth(
    event: &AuthorizationEvent,
    required_verb: Option<&str>,
    required_hash: Option<&str>,
) -> Result<(), AuthError> {
    validate_auth_event(event, required_verb, required_hash)?;
    verify_event_signature(event)?;
    Ok(())
}
