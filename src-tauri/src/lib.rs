// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, RunEvent};
use std::sync::Mutex;

struct OpenedFile(Mutex<Option<String>>);

#[tauri::command]
fn get_opened_file(state: tauri::State<'_, OpenedFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

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
    let history_text = if is_zh { "打开历史..." } else { "Open History..." };
    let save_text = if is_zh { "保存" } else { "Save" };
    let export_pdf_text = if is_zh { "导出为 PDF..." } else { "Export to PDF..." };
    let export_word_text = if is_zh { "导出为 Word..." } else { "Export to Word..." };
    let theme_text = if is_zh { "切换深色/浅色模式" } else { "Toggle Theme" };
    let lang_text = if is_zh { "Switch to English / 切换到英文" } else { "切换到中文 / Switch to Chinese" };
    let about_text = if is_zh { "关于 Hylo" } else { "About Hylo" };
    let check_updates_text = if is_zh { "检查更新..." } else { "Check for Updates..." };
    
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
    let history_i = MenuItem::with_id(&app, "open-history", history_text, true, Some("CmdOrCtrl+Shift+H")).map_err(|e| e.to_string())?;
    let save_i = MenuItem::with_id(&app, "save-file", save_text, true, Some("CmdOrCtrl+S")).map_err(|e| e.to_string())?;
    let export_pdf_i = MenuItem::with_id(&app, "export-pdf", export_pdf_text, true, Some("CmdOrCtrl+Alt+P")).map_err(|e| e.to_string())?;
    let export_word_i = MenuItem::with_id(&app, "export-word", export_word_text, true, Some("CmdOrCtrl+Shift+W")).map_err(|e| e.to_string())?;
    let theme_i = MenuItem::with_id(&app, "toggle-theme", theme_text, true, Some("CmdOrCtrl+T")).map_err(|e| e.to_string())?;
    let lang_i = MenuItem::with_id(&app, "toggle-lang", lang_text, true, Some("CmdOrCtrl+L")).map_err(|e| e.to_string())?;
    let about_i = MenuItem::with_id(&app, "about-app", about_text, true, None::<&str>).map_err(|e| e.to_string())?;

    #[cfg(not(feature = "appstore"))]
    let check_updates_i = MenuItem::with_id(&app, "check-updates", check_updates_text, true, None::<&str>).map_err(|e| e.to_string())?;

    #[cfg(not(feature = "appstore"))]
    let app_submenu = Submenu::with_items(
        &app,
        app_name,
        true,
        &[&about_i, &check_updates_i, &sep, &quit_i],
    ).map_err(|e| e.to_string())?;

    #[cfg(feature = "appstore")]
    let app_submenu = Submenu::with_items(
        &app,
        app_name,
        true,
        &[&about_i, &sep, &quit_i],
    ).map_err(|e| e.to_string())?;

    let file_submenu = Submenu::with_items(
        &app,
        file_text,
        true,
        &[&new_i, &open_i, &history_i, &sep, &save_i, &sep, &export_pdf_i, &export_word_i],
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

#[tauri::command]
fn export_pdf(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init());

    #[cfg(not(feature = "appstore"))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder = builder
        .plugin(tauri_plugin_process::init())
        .manage(OpenedFile(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![update_menu, export_pdf, get_opened_file])
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let path = &args[1];
                if !path.starts_with("--") {
                    if let Some(state) = app.try_state::<OpenedFile>() {
                        *state.0.lock().unwrap() = Some(path.clone());
                    }
                }
            }
            // 初始化时设置原生菜单默认为英文，防止非中文系统下首屏出现中文菜单
            let handle = app.handle().clone();
            let _ = update_menu(handle, "en".to_string());
            
            // 监听原生菜单点击事件，并将其转发给前端
            app.on_menu_event(move |app_handle, event| {
                let id = event.id().0.as_str();
                if let Err(e) = app_handle.emit("native-menu-action", id) {
                    eprintln!("Failed to emit menu event: {}", e);
                }
            });
            Ok(())
        });

    let app = builder.build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, e| {
        if let RunEvent::Opened { urls } = e {
            for url in urls {
                if let Ok(file_path) = url.to_file_path() {
                    let path_str = file_path.to_string_lossy().to_string();
                    if let Some(state) = app_handle.try_state::<OpenedFile>() {
                        *state.0.lock().unwrap() = Some(path_str.clone());
                    }
                    let _ = app_handle.emit("open-file-url", path_str);
                    break;
                }
            }
        }
    });
}
