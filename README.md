# Hylo ✦

> **HTML 的 Typora** — 实时 HTML 预览与源码双向联动编辑器。
> **Typora for HTML** — Real-time HTML live preview with bi-directional syncing.

---

[官网 / Official Site](https://ainx.ink/hylo/) | [VS Code 插件 / VS Code Extension](https://marketplace.visualstudio.com/items?itemName=AINX.hylo-html-preview)

Hylo 是一款双向联动的 HTML 可视化编辑器。无需复杂的服务器配置或外部热更新工具，即可在编写 HTML 文件时实现“源码”与“预览”的无缝双向交互定位：

* **源码 → 预览 (Code to Preview)**：在编辑器中移动光标或选中标签，预览侧自动定位并高亮对应的渲染元素。
* **预览 → 源码 (Preview to Code)**：点击预览侧中的任意渲染元素，源码编辑器光标瞬间定位并滚动至该元素对应的确切代码行。

---

## ⚡ 核心特性 / Key Features

* **极速双向定位**：基于高精度 AST (抽象语法树) 映射引擎，双向高亮零延迟。
* **沙盒安全隔离**：预览侧采用 Shadow DOM 独立沙盒，用户自定义的 CSS/JS 绝不污染 App 本身的 UI。
* **Tailwind & 框架支持**：直接支持引入外部 CDN 脚本（如 Tailwind CSS、Bootstrap），毫秒级热重载。
* **纯本地运行**：没有任何外部服务器连接，保障您的隐私与源码安全。

---

## 🚀 开发者指南 / Developer Guide

### 运行开发版 (Run Development)
```bash
# 安装依赖
npm install

# 启动本地开发调试 (Tauri)
npm run tauri dev
```

### 打包安装程序 (Build Application Bundle)
```bash
npm run tauri build
```
打包成功后，将在 `src-tauri/target/release/bundle/` 下生成各平台对应的原生安装包（macOS 为 `.dmg`/`.app`，Windows 为 `.msi`）。

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
