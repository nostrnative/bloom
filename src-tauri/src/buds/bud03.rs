// BUD-03: User Server List
// Implemented in nostr.rs

use nostr::prelude::*;

#[derive(Debug, Clone)]
pub struct ServerListEntry {
    pub url: String,
    pub index: usize,
}

pub struct Bud03;

impl Bud03 {
    pub const EVENT_KIND: u64 = 10063;

    pub fn extract_server_tags(event: &Event) -> Vec<ServerListEntry> {
        event
            .tags
            .iter()
            .enumerate()
            .filter_map(|(i, tag)| {
                if tag.as_vec().len() >= 2 && tag.as_vec()[0] == "server" {
                    Some(ServerListEntry {
                        url: tag.as_vec()[1].clone(),
                        index: i,
                    })
                } else {
                    None
                }
            })
            .collect()
    }
}
