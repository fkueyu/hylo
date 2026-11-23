// ============================================================
// source-edit — 源码级微调工具（文本节点 / 元素 start-tag 的定位与替换）
// ============================================================

/** 把预览里编辑后的纯文本安全地写回 HTML 源码（转义文本内容，不转义引号）。 */
export function escapeTextForHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 属性值转义（包含引号，用于重新序列化 start tag）。 */
export function escapeAttributeValue(value: string): string {
  return escapeTextForHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function replaceSourceRange(
  content: string,
  start: number,
  end: number,
  replacement: string,
): string | null {
  if (
    start < 0 ||
    end < start ||
    end > content.length ||
    !Number.isInteger(start) ||
    !Number.isInteger(end)
  ) {
    return null;
  }
  return content.slice(0, start) + replacement + content.slice(end);
}

export interface StartTagRange {
  start: number;
  /** 结束位置（不含），即 `>` 之后 */
  end: number;
  selfClosing: boolean;
}

/**
 * 从元素源码起始位置（parse5 的 startOffset，指向 `<`）解析 start-tag 范围。
 * 扫描时跳过引号内的 `>`，避免属性值里带 `>` 时截断错误。
 */
export function findStartTagRange(content: string, elementStartOffset: number): StartTagRange | null {
  if (
    !Number.isInteger(elementStartOffset) ||
    elementStartOffset < 0 ||
    elementStartOffset >= content.length
  ) {
    return null;
  }
  if (content[elementStartOffset] !== "<") return null;
  let quote: '"' | "'" | null = null;
  for (let index = elementStartOffset + 1; index < content.length; index += 1) {
    const char = content[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") {
      let cursor = index - 1;
      while (cursor > elementStartOffset && /\s/.test(content[cursor])) cursor -= 1;
      return { start: elementStartOffset, end: index + 1, selfClosing: content[cursor] === "/" };
    }
  }
  return null;
}

/**
 * 用 AST 中的属性表重新序列化 start-tag。
 * v1 说明：会按 AST 的属性顺序重写整个开始标签（保留属性值内容），
 * 因此原有的属性引号风格/换行格式会被规范化。
 */
export function serializeStartTag(
  tagName: string,
  attrs: Record<string, string>,
  selfClosing: boolean,
): string {
  const serializedAttrs = Object.entries(attrs)
    .map(([name, value]) =>
      value === "" ? ` ${name}` : ` ${name}="${escapeAttributeValue(value)}"`,
    )
    .join("");
  return `<${tagName}${serializedAttrs}${selfClosing ? " /" : ""}>`;
}
