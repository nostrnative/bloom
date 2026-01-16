use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::sync::RwLock;

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

#[derive(Debug)]
pub struct StorageManager {
    base_path: PathBuf,
    #[allow(dead_code)]
    cache: RwLock<HashMap<String, BlobDescriptor>>,
    server_url: String,
}

impl StorageManager {
    pub fn new(base_path: PathBuf, server_url: String) -> Self {
        std::fs::create_dir_all(&base_path).expect("Failed to create storage directory");
        Self {
            base_path,
            cache: RwLock::new(HashMap::new()),
            server_url,
        }
    }

    pub fn get_blob_path(&self, sha256: &str) -> PathBuf {
        let mut path = self.base_path.clone();
        path.push(sha256);
        path
    }

    pub async fn get_descriptor_path(&self, sha256: &str) -> PathBuf {
        let mut path = self.base_path.clone();
        path.push(format!("{}.json", sha256));
        path
    }

    pub async fn store_blob(
        &self,
        data: Vec<u8>,
        sha256: &str,
        mime_type: Option<String>,
    ) -> Result<BlobDescriptor, String> {
        let blob_path = self.get_blob_path(sha256);
        let descriptor_path = self.get_descriptor_path(sha256).await;
        println!("{:?}", mime_type);

        let mime_type = mime_type.unwrap_or_else(|| {
            mime_guess::from_path(sha256)
                .first_or_octet_stream()
                .to_string()
        });
        let size = data.len() as u64;
        let uploaded = chrono::Utc::now().timestamp();

        let extension = match mime_type.as_str() {
            "application/pdf" => "pdf",
            "image/png" => "png",
            "image/jpeg" => "jpg",
            "image/gif" => "gif",
            "image/webp" => "webp",
            "video/mp4" => "mp4",
            "video/quicktime" => "mov",
            "audio/mpeg" => "mp3",
            "audio/wav" => "wav",
            "text/plain" => "txt",
            _ => "bin",
        };

        let url = format!(
            "{}/{}.{}",
            self.server_url.trim_end_matches('/'),
            sha256,
            extension
        );

        tokio::fs::write(&blob_path, data)
            .await
            .map_err(|e| format!("Failed to write blob: {}", e))?;

        let descriptor = BlobDescriptor {
            url,
            sha256: sha256.to_string(),
            size,
            mime_type,
            uploaded,
            nip94: None,
        };

        let descriptor_json = serde_json::to_string_pretty(&descriptor)
            .map_err(|e| format!("Failed to serialize descriptor: {}", e))?;

        tokio::fs::write(&descriptor_path, descriptor_json)
            .await
            .map_err(|e| format!("Failed to write descriptor: {}", e))?;

        let mut cache = self.cache.write().await;
        cache.insert(sha256.to_string(), descriptor.clone());

        Ok(descriptor)
    }

    pub async fn get_blob(&self, sha256: &str) -> Result<(Vec<u8>, BlobDescriptor), String> {
        let blob_path = self.get_blob_path(sha256);

        if !blob_path.exists() {
            return Err("Blob not found".to_string());
        }

        let data = tokio::fs::read(&blob_path)
            .await
            .map_err(|e| format!("Failed to read blob: {}", e))?;

        let descriptor = self.get_descriptor(sha256).await?;
        Ok((data, descriptor))
    }

    pub async fn get_descriptor(&self, sha256: &str) -> Result<BlobDescriptor, String> {
        let descriptor_path = self.get_descriptor_path(sha256).await;

        if !descriptor_path.exists() {
            return Err("Descriptor not found".to_string());
        }

        let content = tokio::fs::read_to_string(&descriptor_path)
            .await
            .map_err(|e| format!("Failed to read descriptor: {}", e))?;

        let descriptor: BlobDescriptor = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse descriptor: {}", e))?;

        Ok(descriptor)
    }

    pub async fn blob_exists(&self, sha256: &str) -> bool {
        self.get_blob_path(sha256).exists()
    }

    pub async fn delete_blob(&self, sha256: &str) -> Result<(), String> {
        let blob_path = self.get_blob_path(sha256);
        let descriptor_path = self.get_descriptor_path(sha256).await;

        if blob_path.exists() {
            tokio::fs::remove_file(&blob_path)
                .await
                .map_err(|e| format!("Failed to delete blob: {}", e))?;
        }

        if descriptor_path.exists() {
            tokio::fs::remove_file(&descriptor_path)
                .await
                .map_err(|e| format!("Failed to delete descriptor: {}", e))?;
        }

        let mut cache = self.cache.write().await;
        cache.remove(sha256);

        Ok(())
    }

    pub async fn list_all(&self) -> Result<Vec<BlobDescriptor>, String> {
        println!("{:?}", self.base_path);
        let mut blobs = Vec::new();
        let mut entries = tokio::fs::read_dir(&self.base_path)
            .await
            .map_err(|e| format!("Failed to read storage directory: {}", e))?;

        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(sha256) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Ok(descriptor) = self.get_descriptor(sha256).await {
                        blobs.push(descriptor);
                    }
                }
            }
        }

        Ok(blobs)
    }

    pub fn compute_sha256(data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        hex::encode(hasher.finalize())
    }
}

#[async_trait]
pub trait Storage: Send + Sync {
    async fn store(
        &self,
        data: Vec<u8>,
        sha256: &str,
        mime_type: Option<String>,
    ) -> Result<BlobDescriptor, String>;
    async fn get(&self, sha256: &str) -> Result<(Vec<u8>, BlobDescriptor), String>;
    async fn exists(&self, sha256: &str) -> bool;
    async fn delete(&self, sha256: &str) -> Result<(), String>;
    #[allow(dead_code)]
    async fn get_descriptor(&self, sha256: &str) -> Result<BlobDescriptor, String>;
    #[allow(dead_code)]
    async fn list_all(&self) -> Result<Vec<BlobDescriptor>, String>;
}

#[async_trait]
impl Storage for StorageManager {
    async fn store(
        &self,
        data: Vec<u8>,
        sha256: &str,
        mime_type: Option<String>,
    ) -> Result<BlobDescriptor, String> {
        self.store_blob(data, sha256, mime_type).await
    }

    async fn get(&self, sha256: &str) -> Result<(Vec<u8>, BlobDescriptor), String> {
        self.get_blob(sha256).await
    }

    async fn exists(&self, sha256: &str) -> bool {
        self.blob_exists(sha256).await
    }

    async fn delete(&self, sha256: &str) -> Result<(), String> {
        self.delete_blob(sha256).await
    }

    async fn get_descriptor(&self, sha256: &str) -> Result<BlobDescriptor, String> {
        self.get_descriptor(sha256).await
    }

    async fn list_all(&self) -> Result<Vec<BlobDescriptor>, String> {
        self.list_all().await
    }
}
