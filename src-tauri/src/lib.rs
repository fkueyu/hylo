// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use base64::Engine as _;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
#[cfg(target_os = "macos")]
use tauri::RunEvent;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_fs::FsExt;

/// 系统级「用 Hylo 打开」的唤醒事件：只负责通知前端“队列里有新文件”，
/// 文件路径统一由前端调用 `take_pending_open_files` 一次性取走。
const OPEN_FILE_REQUEST_EVENT: &str = "open-file-request";
/// 通过系统事件传入的文件大小上限，避免异常路径把超大文件整体读进内存。
const MAX_SYSTEM_OPEN_FILE_BYTES: u64 = 32 * 1024 * 1024;
/// 系统事件只允许打开 HTML 文档（与 fileAssociations 声明保持一致）。
const ALLOWED_OPEN_EXTENSIONS: &[&str] = &["html", "htm", "xhtml"];
/// Word 导出经 base64 IPC 传入的字节上限。
const MAX_DOCX_BYTES: usize = 64 * 1024 * 1024;

/// 退出/重启前的确认状态。
///
/// 只有前端明确调用 `allow_app_exit` 后，Cmd+Q / Dock 退出 / 系统注销等
/// `ExitRequested` 才会真正退出；否则拦截并让前端走「保存未保存修改」流程。
#[derive(Default)]
struct AppExitState {
    allow_exit: AtomicBool,
    frontend_ready: AtomicBool,
}

#[tauri::command]
fn allow_app_exit(state: tauri::State<'_, AppExitState>) {
    state.allow_exit.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn mark_frontend_ready(state: tauri::State<'_, AppExitState>) {
    state.frontend_ready.store(true, Ordering::SeqCst);
}

/// 为对话框选中 / 历史记录等路径补登记 `fs` 与 asset 协议 scope。
/// 系统事件路径由 `enqueue_system_open_file` 自动登记，此命令供其他入口调用。
#[tauri::command]
fn allow_file_access(app: AppHandle, path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    if !file_path.is_absolute() {
        return Err("File path must be absolute".to_string());
    }
    grant_file_access(&app, &file_path);
    Ok(())
}

/// 待打开文件队列。
///
/// macOS 的 `application:openURLs:` 可能在 WebView 就绪前就触发，而 Tauri 事件
/// 没有缓冲，早于 `listen()` 注册的事件会直接丢失。因此系统传来的路径先入队，
/// 前端完成监听注册后再主动 drain，避免「应用启动了但仍停在欢迎页」的竞态。
#[derive(Default)]
struct PendingOpenFiles(Mutex<Vec<String>>);

impl PendingOpenFiles {
    fn push(&self, path: String) {
        let mut paths = self.0.lock().unwrap();
        if !paths.iter().any(|queued| queued == &path) {
            paths.push(path);
        }
    }

    fn drain(&self) -> Vec<String> {
        std::mem::take(&mut *self.0.lock().unwrap())
    }
}

/// 把系统传入的文件登记进 `fs` / asset 协议 scope。
///
/// 系统事件传入的路径不会进入 `tauri-plugin-fs` 的运行时 scope，
/// 不补登记的话后续保存（Cmd+S）会失败；执行 `persisted-scope` 还会把授权持久化，
/// 使“打开历史”在重启后仍可读取。
fn grant_file_access(app: &AppHandle, path: &Path) {
    // 保存（Ctrl/Cmd+S）只需要该文件本身
    if let Some(scope) = app.try_fs_scope() {
        let _ = scope.allow_file(path);
    }
    // 相对路径图片走 asset 协议：需要放行文件所在目录（递归），否则 preview 里的
    // <img src="./a.png"> 会被 asset scope 拒绝。
    let asset_scope = app.asset_protocol_scope();
    let _ = asset_scope.allow_file(path);
    if let Some(parent) = path.parent() {
        let _ = asset_scope.allow_directory(parent, true);
    }
}

/// 窗口尺寸/位置持久化（自实现，避免引入额外插件依赖）。
#[derive(serde::Serialize, serde::Deserialize)]
struct WindowStateFile {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

fn window_state_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("window-state.json"))
}

