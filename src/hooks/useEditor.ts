// ============================================================
// useEditor Hook
// ============================================================

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type * as Monaco from "monaco-editor";
import { parseHTML } from "@/core/ast-parser";
import { shouldParseInWorker } from "@ainx/hylo-core";
import { NodeMapManager } from "@/core/node-map";
import { SyncManager } from "@/core/sync-manager";
import { eventBus } from "@/core/event-bus";
import type { ParseResult, SourceLocation } from "@/types";
import { escapeTextForHtml } from "@/core/source-edit";

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
  const isDirtyRef = useRef(false);

  const nodeMapRef = useRef(new NodeMapManager());
  const syncManagerRef = useRef<SyncManager | null>(null);
  // 直接持有 Monaco editor 实例，用于 loadContent 同步 setValue
  const monacoEditorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const savedContentRef = useRef(initialContent);
  const contentRef = useRef(initialContent);
  const parserWorkerRef = useRef<Worker | null>(null);
  const parserWorkerAvailableRef = useRef(true);
  const parserTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWorkerParseRef = useRef<{ version: number; html: string } | null>(null);
  const parseVersion = useRef(0);
  const parseResultRef = useRef<ParseResult | null>(null);

  const clearParserTimeout = useCallback(() => {
    if (parserTimeoutRef.current !== null) {
      clearTimeout(parserTimeoutRef.current);
      parserTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const nodeMap = nodeMapRef.current;
    syncManagerRef.current = new SyncManager(nodeMap, eventBus);
    let parserWorker: Worker | null = null;
    try {
      parserWorker = new Worker(
        new URL("../core/parser.worker.ts", import.meta.url),
        { type: "module" },
      );
      parserWorkerRef.current = parserWorker;
      parserWorker.onmessage = (
        event: MessageEvent<{ version: number; result: ParseResult }>,
      ) => {
        if (event.data.version !== parseVersion.current) return;
        pendingWorkerParseRef.current = null;
        clearParserTimeout();
        eventBus.emit("ast:parsed", { result: event.data.result });
      };
      const handleWorkerFailure = (event?: ErrorEvent | MessageEvent) => {
        if (event instanceof ErrorEvent) event.preventDefault();
        clearParserTimeout();
        parserWorkerAvailableRef.current = false;
        parserWorkerRef.current = null;
        parserWorker?.terminate();
        const pending = pendingWorkerParseRef.current;
        pendingWorkerParseRef.current = null;
        if (pending?.version === parseVersion.current) {
          eventBus.emit("ast:parsed", { result: parseHTML(pending.html) });
        }
      };
      parserWorker.onerror = handleWorkerFailure;
      parserWorker.onmessageerror = handleWorkerFailure;
    } catch {
      parserWorkerAvailableRef.current = false;
      parserWorkerRef.current = null;
    }

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
      clearParserTimeout();
      parserWorker?.terminate();
      parserWorkerRef.current = null;
      pendingWorkerParseRef.current = null;
      syncManagerRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    parseResultRef.current = parseResult;
  }, [parseResult]);

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

  const parseContent = useCallback((html: string): ParseResult | null => {
    const version = ++parseVersion.current;
    if (
      shouldParseInWorker(html.length) &&
      parserWorkerAvailableRef.current &&
      parserWorkerRef.current
    ) {
      pendingWorkerParseRef.current = { version, html };
      // 保留上一份 AST：大文档持续编辑时预览不闪空、点击/高亮仍可用
      setHighlightedPreviewNodeId(null);
      setHighlightedSourceRange(null);
      clearParserTimeout();
      parserTimeoutRef.current = setTimeout(() => {
        const pending = pendingWorkerParseRef.current;
        if (!pending || pending.version !== parseVersion.current) return;
        // Worker 卡死兜底：降级为主线程解析，避免预览永久空白
        parserWorkerAvailableRef.current = false;
        parserWorkerRef.current?.terminate();
        parserWorkerRef.current = null;
        pendingWorkerParseRef.current = null;
        parserTimeoutRef.current = null;
        eventBus.emit("ast:parsed", { result: parseHTML(pending.html) });
      }, 8000);
      try {
        parserWorkerRef.current.postMessage({ version, html });
      } catch {
        clearParserTimeout();
        parserWorkerAvailableRef.current = false;
        parserWorkerRef.current = null;
        pendingWorkerParseRef.current = null;
        return parseHTML(html);
      }
      return null;
    }
    clearParserTimeout();
    pendingWorkerParseRef.current = null;
    return parseHTML(html);
  }, [clearParserTimeout]);

  // 脏状态必须同步更新（防抖会漏掉“刚输入就关窗/新建”的数据丢失场景），
  // 只有解析与 content 状态保持防抖，避免每次按键都触发整棵组件树重渲染。
  const setDirtyState = useCallback((value: boolean) => {
    if (isDirtyRef.current === value) return;
    isDirtyRef.current = value;
    setIsDirty(value);
  }, []);

  const scheduleParse = useMemo(
    () =>
      debounce((newContent: string) => {
        setContent(newContent);
        const result = parseContent(newContent);
        if (result) eventBus.emit("ast:parsed", { result });
      }, 300),
    [parseContent]
  );

  const handleContentChange = useCallback(
    (newContent: string) => {
      setDirtyState(newContent !== savedContentRef.current);
      scheduleParse(newContent);
    },
    [scheduleParse, setDirtyState]
  );

  /** 同步判断是否有未保存修改（读取编辑器实时内容，而不是防抖后的 state）。 */
  const hasUnsavedChanges = useCallback(() => {
    const current = monacoEditorRef.current
      ? monacoEditorRef.current.getValue()
      : contentRef.current;
    return current !== savedContentRef.current;
  }, []);

  /**
   * 加载新文件内容：
   * 1. 同步更新 Monaco 编辑器内容（直接 setValue，无时序问题）
   * 2. 同步解析 AST，立即更新预览
   */
  const loadContent = useCallback((newContent: string, markAsSaved = true) => {
    // 1. 立即更新 Monaco 编辑器（同步，避免 useEffect 时序问题）
    contentRef.current = newContent;
    if (monacoEditorRef.current) {
      monacoEditorRef.current.setValue(newContent);
    } else {
      pendingContentRef.current = newContent;
    }

    // 2. 更新 React 状态
    setContent(newContent);
    savedContentRef.current = markAsSaved ? newContent : "";
    setDirtyState(!markAsSaved);
    setHighlightedPreviewNodeId(null);
    setHighlightedSourceRange(null);

    // 3. 小文件同步刷新；大文件交给 Worker，完成后经 ast:parsed 更新。
    const result = parseContent(newContent);
    if (result) {
      nodeMapRef.current.update(result.nodeMap);
      setParseResult(result);
    }
  }, [parseContent, setDirtyState]);

  /** 在 Monaco 当前光标/选区处插入 HTML（粘贴模式「插入到光标处」）。 */
  const insertAtCursor = useCallback(
    (text: string) => {
      const monacoEditor = monacoEditorRef.current;
      if (!monacoEditor) {
        loadContent(`${contentRef.current}\n${text}`, false);
        return;
      }
      const selection = monacoEditor.getSelection();
      if (!selection) return;
      monacoEditor.executeEdits("hylo-insert", [
        { range: selection, text, forceMoveMarkers: true },
      ]);
      monacoEditor.focus();
    },
    [loadContent],
  );

  /** 用新文本替换源码中的指定区间（保留 Monaco 撤销栈）。 */
  const applySourceReplace = useCallback(
    (startOffset: number, endOffset: number, text: string): boolean => {
      const monacoEditor = monacoEditorRef.current;
      const model = monacoEditor?.getModel();
      if (!monacoEditor || !model) return false;
      if (
        startOffset < 0 ||
        endOffset < startOffset ||
        endOffset > model.getValueLength()
      ) {
        return false;
      }
      const start = model.getPositionAt(startOffset);
      const end = model.getPositionAt(endOffset);
      monacoEditor.executeEdits("hylo-source-edit", [
        {
          range: {
            startLineNumber: start.lineNumber,
            startColumn: start.column,
            endLineNumber: end.lineNumber,
            endColumn: end.column,
          },
          text,
          forceMoveMarkers: true,
        },
      ]);
      monacoEditor.focus();
      return true;
    },
    [],
  );

  /** 把预览里就地编辑后的文本写回源码对应文本节点（转义后替换）。 */
  const applyTextEdit = useCallback(
    (nodeId: string, text: string): boolean => {
      const result = parseResultRef.current;
      const location = result?.nodeMap.get(nodeId) as SourceLocation | undefined;
      if (!location) return false;
      return applySourceReplace(location.startOffset, location.endOffset, escapeTextForHtml(text));
    },
    [applySourceReplace],
  );

  /** 触发 Monaco 内置 action（原生菜单的查找/替换等）。 */
  const triggerEditorAction = useCallback((actionId: string) => {
    monacoEditorRef.current?.trigger("hylo-menu", actionId, null);
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
      contentRef.current = savedContentRef.current;
    } else {
      savedContentRef.current = content;
    }
    setDirtyState(false);
  }, [content, setDirtyState]);

  return {
    content,
    parseResult,
    highlightedPreviewNodeId,
    highlightedSourceRange,
    isDirty,
    hasUnsavedChanges,
    insertAtCursor,
    applyTextEdit,
    applySourceReplace,
    triggerEditorAction,
    handleContentChange,
    handlePreviewClick,
    handleCursorChange,
    loadContent,
    getContent,
    markClean,
    setMonacoEditor,
  };
}
