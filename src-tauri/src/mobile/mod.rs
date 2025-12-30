pub mod ios;
pub mod android;

#[cfg(target_os = "ios")]
pub use ios::*;

#[cfg(target_os = "android")]
pub use android::*;

#[cfg(not(any(target_os = "ios", target_os = "android")))]
pub fn init_background_sync() {
    tracing::info!("Background sync not available on this platform");
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
pub fn start_background_service() {
    tracing::info!("Background service not available on this platform");
}
