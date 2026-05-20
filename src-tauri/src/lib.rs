// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter};

#[tauri::command]
fn update_menu(app: AppHandle, locale: String) -> Result<(), String> {
    let is_zh = locale == "zh";
    let app_name = "Hylo";
    
    let quit_text = if is_zh { "退出 Hylo" } else { "Quit Hylo" };
    let file_text = if is_zh { "文件" } else { "File" };
    let edit_text = if is_zh { "编辑" } else { "Edit" };
    let view_text = if is_zh { "视图" } else { "View" };
    
    let new_text = if is_zh { "新建" } else { "New" };
    let open_text = if is_zh { "打开文件..." } else { "Open File..." };
    let save_text = if is_zh { "保存" } else { "Save" };
    let theme_text = if is_zh { "切换深色/浅色模式" } else { "Toggle Theme" };
    let lang_text = if is_zh { "Switch to English / 切换到英文" } else { "切换到中文 / Switch to Chinese" };
    
    let copy_text = if is_zh { "复制" } else { "Copy" };
    let paste_text = if is_zh { "粘贴" } else { "Paste" };
    let cut_text = if is_zh { "剪切" } else { "Cut" };
    let select_all_text = if is_zh { "全选" } else { "Select All" };
    let undo_text = if is_zh { "撤销" } else { "Undo" };
    let redo_text = if is_zh { "重做" } else { "Redo" };
    let fullscreen_text = if is_zh { "进入全屏" } else { "Enter Full Screen" };

    // 创建内置项
    let quit_i = PredefinedMenuItem::quit(&app, Some(quit_text)).map_err(|e| e.to_string())?;
    let copy_i = PredefinedMenuItem::copy(&app, Some(copy_text)).map_err(|e| e.to_string())?;
    let paste_i = PredefinedMenuItem::paste(&app, Some(paste_text)).map_err(|e| e.to_string())?;
    let cut_i = PredefinedMenuItem::cut(&app, Some(cut_text)).map_err(|e| e.to_string())?;
    let select_all_i = PredefinedMenuItem::select_all(&app, Some(select_all_text)).map_err(|e| e.to_string())?;
    let undo_i = PredefinedMenuItem::undo(&app, Some(undo_text)).map_err(|e| e.to_string())?;
    let redo_i = PredefinedMenuItem::redo(&app, Some(redo_text)).map_err(|e| e.to_string())?;
    let fs_i = PredefinedMenuItem::fullscreen(&app, Some(fullscreen_text)).map_err(|e| e.to_string())?;
    let sep = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;

    // 创建自定义业务菜单项
    let new_i = MenuItem::with_id(&app, "new-file", new_text, true, Some("CmdOrCtrl+N")).map_err(|e| e.to_string())?;
    let open_i = MenuItem::with_id(&app, "open-file", open_text, true, Some("CmdOrCtrl+O")).map_err(|e| e.to_string())?;
    let save_i = MenuItem::with_id(&app, "save-file", save_text, true, Some("CmdOrCtrl+S")).map_err(|e| e.to_string())?;
    let theme_i = MenuItem::with_id(&app, "toggle-theme", theme_text, true, Some("CmdOrCtrl+T")).map_err(|e| e.to_string())?;
    let lang_i = MenuItem::with_id(&app, "toggle-lang", lang_text, true, Some("CmdOrCtrl+L")).map_err(|e| e.to_string())?;

    let app_submenu = Submenu::with_items(
        &app,
        app_name,
        true,
        &[&quit_i],
    ).map_err(|e| e.to_string())?;

    let file_submenu = Submenu::with_items(
        &app,
        file_text,
        true,
        &[&new_i, &open_i, &save_i],
    ).map_err(|e| e.to_string())?;

    let edit_submenu = Submenu::with_items(
        &app,
        edit_text,
        true,
        &[&undo_i, &redo_i, &sep, &cut_i, &copy_i, &paste_i, &select_all_i],
    ).map_err(|e| e.to_string())?;

    let view_submenu = Submenu::with_items(
        &app,
        view_text,
        true,
        &[&theme_i, &lang_i, &sep, &fs_i],
    ).map_err(|e| e.to_string())?;

    let menu = Menu::with_items(&app, &[&app_submenu, &file_submenu, &edit_submenu, &view_submenu]).map_err(|e| e.to_string())?;

    app.set_menu(menu).map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![update_menu])
        .setup(|app| {
            // 初始化时设置原生菜单为中文
            let handle = app.handle().clone();
            let _ = update_menu(handle, "zh".to_string());
            
            // 监听原生菜单点击事件，并将其转发给前端
            app.on_menu_event(move |app_handle, event| {
                let id = event.id().0.as_str();
                if let Err(e) = app_handle.emit("native-menu-action", id) {
                    eprintln!("Failed to emit menu event: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
