// BUD-06: Upload requirements
// Implemented in http_server.rs (HEAD /upload endpoint)

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct UploadRequirements {
    pub sha256: String,
    pub size: u64,
    pub mime_type: String,
}

pub struct Bud06;

impl Bud06 {
    pub const MAX_SIZE: u64 = 100 * 1024 * 1024; // 100 MiB

    pub fn validate_requirements(req: &UploadRequirements) -> Result<(), String> {
        if req.sha256.len() != 64 {
            return Err("Invalid SHA-256 hash length".to_string());
        }

        if req.size > Self::MAX_SIZE {
            return Err(format!("File too large. Max allowed size is {} bytes", Self::MAX_SIZE));
        }

        Ok(())
    }
}
