// ============================================================
// system-file — 系统级「用 Hylo 打开 / 拖拽打开」的读取桥接
// ============================================================
//
// 由 Finder「打开方式」、双击、拖拽或命令行传入的文件路径不会进入
// tauri-plugin-fs 的运行时 scope，前端直接 readTextFile() 会得到
// "forbidden path"（表现为：应用已启动，但仍显示默认欢迎页）。
// 因此统一改走 Rust 命令读取，Rust 侧同时补登记 fs scope 以支持保存。

import { invoke } from "@tauri-apps/api/core";

/** Rust 侧在收到系统打开请求时广播的事件名（仅唤醒前端，路径由命令 drain）。 */
export const SYSTEM_OPEN_REQUEST_EVENT = "open-file-request";

/** 读取系统事件传入的本地文件内容（UTF-8，自动去掉 BOM）。 */
export async function readSystemFile(path: string): Promise<string> {
  return invoke<string>("read_system_open_file", { path });
}

/**
 * 为对话框选中 / 历史记录等路径补登记 fs + asset 协议 scope（Rust 侧执行）。
 * 浏览器调试环境下直接跳过。
 */
export async function allowFileAccess(path: string): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  await invoke("allow_file_access", { path });
}

/** 原子取走启动阶段积压的待打开文件路径。 */
export async function takePendingSystemFiles(): Promise<string[]> {
  return invoke<string[]>("take_pending_open_files");
}

/** 从绝对路径中提取文件名，作为标题栏展示名。 */
export function filenameFromPath(path: string, fallback: string): string {
  return path.split(/[/\\]/).pop() || fallback;
}
