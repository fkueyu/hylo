import { useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { allowFileAccess } from "@/core/system-file";
import { downloadDir, join } from "@tauri-apps/api/path";
import type { Locale } from "@/i18n";
import { t } from "@/i18n";

interface UseFileSaveOptions {
  locale: Locale;
  onFileSaved: (filename: string, filepath: string) => void;
  onError?: (msg: string) => void;
}

const isTauriRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** 优先使用 Rust 原子写入；浏览器调试环境回退到 fs 插件。 */
async function persistText(filepath: string, content: string): Promise<void> {
  if (isTauriRuntime) {
    await invoke("write_text_atomic", { targetPath: filepath, content });
    return;
  }
  await writeTextFile(filepath, content);
}

export function useFileSave({ locale, onFileSaved, onError }: UseFileSaveOptions) {
  const saveFile = useCallback(
    async (content: string, currentFilepath: string | null): Promise<boolean> => {
      try {
        let filepath = currentFilepath;

        // 如果没有当前文件路径（新文件），弹出另存为对话框
        if (!filepath) {
          const dlDir = await downloadDir();
          const defaultName = `${t(locale, "untitled")}.html`;
          const defaultPath = await join(dlDir, defaultName);
          const selected = await save({
            title: t(locale, "dialogSaveTitle"),
            defaultPath: defaultPath,
            filters: [
              {
                name: t(locale, "dialogSaveFilter"),
                extensions: ["html", "htm"],
              },
            ],
          });

          if (!selected) return false; // 用户取消
          filepath = selected;
          
          // 强制补充 .html 后缀
          if (!filepath.toLowerCase().endsWith(".html") && !filepath.toLowerCase().endsWith(".htm")) {
            filepath += ".html";
          }
        }

        // 原子写入（Tauri 下走 Rust 临时文件 + fsync + rename，避免中途崩溃截断原文件）
        await persistText(filepath, content);
        await allowFileAccess(filepath).catch(() => {});

        // 提取文件名
        const filename = filepath.split(/[/\\]/).pop() ?? t(locale, "untitled");
        
        onFileSaved(filename, filepath);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onError?.(`${t(locale, "fileSaveError")}: ${msg}`);
        console.error("[useFileSave]", err);
        return false;
      }
    },
    [locale, onFileSaved, onError]
  );

  const saveFileAs = useCallback(
    async (content: string, currentFilepath: string | null) => {
      try {
        const dlDir = await downloadDir();
        // 优先用当前文件路径作为默认路径，没有则用下载目录
        const defaultPath = currentFilepath ?? await join(dlDir, `${t(locale, "untitled")}.html`);
        const selected = await save({
          title: t(locale, "dialogSaveAsTitle"),
          defaultPath,
          filters: [
            {
              name: t(locale, "dialogSaveFilter"),
              extensions: ["html", "htm"],
            },
          ],
        });

        if (!selected) return;
        let filepath = selected;
        if (!filepath.toLowerCase().endsWith(".html") && !filepath.toLowerCase().endsWith(".htm")) {
          filepath += ".html";
        }

        await persistText(filepath, content);
        await allowFileAccess(filepath).catch(() => {});
        const filename = filepath.split(/[/\\]/).pop() ?? t(locale, "untitled");
        onFileSaved(filename, filepath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onError?.(`${t(locale, "fileSaveError")}: ${msg}`);
        console.error("[useFileSave:saveAs]", err);
      }
    },
    [locale, onFileSaved, onError]
  );

  return { saveFile, saveFileAs };
}
