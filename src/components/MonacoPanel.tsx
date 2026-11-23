// ============================================================
// MonacoPanel — 重构版
// 移除 value prop，改用 onEditorReady 暴露 editor 实例
// ============================================================

import { useRef, useCallback, useEffect, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import { t } from "@/i18n";
import type { Locale } from "@/i18n";
import { ensureLocalMonaco } from "@/core/monaco-loader";
import { readClipboardText, writeClipboardText } from "@/core/clipboard";
import type { SourceLocation } from "@/types";

interface MonacoPanelProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
  onCursorChange?: (line: number, col: number, offset: number) => void;
  /** 接收外部高亮范围，触发 Monaco 定位并绘制高亮装饰 */
  highlightRange?: SourceLocation | null;
  /** 面板头部标签（支持双语） */
  label?: string;
  /** 当前主题 */
  theme?: "dark" | "light";
  /** Monaco 就绪后回调，暴露 editor 实例供外部直接调用 setValue 等 */
  onEditorReady?: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
  /** 面板头部附加的右侧操作区 */
  headerRight?: React.ReactNode;
  locale?: Locale;
}

// 固定 options 对象：避免每次渲染都触发 @monaco-editor/react 的 updateOptions
const EDITOR_OPTIONS = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
  fontLigatures: true,
  lineNumbers: "on" as const,
  minimap: { enabled: true, scale: 0.75 },
  scrollBeyondLastLine: false,
  wordWrap: "on" as const,
  tabSize: 2,
  insertSpaces: true,
  automaticLayout: true,
  padding: { top: 12, bottom: 12 },
  lineDecorationsWidth: 4,
  renderLineHighlight: "line" as const,
  smoothScrolling: true,
  cursorBlinking: "smooth" as const,
  cursorSmoothCaretAnimation: "on" as const,
  scrollbar: {
    vertical: "visible" as const,
    horizontal: "auto" as const,
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
    useShadows: false,
    verticalHasArrows: false,
    horizontalHasArrows: false,
  },
  contextmenu: false,
};

