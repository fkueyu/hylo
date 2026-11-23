// ============================================================
// Hylo Core Types
// 全局类型契约，所有模块共享
// ============================================================

import type { ParseResult, SourceLocation } from "@ainx/hylo-core";

export type { HyloNode, ParseResult, SourceLocation } from "@ainx/hylo-core";

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
  /** 在隔离预览文档自身触发打印，避免主窗口 iframe 截断。 */
  /** Monaco 光标位置发生变化 */
  "source:cursorChange": { line: number; col: number; offset: number };
  /** 需要在 Monaco 中高亮某个源码范围 */
  "highlight:source": { location: SourceLocation };
  /** 需要在预览面板中高亮某个节点（null 表示取消高亮） */
  "highlight:preview": { nodeId: string | null };
};
