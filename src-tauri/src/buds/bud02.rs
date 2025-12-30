// BUD-02: Blob upload and management
// Implemented in http_server.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlobDescriptor {
    pub url: String,
    pub sha256: String,
    pub size: u64,
    #[serde(rename = "type")]
    pub mime_type: String,
    pub uploaded: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nip94: Option<Vec<Vec<String>>>,
}

pub struct Bud02;

impl Bud02 {
    pub fn validate_blob_descriptor(descriptor: &BlobDescriptor) -> bool {
        !descriptor.url.is_empty()
            && descriptor.sha256.len() == 64
            && descriptor.size > 0
            && !descriptor.mime_type.is_empty()
            && descriptor.uploaded > 0
    }
}
