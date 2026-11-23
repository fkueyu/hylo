// ============================================================
// App.tsx — Hylo 根组件（含文件打开、双语、全屏布局）
// ============================================================

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import {
  SYSTEM_OPEN_REQUEST_EVENT,
  filenameFromPath,
  readSystemFile,
  takePendingSystemFiles,
} from "@/core/system-file";
import { DropdownMenu } from "@/components/DropdownMenu";
import { useFileExport } from "@/hooks/useFileExport";
import type { Locale } from "@/i18n";
import { t } from "@/i18n";
import { UpdateModal } from "@/components/UpdateModal";
import { HistoryModal } from "@/components/HistoryModal";
import { AboutModal } from "@/components/AboutModal";
import { PasteHtmlModal, type PasteMode } from "@/components/PasteHtmlModal";
import { NodeAttributesModal } from "@/components/NodeAttributesModal";
import { AuditModal } from "@/components/AuditModal";
import { auditDocument } from "@/core/audit";
import { useHistory } from "@/hooks/useHistory";
import { DocumentOutline } from "@/components/DocumentOutline";
import { INITIAL_HTML, INITIAL_HTML_EN } from "@/assets/welcome";
import { readClipboardText } from "@/core/clipboard";
import { clearDraft, readDraft, saveDraft } from "@/core/draft";
import { useFileWatcher } from "@/hooks/useFileWatcher";
import { findStartTagRange, serializeStartTag } from "@/core/source-edit";
import {
  buildDocumentOutline,
  countOutlineItems,
  findNodeById,
  findNodeTrail,
  isUsableHtmlClipboard,
  normalizeHtmlClipboard,
} from "@/core/document-structure";

const isTauriRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;




const STORAGE_KEYS = {
  locale: "hylo.locale",
  theme: "hylo.theme",
  layout: "hylo.layout",
} as const;

function readStoredLocale(): Locale | null {
  if (typeof localStorage === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEYS.locale);
  return stored === "zh" || stored === "en" ? stored : null;
}

