// ============================================================
// ASTRenderer
// 将 HyloNode 树递归渲染为 React 元素
// ============================================================

import React from "react";
import type { HyloNode } from "@/types";

// 这些标签不应该渲染子节点内容（void elements）
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

// 这些标签的内容在预览中跳过渲染（但保留节点结构）
const SKIP_CONTENT_TAGS = new Set(["script"]);

// 解析内联 style 字符串为 React style 对象
function parseStyleString(styleStr: string): React.CSSProperties {
  const styleObj: React.CSSProperties = {};
  if (!styleStr || typeof styleStr !== "string") return styleObj;
  
  styleStr.split(";").forEach((rule) => {
    const colonIndex = rule.indexOf(":");
    if (colonIndex > 0) {
      const key = rule.slice(0, colonIndex).trim();
      const value = rule.slice(colonIndex + 1).trim();
      if (key && value) {
        // kebab-case 转 camelCase
        const camelKey = key.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        (styleObj as any)[camelKey] = value;
      }
    }
  });
  return styleObj;
}

interface ASTRendererProps {
  root: HyloNode;
  highlightedNodeId: string | null;
}

function renderNode(
  node: HyloNode,
  highlightedNodeId: string | null,
  index: number
): React.ReactNode {
  switch (node.type) {
    case "text":
      return node.textContent ?? null;

    case "comment":
    case "doctype":
      return null;

    case "document":
      return (
        <React.Fragment key={node.nodeId}>
          {node.children?.map((child, i) =>
            renderNode(child, highlightedNodeId, i)
          )}
        </React.Fragment>
      );

    case "element": {
      const tag = node.tagName!;
      const isHighlighted = node.nodeId === highlightedNodeId;
      const skipContent = SKIP_CONTENT_TAGS.has(tag);
      const isVoid = VOID_ELEMENTS.has(tag);

      // parse5 会自动补全 html/head/body 骨架节点。
      // html 和 head 在 React 里直接渲染会有很多副作用，透传子节点。
      // 但 body 必须渲染，否则用户在 <style> 中写的 body { ... } 样式会全部失效（如边距、背景色）
      const TRANSPARENT_TAGS = new Set(["html", "head"]);
      if (TRANSPARENT_TAGS.has(tag)) {
        return (
          <React.Fragment key={`${node.nodeId}-${index}`}>
            {node.children?.map((child, i) =>
              renderNode(child, highlightedNodeId, i)
            )}
          </React.Fragment>
        );
      }

      // 构建 props，过滤掉 React 保留属性名
      const safeAttrs: Record<string, any> = {};
      if (node.attrs) {
        for (const [key, val] of Object.entries(node.attrs)) {
          // class → className 特殊处理
          if (key === "class") {
            safeAttrs["className"] = val;
          } else if (key === "for") {
            safeAttrs["htmlFor"] = val;
          } else if (key === "style") {
            // 修复：React style 必须是对象，不能是字符串
            safeAttrs["style"] = parseStyleString(val);
          } else if (key.startsWith("on")) {
            // 跳过内联事件属性，避免 XSS
          } else {
            safeAttrs[key] = val;
          }
        }
      }

      const props: Record<string, unknown> = {
        key: `${node.nodeId}-${index}`,
        "data-hylo-id": node.nodeId,
        ...safeAttrs,
        // 高亮样式叠加
        className: [safeAttrs["className"], isHighlighted ? "hylo-preview-highlight" : ""]
          .filter(Boolean)
          .join(" ") || undefined,
      };

      // Void 元素没有子节点
      if (isVoid) {
        return React.createElement(tag, props);
      }

      // script 标签不渲染实际内容
      if (skipContent) {
        return React.createElement(tag, props);
      }

      const children = node.children?.map((child, i) =>
        renderNode(child, highlightedNodeId, i)
      );

      return React.createElement(tag, props, ...(children ?? []));
    }

    default:
      return null;
  }
}

export function ASTRenderer({ root, highlightedNodeId }: ASTRendererProps) {
  return (
    <div className="ast-renderer">
      {renderNode(root, highlightedNodeId, 0)}
    </div>
  );
}
