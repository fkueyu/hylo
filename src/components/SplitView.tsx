// ============================================================
// SplitView
// 可拖拽分屏布局组件，纯 CSS flex + 鼠标事件
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from "react";

interface SplitViewProps {
  left: React.ReactElement;
  right: React.ReactElement;
  /** 初始左侧面板宽度比例 (0–1)，默认 0.5 */
  initialRatio?: number;
  /** 最小面板宽度（px），默认 200 */
  minPanelWidth?: number;
  /** 布局模式：双栏 (both) | 仅编辑器 (editor) | 仅预览 (preview) */
  layoutMode?: "both" | "editor" | "preview";
  /** 是否正在展示源码与预览的节点映射 */
  mappingActive?: boolean;
}

export function SplitView({
  left,
  right,
  initialRatio = 0.5,
  minPanelWidth = 200,
  layoutMode = "both",
  mappingActive = false,
}: SplitViewProps) {
  const [ratio, setRatio] = useState(initialRatio);
  const [dragging, setDragging] = useState(false);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const endDrag = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    isDragging.current = true;
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      if (totalWidth <= 0) return;
      const relativeX = e.clientX - rect.left;

      const minRatio = minPanelWidth / totalWidth;
      const maxRatio = 1 - minPanelWidth / totalWidth;
      const newRatio = Math.min(maxRatio, Math.max(minRatio, relativeX / totalWidth));

      setRatio(newRatio);
    },
    [minPanelWidth]
  );

  useEffect(() => {
    // Pointer Events + capture：即使鼠标移出窗口/松开在窗外也能正确结束拖拽
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", endDrag);
    document.addEventListener("visibilitychange", endDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("blur", endDrag);
      document.removeEventListener("visibilitychange", endDrag);
    };
  }, [handlePointerMove, endDrag]);

  const isEditorOnly = layoutMode === "editor";
  const isPreviewOnly = layoutMode === "preview";

  let leftStyle: React.CSSProperties = { width: `${ratio * 100}%` };
  let rightStyle: React.CSSProperties = { width: `${(1 - ratio) * 100}%` };

  if (isEditorOnly) {
    leftStyle = { width: "100%", flex: 1 };
    rightStyle = { display: "none" };
  } else if (isPreviewOnly) {
    leftStyle = { display: "none" };
    rightStyle = { width: "100%", flex: 1 };
  }

  return (
    <div ref={containerRef} className={`split-view ${mappingActive ? "split-view--mapping-active" : ""}`}>
      {/* 左侧面板 */}
      <div
        className="split-panel split-panel--left"
        style={leftStyle}
      >
        {left}
      </div>

      {/* 分隔线 */}
      {!isEditorOnly && !isPreviewOnly && (
        <div
          className="split-divider"
          onPointerDown={handlePointerDown}
          role="separator"
          aria-orientation="vertical"
          tabIndex={0}
        >
          <div className="split-divider__handle" />
        </div>
      )}

      {/* 右侧面板 */}
      <div
        className="split-panel split-panel--right"
        style={{
          ...rightStyle,
          pointerEvents: dragging ? "none" : undefined,
        }}
      >
        {right}
      </div>
    </div>
  );
}
