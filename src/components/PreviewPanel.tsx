import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import {
  buildPreviewFrameDocument,
  isPreviewFrameMessage,
  type PreviewDiagnostics,
  type PreviewMode,
} from "@/core/preview-security";
import { t, type Locale } from "@/i18n";
import type { HyloNode } from "@/types";

interface PreviewPanelProps {
  astRoot: HyloNode | null;
  onNodeClick?: (nodeId: string) => void;
  highlightedNodeId?: string | null;
  locale?: Locale;
  label?: string;
  emptyHint?: string;
  headerRight?: React.ReactNode;
  onContextMenuAction?: (actionId: string, nodeId?: string) => void;
  filepath?: string | null;
  /** 打印时按内容真实高度展开 iframe，保证长文档完整输出 */
  printing?: boolean;
  /** 预览内就地编辑文本后，把新文本写回源码 */
  onTextEdit?: (nodeId: string, text: string) => void;
  /** 文档标识变化（打开/新建/切换文件）时把预览模式重置回安全模式 */
  documentKey?: string;
}

function collectNodeIds(root: HyloNode | null): Set<string> {
  const ids = new Set<string>();
  function visit(node: HyloNode) {
    ids.add(node.nodeId);
    node.children?.forEach(visit);
  }
  if (root) visit(root);
  return ids;
}

