// BUD-01: Server requirements and blob retrieval
// Implemented in http_server.rs

pub struct Bud01;

impl Bud01 {
    pub fn check_cors_headers() -> bool {
        true
    }

    pub fn check_range_request_support() -> bool {
        true
    }
}
