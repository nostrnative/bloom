// BUD-04: Mirroring blobs
// Implemented in http_server.rs (PUT /mirror endpoint)

#[derive(serde::Deserialize)]
pub struct MirrorRequest {
    pub url: String,
}

pub struct Bud04;

impl Bud04 {
    pub fn validate_mirror_url(url: &str) -> bool {
        url.starts_with("http://") || url.starts_with("https://")
    }
}
