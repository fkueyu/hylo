# Changelog

All notable changes to this project will be documented in this file.

## [0.1.17] - 2026-06-21

### Fixed
- 修复了在系统文件管理器中右键选择“用 Hylo 打开”时仅打开默认文档的问题。现在可以正确加载目标 `.html` 文件（兼容 macOS Apple Events 以及 Windows/Linux 命令行启动）。
- 修复了编辑器双栏分割线在向右拖拽鼠标越过 `<iframe>` 预览面板时导致拖拽事件卡死、无法拖回的问题。
- 修复并优化了预览区相对路径图片的渲染问题。通过开启 Tauri 的 `assetProtocol` 本地资源协议与 `fs` 文件读取权限，动态在 iframe 中添加 `<base>` 标签实现本地图片渲染，且优化了 `<base>` 标签的更新时机，仅在文件路径变化时更新，避免了敲击键盘编辑时发生页面排版闪烁与重新加载。

## [0.1.16] - 2026-06-02

### Added
- 支持在 Tauri 桌面端重启应用后，自动持久化并恢复已打开的历史文件访问权限（集成 `tauri-plugin-persisted-scope` 插件）。

### Fixed
- 修复编辑 HTML 触发 AST 更新时，因内联脚本重新执行导致 top-level 变量重复声明而抛出 `SyntaxError` 的问题（将内联脚本执行环境包裹在独立的块级作用域 `{ ... }` 并辅以 `try-catch` 保护，完美解决后半部分 `fade-in` 动画元素渲染丢失的 Bug）。
- 修复内联脚本随着输入频繁挂载导致的 Iframe Header DOM 节点膨胀问题，在组件卸载时安全移除同步执行完毕的内联脚本节点，确保长久运行的内存健康与流畅度。

## [0.1.15] - 2026-05-25

### Added
- 新增 PDF 与 Word (.docx) 导出功能。
- PDF 导出在普通网页环境使用浏览器打印，在 Tauri 桌面端调用原生 Webview 打印管道，高保真还原 CSS 与 Tailwind 样式。
- Word 导出引入 `html-to-docx` 库，支持在网页端（通过 Blob fallback 下载）与桌面端（通过原生另存为对话框写入文件）将 HTML 骨架转换为标准的 docx 段落与格式。
- 新增顶部标题栏“导出”下拉菜单及全局/预览面板右键菜单项。
- 新增 Tauri 原生 macOS/Windows 菜单中“导出为 PDF”和“导出为 Word”菜单项及相应的快捷键。

### Fixed
- 修复了 Tauri 桌面端调用 `window.print()` 无反应的问题。
- 修复了因快捷键与 Webview 默认的 `Cmd+P` 冲突导致双重触发、打印对话框死锁卡死的问题，将 PDF 原生菜单快捷键修改为 `Cmd+Alt+P`，并移除冗余的原生 Alert 提示框。
- 修复了导出 Word 时由于未在 `default.json` 配置文件中声明 `fs:allow-write-file` 权限而导致的 `fs:write_file not allowed` 写入报错。

## [0.1.8] - 2026-05-21

### Fixed
- 修复了 `generate-updater` 脚本因 `package.json` 中 `"type": "module"` 导致的 `require is not defined` 错误，将脚本重命名为 `.cjs` 格式以明确声明其 CommonJS 模块类型。



### Fixed
- 修复了在 GitHub Actions 中下载 Draft Release 资产时出现的 404 错误。我们从第三方下载插件切换为了使用官方预装的 GitHub CLI `gh release download`，以完全支持从草稿发布包中拉取并合并自动更新配置。

## [0.1.6] - 2026-05-20

### Fixed
- 修复了因为代码未提交导致打包构建的 v0.1.5 版本依然存在 React 19 崩溃白屏的问题，此版本将修复代码打包并完成了自动更新链路的测试。

## [0.1.5] - 2026-05-20

### Fixed
- 紧急修复了桌面端 v0.1.4 版本中因直接渲染 `<body>` 标签导致的 React 19 崩溃白屏问题。

## [0.1.4] - 2026-05-20

### Fixed
- 修复了预览时 `<body>` 标签的 CSS 样式（如 padding 和 margin）失效的问题。
- 完善了初始欢迎文档，添加了相关官网和源码链接。

## [0.1.3] - 2026-05-20

### Fixed
- 修复了桌面端预览区域内容文字紧贴边缘的问题，通过添加统一的内边距使显示效果与 VS Code 插件版保持一致。

## [0.1.2] - 2026-05-20

### Added
- 新增软件自动更新与手动更新检查功能。
- 在前端集成基于毛玻璃高颜值特效的软件升级状态提示弹窗 `UpdateModal`。
- 实现启动自动静默检测更新、右键菜单点击手动检测更新，提供进度条和自动重启覆盖安装支持。
- 将更新数据分发源和包存放源设计为私有服务器 `ainx.ink`，全面解决国内用户访问和更新缓慢的问题。
- 在 GitHub Actions 工作流中集成基于私钥 `TAURI_SIGNING_PRIVATE_KEY` 变量的安全自动数字签名机制。

## [0.1.1] - 2026-05-19

### Added
- 新增 GitHub Actions 自动 CI/CD 构建工作流，实现 macOS (Universal), Windows, Linux 三端安装包的自动编译与 Release 发布。
- 新增 GitHub Actions 触发时自动利用 Git commits 生成 Releases 页面更新记录的功能 (`generateReleaseNotes`)。

### Fixed
- 修复 Node 22+ 环境下因 `fs.rmdirSync` 选项废弃导致项目 Vite 开发服务器启动崩溃的兼容性问题。
- 修复因缺少 `core:window:allow-start-dragging` 权限导致的 Tauri 窗口无法拖拽的问题。
- 重构标题栏拖拽逻辑，将拖拽区域直接绑定到 header 级元素并设置为 `drag`，且将左区和右区控制层设为 `no-drag`，移除原有的绝对定位占位层，彻底解决了层级遮挡引起的拖动失效问题。
