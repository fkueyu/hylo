// ============================================================
// Hylo Core Types
// 全局类型契约，所有模块共享
// ============================================================

/**
 * 源代码位置信息
 * 行列号均为 1-based（与 Monaco Editor 保持一致）
 * 偏移量为 0-based 字符索引
 */
export interface SourceLocation {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Hylo 内部 AST 节点
 * parse5 AST 的包装层，附加 nodeId 和 sourceLocation
 */
export interface HyloNode {
  /** nanoid 生成的稳定唯一标识符 */
  nodeId: string;
  /** 节点类型 */
  type: "element" | "text" | "comment" | "document" | "doctype";
  /** 元素标签名（仅 element，已转小写） */
  tagName?: string;
  /** 元素属性键值对（仅 element） */
  attrs?: Record<string, string>;
  /** 子节点列表 */
  children?: HyloNode[];
  /** 文本/注释内容（仅 text/comment） */
  textContent?: string;
  /** 源代码位置（部分隐式节点可能为 null） */
  sourceLocation: SourceLocation | null;
}

/**
 * AST 解析结果
 */
export interface ParseResult {
  /** AST 根节点 */
  root: HyloNode;
  /** nodeId → SourceLocation 映射表 */
  nodeMap: Map<string, SourceLocation>;
  /** 解析耗时（ms） */
  parseTime: number;
  /** 节点总数 */
  nodeCount: number;
}

/**
 * 编辑器顶层状态
 */
export interface EditorState {
  content: string;
  parseResult: ParseResult | null;
  /** 预览面板当前高亮的节点 ID */
  highlightedPreviewNodeId: string | null;
  /** Monaco 当前高亮的源码范围 */
  highlightedSourceRange: SourceLocation | null;
  /** 防止双向同步循环触发的标志 */
  isSyncing: boolean;
}

/**
 * EventBus 事件类型映射
 * 所有事件的 payload 类型在此定义
 */
export type EventMap = {
  /** 用户修改了 HTML 内容 */
  "content:change": { content: string };
  /** AST 解析完成 */
  "ast:parsed": { result: ParseResult };
  /** 用户点击了预览面板中的某个节点 */
  "preview:click": { nodeId: string };
  /** Monaco 光标位置发生变化 */
  "source:cursorChange": { line: number; col: number; offset: number };
  /** 需要在 Monaco 中高亮某个源码范围 */
  "highlight:source": { location: SourceLocation };
  /** 需要在预览面板中高亮某个节点（null 表示取消高亮） */
  "highlight:preview": { nodeId: string | null };
};
