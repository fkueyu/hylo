# Changelog

All notable changes to this project will be documented in this file.

## [0.1.21] - 2026-11-22

### 新增
- 系统文件关联：Finder 双击 / 右键「打开方式」/ 拖拽 / 命令行参数都能在 Hylo 中打开 `.html`；冷启动与运行中打开都可靠（Rust 侧待打开队列 + 前端 drain）。
- 关闭窗口（Cmd+W）、退出（Cmd+Q / Dock / 系统注销）与更新重启前统一确认未保存修改；更新重启同样受保护。
- 交互预览中点击 `https` 链接改用系统默认浏览器打开。
- 粘贴 AI HTML 时新增三选一：替换当前文档 / 插入光标处 / 新建文档，避免反复微调时误替换整篇。
- 剪贴板改走系统原生实现（`tauri-plugin-clipboard-manager`）：修复 WKWebView 下 `navigator.clipboard.readText()` 可能被系统拦截、导致「无法读取剪贴板」的问题；复制/剪切/粘贴同样走原生通道。
- 原生「编辑」菜单新增查找（`Cmd+F`）与查找替换（`Cmd+Alt+F`），直接驱动 Monaco 搜索。
- **预览内就地改文字**：双击预览中的文本即可直接编辑（Esc 取消 / Enter 提交），新文本转义后写回源码对应文本节点，保留 Monaco 撤销栈。
- **节点属性快速编辑**：选中/右键预览元素可打开属性面板，增删改 `class/style/src/alt/href` 等属性后回写源码 start-tag（自动处理引号转义与自闭合标签）。
- **离线文档审阅**：一键检查 AI 生成 HTML 的常见问题（缺 alt、远程资源、空链接、重复 id、标题跳级、内联样式、会被安全预览阻止的脚本），点击条目直接定位源码。
- **预览诊断徽标**：安全预览拦截脚本/远程资源/交互嵌入时在预览头部提示数量，点击即可切换交互预览。
- **交互预览脚本复用**：交互模式下按「脚本内容哈希 + 最长公共前缀」复用已执行的脚本——改普通文本/属性不会重跑任何脚本，也不会重新拉取 CDN；只有脚本本身（或其前面的脚本）变化时才从变化处重新执行，保持执行顺序。
- **大纲虚拟化**：结构树改为按视口渲染（可见行 + 上下占位撑起滚动高度），只渲染视口附近约 20-40 行 DOM，超大文档（数千节点）滚动与光标联动不再卡顿；折叠/键盘导航/选中滚动定位保持可用。
- **节点 ID 稳定化**：节点标识从「兄弟索引路径」改为「显式 id 锚点 + 同标签序号」——在元素前后插入不同标签的兄弟不再改变其 ID（预览就地编辑/选中高亮/增量 patch 都因此更稳）；同标签兄弟插入仍会改变序号（无锚点时的固有限制），重复 id 会自动加后缀保证唯一。
- **预览增量渲染**：预览 DOM 改为按节点 id 增量 patch（安全/交互模式切换时才全量重建），不再每次输入重建整棵预览树，滚动位置、表单状态与 CSS 动画在编辑时保持稳定。
- **外部文件变更监听**：当前文件被其他工具/AI 改写时（2 秒 stat 轮询，忽略自身保存），文档干净会自动重载，有未保存修改则询问是否重载；文件被删除/移动会提示另存为。
- **自动保存草稿 + 崩溃恢复**：有未保存修改时每 2.5s 把草稿原子写入应用数据目录；异常退出/崩溃后下次启动询问是否恢复；正常保存、主动丢弃或正常退出会清理草稿。
- 语言、主题、布局、窗口尺寸与位置会在重启后恢复。
- Windows/Linux 支持单实例运行：应用已打开时再次双击文件会复用现有窗口并载入文件（macOS 由 LaunchServices 原生处理）。

### 修复
- 修复 macOS「用 Hylo 打开」不生效：未声明 `CFBundleDocumentTypes`、系统路径不在 fs scope 导致读取被静默拒绝；现在声明 HTML 文档类型、由 Rust 读取并补登记 fs/asset scope，失败会弹窗提示。
- 修复 macOS PDF 导出静默失效：改为从主 frame 调起原生打印，并按 iframe 真实内容高度展开，长文档完整分页；导出有明确的成功/失败提示。
- 修复未保存修改可能丢失：脏状态改为同步判断（去掉双重 300ms 防抖）；新建/打开/历史/粘贴/拖拽/退出/更新重启统一走二次确认。
- 修复源码面板在离线或受限网络下永久停在 `Loading…`：Monaco 改为随应用打包的本地版本，运行时不再请求 CDN。
- 修复交互预览确认框在 WebView 中无法显示（改用系统对话框），并改为按文档信任、每次打开文档回到安全预览。
- 修复关闭窗口在对话框异常时卡死、快速点击弹出多个对话框的问题。
- 修复 Word 导出把多 MB `Uint8Array` 序列化成 JSON 数组经 IPC 传输造成的卡顿（改为 base64 + Rust 原子写入）。
- 修复大文档编辑时预览闪空、parser worker 卡死导致预览永久空白（保留上一份 AST + 8s 超时降级到主线程）。
- 修复预览右键「复制」空实现（移除无效菜单项）；历史记录损坏数据可能导致历史弹窗崩溃的问题。
- 修复关闭窗口/⌘Q 路径未持久化窗口状态的问题（无插件依赖的自实现窗口状态持久化）。
- 文本保存改为原子写入（Rust 临时文件 + fsync + rename），避免保存过程中崩溃/断电把原文件截断；浏览器调试环境仍回退到 fs 插件。
- 修复 release 构建偶发失败（`mis-aligned LINKEDIT string pool`）：`Info.plist` 的 `__info_plist` 链接参数原先写在 `.cargo/config.toml` 的全局 rustflags，会作用到所有链接产物（含 proc-macro dylib）并产生损坏的 Mach-O；现改为 `build.rs` 中仅对 bin 生效，同时去掉硬编码的绝对路径，CI/其他机器可直接构建。
- 修复启用 CSP 后预览区相对路径图片不显示：父文档 CSP 的 `base-uri 'none'` 会阻止 sandbox iframe 内的 `<base href="asset://…">`，导致相对图片按 about:srcdoc 解析；现在父 CSP 的 `base-uri` 放行 asset 协议（iframe 自身的 meta CSP 仍限制为当前文件目录）。
- 修复启用 CSP 后预览区空白：Tauri 会向 `script-src` 注入 nonce/hash，按 CSP 规范将令 `'unsafe-inline'` 失效，从而拦截 sandbox 预览 iframe 里的内联运行时脚本；现在通过 `dangerousDisableAssetCspModification: ["script-src"]` 保留自有 `script-src`，其余指令仍由 Tauri 管理。