export function PreviewPanel({
  astRoot,
  onNodeClick,
  highlightedNodeId,
  locale = "zh",
  label = "Preview",
  emptyHint = "Start typing HTML in the editor…",
  headerRight,
  onContextMenuAction,
  filepath,
  printing = false,
  documentKey,
  onTextEdit,
}: PreviewPanelProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const frameReadyRef = useRef(false);
  const highlightedNodeIdRef = useRef(highlightedNodeId);
  // 交互预览是“按文档信任”的决定：每次打开新文档都回到安全预览
  const [previewMode, setPreviewMode] = useState<PreviewMode>("safe");
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [diagnostics, setDiagnostics] = useState<PreviewDiagnostics | null>(null);
  const { menuData, openContextMenuAt, closeContextMenu } = useContextMenu();
  const nodeIds = useMemo(() => collectNodeIds(astRoot), [astRoot]);

  useEffect(() => {
    setPreviewMode("safe");
  }, [documentKey]);

  const baseHref = useMemo(() => {
    if (!filepath) return null;
    const separator = Math.max(filepath.lastIndexOf("/"), filepath.lastIndexOf("\\"));
    if (separator < 0) return null;
    return `${convertFileSrc(filepath.slice(0, separator))}/`;
  }, [filepath]);

  const frameDocument = useMemo(
    () => buildPreviewFrameDocument({ mode: previewMode, baseHref }),
    [baseHref, previewMode],
  );

  const postToFrame = useCallback((message: Record<string, unknown>) => {
    if (!frameReadyRef.current) return;
    frameRef.current?.contentWindow?.postMessage(
      { channel: "hylo-preview", ...message },
      "*",
    );
  }, []);

  const sendRender = useCallback(() => {
    postToFrame({
      type: "render",
      ast: astRoot,
      mode: previewMode,
      highlightedNodeId: highlightedNodeIdRef.current ?? null,
    });
  }, [astRoot, postToFrame, previewMode]);

  const handleFrameLoad = useCallback(() => {
    // The child may post preview-ready before React's passive message effect is installed.
    // load is a reliable second handshake point after the frame runtime has initialized.
    frameReadyRef.current = true;
    sendRender();
  }, [sendRender]);

  useEffect(() => {
    highlightedNodeIdRef.current = highlightedNodeId;
  }, [highlightedNodeId]);

  useEffect(() => {
    frameReadyRef.current = false;
    setDiagnostics(null);
  }, [frameDocument]);

  useEffect(() => {
    if (previewMode === "interactive" && frameReadyRef.current) {
      frameReadyRef.current = false;
      const frame = frameRef.current;
      if (frame) frame.srcdoc = frameDocument;
      return;
    }
    sendRender();
  }, [frameDocument, previewMode, sendRender]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (!isPreviewFrameMessage(event.data)) return;

      if (event.data.type === "preview-ready") {
        frameReadyRef.current = true;
        sendRender();
        return;
      }

      if (event.data.type === "frame-height") {
        setContentHeight(event.data.height);
        return;
      }

      if (event.data.type === "diagnostics") {
        setDiagnostics(event.data);
        return;
      }

      if (event.data.type === "open-link") {
        const href = event.data.href;
        if (/^https?:/i.test(href)) {
          openUrl(href).catch(async (error) => {
            console.error("Failed to open preview link:", error);
            await message(t(locale, "linkOpenFailedDesc"), {
              title: t(locale, "linkOpenFailed"),
              kind: "error",
            });
          });
        }
        return;
      }

      if (event.data.type === "text-edit") {
        onTextEdit?.(event.data.nodeId, event.data.text);
        return;
      }

      const nodeId = event.data.nodeId;
      if (nodeId && !nodeIds.has(nodeId)) return;
      if (event.data.type === "node-selected") {
        onNodeClick?.(event.data.nodeId);
        return;
      }

      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect) return;
      openContextMenuAt(rect.left + event.data.x, rect.top + event.data.y, nodeId ?? undefined);
      if (nodeId) onNodeClick?.(nodeId);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [nodeIds, onNodeClick, openContextMenuAt, sendRender, locale, onTextEdit]);

  useEffect(() => {
    postToFrame({
      type: "highlight",
      nodeId: highlightedNodeId ?? null,
      scroll: true,
    });
  }, [highlightedNodeId, postToFrame]);

  const togglePreviewMode = async () => {
    const nextMode: PreviewMode = previewMode === "safe" ? "interactive" : "safe";
    if (nextMode === "interactive") {
      const accepted = await ask(t(locale, "interactivePreviewConfirm"), {
        title: t(locale, "interactivePreviewTitle"),
        kind: "warning",
        okLabel: t(locale, "confirmOk"),
        cancelLabel: t(locale, "confirmCancel"),
      });
      if (!accepted) return;
    }
    setPreviewMode(nextMode);
  };

  const diagnosticsParts: string[] = [];
  if (diagnostics) {
    if (diagnostics.scripts > 0) {
      diagnosticsParts.push(`${diagnostics.scripts} ${t(locale, "diagnosticsScripts")}`);
    }
    if (diagnostics.remoteAssets > 0) {
      diagnosticsParts.push(`${diagnostics.remoteAssets} ${t(locale, "diagnosticsRemote")}`);
    }
    if (diagnostics.embeds > 0) {
      diagnosticsParts.push(`${diagnostics.embeds} ${t(locale, "diagnosticsEmbeds")}`);
    }
  }
  const diagnosticsSummary = diagnosticsParts.join(" · ");
  const showDiagnostics = previewMode === "safe" && diagnosticsParts.length > 0;

  return (
    <div className={`preview-panel ${printing ? "preview-panel--printing" : ""}`}>
      {label && (
        <div className="preview-panel__header">
          <span className="preview-panel__label">{label}</span>
          <span className="preview-panel__security-hint">
            {previewMode === "safe"
              ? `${t(locale, "safePreviewHint")} · ${t(locale, "inlineEditHint")}`
              : t(locale, "inlineEditHint")}
          </span>
          {showDiagnostics && (
            <button
              type="button"
              className="preview-panel__diagnostics"
              onClick={() => void togglePreviewMode()}
              title={t(locale, "diagnosticsEnableHint")}
            >
              ⚠ {t(locale, "diagnosticsBlocked")} {diagnosticsSummary}
            </button>
          )}
          <button
            type="button"
            className={`preview-panel__mode ${previewMode === "interactive" ? "is-interactive" : ""}`}
            onClick={togglePreviewMode}
            aria-pressed={previewMode === "interactive"}
          >
            {t(locale, previewMode === "safe" ? "safePreview" : "interactivePreview")}
          </button>
          {headerRight && <div className="preview-panel__actions">{headerRight}</div>}
        </div>
      )}

      <iframe
        className="preview-panel__content"
        ref={frameRef}
        sandbox="allow-scripts"
        srcDoc={frameDocument}
        onLoad={handleFrameLoad}
        style={printing && contentHeight > 0 ? { height: `${contentHeight}px` } : undefined}
        title={label || t(locale, "previewPanel")}
      />

      {!astRoot && (
        <div className="preview-panel__empty">
          <p>{emptyHint}</p>
        </div>
      )}

      {menuData.visible && (
        <ContextMenu
          x={menuData.x}
          y={menuData.y}
          items={[
            ...(menuData.nodeId
              ? [
                  {
                    label: t(locale, "inspect"),
                    onClick: () => {
                      onNodeClick?.(menuData.nodeId!);
                      closeContextMenu();
                    },
                  },
                  {
                    label: t(locale, "editAttributes"),
                    onClick: () => {
                      onContextMenuAction?.("editAttributes", menuData.nodeId ?? undefined);
                      closeContextMenu();
                    },
                  },
                  { isDivider: true } as const,
                ]
              : []),
            {
              label: t(locale, "openFile"),
              onClick: () => {
                onContextMenuAction?.("openFile");
                closeContextMenu();
              },
            },
            {
              label: t(locale, "saveFile"),
              onClick: () => {
                onContextMenuAction?.("saveFile");
                closeContextMenu();
              },
            },
            {
              label: t(locale, "exportToPDF"),
              onClick: () => {
                onContextMenuAction?.("exportPDF");
                closeContextMenu();
              },
            },
            {
              label: t(locale, "exportToWord"),
              onClick: () => {
                onContextMenuAction?.("exportWord");
                closeContextMenu();
              },
            },
            {
              label: t(locale, "toggleTheme"),
              onClick: () => {
                onContextMenuAction?.("toggleTheme");
                closeContextMenu();
              },
            },
          ]}
        />
      )}
    </div>
  );
}
