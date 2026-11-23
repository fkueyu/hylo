# Hylo ✦

> **HTML 的 Typora** — 面向 AI 生成 HTML 的实时预览与快速微调编辑器。
> **Typora for HTML** — Live preview and quick fine-tuning for AI-generated HTML.

---

[官网 / Official Site](https://ainx.ink/hylo/) | [Mac App Store](https://apps.apple.com/cn/app/hylo-editor/id6771771702?mt=12) | [Windows 下载 / Windows Releases](https://github.com/fkueyu/hylo/releases) | [VS Code 插件 / VS Code Extension](https://marketplace.visualstudio.com/items?itemName=AINX.hylo-html-preview)

Hylo 是一款面向 AI 生成 HTML 的双向联动可视化编辑器（不内置 AI，AI 生成交给你的 Agent/LLM，Hylo 专注预览、定位与微调）。无需复杂的服务器配置或外部热更新工具，即可在编写 HTML 文件时实现“源码”与“预览”的无缝双向交互定位：

* **源码 → 预览 (Code to Preview)**：在编辑器中移动光标或选中标签，预览侧自动定位并高亮对应的渲染元素。
* **预览 → 源码 (Preview to Code)**：点击预览侧中的任意渲染元素，源码编辑器光标瞬间定位并滚动至该元素对应的确切代码行。

---

## ⚡ 核心特性 / Key Features

* **极速双向定位**：基于高精度 AST (抽象语法树) 映射引擎，双向高亮零延迟。
* **AI HTML 工作流**：直接粘贴 AI 对话里的 HTML（可选择「替换当前 / 插入光标处 / 新建文档」），自动清理 Markdown 代码围栏，双栏即时预览后微调。
* **文档结构导航**：通过可折叠结构树和元素 breadcrumb 理解长文档，并在结构、源码、预览之间同步定位。
* **外部修改同步**：文件被其他工具改写时自动重载/提示重载，避免覆盖。
* **防崩溃草稿**：未保存内容自动落盘，异常退出后可恢复。
* **文档审阅与诊断**：离线检查缺 alt、远程资源、空链接、重复 id、标题跳级等问题并可一键定位；安全预览拦截脚本/远程资源时给出诊断提示。
* **快速微调**：双击预览里的文字就地修改、选中元素直接改属性（class/style/src/alt/href）、点击定位源码、查找/替换与格式化，配合原子保存与未保存保护，改一版 AI 输出的 HTML 只需几秒钟。
* **沙盒 iframe 隔离**：用户页面运行在不具备同源权限的独立 sandbox iframe 中，自定义样式无法覆盖 Hylo 外壳。
* **安全预览默认开启**：默认阻止文档脚本与远程资源；仅在用户明确开启“交互预览”后，才在隔离 iframe 内运行 HTTPS 脚本和 CDN 资源。
* **大文档后台解析**：超过 512 KB 的 HTML 自动交给版本化 Worker 解析，连续编辑时旧结果不会覆盖新内容。
* **纯本地运行**：不做任何统计或遥测，文档内容与编辑行为不会上传；仅在应用启动后检查更新时访问更新服务器（匿名请求，不携带任何文档或个人信息）。Monaco 编辑器与解析 Worker 均随应用打包，离线可用。

---

## 🚀 开发者指南 / Developer Guide

### 运行开发版 (Run Development)
```bash
# 安装依赖
npm install

# 启动本地开发调试 (Tauri)
npm run tauri dev
```

### 运行测试 / 类型检查 (Tests & Typecheck)
```bash
npm test              # 前端单元测试（node:test）
npx tsc --noEmit      # TypeScript 类型检查
cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings
```

### 打包安装程序 (Build Application Bundle)
```bash
npm run tauri build
```
打包成功后，将在 `src-tauri/target/release/bundle/` 下生成各平台对应的原生安装包（macOS 为 `.dmg`/`.app`，Windows 为 `.msi`）。

> 版本号以 `package.json` 为唯一来源，发版前先执行 `npm run version:sync`，它会同步 `Cargo.toml`、`tauri.conf.json`、`Info.plist` 与关于页。
> Mac App Store 构建使用 `npm run build:mas`，需要本机安装对应证书；GitHub Release 构建在 CI 中完成，配置 `APPLE_*` secrets 后可签名并公证。

---

## 📂 项目文档 / Project Documents

在 `docs/` 目录下可以阅读更多关于 Hylo 的设计细节：
* [📝 产品需求文档 (PRD)](docs/产品需求文档.md)
* [📖 功能特性与用户手册](docs/功能特性.md)
* [📐 系统架构设计](docs/架构设计.md)
* [💻 开发与贡献指南](docs/开发指南.md)
* [🎨 视觉设计规范](docs/视觉设计.md)

---

## 🛠️ 技术栈 / Tech Stack

* **Frontend**: React 19 + TypeScript + Vite
* **Native Shell**: Tauri v2 + Rust
* **Code Editor**: Monaco Editor (VS Code 核心编辑器内核)
* **AST Parser**: parse5
