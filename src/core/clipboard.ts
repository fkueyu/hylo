// ============================================================
// clipboard — 系统剪贴板读写
// ============================================================
//
// WKWebView 里的 navigator.clipboard 在部分场景（非直接手势、系统剪贴板权限）
// 会失败，而「粘贴 AI 生成的 HTML」是核心路径，因此 Tauri 下优先走 Rust
// plugin-clipboard-manager，浏览器调试环境回退到 Web API。

import { invoke } from "@tauri-apps/api/core";

const isTauriRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function readClipboardText(): Promise<string> {
  if (isTauriRuntime) {
    try {
      return await invoke<string>("read_clipboard_text");
    } catch (error) {
      console.warn("[clipboard] native read failed, falling back to web API:", error);
    }
  }
  return navigator.clipboard.readText();
}

export async function writeClipboardText(text: string): Promise<void> {
  if (isTauriRuntime) {
    try {
      await invoke("write_clipboard_text", { text });
      return;
    } catch (error) {
      console.warn("[clipboard] native write failed, falling back to web API:", error);
    }
  }
  await navigator.clipboard.writeText(text);
}
