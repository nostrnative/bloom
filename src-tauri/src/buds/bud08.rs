// BUD-08: NIP-94 File Metadata tags

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Nip94Metadata {
    pub url: String,
    #[serde(rename = "m")]
    pub mime_type: String,
    #[serde(rename = "x")]
    pub sha256: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "size")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "magnet")]
    pub magnet: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "i")]
    pub infohash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "blurhash")]
    pub blurhash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "dim")]
    pub dimensions: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "alt")]
    pub alt_text: Option<String>,
}

pub struct Bud08;

impl Bud08 {
    pub fn to_tags(metadata: &Nip94Metadata) -> Vec<Vec<String>> {
        let mut tags = vec![
            vec!["url".to_string(), metadata.url.clone()],
            vec!["m".to_string(), metadata.mime_type.clone()],
            vec!["x".to_string(), metadata.sha256.clone()],
        ];

        if let Some(size) = metadata.size {
            tags.push(vec!["size".to_string(), size.to_string()]);
        }

        if let Some(magnet) = &metadata.magnet {
            tags.push(vec!["magnet".to_string(), magnet.clone()]);
        }

        if let Some(infohash) = &metadata.infohash {
            tags.push(vec!["i".to_string(), infohash.clone()]);
        }

        if let Some(blurhash) = &metadata.blurhash {
            tags.push(vec!["blurhash".to_string(), blurhash.clone()]);
        }

        if let Some(dimensions) = &metadata.dimensions {
            tags.push(vec!["dim".to_string(), dimensions.clone()]);
        }

        if let Some(alt) = &metadata.alt_text {
            tags.push(vec!["alt".to_string(), alt.clone()]);
        }

        tags
    }

    pub fn from_tags(tags: &[Vec<String>]) -> Option<Nip94Metadata> {
        let get_tag = |name: &str| -> Option<String> {
            tags.iter()
                .find(|t| t.len() >= 2 && t[0] == name)
                .map(|t| t[1].clone())
        };

        let url = get_tag("url")?;
        let mime_type = get_tag("m")?;
        let sha256 = get_tag("x")?;

        Some(Nip94Metadata {
            url,
            mime_type,
            sha256,
            size: get_tag("size").and_then(|s| s.parse().ok()),
            magnet: get_tag("magnet"),
            infohash: get_tag("i"),
            blurhash: get_tag("blurhash"),
            dimensions: get_tag("dim"),
            alt_text: get_tag("alt"),
        })
    }
}
