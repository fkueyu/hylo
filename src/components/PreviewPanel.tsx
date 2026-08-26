import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import {
  buildPreviewFrameDocument,
  isPreviewFrameMessage,
  type PreviewMode,
} from "@/core/preview-security";
import { t, type Locale } from "@/i18n";
import type { HyloNode } from "@/types";
import { eventBus } from "@/core/event-bus";

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
}

const PREVIEW_MODE_KEY = "hylo.previewMode";
const INTERACTIVE_NOTICE_KEY = "hylo.interactivePreviewAcknowledged";

function readPreviewMode(): PreviewMode {
  return localStorage.getItem(PREVIEW_MODE_KEY) === "interactive" ? "interactive" : "safe";
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
}: PreviewPanelProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const frameReadyRef = useRef(false);
  const highlightedNodeIdRef = useRef(highlightedNodeId);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(readPreviewMode);
  const { menuData, openContextMenuAt, closeContextMenu } = useContextMenu();
  const nodeIds = useMemo(() => collectNodeIds(astRoot), [astRoot]);

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
  }, [nodeIds, onNodeClick, openContextMenuAt, sendRender]);

  useEffect(() => {
    postToFrame({
      type: "highlight",
      nodeId: highlightedNodeId ?? null,
      scroll: true,
    });
  }, [highlightedNodeId, postToFrame]);

  useEffect(() => eventBus.on("preview:print", () => {
    postToFrame({ type: "print" });
  }), [postToFrame]);

  const togglePreviewMode = () => {
    const nextMode: PreviewMode = previewMode === "safe" ? "interactive" : "safe";
    if (
      nextMode === "interactive"
      && localStorage.getItem(INTERACTIVE_NOTICE_KEY) !== "true"
    ) {
      if (!window.confirm(t(locale, "interactivePreviewConfirm"))) return;
      localStorage.setItem(INTERACTIVE_NOTICE_KEY, "true");
    }
    localStorage.setItem(PREVIEW_MODE_KEY, nextMode);
    setPreviewMode(nextMode);
  };

  return (
    <div className="preview-panel">
      {label && (
        <div className="preview-panel__header">
          <span className="preview-panel__label">{label}</span>
          <span className="preview-panel__security-hint">
            {previewMode === "safe" ? t(locale, "safePreviewHint") : ""}
          </span>
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
                    label: t(locale, "copy"),
                    onClick: () => {
                      onContextMenuAction?.("copy", menuData.nodeId);
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
