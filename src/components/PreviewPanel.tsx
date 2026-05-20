// ============================================================
// PreviewPanel
// AST 渲染预览面板，事件代理处理点击同步
// ============================================================

import React, { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ASTRenderer } from "@/components/ASTRenderer";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import type { HyloNode } from "@/types";
import { t } from "@/i18n";
import type { Locale } from "@/i18n";

interface PreviewPanelProps {
  astRoot: HyloNode | null;
  onNodeClick?: (nodeId: string) => void;
  highlightedNodeId?: string | null;
  locale?: Locale;
  /** 面板头部标签 */
  label?: string;
  /** 空内容提示 */
  emptyHint?: string;
  /** 面板头部附加的右侧操作区 */
  headerRight?: React.ReactNode;
  /** 右键菜单动作回调 */
  onContextMenuAction?: (actionId: string, nodeId?: string) => void;
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
}: PreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
  const { menuData, openContextMenu, closeContextMenu } = useContextMenu();

  // 初始化 Shadow DOM
  useEffect(() => {
    if (containerRef.current && !shadowRoot) {
      // 修复 React 18 Strict Mode 导致 DOM 未销毁但重新执行 Effect 的问题
      if (containerRef.current.shadowRoot) {
        setShadowRoot(containerRef.current.shadowRoot);
      } else {
        const root = containerRef.current.attachShadow({ mode: "open" });
        setShadowRoot(root);
      }
    }
  }, [shadowRoot]);

  // 点击事件代理：从 composedPath 获取 Shadow DOM 内部的真实目标
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const path = e.nativeEvent.composedPath();
      const target = path[0] as HTMLElement;
      if (!target || !target.closest) return;
      
      const nodeEl = target.closest("[data-hylo-id]");
      if (!nodeEl) return;
      const nodeId = nodeEl.getAttribute("data-hylo-id");
      if (nodeId) {
        onNodeClick?.(nodeId);
      }
    },
    [onNodeClick]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault(); // 必须阻止浏览器默认右键菜单
      e.stopPropagation(); // 阻止冒泡到 document 导致菜单立刻关闭
      const path = e.nativeEvent.composedPath();
      const target = path[0] as HTMLElement;
      
      // 如果不是元素节点（比如文本节点），取其父元素
      const el = target?.nodeType === 1 ? target : target?.parentElement;
      
      if (!el || typeof el.closest !== 'function') {
        openContextMenu(e);
        return;
      }
      
      const nodeEl = el.closest("[data-hylo-id]");
      const nodeId = nodeEl ? nodeEl.getAttribute("data-hylo-id") : undefined;
      
      openContextMenu(e, nodeId ?? undefined);
      
      if (nodeId) {
        onNodeClick?.(nodeId);
      }
    },
    [openContextMenu, onNodeClick]
  );

  // 当高亮节点变化时，将该节点滚动到可见区域
  useEffect(() => {
    if (!highlightedNodeId || !shadowRoot) return;

    const el = shadowRoot.querySelector(
      `[data-hylo-id="${highlightedNodeId}"]`
    ) as HTMLElement | null;

    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [highlightedNodeId, shadowRoot]);

  return (
    <div className="preview-panel">
      {label && (
        <div className="preview-panel__header">
          <span className="preview-panel__label">{label}</span>
          {headerRight && <div style={{ marginLeft: "auto" }}>{headerRight}</div>}
        </div>
      )}
      <div
        className="preview-panel__content"
        ref={containerRef}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {shadowRoot && createPortal(
          <>
            {/* 注入预览专用的高亮样式和滚动条美化 */}
            <style>
              {`
                :host {
                  display: block;
                  height: 100%;
                  overflow: auto;
                  /* 阻断宿主的暗色模式文本颜色继承，恢复浏览器默认的黑底白字阅读体验 */
                  color: #000000;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  font-size: 16px;
                }
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.12); border-radius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.22); }
                .hylo-preview-highlight {
                  background: rgba(99, 102, 241, 0.12) !important;
                  outline: 2px solid rgba(99, 102, 241, 0.55) !important;
                  outline-offset: 1px;
                  border-radius: 4px;
                  transition: all 120ms ease;
                }
                [data-hylo-id]:hover {
                  cursor: pointer;
                  outline: 1px dashed rgba(99, 102, 241, 0.3);
                  outline-offset: 1px;
                  border-radius: 4px;
                }
                .hylo-preview-highlight:hover {
                  outline: 2px solid rgba(99, 102, 241, 0.55) !important;
                }
              `}
            </style>
            {astRoot ? (
              <ASTRenderer root={astRoot} highlightedNodeId={highlightedNodeId ?? null} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#aaa', fontSize: '14px', fontFamily: 'system-ui, sans-serif' }}>
                <p>{emptyHint}</p>
              </div>
            )}
          </>,
          shadowRoot
        )}
      </div>

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
                  { isDivider: true } as any, // 简易分隔线支持（如果 ContextMenu 组件支持的话，这里先兼容）
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
