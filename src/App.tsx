// ============================================================
// App.tsx — Hylo 根组件（含文件打开、双语、全屏布局）
// ============================================================

import { useState, useCallback, useEffect, useRef } from "react";
import { SplitView } from "@/components/SplitView";
import { MonacoPanel } from "@/components/MonacoPanel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import { useEditor } from "@/hooks/useEditor";
import { useFileOpen } from "@/hooks/useFileOpen";
import { useFileSave } from "@/hooks/useFileSave";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { DropdownMenu } from "@/components/DropdownMenu";
import { useFileExport } from "@/hooks/useFileExport";
import type { Locale } from "@/i18n";
import { t } from "@/i18n";
import { UpdateModal } from "@/components/UpdateModal";
import { HistoryModal } from "@/components/HistoryModal";
import { AboutModal } from "@/components/AboutModal";
import { useHistory } from "@/hooks/useHistory";

// ── 内置示例文档 ─────────────────────────────────────────────
const INITIAL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>欢迎使用 Hylo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', sans-serif;
      margin: 0;
      padding: 32px 40px;
      line-height: 1.75;
      color: #1a1a2e;
      box-sizing: border-box;
    }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.25rem; color: #111; }
    h2 { font-size: 1.15rem; font-weight: 600; margin-top: 2rem; color: #222; }
    p  { margin: 0.75rem 0; color: #444; }
    code {
      background: #f0f0f5;
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.875em;
      font-family: 'JetBrains Mono', monospace;
    }
    blockquote {
      border-left: 3px solid #6366f1;
      margin: 1.25rem 0;
      padding: 0.75rem 1.25rem;
      background: #f5f5ff;
      border-radius: 0 6px 6px 0;
      color: #555;
    }
    ul { padding-left: 1.5rem; }
    li { margin: 0.4rem 0; color: #444; }
    .tag { color: #6366f1; font-weight: 500; }
    a { color: #007aff; text-decoration: none; border-bottom: 1px solid transparent; transition: all 0.2s; }
    a:hover { border-bottom-color: #007aff; }
  </style>
</head>
<body>

  <h1>欢迎使用 Hylo ✦</h1>

  <blockquote>
    <p>HTML 的 Typora — AI 原生可视化编辑器</p>
  </blockquote>

  <p>
    Hylo 消除了 <strong>源代码</strong> 与 <strong>渲染预览</strong> 之间的割裂感，
    将 HTML 视为文档格式，而不是 Web 开发产物。
  </p>

  <h2>快速体验</h2>
  <ul>
    <li>点击右侧预览区的任意元素 → 左侧立即定位对应源码</li>
    <li>在编辑器中移动光标 → 右侧高亮对应的渲染元素</li>
    <li>拖动中间分隔线调整面板宽度</li>
    <li>点击工具栏「打开文件」加载本地 HTML 文档</li>
  </ul>

  <h2>AI 时代而生</h2>
  <p>
    大语言模型越来越多地直接生成 <code>HTML</code>。
    Hylo 让你无需接触原始标记，即可检查、编辑和精调 AI 生成的文档。
  </p>

  <h2>架构原理</h2>
  <p>
    每个渲染元素都通过 <code>parse5</code> AST 映射回精确的源码位置。
    无 <code>iframe</code>，无 <code>innerHTML</code>——
    只有带稳定节点标识符的干净 React 渲染树。
  </p>

  <h2>获取更多</h2>
  <ul>
    <li>官网：<a href="https://ainx.ink/hylo/" target="_blank">ainx.ink/hylo/</a></li>
    <li>VS Code 插件：<a href="https://marketplace.visualstudio.com/items?itemName=AINX.hylo-html-preview" target="_blank">在插件市场获取</a></li>
    <li>GitHub 源码：<a href="https://github.com/fkueyu/hylo" target="_blank">fkueyu/hylo</a></li>
  </ul>

</body>
</html>`;

const INITIAL_HTML_EN = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Welcome to Hylo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 32px 40px;
      line-height: 1.75;
      color: #1a1a2e;
      box-sizing: border-box;
    }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.25rem; color: #111; }
    h2 { font-size: 1.15rem; font-weight: 600; margin-top: 2rem; color: #222; }
    p  { margin: 0.75rem 0; color: #444; }
    code {
      background: #f0f0f5;
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.875em;
      font-family: 'JetBrains Mono', monospace;
    }
    blockquote {
      border-left: 3px solid #6366f1;
      margin: 1.25rem 0;
      padding: 0.75rem 1.25rem;
      background: #f5f5ff;
      border-radius: 0 6px 6px 0;
      color: #555;
    }
    ul { padding-left: 1.5rem; }
    li { margin: 0.4rem 0; color: #444; }
    .tag { color: #6366f1; font-weight: 500; }
    a { color: #007aff; text-decoration: none; border-bottom: 1px solid transparent; transition: all 0.2s; }
    a:hover { border-bottom-color: #007aff; }
  </style>
</head>
<body>

  <h1>Welcome to Hylo ✦</h1>

  <blockquote>
    <p>Typora for HTML — AI Native Visual Editor</p>
  </blockquote>

  <p>
    Hylo eliminates the disconnect between <strong>Source Code</strong> and <strong>Render Preview</strong>,
    treating HTML as a document format rather than a raw web development artifact.
  </p>

  <h2>Quick Start</h2>
  <ul>
    <li>Click any element in the preview pane on the right → instantly locates and highlights the corresponding source code on the left.</li>
    <li>Move your cursor in the editor → highlights the corresponding rendered element in the preview.</li>
    <li>Drag the middle splitter to adjust the widths of the panes.</li>
    <li>Click "Open File" in the titlebar to load your local HTML files.</li>
  </ul>

  <h2>Born for the AI Era</h2>
  <p>
    Large Language Models increasingly generate direct <code>HTML</code> output.
    Hylo lets you review, edit, and fine-tune AI-generated documents without touching the raw markup.
  </p>

  <h2>How It Works</h2>
  <p>
    Every rendered element is mapped back to its precise source location using the <code>parse5</code> AST.
    No <code>iframe</code>, no <code>innerHTML</code> — just a clean React render tree with stable node identifiers.
  </p>

  <h2>Learn More</h2>
  <ul>
    <li>Website: <a href="https://ainx.ink/hylo/" target="_blank">ainx.ink/hylo/</a></li>
    <li>VS Code Extension: <a href="https://marketplace.visualstudio.com/items?itemName=AINX.hylo-html-preview" target="_blank">Available in VS Code Marketplace</a></li>
    <li>GitHub Repository: <a href="https://github.com/fkueyu/hylo" target="_blank">fkueyu/hylo</a></li>
  </ul>

</body>
</html>`;

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    }
    return "zh";
  });
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  });
  const [layout, setLayout] = useState<"both" | "editor" | "preview">("both");
  const [filename, setFilename] = useState<string | null>(null);
  const [filepath, setFilepath] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const updateModalRef = useRef<any>(null);

  const isMac = typeof window !== "undefined" && navigator.userAgent.includes("Mac");

  // 根据当前初始测得的语言加载默认欢迎文档
  const editor = useEditor(locale === "zh" ? INITIAL_HTML : INITIAL_HTML_EN);

  // 首屏挂载以及 locale 变更时同步通知 Rust 刷新原生菜单栏
  useEffect(() => {
    invoke("update_menu", { locale }).catch((err) => {
      console.error("Failed to update native menu via invoke:", err);
    });
  }, [locale]);

  // 根据 theme 的变化自动同步 Body 类名，适配亮暗主题渲染
  useEffect(() => {
    if (theme === "light") {
      document.body.classList.add("theme-light");
    } else {
      document.body.classList.remove("theme-light");
    }
  }, [theme]);

  const latestRef = useRef<any>({
    filepath,
    editor,
  });

  const { history, addHistory, clearHistory, removeHistory } = useHistory();

  useEffect(() => {
    latestRef.current = {
      filepath,
      editor,
      saveFile,
      saveFileAs,
      handleNewFile,
      handleOpenFile,
      exportPDF,
      exportWord,
      addHistory,
    };
  });

  // 处理冷启动或运行中从系统级 "Open With" 传来的文件
  useEffect(() => {
    const handleSystemOpenFile = async (path: string) => {
      try {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const content = await readTextFile(path);
        const name = path.split(/[/\\]/).pop() ?? t(locale, "untitled");
        latestRef.current.editor.loadContent(content);
        setFilename(name);
        setFilepath(path);
        latestRef.current.addHistory(path, name);
      } catch (err) {
        console.error("Failed to open system file:", err);
      }
    };

    const unlistenFileOpen = listen<string>("open-file-url", (event) => {
      handleSystemOpenFile(event.payload);
    });

    let unlistenDragDrop: (() => void) | undefined;
    getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        const path = event.payload.paths[0];
        if (path) {
          handleSystemOpenFile(path);
        }
      }
    }).then((fn) => {
      unlistenDragDrop = fn;
    }).catch(console.error);

    invoke<string | null>("get_opened_file")
      .then((path) => {
        if (path) {
          handleSystemOpenFile(path);
        }
      })
      .catch(console.error);

    return () => {
      unlistenFileOpen.then((fn) => fn());
      if (unlistenDragDrop) {
        unlistenDragDrop();
      }
    };
  }, [locale]);

  // 文件加载回调
  const handleFileLoaded = useCallback(
    (content: string, name: string, path: string) => {
      editor.loadContent(content);
      setFilename(name);
      setFilepath(path);
      addHistory(path, name);
    },
    [editor, addHistory]
  );

  // 文件保存回调
  const handleFileSaved = useCallback(
    (name: string, path: string) => {
      setFilename(name);
      setFilepath(path);
      editor.markClean();
      addHistory(path, name);
    },
    [editor, addHistory]
  );

  const { openFile } = useFileOpen({
    locale,
    onFileLoaded: handleFileLoaded,
    onError: (msg) => console.error(msg),
  });

  const { saveFile, saveFileAs } = useFileSave({
    locale,
    onFileSaved: handleFileSaved,
    onError: (msg) => console.error(msg),
  });

  const { exportPDF, exportWord } = useFileExport({
    locale,
    onError: (msg) => {
      message(msg, { title: t(locale, "exportWordFailed"), kind: "error" });
    },
    onSuccess: (msg) => {
      message(msg, { title: t(locale, "exportMenu"), kind: "info" });
    },
  });

  // 新建文件处理（清除内容并重置路径，带 isDirty 二次确认）
  const handleNewFile = useCallback(async () => {
    if (editor.isDirty) {
      const confirm = await ask(t(locale, "confirmNewFileDesc"), {
        title: t(locale, "confirmNewFileTitle"),
        kind: "warning",
        okLabel: t(locale, "confirmOk"),
        cancelLabel: t(locale, "confirmCancel"),
      });
      if (!confirm) return;
    }
    editor.loadContent(""); // 新建时清空编辑器
    setFilename(null);
    setFilepath(null);
  }, [editor, locale]);

  // 打开文件处理（带 isDirty 二次确认）
  const handleOpenFile = useCallback(async () => {
    if (editor.isDirty) {
      const confirm = await ask(t(locale, "confirmOpenFileDesc"), {
        title: t(locale, "confirmOpenFileTitle"),
        kind: "warning",
        okLabel: t(locale, "confirmOk"),
        cancelLabel: t(locale, "confirmCancel"),
      });
      if (!confirm) return;
    }
    openFile();
  }, [editor.isDirty, openFile, locale]);

  const {
    menuData: globalMenuData,
    openContextMenu: openGlobalContextMenu,
    closeContextMenu: closeGlobalContextMenu,
  } = useContextMenu();

  const toggleLocale = () => {
    setLocale((prev) => (prev === "zh" ? "en" : "zh"));
  };
  const toggleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  const renderLayoutSwitcher = () => (
    <div className="layout-switcher" onMouseDown={(e) => e.stopPropagation()}>
      <button
        className={`layout-switcher__btn ${layout === "editor" ? "active" : ""}`}
        onClick={() => setLayout("editor")}
        title={t(locale, "layoutEditor")}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </button>
      <button
        className={`layout-switcher__btn ${layout === "both" ? "active" : ""}`}
        onClick={() => setLayout("both")}
        title={t(locale, "layoutBoth")}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      </button>
      <button
        className={`layout-switcher__btn ${layout === "preview" ? "active" : ""}`}
        onClick={() => setLayout("preview")}
        title={t(locale, "layoutPreview")}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  );

  // 监听 macOS 原生顶部菜单栏事件
  useEffect(() => {
    const unlisten = listen<string>("native-menu-action", (event) => {
      const state = latestRef.current;
      switch (event.payload) {
        case "new-file":
          state.handleNewFile();
          break;
        case "open-file":
          state.handleOpenFile();
          break;
        case "open-history":
          setIsHistoryOpen(true);
          break;
        case "save-file":
          state.saveFile(state.editor.getContent(), state.filepath);
          break;
        case "save-file-as":
          state.saveFileAs(state.editor.getContent(), state.filepath);
          break;
        case "export-pdf":
          state.exportPDF();
          break;
        case "export-word":
          state.exportWord(state.editor.getContent());
          break;
        case "toggle-theme":
          toggleTheme();
          break;
        case "toggle-lang":
          toggleLocale();
          break;
        case "about-app":
          setIsAboutOpen(true);
          break;
        case "check-updates":
          updateModalRef.current?.checkUpdates(true);
          break;
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 处理全局右键点击
  const handleGlobalContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      openGlobalContextMenu(e.nativeEvent);
    },
    [openGlobalContextMenu]
  );

  return (
    <div className="app" onContextMenu={handleGlobalContextMenu}>
      {/* ── 全局统一标题栏 ── */}
      <header className={`app-titlebar ${isMac ? "app-titlebar--mac" : ""}`} data-tauri-drag-region>
        <div className="app-titlebar__left">
          <img 
            src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"} 
            alt="Logo" 
            style={{ 
              width: "16px",
              height: "16px",
              objectFit: "contain",
              userSelect: "none",
              display: "block"
            }} 
          />
          <div className="app-titlebar__title-group">
            <span className="app-titlebar__name">Hylo</span>
            <span className="app-titlebar__sep">/</span>
            <span 
              className="app-titlebar__filename" 
              style={{ 
                maxWidth: "400px", 
                cursor: "default"
              }}
              title={filepath ? filepath : (filename || t(locale, "untitled"))}
            >
              {filename || t(locale, "untitled")}
              {editor.isDirty && <span style={{ color: "var(--color-accent)", marginLeft: "4px" }}>*</span>}
            </span>
          </div>
        </div>

        <div className="app-titlebar__right">
          {editor.parseResult && (
            <span className="app-titlebar__stats">
              {editor.parseResult.nodeCount}{t(locale, "nodes")}
              &nbsp;·&nbsp;
              {editor.parseResult.parseTime.toFixed(1)}&thinsp;{t(locale, "ms")}
            </span>
          )}
          
          {editor.parseResult && <div className="app-titlebar__divider" />}

          {renderLayoutSwitcher()}
          
          <DropdownMenu
            label={t(locale, "exportMenu")}
            items={[
              {
                label: t(locale, "exportToPDF"),
                onClick: exportPDF,
              },
              {
                label: t(locale, "exportToWord"),
                onClick: () => exportWord(editor.getContent()),
              },
            ]}
          />
          
          <button
            className="toolbar-btn toolbar-btn--lang"
            onClick={toggleTheme}
            title={t(locale, "toggleTheme")}
            style={{ background: "transparent", border: "none", padding: 0, height: "auto" }}
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
        </div>
      </header>

      {/* ── 主编辑区 ── */}
      <main className="app-main">
        <SplitView
          initialRatio={0.45}
          minPanelWidth={240}
          layoutMode={layout}
          left={
            <MonacoPanel
              initialContent={editor.content}
              theme={theme}
              onEditorReady={editor.setMonacoEditor}
              onContentChange={editor.handleContentChange}
              onCursorChange={editor.handleCursorChange}
              highlightRange={editor.highlightedSourceRange}
              locale={locale}
            />
          }
          right={
            <PreviewPanel
              astRoot={editor.parseResult?.root ?? null}
              highlightedNodeId={editor.highlightedPreviewNodeId}
              onNodeClick={editor.handlePreviewClick}
              locale={locale}
              filepath={filepath}
              emptyHint={t(locale, "emptyHint")}
              onContextMenuAction={(action) => {
                switch (action) {
                  case "openFile":
                    openFile();
                    break;
                  case "saveFile":
                    saveFile(editor.getContent(), filepath);
                    break;
                  case "exportPDF":
                    exportPDF();
                    break;
                  case "exportWord":
                    exportWord(editor.getContent());
                    break;
                  case "toggleTheme":
                    toggleTheme();
                    break;
                  case "copy":
                    console.log("Copy requested");
                    break;
                }
              }}
            />
          }
        />
      </main>

      {/* 全局右键菜单 */}
      {globalMenuData.visible && (
        <ContextMenu
          x={globalMenuData.x}
          y={globalMenuData.y}
          items={[
            {
              label: t(locale, "newFile"),
              onClick: () => {
                handleNewFile();
                closeGlobalContextMenu();
              },
            },
            {
              label: t(locale, "openFile"),
              onClick: () => {
                handleOpenFile();
                closeGlobalContextMenu();
              },
            },
            {
              label: t(locale, "saveFile"),
              onClick: () => {
                saveFile(editor.getContent(), filepath);
                closeGlobalContextMenu();
              },
            },
            {
              label: t(locale, "exportToPDF"),
              onClick: () => {
                exportPDF();
                closeGlobalContextMenu();
              },
            },
            {
              label: t(locale, "exportToWord"),
              onClick: () => {
                exportWord(editor.getContent());
                closeGlobalContextMenu();
              },
            },
            { isDivider: true } as any,
            {
              label: t(locale, "layoutEditor"),
              onClick: () => {
                setLayout("editor");
                closeGlobalContextMenu();
              },
            },
            {
              label: t(locale, "layoutPreview"),
              onClick: () => {
                setLayout("preview");
                closeGlobalContextMenu();
              },
            },
            {
              label: t(locale, "layoutBoth"),
              onClick: () => {
                setLayout("both");
                closeGlobalContextMenu();
              },
            },
            { isDivider: true } as any,
            {
              label: t(locale, "reloadApp"),
              onClick: () => {
                window.location.reload();
                closeGlobalContextMenu();
              },
            },
            {
              label: t(locale, "toggleTheme"),
              onClick: () => {
                toggleTheme();
                closeGlobalContextMenu();
              },
            },
            ...(import.meta.env.VITE_APP_STORE !== "true" ? [
              {
                label: t(locale, "updateTitle"),
                onClick: () => {
                  updateModalRef.current?.checkUpdates(true);
                  closeGlobalContextMenu();
                },
              }
            ] : []),
          ]}
        />
      )}
      <UpdateModal ref={updateModalRef} locale={locale} />
      <HistoryModal
        isOpen={isHistoryOpen}
        locale={locale}
        history={history}
        onClose={() => setIsHistoryOpen(false)}
        onFileLoaded={handleFileLoaded}
        onClear={clearHistory}
        onRemove={removeHistory}
      />
      <AboutModal
        isOpen={isAboutOpen}
        locale={locale}
        theme={theme}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
}
