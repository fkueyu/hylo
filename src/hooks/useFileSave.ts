import { useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { downloadDir, join } from "@tauri-apps/api/path";
import type { Locale } from "@/i18n";
import { t } from "@/i18n";

interface UseFileSaveOptions {
  locale: Locale;
  onFileSaved: (filename: string, filepath: string) => void;
  onError?: (msg: string) => void;
}

export function useFileSave({ locale, onFileSaved, onError }: UseFileSaveOptions) {
  const saveFile = useCallback(
    async (content: string, currentFilepath: string | null) => {
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

          if (!selected) return; // 用户取消
          filepath = selected;
          
          // 强制补充 .html 后缀
          if (!filepath.toLowerCase().endsWith(".html") && !filepath.toLowerCase().endsWith(".htm")) {
            filepath += ".html";
          }
        }

        // 写入文件
        await writeTextFile(filepath, content);

        // 提取文件名
        const filename = filepath.split(/[/\\]/).pop() ?? t(locale, "untitled");
        
        onFileSaved(filename, filepath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onError?.(`保存失败: ${msg}`);
        console.error("[useFileSave]", err);
      }
    },
    [locale, onFileSaved, onError]
  );

  return { saveFile };
}
