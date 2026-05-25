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

    // 更新相关
    updateTitle: "软件更新",
    updateFound: "发现新版本可用！",
    updateCurrent: "当前版本",
    updateLatest: "最新版本",
    updateBtnNow: "立即更新",
    updateBtnLater: "以后再说",
    updateDownloading: "正在下载并安装更新包...",
    updateSuccess: "更新下载安装成功，应用将立即重启以应用更新！",
    updateError: "更新失败",
    updateChecking: "正在检查更新，请稍候...",
    updateAlreadyLatest: "您当前已是最新版本，无需更新！",
    updateClose: "关闭",

    // 历史记录相关
    historyTitle: "打开历史",
    historyEmpty: "暂无打开的历史记录",
    historyClear: "清空历史",
    fileNotExistTitle: "文件已不存在",
    fileNotExistDesc: "该文件可能已被移动或删除，是否从历史记录中移除？",

    // 关于页面相关
    aboutSlogan: "HTML 的 Typora — AI 原生可视化编辑器",
    aboutWebsite: "访问官网",

    // 导出相关
    exportPDFSuccess: "已调起系统打印，请选择另存为 PDF",
    exportPDFFailed: "导出 PDF 失败",
    exportWordTitle: "导出为 Word",
    exportWordSuccess: "导出 Word 成功",
    exportWordFailed: "导出 Word 失败",
    exportMenu: "导出",
    exportToPDF: "导出为 PDF",
    exportToWord: "导出为 Word",
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

    // Update related
    updateTitle: "Software Update",
    updateFound: "A new version is available!",
    updateCurrent: "Current Version",
    updateLatest: "Latest Version",
    updateBtnNow: "Update Now",
    updateBtnLater: "Later",
    updateDownloading: "Downloading and installing update...",
    updateSuccess: "Update installed successfully, relaunching application...",
    updateError: "Update Failed",
    updateChecking: "Checking for updates, please wait...",
    updateAlreadyLatest: "You are already using the latest version!",
    updateClose: "Close",

    // History related
    historyTitle: "Open Recent",
    historyEmpty: "No recent files",
    historyClear: "Clear History",
    fileNotExistTitle: "File Not Found",
    fileNotExistDesc: "This file may have been moved or deleted. Remove from history?",

    // About related
    aboutSlogan: "Typora for HTML — AI Native Visual Editor",
    aboutWebsite: "Visit Website",

    // Export related
    exportPDFSuccess: "System print dialog opened, please choose Save as PDF",
    exportPDFFailed: "Export PDF failed",
    exportWordTitle: "Export to Word",
    exportWordSuccess: "Export to Word successfully",
    exportWordFailed: "Export to Word failed",
    exportMenu: "Export",
    exportToPDF: "Export to PDF",
    exportToWord: "Export to Word",
  },
} as const;

export type TranslationKey = keyof typeof translations.zh;

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key];
}