function readStoredTheme(): "dark" | "light" | null {
  if (typeof localStorage === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  return stored === "dark" || stored === "light" ? stored : null;
}

function readStoredLayout(): "both" | "editor" | "preview" | null {
  if (typeof localStorage === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEYS.layout);
  return stored === "both" || stored === "editor" || stored === "preview" ? stored : null;
}

type EditorApi = ReturnType<typeof useEditor>;

/** latestRef 快照：让菜单/系统事件回调始终拿到最新状态，同时避免 any。 */
interface AppLatestState {
  filepath: string | null;
  filename: string | null;
  layout: "both" | "editor" | "preview";
  editor: EditorApi;
  isDirty: boolean;
  hasUnsavedChanges: () => boolean;
  locale: Locale;
  saveFile: (content: string, currentFilepath: string | null) => Promise<boolean>;
  saveFileAs: (content: string, currentFilepath: string | null) => Promise<void>;
  handleNewFile: () => Promise<void>;
  handleOpenFile: () => Promise<void>;
  handleExportPDF: () => Promise<void>;
  handleExportWord: (content?: string) => Promise<void> | void;
  addHistory: (path: string, name: string) => void;
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    const stored = readStoredLocale();
    if (stored) return stored;
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    }
    return "zh";
  });
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = readStoredTheme();
    if (stored) return stored;
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  });
  const [layout, setLayout] = useState<"both" | "editor" | "preview">(
    () => readStoredLayout() ?? "both",
  );

  // 跟随界面语言设置 <html lang>，便于读屏与字体回退
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  // 持久化用户偏好，下次启动恢复；未手动设置主题时跟随系统变化
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.locale, locale); } catch {}
  }, [locale]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.layout, layout); } catch {}
  }, [layout]);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      // 只有用户从未手动切换过主题时才跟随系统
      if (!readStoredTheme()) setTheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  const [filename, setFilename] = useState<string | null>(null);
  const [filepath, setFilepath] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const updateModalRef = useRef<any>(null);

  const isMac = typeof window !== "undefined" && navigator.userAgent.includes("Mac");
  // 打印进行中：PreviewPanel 按真实内容高度展开 iframe，保证长文档不被截断
  const [isPrinting, setIsPrinting] = useState(false);
  const [pendingPasteHtml, setPendingPasteHtml] = useState<string | null>(null);
  const [attributeEditNodeId, setAttributeEditNodeId] = useState<string | null>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const printRestoreRef = useRef<{
    layout: "both" | "editor" | "preview";
    announceSuccess: boolean;
  } | null>(null);
  const printSuccessMessageRef = useRef<string | null>(null);
  const exitInProgressRef = useRef(false);
  const watcherIgnoreBeforeRef = useRef(0);

  // 根据当前初始测得的语言加载默认欢迎文档
  const editor = useEditor(locale === "zh" ? INITIAL_HTML : INITIAL_HTML_EN);

  // 自动保存草稿：有未保存修改时 2.5s 防抖写盘，保存/丢弃后清理
  // 初始为 true：首屏是干净状态，不能把上次会话的草稿当作“已保存”清掉
  const draftCleanRef = useRef(true);
  useEffect(() => {
    if (!isTauriRuntime) return;
    if (!editor.isDirty) {
      if (!draftCleanRef.current) {
        draftCleanRef.current = true;
        void clearDraft().catch((error) => console.warn("[draft] clear failed", error));
      }
      return;
    }
    draftCleanRef.current = false;
    const timer = window.setTimeout(() => {
      const state = latestRef.current;
      void saveDraft({
        content: state.editor.getContent(),
        filepath: state.filepath,
        filename: state.filename,
      }).catch((error) => console.warn("[draft] autosave failed", error));
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [editor.isDirty, editor.content]);

  // 启动时检测上次会话的未保存草稿
  useEffect(() => {
    if (!isTauriRuntime) return;
    let cancelled = false;
    const restoreTimer = window.setTimeout(() => {
      void (async () => {
        try {
          const draft = await readDraft();
          if (cancelled || !draft) return;
          // 本次启动已通过「打开方式」载入文件时不打断用户，草稿留待下次
          if (latestRef.current.filepath) return;
          const loc = latestRef.current.locale;
          const restore = await ask(t(loc, "draftRestoreDesc"), {
            title: t(loc, "draftRestoreTitle"),
            kind: "warning",
            okLabel: t(loc, "draftRestoreOk"),
            cancelLabel: t(loc, "draftRestoreDiscard"),
          });
          if (cancelled) return;
          if (!restore) {
            await clearDraft().catch(() => {});
            return;
          }
          latestRef.current.editor.loadContent(draft.content, false);
          setFilename(draft.filename ?? null);
          setFilepath(draft.filepath ?? null);
          setLayout("both");
        } catch (error) {
          console.warn("[draft] restore failed", error);
        }
      })();
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(restoreTimer);
    };
  }, []);


  const outlineItems = useMemo(
    () => editor.parseResult ? buildDocumentOutline(editor.parseResult.root) : [],
    [editor.parseResult],
  );
  const selectedTrail = useMemo(() => {
    if (!editor.parseResult || !selectedNodeId) return [];
    return findNodeTrail(editor.parseResult.root, selectedNodeId);
  }, [editor.parseResult, selectedNodeId]);

  const auditReport = useMemo(
    () => auditDocument(editor.parseResult?.root ?? null),
    [editor.parseResult],
  );

  useEffect(() => {
    if (editor.highlightedPreviewNodeId) {
      setSelectedNodeId(editor.highlightedPreviewNodeId);
    }
  }, [editor.highlightedPreviewNodeId]);

  useEffect(() => {
    if (selectedNodeId && editor.parseResult && selectedTrail.length === 0) {
      setSelectedNodeId(null);
    }
  }, [editor.parseResult, selectedNodeId, selectedTrail.length]);

  const previewClickHandler = editor.handlePreviewClick;
  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    previewClickHandler(nodeId);
  }, [previewClickHandler]);

  // 预览内双击改文字 → 写回源码（转义后替换对应文本节点）
  const applyTextEdit = editor.applyTextEdit;
  const handlePreviewTextEdit = useCallback(
    (nodeId: string, text: string) => {
      applyTextEdit(nodeId, text);
    },
    [applyTextEdit],
  );

  // 首屏挂载以及 locale 变更时同步通知 Rust 刷新原生菜单栏
  useEffect(() => {
    if (!isTauriRuntime) return;
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

  const latestRef = useRef<AppLatestState>({
    filepath,
    filename,
    layout,
    editor,
    isDirty: editor.isDirty,
    hasUnsavedChanges: editor.hasUnsavedChanges,
    locale,
    saveFile: async () => false,
    saveFileAs: async () => {},
    handleNewFile: async () => {},
    handleOpenFile: async () => {},
    handleExportPDF: async () => {},
    handleExportWord: () => {},
    addHistory: () => {},
  });

  const { history, addHistory, clearHistory, removeHistory } = useHistory();

  useEffect(() => {
    latestRef.current = {
      filepath,
      filename,
      layout,
      editor,
      isDirty: editor.isDirty,
      hasUnsavedChanges: editor.hasUnsavedChanges,
      locale,
      saveFile,
      saveFileAs,
      handleNewFile,
      handleOpenFile,
      handleExportPDF,
      handleExportWord,
      addHistory,
    };
  });

  // 统一的“放弃未保存修改”确认：所有替换当前文档/退出应用的入口共用
  const confirmDiscardChanges = useCallback(async (): Promise<boolean> => {
    const state = latestRef.current;
    if (!state.hasUnsavedChanges()) return true;
    const loc = state.locale;
    return ask(t(loc, "confirmDiscardDesc"), {
      title: t(loc, "confirmDiscardTitle"),
      kind: "warning",
      okLabel: t(loc, "confirmDiscardOk"),
      cancelLabel: t(loc, "confirmCancel"),
    });
  }, []);

  // 退出/重启前的准备：需要时先保存，用户取消则返回 false
  const prepareToLeave = useCallback(async (): Promise<boolean> => {
    const state = latestRef.current;
    if (!state.hasUnsavedChanges()) return true;
    const loc = state.locale;
    const saveFirst = await ask(t(loc, "confirmExitSaveDesc"), {
      title: t(loc, "confirmExitSaveTitle"),
      kind: "warning",
      okLabel: t(loc, "confirmExitSaveOk"),
      cancelLabel: t(loc, "confirmExitDiscard"),
    });
    if (!saveFirst) return true; // 用户选择不保存
    return latestRef.current.saveFile(
      latestRef.current.editor.getContent(),
      latestRef.current.filepath,
    );
  }, []);

  // 统一的退出流程：确认后放行 Rust 侧 ExitRequested 拦截
  const requestAppExit = useCallback(async () => {
    if (exitInProgressRef.current) return;
    exitInProgressRef.current = true;
    try {
      if (!(await prepareToLeave())) return; // 保存被取消或失败：留在应用内
      if (isTauriRuntime) {
        await clearDraft().catch(() => {});
        await invoke("allow_app_exit");
        const { exit } = await import("@tauri-apps/plugin-process");
        await exit(0);
      }
    } catch (error) {
      console.error("[App] failed to exit:", error);
      const loc = latestRef.current.locale;
      await message(t(loc, "appExitErrorDesc"), {
        title: t(loc, "appExitErrorTitle"),
        kind: "error",
      });
    } finally {
      exitInProgressRef.current = false;
    }
  }, [prepareToLeave]);

  // 关窗前未保存提醒（窗口红点 / Cmd+W 都走这里）
  useEffect(() => {
    if (!isTauriRuntime) return;
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested(async (event) => {
      event.preventDefault(); // 由统一的退出流程决定是否真正退出
      await requestAppExit();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [requestAppExit]);

  // Rust 侧拦截 Cmd+Q / Dock 退出 / 系统注销后，通知前端确认
  useEffect(() => {
    if (!isTauriRuntime) return;
    const unlisten = listen("app-exit-requested", () => {
      void requestAppExit();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [requestAppExit]);

  // 通知 Rust 前端已就绪：未就绪时（冷启动瞬间）不拦截退出，避免退出被挂起
  useEffect(() => {
    if (!isTauriRuntime) return;
    invoke("mark_frontend_ready").catch((error) => {
      console.error("Failed to mark frontend ready:", error);
    });
  }, []);

  // 处理冷启动或运行中从系统级 "Open With" 传来的文件
  useEffect(() => {
    if (!isTauriRuntime) return;
    let disposed = false;
    let unlistenOpenRequest: (() => void) | undefined;
    let unlistenDragDrop: (() => void) | undefined;

    const handleSystemOpenFile = async (path: string, fromColdStart = false) => {
      // 非冷启动模式下确认未保存修改，防止拖拽/系统打开默默覆盖内容
      if (!fromColdStart && !(await confirmDiscardChanges())) return;
      try {
        // 系统事件路径不在 fs 插件 scope 内，必须走 Rust 命令读取
        const content = await readSystemFile(path);
        if (disposed) return;
        const loc = latestRef.current.locale;
        const name = filenameFromPath(path, t(loc, "untitled"));
        void clearDraft().catch(() => {});
        latestRef.current.editor.loadContent(content);
        setFilename(name);
        setFilepath(path);
        latestRef.current.addHistory(path, name);
      } catch (err) {
        const loc = latestRef.current.locale;
        const detail = err instanceof Error ? err.message : String(err);
        console.error("Failed to open system file:", err);
        if (disposed) return;
        await message(`${t(loc, "systemOpenErrorDesc")}\n\n${path}\n${detail}`, {
          title: t(loc, "systemOpenErrorTitle"),
          kind: "error",
        });
      }
    };

    const drainPendingSystemFiles = async () => {
      try {
        const pending = await takePendingSystemFiles();
        if (disposed || pending.length === 0) return;
        // 冷启动的第一个文件直接加载；其余文件按“未保存修改”规则依次处理
        for (let index = 0; index < pending.length; index += 1) {
          await handleSystemOpenFile(pending[index], index === 0);
        }
      } catch (err) {
        console.error("Failed to drain pending system files:", err);
      }
    };

    (async () => {
      try {
        // 先完成事件监听注册，再 drain 积压路径：即使事件在 drain 之后才到达也不会丢
        const unlisten = await listen(SYSTEM_OPEN_REQUEST_EVENT, () => {
          void drainPendingSystemFiles();
        });
        if (disposed) {
          unlisten();
          return;
        }
        unlistenOpenRequest = unlisten;
        await drainPendingSystemFiles();
      } catch (err) {
        console.error("Failed to listen for system open files:", err);
      }
    })();

    getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          const path = event.payload.paths[0];
          if (path) {
            void handleSystemOpenFile(path, false);
          }
        }
      })
      .then((fn) => {
        if (disposed) {
          fn();
          return;
        }
        unlistenDragDrop = fn;
      })
      .catch(console.error);

    return () => {
      disposed = true;
      unlistenOpenRequest?.();
      unlistenDragDrop?.();
    };
  }, [confirmDiscardChanges]);

  // 文件加载回调
  const handleFileLoaded = useCallback(
    (content: string, name: string, path: string) => {
      void clearDraft().catch(() => {});
      editor.loadContent(content);
      setFilename(name);
      setFilepath(path);
      addHistory(path, name);
    },
    [editor, addHistory]
  );

  // 打开历史：与其它入口共用未保存确认
  const handleHistoryFileLoaded = useCallback(
    async (content: string, name: string, path: string) => {
      if (!(await confirmDiscardChanges())) return;
      handleFileLoaded(content, name, path);
    },
    [confirmDiscardChanges, handleFileLoaded]
  );

  // 文件保存回调
  const handleFileSaved = useCallback(
    (name: string, path: string) => {
      // 自己的保存会触发 watcher，忽略短时间内的事件
      watcherIgnoreBeforeRef.current = Date.now();
      setFilename(name);
      setFilepath(path);
      editor.markClean();
      addHistory(path, name);
    },
    [editor, addHistory]
  );

  // 外部文件变更：干净时自动重载；有未保存修改时询问
  const reloadFromDisk = useCallback(
    (content: string) => {
      watcherIgnoreBeforeRef.current = Date.now();
      void clearDraft().catch(() => {});
      editor.loadContent(content);
    },
    [editor],
  );

  useFileWatcher({
    filepath,
    isDirty: editor.isDirty,
    locale,
    ignoreBeforeRef: watcherIgnoreBeforeRef,
    onReload: reloadFromDisk,
  });

  const { openFile } = useFileOpen({
    locale,
    onFileLoaded: handleFileLoaded,
    onError: async (msg) => {
      await message(msg, { title: t(locale, "fileReadError"), kind: "error" });
    },
  });

  const { saveFile, saveFileAs } = useFileSave({
    locale,
    onFileSaved: handleFileSaved,
    onError: async (msg) => {
      await message(msg, { title: t(locale, "fileSaveError"), kind: "error" });
    },
  });

  const { exportWord } = useFileExport({
    locale,
    onError: async (msg) => {
      await message(msg, { title: t(locale, "exportWordFailed"), kind: "error" });
    },
    onSuccess: async (msg) => {
      await message(msg, { title: t(locale, "exportMenu"), kind: "info" });
    },
  });

  const handleExportWord = useCallback(
    (content?: string) => exportWord(content ?? latestRef.current.editor.getContent()),
    [exportWord]
  );

  // 打印编排：先把界面切到“仅预览 + 展开真实高度”，再调起系统打印面板
  const handleExportPDF = useCallback(async () => {
    const previousLayout = latestRef.current.layout as "both" | "editor" | "preview";
    printRestoreRef.current = { layout: previousLayout, announceSuccess: false };
    try {
      if (previousLayout === "editor") setLayout("preview");
      setIsPrinting(true);
      // 等 React 提交 + 浏览器完成一轮布局，确保打印时 iframe 已是完整高度
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      if (isTauriRuntime) {
        await invoke("export_pdf");
      } else {
        window.print();
      }
      // 原生打印面板是异步 sheet：成功提示等在窗口重新获得焦点后再弹，避免盖住打印面板
      printSuccessMessageRef.current = t(latestRef.current.locale, "exportPDFSuccess");
      if (printRestoreRef.current) printRestoreRef.current.announceSuccess = true;
    } catch (error) {
      console.error("[App] failed to export PDF:", error);
      const loc = latestRef.current.locale;
      await message(
        `${t(loc, "exportPDFFailed")}: ${error instanceof Error ? error.message : String(error)}`,
        { title: t(loc, "exportPDFFailed"), kind: "error" },
      );
      setIsPrinting(false);
      if (previousLayout === "editor") setLayout("editor");
      printRestoreRef.current = null;
    }
  }, []);

  // 打印结束后恢复布局：原生打印面板是 sheet，窗口重新获得焦点即视为结束
  useEffect(() => {
    if (!isPrinting) return;
    let finished = false;
    const restore = () => {
      if (finished) return;
      finished = true;
      setIsPrinting(false);
      const previous = printRestoreRef.current?.layout;
      const announce = printRestoreRef.current?.announceSuccess;
      printRestoreRef.current = null;
      if (previous === "editor") setLayout("editor");
      if (announce) {
        const successText = printSuccessMessageRef.current;
        printSuccessMessageRef.current = null;
        if (successText) {
          void message(successText, { title: t(latestRef.current.locale, "exportMenu"), kind: "info" });
        }
      }
    };
    const onFocus = () => {
      window.setTimeout(restore, 400);
    };
    window.addEventListener("afterprint", restore);
    window.addEventListener("focus", onFocus);
    const fallback = window.setTimeout(restore, 5 * 60 * 1000);
    return () => {
      finished = true;
      window.clearTimeout(fallback);
      window.removeEventListener("afterprint", restore);
      window.removeEventListener("focus", onFocus);
    };
  }, [isPrinting]);

  // Fix 3: 新建文件时用最小 HTML 骨架，而不是空字符串
  const EMPTY_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="${locale === 'zh' ? 'zh-CN' : 'en'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${locale === 'zh' ? '\u65e0\u6807\u9898' : 'Untitled'}</title>
</head>
<body>
  
</body>
</html>`;

  // 新建文件处理（清除内容并重置路径，带未保存确认）
  const handleNewFile = useCallback(async () => {
    if (!(await confirmDiscardChanges())) return;
    void clearDraft().catch(() => {});
    editor.loadContent(EMPTY_HTML_TEMPLATE, false);
    setFilename(null);
    setFilepath(null);
  }, [confirmDiscardChanges, editor, EMPTY_HTML_TEMPLATE]);

  // 打开文件处理（带未保存确认）
  const handleOpenFile = useCallback(async () => {
    if (!(await confirmDiscardChanges())) return;
    await openFile();
  }, [confirmDiscardChanges, openFile]);

  const handlePasteHtml = useCallback(async () => {
    try {
      const html = normalizeHtmlClipboard(await readClipboardText());
      if (!isUsableHtmlClipboard(html)) {
        await message(t(locale, "clipboardInvalidDesc"), {
          title: t(locale, "clipboardInvalidTitle"),
          kind: "warning",
        });
        return;
      }
      // 三选一：替换当前 / 插入光标处 / 新建文档（AI 输出反复粘贴时避免误伤）
      setPendingPasteHtml(html);
    } catch (error) {
      console.error("Failed to read clipboard:", error);
      await message(t(locale, "clipboardReadErrorDesc"), {
        title: t(locale, "clipboardReadErrorTitle"),
        kind: "error",
      });
    }
  }, [locale]);

  const applyPaste = useCallback(
    async (mode: PasteMode) => {
      const html = pendingPasteHtml;
      setPendingPasteHtml(null);
      if (!html) return;
      if (mode === "insert") {
        editor.insertAtCursor(html);
        setLayout("both");
        return;
      }
      if (!(await confirmDiscardChanges())) return;
      void clearDraft().catch(() => {});
      editor.loadContent(html, false);
      if (mode === "new") {
        setFilename(null);
        setFilepath(null);
      }
      setLayout("both");
    },
    [confirmDiscardChanges, editor, pendingPasteHtml],
  );

  const {
    menuData: globalMenuData,
    openContextMenu: openGlobalContextMenu,
    closeContextMenu: closeGlobalContextMenu,
  } = useContextMenu();

  const toggleLocale = () => {
    setLocale((prev) => {
      const next = prev === "zh" ? "en" : "zh";
      try { localStorage.setItem(STORAGE_KEYS.locale, next); } catch {}
      return next;
    });
  };
  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem(STORAGE_KEYS.theme, next); } catch {}
      return next;
    });
  };

  const renderLayoutSwitcher = () => (
    <div className="layout-switcher" onMouseDown={(e) => e.stopPropagation()}>
      <button
        className={`layout-switcher__btn ${layout === "editor" ? "active" : ""}`}
        onClick={() => setLayout("editor")}
        title={t(locale, "layoutEditor")}
        aria-pressed={layout === "editor"}
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
        aria-pressed={layout === "both"}
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
        aria-pressed={layout === "preview"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  );

  const renderSelectionTrail = () => (
    <div className="selection-trail" aria-live="polite">
      {selectedTrail.length > 0 ? (
        selectedTrail.slice(-4).map((item, index) => (
          <span className="selection-trail__segment" key={item.nodeId}>
            {index > 0 && <span className="selection-trail__separator">/</span>}
            <button type="button" onClick={() => handleNodeSelect(item.nodeId)}>
              {item.tagName}{item.detail}
            </button>
          </span>
        ))
      ) : (
        <span className="selection-trail__hint">{t(locale, "selectElementHint")}</span>
      )}
    </div>
  );

  // 监听 macOS 原生顶部菜单栏事件
  useEffect(() => {
    if (!isTauriRuntime) return;
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
          state.handleExportPDF();
          break;
        case "export-word":
          state.handleExportWord();
          break;
        case "find-in-editor":
          state.editor.triggerEditorAction("actions.find");
          break;
        case "replace-in-editor":
          state.editor.triggerEditorAction("editor.action.startFindReplaceAction");
          break;
        case "quit-app":
          void requestAppExit();
          break;
        case "close-window":
          getCurrentWindow()
            .close()
            .catch((error) => console.error("Failed to close window:", error));
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
  }, [requestAppExit]);

  const attributeNode = attributeEditNodeId
    ? findNodeById(editor.parseResult?.root ?? null, attributeEditNodeId)
    : null;

  const handleSaveAttributes = useCallback(
    (nextAttrs: Record<string, string>) => {
      const nodeId = attributeEditNodeId;
      if (!nodeId) return;
      const state = latestRef.current;
      const result = state.editor.parseResult;
      const node = findNodeById(result?.root ?? null, nodeId);
      const location = result?.nodeMap.get(nodeId);
      if (!node || node.type !== "element" || !node.tagName || !location) {
        setAttributeEditNodeId(null);
        return;
      }
      const content = state.editor.getContent();
      const range = findStartTagRange(content, location.startOffset);
      if (!range) {
        setAttributeEditNodeId(null);
        return;
      }
      state.editor.applySourceReplace(
        range.start,
        range.end,
        serializeStartTag(node.tagName, nextAttrs, range.selfClosing),
      );
      setAttributeEditNodeId(null);
    },
    [attributeEditNodeId],
  );

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
            className="app-titlebar__brandmark"
            src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
            alt=""
          />
          <div className="app-titlebar__title-group">
            <span className="app-titlebar__name">Hylo</span>
            <span className="app-titlebar__sep">/</span>
            <span
              className="app-titlebar__filename"
              title={filepath ? filepath : (filename || t(locale, "untitled"))}
            >
              {filename || t(locale, "untitled")}
              {editor.isDirty && <span style={{ color: "var(--color-accent)", marginLeft: "4px" }}>*</span>}
            </span>
          </div>
        </div>

        <div className="app-titlebar__right">
          <button
            type="button"
            className="toolbar-btn toolbar-btn--primary"
            onClick={handlePasteHtml}
            title={t(locale, "pasteHtmlHint")}
          >
            <svg viewBox="0 0 18 18" aria-hidden="true">
              <path d="M6.5 4.25V3.5A1.5 1.5 0 0 1 8 2h2a1.5 1.5 0 0 1 1.5 1.5v.75" />
              <path d="M5 4.25h8A1.75 1.75 0 0 1 14.75 6v8A1.75 1.75 0 0 1 13 15.75H5A1.75 1.75 0 0 1 3.25 14V6A1.75 1.75 0 0 1 5 4.25Z" />
              <path d="M6.5 8.25h5M6.5 11.25h3.25" />
            </svg>
            <span>{t(locale, "pasteHtml")}</span>
          </button>

          <button
            type="button"
            className={`toolbar-btn toolbar-btn--icon ${isOutlineOpen ? "is-active" : ""}`}
            onClick={() => setIsOutlineOpen((open) => !open)}
            title={t(locale, isOutlineOpen ? "hideStructure" : "showStructure")}
            aria-pressed={isOutlineOpen}
          >
            <svg viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3.25 4.25h3.5v3.5h-3.5zM11.25 3.25h3.5v3.5h-3.5zM11.25 11.25h3.5v3.5h-3.5z" />
              <path d="M6.75 6h2A2.5 2.5 0 0 1 11.25 8.5v2.75M8.75 12.75h2.5" />
            </svg>
          </button>

          <button
            type="button"
            className={`toolbar-btn toolbar-btn--icon ${isAuditOpen ? "is-active" : ""}`}
            onClick={() => setIsAuditOpen(true)}
            title={t(locale, "auditButton")}
          >
            <svg viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4 3.25h7.25L14.5 6.5v8.25H4z" />
              <path d="M11 3.25V6.5h3.5" />
              <path d="M6.5 9.5h5M6.5 12h3.5" />
            </svg>
            {auditReport.findings.length > 0 && (
              <span className="toolbar-badge">{auditReport.findings.length}</span>
            )}
          </button>

          {editor.parseResult && (
            <span className="app-titlebar__stats">
              {editor.parseResult.nodeCount}{t(locale, "nodes")}
              <span className="app-titlebar__parse-time">
                &nbsp;·&nbsp;{editor.parseResult.parseTime.toFixed(1)}&thinsp;{t(locale, "ms")}
              </span>
            </span>
          )}

          {renderLayoutSwitcher()}
          
          <DropdownMenu
            label={t(locale, "exportMenu")}
            items={[
              {
                label: t(locale, "exportToPDF"),
                onClick: () => void handleExportPDF(),
              },
              {
                label: t(locale, "exportToWord"),
                onClick: () => void handleExportWord(),
              },
            ]}
          />
          
          <button
            type="button"
            className="toolbar-btn toolbar-btn--icon"
            onClick={toggleTheme}
            title={t(locale, "toggleTheme")}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 18 18" aria-hidden="true">
                <path d="M14.75 11.25A6.25 6.25 0 0 1 6.75 3.2a6.25 6.25 0 1 0 8 8.05Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 18 18" aria-hidden="true">
                <circle cx="9" cy="9" r="3" />
                <path d="M9 1.75v1.5M9 14.75v1.5M1.75 9h1.5M14.75 9h1.5M3.87 3.87l1.06 1.06M13.07 13.07l1.06 1.06M14.13 3.87l-1.06 1.06M4.93 13.07l-1.06 1.06" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ── 主编辑区 ── */}
      <main className="app-main">
        <SplitView
          initialRatio={0.4}
          minPanelWidth={240}
          layoutMode={layout}
          mappingActive={Boolean(selectedNodeId)}
          left={
            <div className={`source-workspace ${isOutlineOpen ? "source-workspace--with-outline" : ""}`}>
              {isOutlineOpen && (
                <section className="outline-panel" aria-label={t(locale, "structurePanel")}>
                  <div className="outline-panel__header">
                    <span>{t(locale, "structurePanel")}</span>
                    <span className="outline-panel__count">{countOutlineItems(outlineItems)}</span>
                  </div>
                  <DocumentOutline
                    items={outlineItems}
                    selectedNodeId={selectedNodeId}
                    selectedTrailIds={selectedTrail.map((item) => item.nodeId)}
                    emptyLabel={t(locale, "outlineEmpty")}
                    collapseLabel={t(locale, "collapseNode")}
                    expandLabel={t(locale, "expandNode")}
                    onSelect={handleNodeSelect}
                  />
                </section>
              )}
              <MonacoPanel
                initialContent={editor.content}
                theme={theme}
                onEditorReady={editor.setMonacoEditor}
                onContentChange={editor.handleContentChange}
                onCursorChange={editor.handleCursorChange}
                highlightRange={editor.highlightedSourceRange}
                locale={locale}
                label={t(locale, "sourcePanel")}
                headerRight={renderSelectionTrail()}
              />
            </div>
          }
          right={
            <PreviewPanel
              astRoot={editor.parseResult?.root ?? null}
              highlightedNodeId={selectedNodeId}
              onNodeClick={handleNodeSelect}
              locale={locale}
              filepath={filepath}
              label={t(locale, "previewPanel")}
              headerRight={renderSelectionTrail()}
              emptyHint={t(locale, "emptyHint")}
              onContextMenuAction={(action, nodeId) => {
                switch (action) {
                  case "openFile":
                    openFile();
                    break;
                  case "saveFile":
                    saveFile(editor.getContent(), filepath);
                    break;
                  case "editAttributes":
                    if (nodeId) setAttributeEditNodeId(nodeId);
                    break;
                  case "exportPDF":
                    void handleExportPDF();
                    break;
                  case "exportWord":
                    void handleExportWord();
                    break;
                  case "toggleTheme":
                    toggleTheme();
                    break;
                }
              }}
              printing={isPrinting}
              documentKey={filepath ?? "untitled"}
              onTextEdit={handlePreviewTextEdit}
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
                closeGlobalContextMenu();
                void handleExportPDF();
              },
            },
            {
              label: t(locale, "exportToWord"),
              onClick: () => {
                closeGlobalContextMenu();
                void handleExportWord();
              },
            },
            ...(selectedNodeId
              ? [
                  {
                    label: t(locale, "editAttributes"),
                    onClick: () => {
                      setAttributeEditNodeId(selectedNodeId);
                      closeGlobalContextMenu();
                    },
                  },
                  { isDivider: true } as any,
                ]
              : []),
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
                closeGlobalContextMenu();
                void (async () => {
                  if (!(await confirmDiscardChanges())) return;
                  window.location.reload();
                })();
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
      <UpdateModal
        ref={updateModalRef}
        locale={locale}
        onBeforeRestart={async () => {
          if (!(await prepareToLeave())) return false;
          await invoke("allow_app_exit");
          return true;
        }}
      />
      <HistoryModal
        isOpen={isHistoryOpen}
        locale={locale}
        history={history}
        onClose={() => setIsHistoryOpen(false)}
        onFileLoaded={handleHistoryFileLoaded}
        onClear={clearHistory}
        onRemove={removeHistory}
      />
      <AuditModal
        isOpen={isAuditOpen}
        locale={locale}
        report={auditReport}
        onSelectNode={(nodeId) => {
          handleNodeSelect(nodeId);
          setLayout((current) => (current === "preview" ? "both" : current));
        }}
        onClose={() => setIsAuditOpen(false)}
      />
      {attributeNode && attributeNode.type === "element" && (
        <NodeAttributesModal
          isOpen={attributeEditNodeId !== null}
          locale={locale}
          tagName={attributeNode.tagName ?? ""}
          attrs={attributeNode.attrs ?? {}}
          onSave={handleSaveAttributes}
          onClose={() => setAttributeEditNodeId(null)}
        />
      )}
      <PasteHtmlModal
        isOpen={pendingPasteHtml !== null}
        locale={locale}
        html={pendingPasteHtml ?? ""}
        onChoose={(mode) => {
          void applyPaste(mode);
        }}
        onClose={() => setPendingPasteHtml(null)}
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
