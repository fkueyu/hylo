import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { OutlineItem } from "@/core/document-structure";

interface DocumentOutlineProps {
  items: OutlineItem[];
  selectedNodeId: string | null;
  selectedTrailIds: string[];
  emptyLabel: string;
  collapseLabel: string;
  expandLabel: string;
  onSelect: (nodeId: string) => void;
}

interface OutlineBranchProps extends Omit<DocumentOutlineProps, "items" | "emptyLabel" | "selectedTrailIds"> {
  item: OutlineItem;
  depth: number;
  collapsed: Set<string>;
  onToggle: (nodeId: string) => void;
}

function OutlineBranch({
  item,
  depth,
  selectedNodeId,
  collapseLabel,
  expandLabel,
  collapsed,
  onToggle,
  onSelect,
}: OutlineBranchProps) {
  const hasChildren = item.children.length > 0;
  const isCollapsed = collapsed.has(item.nodeId);
  const isSelected = selectedNodeId === item.nodeId;

  return (
    <li role="treeitem" aria-selected={isSelected} aria-expanded={hasChildren ? !isCollapsed : undefined}>
      <div
        className={`outline-node ${isSelected ? "outline-node--selected" : ""}`}
        style={{ "--outline-depth": depth } as CSSProperties}
      >
        {hasChildren ? (
          <button
            type="button"
            className="outline-node__toggle"
            onClick={() => onToggle(item.nodeId)}
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
          onClick={() => onSelect(item.nodeId)}
          title={`${item.tagName}${item.detail}`}
        >
          <span className="outline-node__tag">{item.tagName}</span>
          {item.detail && <span className="outline-node__detail">{item.detail}</span>}
        </button>
      </div>

      {hasChildren && !isCollapsed && (
        <ul role="group">
          {item.children.map((child) => (
            <OutlineBranch
              key={child.nodeId}
              item={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              collapseLabel={collapseLabel}
              expandLabel={expandLabel}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

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

  useEffect(() => {
    if (selectedTrailIds.length === 0) return;
    setCollapsed((current) => {
      const next = new Set(current);
      selectedTrailIds.forEach((nodeId) => next.delete(nodeId));
      return next.size === current.size ? current : next;
    });
  }, [selectedTrailIds]);

  const handleToggle = (nodeId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  return (
    <aside className="document-outline">
      {items.length === 0 ? (
        <p className="document-outline__empty">{emptyLabel}</p>
      ) : (
        <ul className="document-outline__tree" role="tree">
          {items.map((item) => (
            <OutlineBranch
              key={item.nodeId}
              item={item}
              depth={0}
              selectedNodeId={selectedNodeId}
              collapseLabel={collapseLabel}
              expandLabel={expandLabel}
              collapsed={collapsed}
              onToggle={handleToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}
