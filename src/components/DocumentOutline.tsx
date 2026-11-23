import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { flattenOutline, type OutlineItem, type OutlineRow } from "@/core/document-structure";

interface DocumentOutlineProps {
  items: OutlineItem[];
  selectedNodeId: string | null;
  selectedTrailIds: string[];
  emptyLabel: string;
  collapseLabel: string;
  expandLabel: string;
  onSelect: (nodeId: string) => void;
}

/** 单行高度需与 CSS `.outline-node { height }` 保持一致 */
const ROW_HEIGHT = 27;
const OVERSCAN_ROWS = 8;

export function DocumentOutline({
  items,
  selectedNodeId,
  selectedTrailIds,
  emptyLabel,
  collapseLabel,
  expandLabel,
  onSelect,
}: DocumentOutlineProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // 选中节点在折叠内时自动展开其祖先
  useEffect(() => {
    if (selectedTrailIds.length === 0) return;
    setCollapsed((current) => {
      const next = new Set(current);
      selectedTrailIds.forEach((nodeId) => next.delete(nodeId));
      return next.size === current.size ? current : next;
    });
  }, [selectedTrailIds]);

  const rows = useMemo(() => flattenOutline(items, collapsed), [items, collapsed]);

  // 视口高度（虚拟化窗口大小）
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setViewportHeight(viewport.clientHeight);
    update();
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(update);
      observer.observe(viewport);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 行数变少时修正滚动位置 / 焦点索引
  useEffect(() => {
    const maxScroll = Math.max(0, rows.length * ROW_HEIGHT - viewportHeight);
    setScrollTop((current) => (current > maxScroll ? maxScroll : current));
    setFocusIndex((current) =>
      current === null || rows.length === 0 ? null : Math.min(current, rows.length - 1),
    );
  }, [rows.length, viewportHeight]);

  // 选中节点滚动到可见区域
  useEffect(() => {
    if (!selectedNodeId) return;
    const index = rows.findIndex((row) => row.item.nodeId === selectedNodeId);
    if (index < 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const top = index * ROW_HEIGHT;
    if (top < viewport.scrollTop) viewport.scrollTop = top;
    else if (top + ROW_HEIGHT > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTop = top + ROW_HEIGHT - viewport.clientHeight;
    }
  }, [selectedNodeId, rows, viewportHeight]);

  // 键盘导航焦点：滚动到目标行并聚焦对应按钮
  useEffect(() => {
    if (focusIndex === null) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const top = focusIndex * ROW_HEIGHT;
    if (top < viewport.scrollTop) viewport.scrollTop = top;
    else if (top + ROW_HEIGHT > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTop = top + ROW_HEIGHT - viewport.clientHeight;
    }
    const focusTarget = () => {
      viewport
        .querySelector<HTMLButtonElement>(`[data-row-index="${focusIndex}"] .outline-node__target`)
        ?.focus();
    };
    const frame = requestAnimationFrame(focusTarget);
    const timer = window.setTimeout(focusTarget, 40);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusIndex, scrollTop, viewportHeight]);

  const handleToggle = (nodeId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleTreeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if (rows.length === 0) return;
    const target = event.target as HTMLElement | null;
    const rowElement = target?.closest<HTMLElement>("[data-row-index]");
    const currentIndex =
      focusIndex ?? (rowElement ? Number(rowElement.dataset.rowIndex) : -1);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : Math.min(rows.length - 1, currentIndex + 1);
    if (event.key === "ArrowUp") nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = rows.length - 1;
    event.preventDefault();
    setFocusIndex(nextIndex);
  };

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const endIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS,
  );
  const visibleRows: OutlineRow[] = rows.slice(startIndex, endIndex);
  const paddingTop = startIndex * ROW_HEIGHT;
  const paddingBottom = Math.max(0, (rows.length - endIndex) * ROW_HEIGHT);

  return (
    <aside className="document-outline">
      {items.length === 0 ? (
        <p className="document-outline__empty">{emptyLabel}</p>
      ) : (
        <div
          ref={viewportRef}
          className="document-outline__viewport"
          role="tree"
          tabIndex={-1}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          onKeyDown={handleTreeKeyDown}
        >
          <div style={{ height: paddingTop }} aria-hidden="true" />
          {visibleRows.map((row, offset) => {
            const index = startIndex + offset;
            const { item, depth, hasChildren, collapsed: isCollapsed } = row;
            const isSelected = item.nodeId === selectedNodeId;
            return (
              <div
                key={item.nodeId}
                role="treeitem"
                aria-level={depth + 1}
                aria-selected={isSelected}
                aria-expanded={hasChildren ? !isCollapsed : undefined}
                className={`outline-node ${isSelected ? "outline-node--selected" : ""}`}
                style={{ "--outline-depth": depth } as CSSProperties}
                data-row-index={index}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    className="outline-node__toggle"
                    onClick={() => handleToggle(item.nodeId)}
                    aria-label={isCollapsed ? expandLabel : collapseLabel}
                  >
                    <svg viewBox="0 0 12 12" aria-hidden="true">
                      <path d="m4 2 4 4-4 4" />
                    </svg>
                  </button>
                ) : (
                  <span className="outline-node__spacer" aria-hidden="true" />
                )}
                <button
                  type="button"
                  className="outline-node__target"
                  data-row-index={index}
                  onClick={() => onSelect(item.nodeId)}
                  title={`${item.tagName}${item.detail}`}
                >
                  <span className="outline-node__tag">{item.tagName}</span>
                  {item.detail && <span className="outline-node__detail">{item.detail}</span>}
                </button>
              </div>
            );
          })}
          <div style={{ height: paddingBottom }} aria-hidden="true" />
        </div>
      )}
    </aside>
  );
}
