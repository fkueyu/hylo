# Hylo 双宿主安全预览设计

## 背景

Hylo 桌面端与 hylo-vscode 都会把用户 HTML 解析为 AST，再渲染成可交互预览。当前两端都会执行用户文档中的脚本；hylo-vscode 还把用户内容直接挂在工具栏所在的 Webview 文档中，并使用允许 `unsafe-inline`、`unsafe-eval`、HTTP/HTTPS 脚本及任意网络连接的 CSP。现有 README 和架构文档仍宣称使用 Shadow DOM 隔离，与实现不一致。

本阶段只解决预览信任边界、发布门禁和直接相关的包体问题。共享 `hylo-core`、稳定节点锚点和大文档性能优化属于后续阶段，不在本设计范围内。

## 目标

1. 两端都以“安全预览”为默认行为，不执行用户 HTML 中的脚本。
2. 用户可显式开启“交互预览”，但用户内容必须运行在与宿主 UI 隔离的 sandbox iframe 中。
3. 保留本地 HTML、内联 CSS、相对图片和源码↔预览定位能力。
4. 安全模式不允许远程脚本、远程样式或任意网络请求。
5. hylo-vscode 在未受信任工作区中不得开启交互预览。
6. 发布流程必须先通过测试、类型检查和构建。
7. 文档准确描述实际隔离模型，不再使用不真实的 Shadow DOM 表述。

## 非目标

- 不在本阶段统一 React 与 Webview 的 UI 实现。
- 不实现第三方脚本权限逐项授权。
- 不引入遥测、账号系统或云端代理。
- 不保证安全模式下 Tailwind CDN 等依赖脚本执行的页面完整还原；这类页面需要交互预览。
- 不改变文件打开、保存、导出和历史记录的产品流程。

## 方案选择

### 采用：默认安全模式 + 显式交互模式 + sandbox iframe

宿主工具栏、结构树和提示信息留在可信 UI 中；用户页面进入独立 iframe。iframe 不授予 `allow-same-origin`，避免用户脚本读取或修改宿主文档。宿主与预览只通过受限消息协议通信。

该方案兼顾默认安全与现有动态页面兼容性。相比永久禁用脚本，它不会移除 Hylo 的交互页面预览能力；相比只显示警告并继续执行脚本，它建立了实际的技术隔离。

### 未采用：继续同文档渲染，仅增加警告

实现成本低，但用户 CSS 仍可覆盖宿主 UI，脚本仍与可信控制层共享执行环境，不能满足安全目标。

### 未采用：所有模式永久禁用脚本

安全边界最简单，但会破坏 Tailwind CDN、演示页面和交互组件等既有用途，产品兼容性损失过大。

## 产品行为

### 安全预览

- 默认启用。
- 忽略所有 `<script>` 节点与 `on*` 事件属性。
- 允许文档内联 `<style>`，但样式只作用于 iframe 内部。
- 允许当前文档目录下、经宿主资源协议转换的相对图片和样式。
- 阻止 HTTP/HTTPS 脚本、样式、字体及 `connect` 请求。
- 工具栏显示“安全预览”状态，并提供开启交互预览的明确操作。
- 遇到被阻止的脚本时显示非阻塞提示，不重复弹窗。

### 交互预览

- 由用户主动开启，按项目/工作区保存选择；新项目仍默认安全。
- iframe 使用 `sandbox="allow-scripts"`，不得增加 `allow-same-origin`、`allow-top-navigation`、`allow-popups` 或下载权限。
- 允许 HTTPS 脚本、样式、图片、字体和网络连接；不允许明文 HTTP。
- 用户脚本只能影响预览 iframe，不能直接访问 VS Code API、Tauri API、宿主工具栏或结构树。
- hylo-vscode 只有在 `vscode.workspace.isTrusted === true` 时允许开启；工作区失去信任时立即回退安全模式。
- 桌面端切换交互预览时显示一次明确说明，选择保存在本地设置中。

## 架构

### 可信宿主层

两端宿主层负责：解析 HTML、维护 NodeMap、展示工具栏/结构树、保存模式、校验消息、执行源码定位。它不直接执行用户脚本。

### 隔离预览运行时

两端各自拥有平台适配的 iframe 运行时。运行时接收序列化 AST、基础资源 URI、当前模式和选择状态，重建用户 DOM，并把节点点击通过 `postMessage` 回传。消息只允许以下操作：

