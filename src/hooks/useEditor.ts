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
  const parserWorkerRef = useRef<Worker | null>(null);
  const parserWorkerAvailableRef = useRef(true);
  const pendingWorkerParseRef = useRef<{ version: number; html: string } | null>(null);
  const parseVersion = useRef(0);

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
        eventBus.emit("ast:parsed", { result: event.data.result });
      };
      const handleWorkerFailure = (event?: ErrorEvent | MessageEvent) => {
        if (event instanceof ErrorEvent) event.preventDefault();
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
      parserWorker?.terminate();
      parserWorkerRef.current = null;
      pendingWorkerParseRef.current = null;
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

  const parseContent = useCallback((html: string): ParseResult | null => {
    const version = ++parseVersion.current;
    if (
      shouldParseInWorker(html.length) &&
      parserWorkerAvailableRef.current &&
      parserWorkerRef.current
    ) {
      pendingWorkerParseRef.current = { version, html };
      nodeMapRef.current.clear();
      setParseResult(null);
      setHighlightedPreviewNodeId(null);
      setHighlightedSourceRange(null);
      try {
        parserWorkerRef.current.postMessage({ version, html });
      } catch {
        parserWorkerAvailableRef.current = false;
        parserWorkerRef.current = null;
        pendingWorkerParseRef.current = null;
        return parseHTML(html);
      }
      return null;
    }
    pendingWorkerParseRef.current = null;
    return parseHTML(html);
  }, []);

  // debounce 300ms 用于用户手动编辑
  const handleContentChange = useMemo(
    () =>
      debounce((newContent: string) => {
        setContent(newContent);
        setIsDirty(newContent !== savedContentRef.current);
        const result = parseContent(newContent);
        if (result) eventBus.emit("ast:parsed", { result });
      }, 300),
    [parseContent]
  );

  /**
   * 加载新文件内容：
   * 1. 同步更新 Monaco 编辑器内容（直接 setValue，无时序问题）
   * 2. 同步解析 AST，立即更新预览
   */
  const loadContent = useCallback((newContent: string, markAsSaved = true) => {
    // 1. 立即更新 Monaco 编辑器（同步，避免 useEffect 时序问题）
    if (monacoEditorRef.current) {
      monacoEditorRef.current.setValue(newContent);
    } else {
      pendingContentRef.current = newContent;
    }

    // 2. 更新 React 状态
    setContent(newContent);
    savedContentRef.current = markAsSaved ? newContent : "";
    setIsDirty(!markAsSaved);
    setHighlightedPreviewNodeId(null);
    setHighlightedSourceRange(null);

    // 3. 小文件同步刷新；大文件交给 Worker，完成后经 ast:parsed 更新。
    const result = parseContent(newContent);
    if (result) {
      nodeMapRef.current.update(result.nodeMap);
      setParseResult(result);
    }
  }, [parseContent]);

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
