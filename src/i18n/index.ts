// ============================================================
// Hylo i18n — 中英双语支持
// ============================================================

export type Locale = "zh" | "en";

export const translations = {
  zh: {
    // 标题栏
    nodes: "个节点",
    ms: "ms",
    openFile: "打开文件",
    newFile: "新建",

    // 面板头
    sourcePanel: "HTML 源码",
    editorLoading: "正在加载编辑器…",
    previewPanel: "预览",
    structurePanel: "文档结构",
    showStructure: "显示文档结构",
    hideStructure: "隐藏文档结构",
    outlineEmpty: "添加 HTML 元素后将在这里显示结构",
    collapseNode: "折叠节点",
    expandNode: "展开节点",
    selectElementHint: "在预览中选择元素以定位源码",
    safePreview: "安全预览",
    interactivePreview: "交互预览",
    safePreviewHint: "脚本与远程资源已阻止",
    inlineEditHint: "双击文字可直接编辑",
    diagnosticsBlocked: "已阻止",
    diagnosticsScripts: "脚本",
    diagnosticsRemote: "远程资源",
    diagnosticsEmbeds: "交互嵌入",
    diagnosticsEnableHint: "点击开启交互预览（运行脚本、加载远程资源）",

    interactivePreviewConfirm: "交互预览会在隔离沙盒中运行此文档的脚本并允许 HTTPS 网络资源。仅对你信任的 HTML 开启。是否继续？",
    pasteHtml: "粘贴 HTML",
    pasteHtmlHint: "从剪贴板载入 AI 生成的 HTML",
    clipboardInvalidTitle: "未找到 HTML",
    clipboardInvalidDesc: "剪贴板中没有可载入的 HTML 元素。请先复制完整 HTML，再重试。",
    clipboardReadErrorTitle: "无法读取剪贴板",
    clipboardReadErrorDesc: "请允许 Hylo 访问剪贴板，然后重试。",

    // 状态
    emptyHint: "在左侧编辑器中输入 HTML…",
    untitled: "无标题",

    // 外部文件变更
    externalChangeTitle: "文件已被外部修改",
    externalChangeDesc: "磁盘上的文件已发生变化，是否重新加载？当前未保存的修改会丢失。",
    externalChangeReload: "重新加载",
    externalChangeKeep: "保留当前",
    fileRemovedTitle: "文件已被移动或删除",
    fileRemovedDesc: "磁盘上的文件已不存在。当前内容仍在内存中，建议使用「另存为」保存到新位置。",

    // 草稿恢复
    draftRestoreTitle: "恢复未保存的草稿",
    draftRestoreDesc: "检测到上次会话中未保存的内容，是否恢复？恢复后会保持未保存状态，请记得保存。",
    draftRestoreOk: "恢复草稿",
    draftRestoreDiscard: "丢弃草稿",

    // 文档审阅
    auditTitle: "文档审阅",
    auditButton: "审阅",
    auditItems: "项",
    auditEmpty: "没有发现需要处理的问题 🎉",
    auditLocate: "定位到源码",
    auditClose: "关闭",
    auditMissingAlt: "图片缺少 alt 文本",
    auditRemoteResource: "引用了远程资源（离线/安全预览下不会加载）",
    auditEmptyLink: "链接缺少有效地址",
    auditDuplicateId: "重复的 id",
    auditHeadingJump: "标题层级跳级",
    auditInlineStyle: "使用了内联样式",
    auditBlockedScript: "脚本会被安全预览阻止",

    // 节点属性快速编辑
    editAttributes: "编辑属性",
    attrName: "属性名",
    attrValue: "属性值",
    addAttribute: "添加属性",
    removeAttribute: "删除属性",
    saveAttributes: "保存属性",
    attrNameRequired: "属性名不能为空",
    attrNameInvalid: "属性名包含非法字符",
    attrNameDuplicate: "属性名重复",
    attrEmptyHint: "该元素没有属性，点击下方按钮添加",

    // 粘贴 HTML
    pasteModeTitle: "载入 HTML",
    pasteModeDesc: "检测到剪贴板中的 HTML，选择处理方式：",
    pasteModeReplace: "替换当前文档",
    pasteModeInsert: "插入到光标处",
    pasteModeNew: "新建文档",
    pasteModeSnippet: "内容预览",

    // 文件对话框
    dialogTitle: "打开 HTML 文件",
    dialogFilter: "HTML 文件",
    dialogSaveTitle: "保存 HTML 文件",
    dialogSaveFilter: "HTML 文件",
    dialogSaveAsTitle: "另存为",

    // 菜单
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
    fileSaveError: "文件保存失败",
    systemOpenErrorTitle: "无法打开文件",
    systemOpenErrorDesc: "Hylo 无法读取该文件，请确认文件存在、可访问且体积不超过 32 MB。",

    // 通用“放弃修改”确认（新建 / 打开 / 历史 / 拖拽 / 系统打开 / 刷新共用）
    confirmDiscardTitle: "放弃未保存的修改？",
    confirmDiscardDesc: "当前文件有未保存的修改，继续操作将丢失这些更改。是否继续？",
    confirmDiscardOk: "继续",

    // 退出确认
    confirmExitSaveTitle: "退出前保存",
    confirmExitSaveDesc: "当前文件有未保存的修改，是否在退出前保存？",
    confirmExitSaveOk: "保存并退出",
    confirmExitDiscard: "不保存并退出",
    appExitErrorTitle: "退出失败",
    appExitErrorDesc: "退出应用时发生错误，请重试。",

    // 预览
    interactivePreviewTitle: "开启交互预览",
    linkOpenFailed: "无法打开链接",
    linkOpenFailedDesc: "请确认系统默认浏览器可用后重试。",

    // 确认对话框
    confirmOk: "确定",
    confirmCancel: "取消",

    // 更新相关
    updateAppStoreNote:
      "💡 推荐 macOS 用户前往 Mac App Store 下载安装全新上架的正版客户端，可支持完整的多语言原生系统菜单并享受更安全稳定的沙盒环境。",
    updateReleaseNotes: "更新说明",
    updateAppStoreCta: "前往 App Store",
    updateTitle: "软件更新",
    updateFound: "发现新版本可用！",
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
    aboutSlogan: "AI 生成 HTML 的快捷微调工具 — HTML 的 Typora",
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
    nodes: " nodes",
    ms: "ms",
    openFile: "Open File",
    newFile: "New",

    sourcePanel: "HTML Source",
    editorLoading: "Loading editor…",
    previewPanel: "Preview",
    structurePanel: "Document structure",
    showStructure: "Show document structure",
    hideStructure: "Hide document structure",
    outlineEmpty: "HTML elements will appear here as you add them",
    collapseNode: "Collapse node",
    expandNode: "Expand node",
    selectElementHint: "Select an element in the preview to locate its source",
    safePreview: "Safe Preview",
    interactivePreview: "Interactive Preview",
    safePreviewHint: "Scripts and remote resources are blocked",
    inlineEditHint: "Double-click text to edit in place",
    diagnosticsBlocked: "Blocked",
    diagnosticsScripts: "scripts",
    diagnosticsRemote: "remote assets",
    diagnosticsEmbeds: "embeds",
    diagnosticsEnableHint: "Click to enable interactive preview (run scripts, load remote assets)",

    interactivePreviewConfirm: "Interactive Preview runs this document's scripts inside an isolated sandbox and allows HTTPS resources. Enable it only for HTML you trust. Continue?",
    pasteHtml: "Paste HTML",
    pasteHtmlHint: "Load AI-generated HTML from the clipboard",
    clipboardInvalidTitle: "No HTML found",
    clipboardInvalidDesc: "The clipboard does not contain loadable HTML elements. Copy the full HTML and try again.",
    clipboardReadErrorTitle: "Can't read clipboard",
    clipboardReadErrorDesc: "Allow Hylo to access the clipboard, then try again.",

    emptyHint: "Start typing HTML in the editor…",
    untitled: "Untitled",

    // External file changes
    externalChangeTitle: "File Changed on Disk",
    externalChangeDesc: "The file was modified outside Hylo. Reload it? Unsaved changes will be lost.",
    externalChangeReload: "Reload",
    externalChangeKeep: "Keep Current",
    fileRemovedTitle: "File Moved or Deleted",
    fileRemovedDesc: "The file no longer exists on disk. The current content is still in memory; use Save As to keep it.",

    // Draft recovery
    draftRestoreTitle: "Restore Unsaved Draft",
    draftRestoreDesc: "An unsaved document from the previous session was found. Restore it? It will stay unsaved until you save it.",
    draftRestoreOk: "Restore Draft",
    draftRestoreDiscard: "Discard Draft",

    // Document audit
    auditTitle: "Document Audit",
    auditButton: "Audit",
    auditItems: "items",
    auditEmpty: "Nothing to fix here 🎉",
    auditLocate: "Jump to source",
    auditClose: "Close",
    auditMissingAlt: "Image is missing alt text",
    auditRemoteResource: "References remote assets (blocked in offline/safe preview)",
    auditEmptyLink: "Link has no usable target",
    auditDuplicateId: "Duplicate id attribute",
    auditHeadingJump: "Heading level jumps",
    auditInlineStyle: "Uses inline styles",
    auditBlockedScript: "Script blocked by safe preview",

    // Quick attribute editing
    editAttributes: "Edit Attributes",
    attrName: "Name",
    attrValue: "Value",
    addAttribute: "Add attribute",
    removeAttribute: "Remove attribute",
    saveAttributes: "Save Attributes",
    attrNameRequired: "Attribute name is required",
    attrNameInvalid: "Attribute name contains invalid characters",
    attrNameDuplicate: "Duplicate attribute name",
    attrEmptyHint: "This element has no attributes yet",

    // Paste HTML
    pasteModeTitle: "Load HTML",
    pasteModeDesc: "HTML detected in the clipboard. Choose how to apply it:",
    pasteModeReplace: "Replace current document",
    pasteModeInsert: "Insert at cursor",
    pasteModeNew: "New document",
    pasteModeSnippet: "Preview",

    dialogTitle: "Open HTML File",
    dialogFilter: "HTML Files",
    dialogSaveTitle: "Save HTML File",
    dialogSaveFilter: "HTML Files",
    dialogSaveAsTitle: "Save As",
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
    fileSaveError: "Failed to save file",
    systemOpenErrorTitle: "Could Not Open File",
    systemOpenErrorDesc:
      "Hylo could not read this file. Make sure it exists, is accessible, and is smaller than 32 MB.",

    // Discard confirmation shared by new/open/history/drag-drop/system open/reload
    confirmDiscardTitle: "Discard unsaved changes?",
    confirmDiscardDesc: "This document has unsaved changes. Continuing will discard them. Continue?",
    confirmDiscardOk: "Continue",

    // Quit confirmation
    confirmExitSaveTitle: "Save Before Quit",
    confirmExitSaveDesc: "This document has unsaved changes. Save before quitting?",
    confirmExitSaveOk: "Save and Quit",
    confirmExitDiscard: "Quit Without Saving",
    appExitErrorTitle: "Quit Failed",
    appExitErrorDesc: "Something went wrong while quitting. Please try again.",

    // Preview
    interactivePreviewTitle: "Enable Interactive Preview",
    linkOpenFailed: "Could Not Open Link",
    linkOpenFailedDesc: "Make sure a default browser is available and try again.",

    // Confirm dialogs
    confirmOk: "OK",
    confirmCancel: "Cancel",

    // Update related
    updateAppStoreNote:
      "💡 We recommend macOS users install from the Mac App Store for fully localized native menus and a secure sandboxed environment.",
    updateReleaseNotes: "RELEASE NOTES",
    updateAppStoreCta: "App Store",
    updateTitle: "Software Update",
    updateFound: "A new version is available!",
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
    aboutSlogan: "Quick fine-tuning for AI-generated HTML — Typora for HTML",
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
