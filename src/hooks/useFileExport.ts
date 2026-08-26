import { useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { downloadDir, join } from "@tauri-apps/api/path";
import type { Locale } from "@/i18n";
import { t } from "@/i18n";
import { normalizeExportDocument } from "@ainx/hylo-core";
import { eventBus } from "@/core/event-bus";

interface UseFileExportOptions {
  locale: Locale;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export function useFileExport({ locale, onError, onSuccess }: UseFileExportOptions) {
  // 导出 PDF
  const exportPDF = useCallback(async () => {
    try {
      eventBus.emit("preview:print", undefined);
      console.log("[useFileExport] PDF print dialog invoked successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(`${t(locale, "exportPDFFailed") || "导出 PDF 失败"}: ${msg}`);
    }
  }, [locale, onError, onSuccess]);

  // 导出 Word (.docx)
  const exportWord = useCallback(
    async (htmlContent: string) => {
      try {
        const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

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
          const defaultName = `${t(locale, "untitled") || "untitled"}.docx`;
          const defaultPath = await join(dlDir, defaultName);

          const selected = await save({
            title: t(locale, "exportWordTitle") || "导出为 Word",
            defaultPath: defaultPath,
            filters: [
              {
                name: "Word Document",
                extensions: ["docx"],
              },
            ],
          });

          if (!selected) return; // 用户取消

          // 转换为 Uint8Array 以便写入 Tauri 文件系统
          const arrayBuffer = await new Response(docxBlob).arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("write_docx_atomic", {
            targetPath: selected,
            bytes: Array.from(uint8Array),
          });
        } else {
          // 浏览器调试环境降级：通过 URL.createObjectURL 触发传统下载
          const url = URL.createObjectURL(docxBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${t(locale, "untitled") || "untitled"}.docx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }

        onSuccess?.(t(locale, "exportWordSuccess") || "导出 Word 成功");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onError?.(`${t(locale, "exportWordFailed") || "导出 Word 失败"}: ${msg}`);
        console.error("[useFileExport]", err);
      }
    },
    [locale, onError, onSuccess]
  );

  return { exportPDF, exportWord };
}
