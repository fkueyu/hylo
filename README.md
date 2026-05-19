# Hylo

> **HTML 的 Typora** — AI 原生 HTML 可视化编辑器

Hylo 是一款面向 macOS 的本地 HTML 编辑器，实现了源码编辑与渲染预览的**实时双向联动**。点击预览区任意元素，编辑器立即定位对应代码；在代码间移动光标，预览区同步高亮对应元素。

## 快速开始

```bash
npm install
npm run tauri dev
```

## 文档

- [产品需求文档](docs/产品需求文档.md)
- [功能特性与用户手册](docs/功能特性.md)
- [系统架构设计](docs/架构设计.md)
- [开发与贡献指南](docs/开发指南.md)
- [视觉设计规范](docs/视觉设计.md)

## 技术栈

React 19 + TypeScript + Vite · Tauri v2 + Rust · Monaco Editor · parse5
