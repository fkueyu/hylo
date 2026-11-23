import { useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { downloadDir, join } from "@tauri-apps/api/path";
import type { Locale } from "@/i18n";
import { t } from "@/i18n";
import { normalizeExportDocument } from "@ainx/hylo-core";

interface UseFileExportOptions {
  locale: Locale;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

/** 把 Blob 转成 base64（去掉 data URL 前缀），经 IPC 传给 Rust 原子写入。 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("unexpected file reader result"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

export function useFileExport({ locale, onError, onSuccess }: UseFileExportOptions) {
  // 导出 Word (.docx)
  const exportWord = useCallback(
    async (htmlContent: string) => {
      try {
        const isTauri =
          typeof window !== "undefined" &&
          (window as any).__TAURI_INTERNALS__ !== undefined;

        const { default: HTMLtoDOCX } = await import("html-to-docx");
        const normalizedHtml = normalizeExportDocument(htmlContent);
        const docxBlob = await HTMLtoDOCX(normalizedHtml, undefined, {
          table: { row: { cantSplit: true } },
          footer: true,
          header: true,
          pageNumber: true,
        });

        if (isTauri) {
          const dlDir = await downloadDir();
          const defaultName = `${t(locale, "untitled")}.docx`;
          const defaultPath = await join(dlDir, defaultName);

          const selected = await save({
            title: t(locale, "exportWordTitle"),
            defaultPath,
            filters: [{ name: "Word Document", extensions: ["docx"] }],
          });

          if (!selected) return; // 用户取消

          // 二进制走 base64，避免把多 MB 的 Uint8Array 序列化成 JSON 数组造成卡顿
          const bytesBase64 = await blobToBase64(docxBlob);
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("write_docx_atomic", { targetPath: selected, bytesBase64 });
          onSuccess?.(t(locale, "exportWordSuccess"));
        } else {
          // 浏览器调试环境降级：通过 URL.createObjectURL 触发传统下载
          const url = URL.createObjectURL(docxBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${t(locale, "untitled")}.docx`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          onSuccess?.(t(locale, "exportWordSuccess"));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onError?.(`${t(locale, "exportWordFailed")}: ${msg}`);
        console.error("[useFileExport:exportWord]", err);
      }
    },
    [locale, onError, onSuccess]
  );

  return { exportWord };
}