fn restore_window_state(app: &AppHandle) {
    let Some(path) = window_state_path(app) else {
        return;
    };
    let Ok(text) = std::fs::read_to_string(&path) else {
        return;
    };
    let Ok(state) = serde_json::from_str::<WindowStateFile>(&text) else {
        return;
    };
    if state.width < 400 || state.height < 300 {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_size(tauri::PhysicalSize::new(state.width, state.height));
        let _ = window.set_position(tauri::PhysicalPosition::new(state.x, state.y));
        if state.maximized {
            let _ = window.maximize();
        }
    }
}

fn persist_window_state(app: &AppHandle) {
    let Some(path) = window_state_path(app) else {
        return;
    };
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let (Ok(size), Ok(position)) = (window.inner_size(), window.outer_position()) else {
        return;
    };
    let state = WindowStateFile {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized: window.is_maximized().unwrap_or(false),
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(&state) {
        let _ = std::fs::write(path, json);
    }
}

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn enqueue_system_open_file(app: &AppHandle, raw_path: &str) {
    let raw_path = raw_path.trim();
    if raw_path.is_empty() || raw_path.starts_with('-') {
        return;
    }
    let path = PathBuf::from(raw_path);
    if !path.is_absolute() || !path.is_file() {
        return;
    }
    grant_file_access(app, &path);
    if let Some(pending) = app.try_state::<PendingOpenFiles>() {
        pending.push(path.to_string_lossy().to_string());
    }
    if let Err(error) = app.emit(OPEN_FILE_REQUEST_EVENT, ()) {
        eprintln!("Failed to emit open-file request: {error}");
    }
}

/// 前端挂载并注册监听后调用，取走启动阶段积压的系统打开文件。
#[tauri::command]
fn take_pending_open_files(
    app: AppHandle,
    pending: tauri::State<'_, PendingOpenFiles>,
) -> Vec<String> {
    let paths = pending.drain();
    for path in &paths {
        grant_file_access(&app, Path::new(path));
    }
    paths
}

fn is_allowed_open_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| ALLOWED_OPEN_EXTENSIONS.contains(&value.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// 读取系统事件（Open With / 拖拽 / 命令行参数）传入的文件。
///
/// 前端直接 `readTextFile()` 会被 `fs` 插件判定为 forbidden path（系统事件路径
/// 不在 scope 内），所以改由 Rust 侧读取，同时补登记 scope 供保存与历史复用。
#[tauri::command]
fn read_system_open_file(app: AppHandle, path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.is_absolute() {
        return Err("File path must be absolute".to_string());
    }
    let metadata =
        std::fs::metadata(&file_path).map_err(|error| format!("failed to access file: {error}"))?;
    if !metadata.is_file() {
        return Err("target path is not a file".to_string());
    }
    if metadata.len() > MAX_SYSTEM_OPEN_FILE_BYTES {
        return Err(format!(
            "file exceeds the {} MB open limit",
            MAX_SYSTEM_OPEN_FILE_BYTES / 1024 / 1024
        ));
    }
    if !is_allowed_open_extension(&file_path) {
        return Err("only HTML documents (.html/.htm/.xhtml) can be opened this way".to_string());
    }
    let bytes =
        std::fs::read(&file_path).map_err(|error| format!("failed to read file: {error}"))?;
    grant_file_access(&app, &file_path);
    let content_bytes = if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        &bytes[3..]
    } else {
        &bytes[..]
    };
    Ok(String::from_utf8_lossy(content_bytes).into_owned())
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
    let open_text = if is_zh {
        "打开文件..."
    } else {
        "Open File..."
    };
    let history_text = if is_zh {
        "打开历史..."
    } else {
        "Open History..."
    };
    let save_text = if is_zh { "保存" } else { "Save" };
    let save_as_text = if is_zh { "另存为..." } else { "Save As..." };
    let export_pdf_text = if is_zh {
        "导出为 PDF..."
    } else {
        "Export to PDF..."
    };
    let export_word_text = if is_zh {
        "导出为 Word..."
    } else {
        "Export to Word..."
    };
    let theme_text = if is_zh {
        "切换深色/浅色模式"
    } else {
        "Toggle Theme"
    };
    let lang_text = if is_zh {
        "Switch to English / 切换到英文"
    } else {
        "切换到中文 / Switch to Chinese"
    };
    let about_text = if is_zh { "关于 Hylo" } else { "About Hylo" };
    #[cfg(not(feature = "appstore"))]
    let check_updates_text = if is_zh {
        "检查更新..."
    } else {
        "Check for Updates..."
    };

    let copy_text = if is_zh { "复制" } else { "Copy" };
    let paste_text = if is_zh { "粘贴" } else { "Paste" };
    let cut_text = if is_zh { "剪切" } else { "Cut" };
    let select_all_text = if is_zh { "全选" } else { "Select All" };
    let undo_text = if is_zh { "撤销" } else { "Undo" };
    let redo_text = if is_zh { "重做" } else { "Redo" };
    let find_text = if is_zh { "查找..." } else { "Find..." };
    let replace_text = if is_zh {
        "查找并替换..."
    } else {
        "Find and Replace..."
    };
    let fullscreen_text = if is_zh {
        "进入全屏"
    } else {
        "Enter Full Screen"
    };

    let close_window_text = if is_zh {
        "关闭窗口"
    } else {
        "Close Window"
    };
    let close_window_i = MenuItem::with_id(
        &app,
        "close-window",
        close_window_text,
        true,
        Some("CmdOrCtrl+W"),
    )
    .map_err(|e| e.to_string())?;

    // 创建内置项
    // 退出走自定义菜单项，交给前端做未保存确认（PredefinedMenuItem::quit 会绕过确认）
    let quit_i = MenuItem::with_id(&app, "quit-app", quit_text, true, Some("CmdOrCtrl+Q"))
        .map_err(|e| e.to_string())?;
    let copy_i = PredefinedMenuItem::copy(&app, Some(copy_text)).map_err(|e| e.to_string())?;
    let paste_i = PredefinedMenuItem::paste(&app, Some(paste_text)).map_err(|e| e.to_string())?;
    let cut_i = PredefinedMenuItem::cut(&app, Some(cut_text)).map_err(|e| e.to_string())?;
    let select_all_i =
        PredefinedMenuItem::select_all(&app, Some(select_all_text)).map_err(|e| e.to_string())?;
    let find_i = MenuItem::with_id(&app, "find-in-editor", find_text, true, Some("CmdOrCtrl+F"))
        .map_err(|e| e.to_string())?;
    let replace_i = MenuItem::with_id(
        &app,
        "replace-in-editor",
        replace_text,
        true,
        Some("CmdOrCtrl+Alt+F"),
    )
    .map_err(|e| e.to_string())?;
    let undo_i = PredefinedMenuItem::undo(&app, Some(undo_text)).map_err(|e| e.to_string())?;
    let redo_i = PredefinedMenuItem::redo(&app, Some(redo_text)).map_err(|e| e.to_string())?;
    let fs_i =
        PredefinedMenuItem::fullscreen(&app, Some(fullscreen_text)).map_err(|e| e.to_string())?;
    let sep = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;

    // 创建自定义业务菜单项
    let new_i = MenuItem::with_id(&app, "new-file", new_text, true, Some("CmdOrCtrl+N"))
        .map_err(|e| e.to_string())?;
    let open_i = MenuItem::with_id(&app, "open-file", open_text, true, Some("CmdOrCtrl+O"))
        .map_err(|e| e.to_string())?;
    let history_i = MenuItem::with_id(
        &app,
        "open-history",
        history_text,
        true,
        Some("CmdOrCtrl+Shift+H"),
    )
    .map_err(|e| e.to_string())?;
    let save_i = MenuItem::with_id(&app, "save-file", save_text, true, Some("CmdOrCtrl+S"))
        .map_err(|e| e.to_string())?;
    let save_as_i = MenuItem::with_id(
        &app,
        "save-file-as",
        save_as_text,
        true,
        Some("CmdOrCtrl+Shift+S"),
    )
    .map_err(|e| e.to_string())?;
    let export_pdf_i = MenuItem::with_id(
        &app,
        "export-pdf",
        export_pdf_text,
        true,
        Some("CmdOrCtrl+Alt+P"),
    )
    .map_err(|e| e.to_string())?;
    let export_word_i = MenuItem::with_id(
        &app,
        "export-word",
        export_word_text,
        true,
        Some("CmdOrCtrl+Shift+W"),
    )
    .map_err(|e| e.to_string())?;
    let theme_i = MenuItem::with_id(&app, "toggle-theme", theme_text, true, Some("CmdOrCtrl+T"))
        .map_err(|e| e.to_string())?;
    let lang_i = MenuItem::with_id(&app, "toggle-lang", lang_text, true, Some("CmdOrCtrl+L"))
        .map_err(|e| e.to_string())?;
    let about_i = MenuItem::with_id(&app, "about-app", about_text, true, None::<&str>)
        .map_err(|e| e.to_string())?;

    #[cfg(not(feature = "appstore"))]
    let check_updates_i = MenuItem::with_id(
        &app,
        "check-updates",
        check_updates_text,
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;

    #[cfg(not(feature = "appstore"))]
    let app_submenu = Submenu::with_items(
        &app,
        app_name,
        true,
        &[&about_i, &check_updates_i, &sep, &quit_i],
    )
    .map_err(|e| e.to_string())?;

    #[cfg(feature = "appstore")]
    let app_submenu = Submenu::with_items(&app, app_name, true, &[&about_i, &sep, &quit_i])
        .map_err(|e| e.to_string())?;

    let file_submenu = Submenu::with_items(
        &app,
        file_text,
        true,
        &[
            &new_i,
            &open_i,
            &history_i,
            &sep,
            &save_i,
            &save_as_i,
            &sep,
            &export_pdf_i,
            &export_word_i,
            &sep,
            &close_window_i,
        ],
    )
    .map_err(|e| e.to_string())?;

    let edit_submenu = Submenu::with_items(
        &app,
        edit_text,
        true,
        &[
            &undo_i,
            &redo_i,
            &sep,
            &cut_i,
            &copy_i,
            &paste_i,
            &select_all_i,
            &sep,
            &find_i,
            &replace_i,
        ],
    )
    .map_err(|e| e.to_string())?;

    let view_submenu =
        Submenu::with_items(&app, view_text, true, &[&theme_i, &lang_i, &sep, &fs_i])
            .map_err(|e| e.to_string())?;

    let menu = Menu::with_items(
        &app,
        &[&app_submenu, &file_submenu, &edit_submenu, &view_submenu],
    )
    .map_err(|e| e.to_string())?;

    app.set_menu(menu).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn export_pdf(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

/// 通过系统剪贴板读取文本（WKWebView 的 navigator.clipboard 在部分场景会被系统拦截）。
#[tauri::command]
fn read_clipboard_text(app: AppHandle) -> Result<String, String> {
    app.clipboard()
        .read_text()
        .map_err(|error| error.to_string())
}

/// 写入系统剪贴板（复制/剪切走原生，避免 WebView 权限差异）。
#[tauri::command]
fn write_clipboard_text(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard()
        .write_text(text)
        .map_err(|error| error.to_string())
}

/// 原子写入文本文件：临时文件 + fsync + rename，避免保存中途崩溃把原文件截断。
/// 未保存草稿（崩溃恢复用）。
#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DraftPayload {
    content: String,
    filepath: Option<String>,
    filename: Option<String>,
    updated_at: u64,
}

const MAX_DRAFT_BYTES: usize = 64 * 1024 * 1024;

fn draft_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("draft.json"))
        .map_err(|error| error.to_string())
}

fn write_draft_to_path(path: &Path, payload: &DraftPayload) -> Result<(), String> {
    if payload.content.len() > MAX_DRAFT_BYTES {
        return Err("draft is too large".to_string());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "draft path has no parent directory".to_string())?;
    std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let json = serde_json::to_vec(payload).map_err(|error| error.to_string())?;
    let mut temporary = tempfile::Builder::new()
        .prefix(".hylo-draft-")
        .tempfile_in(parent)
        .map_err(|error| error.to_string())?;
    temporary
        .write_all(&json)
        .map_err(|error| error.to_string())?;
    temporary
        .as_file()
        .sync_all()
        .map_err(|error| error.to_string())?;
    temporary
        .persist(path)
        .map_err(|error| error.error.to_string())?;
    Ok(())
}

fn read_draft_from_path(path: &Path) -> Option<DraftPayload> {
    let bytes = std::fs::read(path).ok()?;
    serde_json::from_slice::<DraftPayload>(&bytes).ok()
}

/// 自动保存未保存草稿（仅在有未保存修改时由前端调用）。
#[tauri::command]
fn save_draft(
    app: AppHandle,
    content: String,
    filepath: Option<String>,
    filename: Option<String>,
    updated_at: u64,
) -> Result<(), String> {
    let path = draft_file_path(&app)?;
    write_draft_to_path(
        &path,
        &DraftPayload {
            content,
            filepath,
            filename,
            updated_at,
        },
    )
}

/// 启动时读取上次会话的草稿；损坏的草稿自动清理。
#[tauri::command]
fn read_draft(app: AppHandle) -> Result<Option<DraftPayload>, String> {
    let path = draft_file_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    match read_draft_from_path(&path) {
        Some(payload) if !payload.content.trim().is_empty() => Ok(Some(payload)),
        _ => {
            let _ = std::fs::remove_file(&path);
            Ok(None)
        }
    }
}

/// 保存成功 / 用户主动丢弃 / 正常退出后清理草稿。
#[tauri::command]
fn clear_draft(app: AppHandle) -> Result<(), String> {
    let path = draft_file_path(&app)?;
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn write_text_atomic(target_path: String, content: String) -> Result<(), String> {
    let target = PathBuf::from(&target_path);
    if !target.is_absolute() {
        return Err("Invalid text file destination".to_string());
    }
    let parent = target
        .parent()
        .ok_or_else(|| "Text file destination has no parent directory".to_string())?;
    let mut temporary = tempfile::Builder::new()
        .prefix(".hylo-save-")
        .tempfile_in(parent)
        .map_err(|error| error.to_string())?;
    temporary
        .write_all(content.as_bytes())
        .map_err(|error| error.to_string())?;
    temporary
        .as_file()
        .sync_all()
        .map_err(|error| error.to_string())?;
    temporary
        .persist(&target)
        .map_err(|error| error.error.to_string())?;
    Ok(())
}

#[tauri::command]
fn write_docx_atomic(target_path: String, bytes_base64: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(bytes_base64.as_bytes())
        .map_err(|error| format!("Invalid DOCX payload: {error}"))?;
    if bytes.is_empty() || bytes.len() > MAX_DOCX_BYTES {
        return Err("Invalid DOCX payload size".to_string());
    }
    let target = PathBuf::from(target_path);
    if !target.is_absolute()
        || target
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("docx"))
            != Some(true)
    {
        return Err("Invalid DOCX destination".to_string());
    }
    let parent = target
        .parent()
        .ok_or_else(|| "DOCX destination has no parent directory".to_string())?;
    let mut temporary = tempfile::Builder::new()
        .prefix(".hylo-docx-")
        .tempfile_in(parent)
        .map_err(|error| error.to_string())?;
    temporary
        .write_all(&bytes)
        .map_err(|error| error.to_string())?;
    temporary
        .as_file()
        .sync_all()
        .map_err(|error| error.to_string())?;
    temporary
        .persist(&target)
        .map_err(|error| error.error.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // single-instance 必须最先注册；只在 Windows/Linux 需要：
    // macOS 的 LaunchServices 本来就把「打开方式」事件投递给已运行实例。
    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            for argument in argv.iter().skip(1) {
                enqueue_system_open_file(app, argument);
            }
            focus_main_window(app);
        }));
    }

    builder = builder
        .plugin(tauri_plugin_clipboard_manager::init())
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
        .manage(PendingOpenFiles::default())
        .manage(AppExitState::default())
        .invoke_handler(tauri::generate_handler![
            update_menu,
            export_pdf,
            write_text_atomic,
            write_docx_atomic,
            save_draft,
            read_draft,
            clear_draft,
            take_pending_open_files,
            read_system_open_file,
            read_clipboard_text,
            write_clipboard_text,
            allow_file_access,
            allow_app_exit,
            mark_frontend_ready
        ])
        .setup(|app| {
            // Windows / Linux 通过命令行参数传入待打开文件；macOS 走 RunEvent::Opened。
            for argument in std::env::args().skip(1) {
                enqueue_system_open_file(app.handle(), &argument);
            }
            // 恢复上次窗口尺寸/位置（首次启动沿用 tauri.conf.json 的默认值）
            restore_window_state(app.handle());

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

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _e| {
        #[cfg(target_os = "macos")]
        if let RunEvent::Opened { ref urls } = _e {
            let mut handled = false;
            for url in urls.iter() {
                if let Ok(file_path) = url.to_file_path() {
                    enqueue_system_open_file(_app_handle, &file_path.to_string_lossy());
                    handled = true;
                }
            }
            if handled {
                focus_main_window(_app_handle);
            }
        }

        match _e {
            // Cmd+Q / Dock 退出 / 系统注销都会走到这里：未确认前拦截，交给前端提示保存
            RunEvent::ExitRequested { api, .. } => {
                if let Some(state) = _app_handle.try_state::<AppExitState>() {
                    let frontend_ready = state.frontend_ready.load(Ordering::SeqCst);
                    let allowed = state.allow_exit.load(Ordering::SeqCst);
                    if frontend_ready && !allowed {
                        api.prevent_exit();
                        let _ = _app_handle.emit("app-exit-requested", ());
                        focus_main_window(_app_handle);
                    }
                }
            }
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => {
                focus_main_window(_app_handle);
            }
            RunEvent::Exit => {
                persist_window_state(_app_handle);
            }
            _ => {}
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::engine::general_purpose::STANDARD as BASE64;

    #[test]
    fn pending_open_files_deduplicates_and_drains() {
        let pending = PendingOpenFiles::default();
        pending.push("/tmp/a.html".to_string());
        pending.push("/tmp/a.html".to_string());
        pending.push("/tmp/b.html".to_string());
        assert_eq!(
            pending.drain(),
            vec!["/tmp/a.html".to_string(), "/tmp/b.html".to_string()]
        );
        assert!(pending.drain().is_empty());
    }

    #[test]
    fn only_html_extensions_are_accepted_from_system_events() {
        assert!(is_allowed_open_extension(Path::new("/tmp/a.html")));
        assert!(is_allowed_open_extension(Path::new("/tmp/a.HTM")));
        assert!(is_allowed_open_extension(Path::new("/tmp/a.xhtml")));
        assert!(!is_allowed_open_extension(Path::new("/tmp/a.txt")));
        assert!(!is_allowed_open_extension(Path::new("/tmp/a.png")));
        assert!(!is_allowed_open_extension(Path::new("/tmp/a")));
    }

    #[test]
    fn draft_roundtrip_and_corrupt_cleanup() {
        let dir = std::env::temp_dir().join(format!("hylo-draft-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("draft.json");

        let payload = DraftPayload {
            content: "<p>draft</p>".to_string(),
            filepath: Some("/tmp/a.html".to_string()),
            filename: Some("a.html".to_string()),
            updated_at: 123,
        };
        write_draft_to_path(&path, &payload).unwrap();
        let loaded = read_draft_from_path(&path).unwrap();
        assert_eq!(loaded.content, "<p>draft</p>");
        assert_eq!(loaded.filepath.as_deref(), Some("/tmp/a.html"));
        assert_eq!(loaded.updated_at, 123);

        std::fs::write(&path, b"not-json").unwrap();
        assert!(read_draft_from_path(&path).is_none());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn text_write_is_atomic_and_replaces_existing_file() {
        let dir = std::env::temp_dir().join(format!("hylo-text-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("doc.html").to_string_lossy().to_string();

        write_text_atomic(target.clone(), "first".to_string()).unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "first");
        write_text_atomic(target.clone(), "second".to_string()).unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "second");
        // 临时文件不应残留在目标目录
        let leftovers = std::fs::read_dir(&dir).unwrap().count();
        assert_eq!(leftovers, 1);

        assert!(write_text_atomic("relative.html".to_string(), "x".to_string()).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn docx_write_validates_payload_and_extension() {
        let dir = std::env::temp_dir().join(format!("hylo-docx-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("out.docx").to_string_lossy().to_string();

        assert!(write_docx_atomic(target.clone(), BASE64.encode(b"HELLO")).is_ok());
        assert_eq!(std::fs::read(dir.join("out.docx")).unwrap(), b"HELLO");

        let bad_extension = dir.join("out.txt").to_string_lossy().to_string();
        assert!(write_docx_atomic(bad_extension, BASE64.encode(b"HELLO")).is_err());
        assert!(write_docx_atomic(target.clone(), String::new()).is_err());
        assert!(write_docx_atomic(target, "not-base64!!!".to_string()).is_err());

        let _ = std::fs::remove_dir_all(&dir);
    }
}
