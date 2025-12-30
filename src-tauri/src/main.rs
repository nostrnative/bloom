mod auth;
mod buds;
mod http_server;
mod mobile;
mod nostr;
mod storage;

use blossom::run_app;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    run_app();
}