### 安全
- 收紧 Tauri 能力：移除 `fs:allow-read-file` 任意路径只读授权；移除未使用的 read-dir 权限。
- `assetProtocol.scope` 收窄为按打开文件/目录动态授权，不再全局 `**`；主窗口启用 CSP。
- 系统事件打开仅允许 `.html` / `.htm` / `.xhtml`，并有 32MB 上限。

### 工程
- CI 增加 quality 门禁（`tsc --noEmit`、`npm test`、`rustfmt --check`、`clippy -D warnings`、`cargo test`），发布在质量门禁之后；部署任务仅 tag 触发，移除危险的 `rm -rf` 清理步骤；补齐 macOS 签名/公证 secrets 占位。
- 版本号单一来源：`npm run version:sync` 同步 `package.json` / `Cargo.toml` / `tauri.conf.json` / `Info.plist` / 关于页，版检覆盖 `Info.plist`。
- Monaco 未使用语言贡献裁剪：Hylo 只编辑 HTML，无需 TypeScript/JSON 语言服务与 worker（ts.worker 约 6.7MB、json.worker 约 374KB），通过 Vite 插件把这两个贡献替换为空模块，前端构建产物从约 20MB 降到 13MB；UI logo 从 1.4MB 优化到约 50KB。
- 新增 Rust 单元测试、i18n 键一致性测试与安全运行时漂移测试；删除死代码 `ASTRenderer`、空 `App.css`、陈旧的根目录 `updater.json`。
- 引入 ESLint 9 + typescript-eslint + react-hooks 规则，`npm run lint` 纳入 CI quality 门禁；修复 hooks 依赖与未使用变量问题。
- 节点映射增加“上一次命中”缓存，光标在同一节点内连续移动不再重复线性扫描。
- 设计源文件迁至 `design/`（`process_new_icons.py` 同步更新），本地临时 `test_images/` 不再纳入仓库。
- 共享核心同步到 VS Code 扩展：新增 `npm run sync:core-vscode`（含仓库内漂移检测测试），扩展端补身份稳定性回归测试、版本升至 0.1.17 并重新打包 VSIX。
- 组件无障碍改进（菜单/弹窗 role、Escape 关闭、拖拽分隔线 Pointer Events + capture）；README / 开发指南补充测试、版本、签名发布与离线说明。

## [0.1.20] - 2026-08-26

### 新增
- 新增 AI HTML 审阅工作台、文档结构树、面包屑导航、稳定节点映射及大文档后台解析。
- 新增与 VS Code 扩展一致的安全预览和交互预览模式。
- 支持直接粘贴 AI 生成的 HTML，并自动清理 Markdown 代码围栏。

### 修复
- 强化预览沙箱隔离、消息校验与交互脚本生命周期管理。
- 改进 `html`、`head`、`body` 根元素的 CSS 兼容性和双向定位。
- 修复长文档 PDF 打印截断，并为 Word 导出增加原子落盘保护。

## [0.1.19] - 2026-07-02

### Added / 新增
- Added "Save As" (另存为) functionality with shortcut `Cmd+Shift+S`. (添加了“另存为”功能，快捷键为 `Cmd+Shift+S`。)
- Added a basic HTML5 template when creating a new file instead of initializing with an empty string. (新建文件时默认使用最小 HTML5 骨架模版，而非空文本。)
- Added `process:allow-exit` permission to tauri capabilities configuration. (在 tauri 权限配置中添加了 `process:allow-exit` 权限。)

### Fixed / 修复
- Fixed closing behavior with unsaved changes. Now prompts to save before exit and correctly handles cancelling the save dialog without terminating the app. (修复了未保存修改时直接关闭窗口的逻辑。现在会在退出前提示保存，并正确处理了取消另存为对话框时不退出的行为。)
- Fixed a bug where drag-and-dropping or opening a file via system would silently overwrite unsaved changes. (修复了拖入文件或通过系统打开新文件时会直接覆盖未保存修改的问题，现在会弹出二次确认。)

## [0.1.18] - 2026-06-24

### Added / 新增
- Supported dragging and dropping local HTML files directly into the application window to open them. (支持直接将本地文件拖拽到应用窗口内打开。)

### Fixed / 修复
- Fixed an initialization race condition where system-opened files (via double-click or "Open With") would briefly flash and then be overwritten by the default "Welcome" content. (修复了通过系统双击或右键打开文件时，因组件初始化时序冲突导致目标文件内容在短暂“闪一下”后被默认页内容错误覆盖的问题。)


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
