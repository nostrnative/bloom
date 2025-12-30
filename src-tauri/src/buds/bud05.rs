// BUD-05: Media optimization
// Implemented in http_server.rs (PUT /media endpoint)

pub struct Bud05;

impl Bud05 {
    pub fn is_supported_media_type(mime_type: &str) -> bool {
        matches!(
            mime_type,
            "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "video/mp4" | "video/quicktime"
        )
    }

    pub fn should_optimize(mime_type: &str) -> bool {
        Self::is_supported_media_type(mime_type)
    }
}
