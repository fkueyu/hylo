import type { HyloNode } from "@/types";
import type { OutlineItem } from "@ainx/hylo-core";
export {
  buildDocumentOutline,
  countOutlineItems,
  findNodeTrail,
} from "@ainx/hylo-core";
export type { OutlineItem, NodeTrailItem } from "@ainx/hylo-core";

export function isUsableHtmlClipboard(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /<[a-z][a-z0-9-]*(?:\s[^<>]*?)?\s*\/?\s*>/i.test(trimmed);
}

export function normalizeHtmlClipboard(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:html?)?\s*\n?([\s\S]*?)\n?```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

/** 按 nodeId 在 AST 中查找节点（属性快速编辑等场景使用）。 */
export function findNodeById(root: HyloNode | null, nodeId: string): HyloNode | null {
  if (!root || !nodeId) return null;
  if (root.nodeId === nodeId) return root;
  for (const child of root.children ?? []) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

export interface OutlineRow {
  item: OutlineItem;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
}

/**
 * 把大纲树按折叠状态压平为可见行（供虚拟化列表渲染）。
 * 行数与文档节点数同阶，但只渲染视口附近的行。
 */
export function flattenOutline(
  items: OutlineItem[],
  collapsed: ReadonlySet<string>,
): OutlineRow[] {
  const rows: OutlineRow[] = [];
  const MAX_ROWS = 100_000;
  const visit = (item: OutlineItem, depth: number) => {
    if (rows.length >= MAX_ROWS) return;
    const hasChildren = (item.children?.length ?? 0) > 0;
    const isCollapsed = collapsed.has(item.nodeId);
    rows.push({ item, depth, hasChildren, collapsed: isCollapsed });
    if (hasChildren && !isCollapsed) {
      for (const child of item.children) visit(child, depth + 1);
    }
  };
  for (const item of items) visit(item, 0);
  return rows;
}
