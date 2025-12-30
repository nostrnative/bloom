// iOS Background Sync

#[no_mangle]
pub extern "C" fn ios_init_background_sync() {
    tracing::info!("iOS background sync initialized");
}

pub fn init_background_sync() {
    ios_init_background_sync();
}

pub fn start_background_service() {
    tracing::info!("iOS background service started");
}
