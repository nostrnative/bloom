// BUD-09: Blob Reporting
// Implemented in http_server.rs (PUT /report endpoint)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlobReport {
    #[serde(rename = "x")]
    pub sha256: String,
    #[serde(rename = "type")]
    pub report_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub e: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub p: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportRequest {
    pub kind: u64,
    pub tags: Vec<Vec<String>>,
    pub content: String,
}

pub struct Bud09;

impl Bud09 {
    pub const KIND: u64 = 1984;

    pub fn extract_reports(request: &ReportRequest) -> Vec<BlobReport> {
        request
            .tags
            .iter()
            .filter(|tag| tag.len() >= 3 && tag[0] == "x")
            .filter_map(|tag| {
                Some(BlobReport {
                    sha256: tag.get(1)?.clone(),
                    report_type: tag.get(2)?.clone(),
                    e: request
                        .tags
                        .iter()
                        .find(|t| t.len() >= 2 && t[0] == "e")
                        .and_then(|t| t.get(1).cloned()),
                    p: request
                        .tags
                        .iter()
                        .find(|t| t.len() >= 2 && t[0] == "p")
                        .and_then(|t| t.get(1).cloned()),
                })
            })
            .collect()
    }

    pub fn validate_report(report: &BlobReport) -> bool {
        report.sha256.len() == 64 && !report.report_type.is_empty()
    }
}
