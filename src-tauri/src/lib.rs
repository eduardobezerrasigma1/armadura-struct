mod project_folder;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(project_folder::Folders::default())
        .invoke_handler(tauri::generate_handler![project_folder::project_folder_choose,project_folder::project_folder_read,project_folder::project_folder_write])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o ArmaduraStruct");
}
