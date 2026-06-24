// ============================================================
// useEditor Hook
// ============================================================

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type * as Monaco from "monaco-editor";
import { parseHTML } from "@/core/ast-parser";
import { NodeMapManager } from "@/core/node-map";
import { SyncManager } from "@/core/sync-manager";
import { eventBus } from "@/core/event-bus";
import type { ParseResult, SourceLocation } from "@/types";

function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): (...args: T) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function useEditor(initialContent: string) {
  const [content, setContent] = useState(initialContent);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [highlightedPreviewNodeId, setHighlightedPreviewNodeId] = useState<string | null>(null);
  const [highlightedSourceRange, setHighlightedSourceRange] = useState<SourceLocation | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const nodeMapRef = useRef(new NodeMapManager());
  const syncManagerRef = useRef<SyncManager | null>(null);
  // 直接持有 Monaco editor 实例，用于 loadContent 同步 setValue
  const monacoEditorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const savedContentRef = useRef(initialContent);

  useEffect(() => {
    const nodeMap = nodeMapRef.current;
    syncManagerRef.current = new SyncManager(nodeMap, eventBus);

    const off1 = eventBus.on("ast:parsed", ({ result }) => {
      nodeMap.update(result.nodeMap);
      setParseResult(result);
    });
    const off2 = eventBus.on("highlight:preview", ({ nodeId }) => {
      setHighlightedPreviewNodeId(nodeId);
    });
    const off3 = eventBus.on("highlight:source", ({ location }) => {
      setHighlightedSourceRange(location);
    });

    // 初始解析
    const initial = parseHTML(initialContent);
    nodeMap.update(initial.nodeMap);
    setParseResult(initial);

    return () => {
      off1(); off2(); off3();
      syncManagerRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 接收 Monaco editor 实例
  const setMonacoEditor = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor) => {
      monacoEditorRef.current = editor;
      if (pendingContentRef.current !== null) {
        editor.setValue(pendingContentRef.current);
        pendingContentRef.current = null;
      }
    },
    []
  );

  // debounce 300ms 用于用户手动编辑
  const handleContentChange = useMemo(
    () =>
      debounce((newContent: string) => {
        setContent(newContent);
        setIsDirty(newContent !== savedContentRef.current);
        const result = parseHTML(newContent);
        eventBus.emit("ast:parsed", { result });
      }, 300),
    []
  );

  /**
   * 加载新文件内容：
   * 1. 同步更新 Monaco 编辑器内容（直接 setValue，无时序问题）
   * 2. 同步解析 AST，立即更新预览
   */
  const loadContent = useCallback((newContent: string) => {
    // 1. 立即更新 Monaco 编辑器（同步，避免 useEffect 时序问题）
    if (monacoEditorRef.current) {
      monacoEditorRef.current.setValue(newContent);
    } else {
      pendingContentRef.current = newContent;
    }

    // 2. 更新 React 状态
    setContent(newContent);
    savedContentRef.current = newContent;
    setIsDirty(false);
    setHighlightedPreviewNodeId(null);
    setHighlightedSourceRange(null);

    // 3. 同步解析，立即刷新预览
    const result = parseHTML(newContent);
    nodeMapRef.current.update(result.nodeMap);
    setParseResult(result);
  }, []);

  const handlePreviewClick = useCallback((nodeId: string) => {
    eventBus.emit("preview:click", { nodeId });
  }, []);

  const handleCursorChange = useCallback((line: number, col: number, offset: number) => {
    eventBus.emit("source:cursorChange", { line, col, offset });
  }, []);

  const getContent = useCallback(() => {
    return monacoEditorRef.current ? monacoEditorRef.current.getValue() : content;
  }, [content]);

  const markClean = useCallback(() => {
    if (monacoEditorRef.current) {
      savedContentRef.current = monacoEditorRef.current.getValue();
    } else {
      savedContentRef.current = content;
    }
    setIsDirty(false);
  }, [content]);

  return {
    content,
    parseResult,
    highlightedPreviewNodeId,
    highlightedSourceRange,
    isDirty,
    handleContentChange,
    handlePreviewClick,
    handleCursorChange,
    loadContent,
    getContent,
    markClean,
    setMonacoEditor,
  };
}
