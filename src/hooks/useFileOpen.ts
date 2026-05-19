// ============================================================
// useFileOpen — 通过 Tauri 插件打开本地 HTML 文件
// ============================================================

import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import type { Locale } from "@/i18n";
import { t } from "@/i18n";

interface UseFileOpenOptions {
  locale: Locale;
  onFileLoaded: (content: string, filename: string, filepath: string) => void;
  onError?: (msg: string) => void;
}

export function useFileOpen({ locale, onFileLoaded, onError }: UseFileOpenOptions) {
  const openFile = useCallback(async () => {
    try {
      // 打开原生文件选择对话框
      const selected = await open({
        title: t(locale, "dialogTitle"),
        multiple: false,
        filters: [
          {
            name: t(locale, "dialogFilter"),
            extensions: ["html", "htm", "xhtml"],
          },
          {
            name: "All Files",
            extensions: ["*"],
          },
        ],
      });

      if (!selected || typeof selected !== "string") return;

      // 读取文件内容
      const content = await readTextFile(selected);

      // 提取文件名（不含路径）
      const filename = selected.split(/[/\\]/).pop() ?? t(locale, "untitled");

      onFileLoaded(content, filename, selected);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(`${t(locale, "fileReadError")}: ${msg}`);
      console.error("[useFileOpen]", err);
    }
  }, [locale, onFileLoaded, onError]);

  return { openFile };
}
