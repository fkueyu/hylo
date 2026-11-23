// ============================================================
// draft — 未保存草稿自动保存 / 崩溃恢复
// ============================================================
//
// 仅在有未保存修改时写草稿；正常保存、主动丢弃、正常退出都会清理。
// 应用异常退出/崩溃后，下次启动读取草稿并询问是否恢复。

import { invoke } from "@tauri-apps/api/core";

export interface DraftSnapshot {
  content: string;
  filepath: string | null;
  filename: string | null;
  updatedAt: number;
}

const isTauriRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function saveDraft(input: {
  content: string;
  filepath: string | null;
  filename: string | null;
}): Promise<void> {
  if (!isTauriRuntime) return;
  await invoke("save_draft", {
    content: input.content,
    filepath: input.filepath,
    filename: input.filename,
    updatedAt: Date.now(),
  });
}

export async function readDraft(): Promise<DraftSnapshot | null> {
  if (!isTauriRuntime) return null;
  return invoke<DraftSnapshot | null>("read_draft");
}

export async function clearDraft(): Promise<void> {
  if (!isTauriRuntime) return;
  await invoke("clear_draft");
}
