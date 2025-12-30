// Android Background Service

#[no_mangle]
pub extern "C" fn android_init_background_sync() {
    tracing::info!("Android background sync initialized");
}

pub fn init_background_sync() {
    android_init_background_sync();
}

pub fn start_background_service() {
    tracing::info!("Android background service started");
}
