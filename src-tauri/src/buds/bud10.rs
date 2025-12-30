// BUD-10: Blossom URI Schema

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlossomUri {
    pub sha256: String,
    pub extension: String,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub params: HashMap<String, Vec<String>>,
}

pub struct Bud10;

impl Bud10 {
    pub const SCHEME: &str = "blossom";

    pub fn parse(uri: &str) -> Result<BlossomUri, String> {
        let uri = uri.strip_prefix(Self::SCHEME).unwrap_or(uri);
        let uri = uri.strip_prefix(':').ok_or("Missing colon after scheme")?;

        let parts: Vec<&str> = uri.splitn(2, '?').collect();

        let hash_ext = parts.get(0).ok_or("Missing hash and extension")?;

        let (sha256, extension) = hash_ext
            .rsplit_once('.')
            .ok_or("Missing file extension")?;

        if sha256.len() != 64 {
            return Err("Invalid SHA-256 hash length".to_string());
        }

        let params = if let Some(query) = parts.get(1) {
            Self::parse_params(query)?
        } else {
            HashMap::new()
        };

        Ok(BlossomUri {
            sha256: sha256.to_string(),
            extension: extension.to_string(),
            params,
        })
    }

    fn parse_params(query: &str) -> Result<HashMap<String, Vec<String>>, String> {
        let mut params = HashMap::new();

        for pair in query.split('&') {
            let parts: Vec<&str> = pair.splitn(2, '=').collect();
            if parts.len() != 2 {
                continue;
            }

            let key = parts[0].to_string();
            let value = parts[1].to_string();

            params.entry(key).or_insert_with(Vec::new).push(value);
        }

        Ok(params)
    }

    pub fn format(uri: &BlossomUri) -> String {
        let mut result = format!("{}:{}.{}", Self::SCHEME, uri.sha256, uri.extension);

        if !uri.params.is_empty() {
            let query: Vec<String> = uri
                .params
                .iter()
                .flat_map(|(k, values)| values.iter().map(move |v| format!("{}={}", k, v)))
                .collect();
            result.push('?');
            result.push_str(&query.join("&"));
        }

        result
    }

    pub fn get_servers(uri: &BlossomUri) -> Vec<String> {
        uri.params.get("xs").cloned().unwrap_or_default()
    }

    pub fn get_authors(uri: &BlossomUri) -> Vec<String> {
        uri.params.get("as").cloned().unwrap_or_default()
    }

    pub fn get_size(uri: &BlossomUri) -> Option<u64> {
        uri.params.get("sz")?.first()?.parse().ok()
    }
}
