import { useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { downloadDir, join } from "@tauri-apps/api/path";
import type { Locale } from "@/i18n";
import { t } from "@/i18n";
import HTMLtoDOCX from "html-to-docx";

interface UseFileExportOptions {
  locale: Locale;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export function useFileExport({ locale, onError, onSuccess }: UseFileExportOptions) {
  // 导出 PDF
  const exportPDF = useCallback(async () => {
    try {
      const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
      if (isTauri) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("export_pdf");
      } else {
        window.print();
      }
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

        // 构造完整的符合 html-to-docx 渲染要求的文档
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Export</title>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

        // 转换成 Word
        const docxBlob = await HTMLtoDOCX(fullHtml, undefined, {
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

          await writeFile(selected, uint8Array);
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
