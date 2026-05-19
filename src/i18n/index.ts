// ============================================================
// Hylo i18n — 中英双语支持
// ============================================================

export type Locale = "zh" | "en";

export const translations = {
  zh: {
    // 标题栏
    appName: "Hylo",
    nodes: "个节点",
    ms: "ms",
    openFile: "打开文件",
    newFile: "新建",
    langToggle: "EN",

    // 面板头
    sourcePanel: "HTML 源码",
    previewPanel: "预览",

    // 状态
    emptyHint: "在左侧编辑器中输入 HTML…",
    untitled: "无标题",

    // 文件对话框
    dialogTitle: "打开 HTML 文件",
    dialogFilter: "HTML 文件",
    dialogSaveTitle: "保存 HTML 文件",
    dialogSaveFilter: "HTML 文件",

    // 菜单
    menuFile: "文件",
    menuView: "视图",
    menuEdit: "编辑",
    saveFile: "保存",
    toggleTheme: "切换主题",
    
    // 右键菜单
    copy: "复制",
    paste: "粘贴",
    cut: "剪切",
    inspect: "检查节点",
    formatDoc: "格式化代码",
    commandPalette: "命令面板",
    reloadApp: "刷新应用",
    layoutEditor: "仅源码",
    layoutPreview: "仅预览",
    layoutBoth: "双栏",

    // 错误
    fileReadError: "文件读取失败",

    // 确认对话框
    confirmNewFileTitle: "新建文件",
    confirmNewFileDesc: "当前文件有未保存的修改，新建文件将丢失这些更改。是否继续？",
    confirmOpenFileTitle: "打开文件",
    confirmOpenFileDesc: "当前文件有未保存的修改，打开其他文件将丢失这些更改。是否继续？",
    confirmOk: "确定",
    confirmCancel: "取消",
  },
  en: {
    appName: "Hylo",
    nodes: " nodes",
    ms: "ms",
    openFile: "Open File",
    newFile: "New",
    langToggle: "中文",

    sourcePanel: "HTML Source",
    previewPanel: "Preview",

    emptyHint: "Start typing HTML in the editor…",
    untitled: "Untitled",

    dialogTitle: "Open HTML File",
    dialogFilter: "HTML Files",
    dialogSaveTitle: "Save HTML File",
    dialogSaveFilter: "HTML Files",

    menuFile: "File",
    menuView: "View",
    menuEdit: "Edit",
    saveFile: "Save",
    toggleTheme: "Toggle Theme",

    copy: "Copy",
    paste: "Paste",
    cut: "Cut",
    inspect: "Inspect Node",
    formatDoc: "Format Document",
    commandPalette: "Command Palette",
    reloadApp: "Reload App",
    layoutEditor: "Source Only",
    layoutPreview: "Preview Only",
    layoutBoth: "Split View",

    fileReadError: "Failed to read file",

    // Confirm dialogs
    confirmNewFileTitle: "New File",
    confirmNewFileDesc: "You have unsaved changes. Creating a new file will discard these changes. Continue?",
    confirmOpenFileTitle: "Open File",
    confirmOpenFileDesc: "You have unsaved changes. Opening another file will discard these changes. Continue?",
    confirmOk: "OK",
    confirmCancel: "Cancel",
  },
} as const;

export type TranslationKey = keyof typeof translations.zh;

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key];
}
