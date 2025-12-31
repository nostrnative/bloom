use blossom::run_app;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    run_app();
}
