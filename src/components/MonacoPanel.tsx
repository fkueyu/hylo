// ============================================================
// MonacoPanel — 重构版
// 移除 value prop，改用 onEditorReady 暴露 editor 实例
// ============================================================

import { useRef, useCallback, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import { t } from "@/i18n";
import type { Locale } from "@/i18n";
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
  const { menuData, openContextMenu, closeContextMenu } = useContextMenu();
  const decorationsRef = useRef<string[]>([]);
  const isApplyingHighlight = useRef(false);

  // debounce 300ms，仅用于用户手动编辑
  const debouncedContentChange = useRef(
    debounce((content: string) => {
      onContentChange?.(content);
    }, 300)
  ).current;

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // 暴露 editor 实例给外部（用于 loadContent 直接 setValue）
      onEditorReady?.(editor);

      // 监听光标位置变化
      editor.onDidChangeCursorPosition((e) => {
        if (isApplyingHighlight.current) return;
        const position = e.position;
        const model = editor.getModel();
        if (!model) return;
        const offset = model.getOffsetAt(position);
        onCursorChange?.(position.lineNumber, position.column, offset);
      });

      // 初始触发一次解析
      onContentChange?.(initialContent);
    },
    [initialContent, onContentChange, onCursorChange, onEditorReady, openContextMenu]
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
        <Editor
          defaultLanguage="html"
          defaultValue={initialContent}
          theme={theme === "dark" ? "vs-dark" : "light"}
          onMount={handleMount}
          onChange={(v) => debouncedContentChange(v ?? "")}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
            fontLigatures: true,
            lineNumbers: "on",
            minimap: { enabled: true, scale: 0.75 },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            insertSpaces: true,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            lineDecorationsWidth: 4,
            renderLineHighlight: "line",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            scrollbar: {
              vertical: "visible",
              horizontal: "auto",
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
              useShadows: false,
              verticalHasArrows: false,
              horizontalHasArrows: false,
            },
            contextmenu: false,
          }}
        />
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
                  navigator.clipboard.writeText(text).then(() => {
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
                  navigator.clipboard.writeText(text);
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
                navigator.clipboard.readText().then((text) => {
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
