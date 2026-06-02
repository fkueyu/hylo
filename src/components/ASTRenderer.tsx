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
// 这里移除 script，因为我们改用自定义的 DynamicScript 执行
const SKIP_CONTENT_TAGS = new Set([""]);

function DynamicScript({ node }: { node: HyloNode }) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const doc = containerRef.current?.ownerDocument;
    if (!doc) return;

    const src = node.attrs?.src;
    
    // 如果是外链脚本，通过 src 排重，避免因为 AST 更新导致脚本不断被销毁和重建（这会中断网络请求）
    if (src) {
      if (doc.querySelector(`script[src="${src}"]`)) {
        return;
      }
    }

    const innerContent = node.children?.length === 1 && node.children[0].type === "text"
      ? node.children[0].textContent || ""
      : "";

    const script = doc.createElement("script");
    if (node.attrs) {
      for (const [key, val] of Object.entries(node.attrs)) {
        script.setAttribute(key, val);
      }
    }
    if (innerContent) {
      // 使用块级作用域 {} 包裹并用 try-catch 保护，既能避免 const/let 重复声明导致的 SyntaxError，
      // 又能确保全局赋值（如 tailwind.config = ...）依然能正确作用于全局，同时防止脚本错误阻断预览。
      script.textContent = `try {\n{\n${innerContent}\n}\n} catch (e) {\n  console.error("Hylo inline script error:", e);\n}`;
    }
    
    doc.head.appendChild(script);

    return () => {
      // 对于外链脚本，不移除以防浏览器取消正在进行的网络请求，且外链脚本已在上方排重；
      // 对于内联脚本，执行是同步且瞬时的，在卸载时安全移除可以防止 DOM 树中积累成百上千个历史脚本节点。
      if (!src) {
        script.remove();
      }
    };
  }, [node]);

  return <div ref={containerRef} style={{ display: "none" }} data-hylo-id={node.nodeId} />;
}

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
      // html 和 head 在 React 19 里直接渲染会有很多副作用，透传子节点。
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

      if (tag === "body") {
        props["data-hylo-body"] = "true";
      }

      const renderTag = tag === "body" ? "div" : tag;

      // Void 元素没有子节点
      if (isVoid) {
        return React.createElement(renderTag, props);
      }

      // style 标签特殊处理：重写 body 选择器以匹配我们的代理 div
      if (tag === "style" && node.children?.length === 1 && node.children[0].type === "text") {
        const cssText = node.children[0].textContent || "";
        const rewritten = cssText.replace(/(^|[\s}>,])body(?=[\s{>,.:#\[]|$)/gi, "$1div[data-hylo-body]");
        return React.createElement(renderTag, props, rewritten);
      }

      // script 标签需要实际执行，使用 DynamicScript 组件
      if (tag === "script") {
        return <DynamicScript key={`${node.nodeId}-${index}`} node={node} />;
      }

      if (skipContent) {
        return React.createElement(renderTag, props);
      }

      const children = node.children?.map((child, i) =>
        renderNode(child, highlightedNodeId, i)
      );

      return React.createElement(renderTag, props, ...(children ?? []));
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