- `preview-ready`
- `node-selected`，携带一个字符串 `nodeId`
- `render-stats`，携带有限的数值统计

宿主收到消息后必须校验消息类型、字段类型，并确认 `nodeId` 存在于当前 NodeMap。未知消息直接忽略。

### CSP 分层

宿主 Webview 使用严格 nonce CSP，只加载扩展自身脚本和样式，不允许 `unsafe-eval` 或网络脚本。iframe 内容根据模式生成独立 CSP：

- 安全模式：`default-src 'none'`，只开放所需的本地图片、样式和字体来源；`connect-src 'none'`、`script-src` 仅允许内置运行时。
- 交互模式：在 sandbox 边界内允许 HTTPS 资源和连接，继续拒绝 HTTP、顶层导航和宿主 API。

内置运行时脚本与用户脚本必须在生成阶段分开处理，使安全模式可以执行渲染桥而不执行用户脚本。

## 平台落地

### hylo-vscode

- `PreviewPanel` 管理模式、Workspace Trust 和严格宿主 CSP。
- Webview shell 保留工具栏、breadcrumb 与 outline，用户页面改为 sandbox iframe。
- 当前 `media/preview.js` 拆分为可信 shell 控制器与 iframe 渲染运行时，避免继续扩大单个 IIFE。
- 配置项提供 `safe` 与 `interactive` 两个值，默认 `safe`；未受信任工作区强制覆盖为 `safe`。

### Hylo 桌面端

- `PreviewPanel` 不再通过 React Portal 把用户 DOM直接挂入可被宿主访问的 about:blank 文档。
- 新增 iframe 运行时，通过消息接收 AST 和回传选择。
- iframe 与 Tauri 主窗口之间不共享同源权限；运行时不得访问 `window.__TAURI__`。
- 安全/交互模式使用与插件一致的用户文案和行为语义，但设置存储采用 Tauri/前端本地能力。

## 兼容与迁移

- 首次升级后所有用户进入安全预览。
- 包含脚本的文档仍能显示静态 HTML/CSS，并看到“脚本已阻止”的状态提示。
- 用户开启交互模式后恢复动态脚本行为，但 HTTP CDN 不再支持；文档应引导迁移到 HTTPS。
- 相对资源继续以当前 HTML 文件所在目录为基准。
- 双向定位不得因 iframe 隔离而退化。

## 测试策略

实施必须遵循测试驱动：先增加会失败的行为测试，再修改生产代码。

1. 纯函数测试：模式解析、Workspace Trust 降级、CSP 生成、消息校验、脚本过滤。
2. 渲染契约测试：安全模式忽略用户脚本和事件属性；交互模式保留脚本队列；两种模式均保留 nodeId。
3. 插件集成测试：安全默认值、未受信任工作区、Webview 消息、相对资源与双向定位。
4. 桌面测试：iframe sandbox 属性、脚本模式切换、消息校验和节点定位。
5. 回归测试：结构树、breadcrumb、导出和现有文档结构测试继续通过。
6. 发布验证：Hylo 执行 `npm test` 与 `npm run build`；hylo-vscode 执行 `npm test`、`npm run typecheck`、`npm run build` 和 VSIX 打包检查。

## 发布与文档

- 两个发布 workflow 在打包或发布前加入测试和类型/构建门禁。
- hylo-vscode 生产 VSIX 不包含 `dist/*.map`；开发 watch 仍可生成 source map。
- README、架构设计、功能说明和 changelog 使用“sandbox iframe”描述真实实现。
- 交互模式的风险说明应清楚但不过度恐吓，不使用“绝对安全”等不可验证表述。

## 验收标准

1. 新安装默认安全预览，用户脚本不会执行。
2. 用户 CSS 无法改变宿主工具栏、outline 或应用外壳。
3. hylo-vscode 未受信任工作区无法开启交互预览。
4. 交互模式下动态页面可运行，但不能访问宿主 API 或顶层文档。
5. 相对图片、内联 CSS、文档结构和双向定位在两种模式下可用。
6. 宿主 CSP 不包含 `unsafe-eval`、HTTP 脚本或任意 `connect-src *`。
7. 两个发布流程在测试失败时停止。
8. VSIX 不包含生产 source map。
9. 所有相关文档与实际隔离实现一致。
