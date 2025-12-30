use super::utils::parse_public_key;
use nostr_sdk::prelude::*;

#[tauri::command]
pub async fn generate_new_nsec() -> String {
    let keys = Keys::generate();
    keys.secret_key().to_bech32().unwrap()
}

#[tauri::command]
pub async fn parse_pubkey(pubkey: String) -> Result<String, String> {
    let pk = parse_public_key(&pubkey)?;
    Ok(pk.to_hex())
}

#[tauri::command]
pub async fn verify_nsec(nsec: String) -> Result<String, String> {
    let keys = Keys::parse(&nsec).map_err(|e| e.to_string())?;
    Ok(keys.public_key().to_hex())
}
