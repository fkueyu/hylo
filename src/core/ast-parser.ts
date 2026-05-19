// ============================================================
// Hylo AST Parser
// HTML String → HyloNode 树 + NodeMap
// ============================================================

import { parse } from "parse5";
import { nanoid } from "nanoid";
import type { HyloNode, SourceLocation, ParseResult } from "@/types";

// parse5 内部类型（通过 any 绕过 bundler 路径限制，实际类型安全由运行时保证）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P5Node = any;

// ── 内部辅助 ────────────────────────────────────────────────

function extractLocation(loc: P5Node): SourceLocation | null {
  if (!loc) return null;
  return {
    startLine: loc.startLine ?? 1,
    startCol: loc.startCol ?? 1,
    endLine: loc.endLine ?? 1,
    endCol: loc.endCol ?? 1,
    startOffset: loc.startOffset ?? 0,
    endOffset: loc.endOffset ?? 0,
  };
}

function traverseNode(
  node: P5Node,
  nodeMap: Map<string, SourceLocation>,
  counter: { count: number }
): HyloNode {
  const nodeId = nanoid(8);
  counter.count++;

  const nodeName: string = node.nodeName ?? "";

  // Document 根节点
  if (nodeName === "#document") {
    const sourceLocation = extractLocation(node.sourceCodeLocation);
    if (sourceLocation) nodeMap.set(nodeId, sourceLocation);

    const children: HyloNode[] = (node.childNodes ?? []).map((child: P5Node) =>
      traverseNode(child, nodeMap, counter)
    );
    return { nodeId, type: "document", children, sourceLocation };
  }

  // DOCTYPE（parse5 实际使用 '#documentType' 驼峰形式）
  if (nodeName === "#document-type" || nodeName === "#documentType") {
    const sourceLocation = extractLocation(node.sourceCodeLocation);
    if (sourceLocation) nodeMap.set(nodeId, sourceLocation);
    return { nodeId, type: "doctype", sourceLocation };
  }

  // 文本节点
  if (nodeName === "#text") {
    const sourceLocation = extractLocation(node.sourceCodeLocation);
    if (sourceLocation) nodeMap.set(nodeId, sourceLocation);
    return {
      nodeId,
      type: "text",
      textContent: node.value ?? "",
      sourceLocation,
    };
  }

  // 注释节点
  if (nodeName === "#comment") {
    const sourceLocation = extractLocation(node.sourceCodeLocation);
    if (sourceLocation) nodeMap.set(nodeId, sourceLocation);
    return {
      nodeId,
      type: "comment",
      textContent: node.data ?? "",
      sourceLocation,
    };
  }

  // 元素节点（默认）
  const sourceLocation = extractLocation(node.sourceCodeLocation);
  if (sourceLocation) nodeMap.set(nodeId, sourceLocation);

  // 属性转 Record
  const attrs: Record<string, string> = {};
  for (const attr of node.attrs ?? []) {
    attrs[attr.name] = attr.value;
  }

  // 递归处理子节点
  const children: HyloNode[] = (node.childNodes ?? []).map((child: P5Node) =>
    traverseNode(child, nodeMap, counter)
  );

  return {
    nodeId,
    type: "element",
    tagName: (node.tagName ?? nodeName).toLowerCase(),
    attrs,
    children,
    sourceLocation,
  };
}

// ── 公共 API ─────────────────────────────────────────────────

/**
 * 将 HTML 字符串解析为 HyloNode 树和 NodeMap
 */
export function parseHTML(html: string): ParseResult {
  const start = performance.now();

  const ast = parse(html, { sourceCodeLocationInfo: true });
  const nodeMap = new Map<string, SourceLocation>();
  const counter = { count: 0 };

  const root = traverseNode(ast, nodeMap, counter);
  const parseTime = performance.now() - start;

  return {
    root,
    nodeMap,
    parseTime,
    nodeCount: counter.count,
  };
}