export function MonacoPanel({
  initialContent = "",
  onContentChange,
  onCursorChange,
  highlightRange,
  label = "HTML Source",
  theme = "dark",
  onEditorReady,
  headerRight,
  locale = "zh",
}: MonacoPanelProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  // 本地 Monaco 是异步 chunk，加载完成前先渲染占位，避免向 CDN 请求
  const [isMonacoReady, setIsMonacoReady] = useState(false);
  const { menuData, openContextMenu, closeContextMenu } = useContextMenu();

  useEffect(() => () => {
    if (cursorFrameRef.current !== null) cancelAnimationFrame(cursorFrameRef.current);
    cursorFrameRef.current = null;
    pendingCursorRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    ensureLocalMonaco()
      .catch((error) => console.error("[MonacoPanel] Failed to load local Monaco:", error))
      .finally(() => {
        if (!cancelled) setIsMonacoReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const decorationsRef = useRef<string[]>([]);
  const isApplyingHighlight = useRef(false);
  const pendingCursorRef = useRef<Monaco.Position | null>(null);
  const cursorFrameRef = useRef<number | null>(null);

  // 防抖统一放在 useEditor 里，这里直接上报，避免双重防抖（~600ms 延迟）
  const onContentChangeRef = useRef(onContentChange);
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // 暴露 editor 实例给外部（用于 loadContent 直接 setValue）
      onEditorReady?.(editor);

      // 监听光标位置变化：用 rAF 合并高频事件，避免每次按键都触发整棵组件树更新
      editor.onDidChangeCursorPosition((e) => {
        if (isApplyingHighlight.current) return;
        const position = e.position;
        pendingCursorRef.current = position;
        if (cursorFrameRef.current !== null) return;
        cursorFrameRef.current = requestAnimationFrame(() => {
          cursorFrameRef.current = null;
          const latest = pendingCursorRef.current;
          const model = editor.getModel();
          if (!latest || !model) return;
          const offset = model.getOffsetAt(latest);
          onCursorChange?.(latest.lineNumber, latest.column, offset);
        });
      });

      // 初始触发一次解析
      onContentChange?.(editor.getValue());
    },
    [onContentChange, onCursorChange, onEditorReady]
  );

  // 响应外部 highlightRange：定位 + 高亮
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    if (!highlightRange) return;

    const { startLine, startCol, endLine, endCol } = highlightRange;
    isApplyingHighlight.current = true;

    editor.revealPositionInCenter(
      { lineNumber: startLine, column: startCol },
      monaco.editor.ScrollType.Smooth
    );

    decorationsRef.current = editor.deltaDecorations([], [
      {
        range: new monaco.Range(startLine, startCol, endLine, endCol),
        options: {
          className: "hylo-source-highlight",
          isWholeLine: false,
          overviewRuler: {
            color: "rgba(99, 102, 241, 0.8)",
            position: monaco.editor.OverviewRulerLane.Center,
          },
        },
      },
    ]);

    requestAnimationFrame(() => { isApplyingHighlight.current = false; });
  }, [highlightRange]);

  return (
    <div className="monaco-panel">
      {label && (
        <div className="monaco-panel__header">
          <span className="monaco-panel__label">{label}</span>
          {headerRight && <div style={{ marginLeft: "auto" }}>{headerRight}</div>}
        </div>
      )}
      <div
        className="monaco-panel__editor"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openContextMenu(e.nativeEvent);
        }}
      >
        {isMonacoReady ? (
          <Editor
            defaultLanguage="html"
            defaultValue={initialContent}
            theme={theme === "dark" ? "vs-dark" : "light"}
            onMount={handleMount}
            onChange={(v) => onContentChangeRef.current?.(v ?? "")}
            options={EDITOR_OPTIONS}
          />
        ) : (
          <div className="monaco-panel__loading">{t(locale, "editorLoading")}</div>
        )}
      </div>
      {menuData.visible && (
        <ContextMenu
          x={menuData.x}
          y={menuData.y}
          items={[
            {
              label: t(locale, "formatDoc"),
              onClick: () => {
                editorRef.current?.focus();
                editorRef.current?.trigger('source', 'editor.action.formatDocument', null);
                closeContextMenu();
              },
            },
            { isDivider: true } as any,
            {
              label: t(locale, "cut"),
              onClick: () => {
                const editor = editorRef.current;
                if (!editor) return;
                editor.focus();
                const selection = editor.getSelection();
                const model = editor.getModel();
                if (selection && model && !selection.isEmpty()) {
                  const text = model.getValueInRange(selection);
                  void writeClipboardText(text).then(() => {
                    editor.executeEdits("context-menu", [{ range: selection, text: "", forceMoveMarkers: true }]);
                  });
                }
                closeContextMenu();
              },
            },
            {
              label: t(locale, "copy"),
              onClick: () => {
                const editor = editorRef.current;
                if (!editor) return;
                editor.focus();
                const selection = editor.getSelection();
                const model = editor.getModel();
                if (selection && model && !selection.isEmpty()) {
                  const text = model.getValueInRange(selection);
                  void writeClipboardText(text);
                }
                closeContextMenu();
              },
            },
            {
              label: t(locale, "paste"),
              onClick: () => {
                const editor = editorRef.current;
                if (!editor) return;
                editor.focus();
                void readClipboardText().then((text) => {
                  const selection = editor.getSelection();
                  if (selection && text) {
                    editor.executeEdits("context-menu", [{ range: selection, text: text, forceMoveMarkers: true }]);
                  }
                });
                closeContextMenu();
              },
            },
            { isDivider: true } as any,
            {
              label: t(locale, "commandPalette"),
              onClick: () => {
                editorRef.current?.focus();
                editorRef.current?.trigger('source', 'editor.action.quickCommand', null);
                closeContextMenu();
              },
            },
          ]}
        />
      )}
    </div>
  );
}
