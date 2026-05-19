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
}

export function SplitView({
  left,
  right,
  initialRatio = 0.5,
  minPanelWidth = 200,
  layoutMode = "both",
}: SplitViewProps) {
  const [ratio, setRatio] = useState(initialRatio);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const relativeX = e.clientX - rect.left;

      const minRatio = minPanelWidth / totalWidth;
      const maxRatio = 1 - minPanelWidth / totalWidth;
      const newRatio = Math.min(maxRatio, Math.max(minRatio, relativeX / totalWidth));

      setRatio(newRatio);
    },
    [minPanelWidth]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

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
    <div ref={containerRef} className="split-view">
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
          onMouseDown={handleMouseDown}
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
        style={rightStyle}
      >
        {right}
      </div>
    </div>
  );
}
