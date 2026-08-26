# Hylo AI Review Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Hylo 深化为面向 AI 内容创作者的 HTML 审阅与精调工作台，并增加剪贴板载入、文档结构导航和选中元素上下文。

**Architecture:** 新增纯函数模块从现有 `HyloNode` AST 派生结构树和 breadcrumb，新建独立 `DocumentOutline` 组件负责展示。`App` 只编排剪贴板、防丢失确认、结构开关与现有双向定位回调，现有解析和同步引擎保持不变。

**Tech Stack:** React 19、TypeScript、Tauri v2、Monaco Editor、Node 内置测试运行器、CSS。

**Spec:** `docs/superpowers/specs/2026-08-25-hylo-ai-review-workbench-design.md`

## Global Constraints

- 不增加网络请求、账号体系、云同步或模型 API。
- 保持中英文字符串同步，界面不硬编码用户可见文案。
- 保持现有文件防丢失流程与源码/预览双向映射接口。
- 不新增运行时依赖，不使用远程字体。
- 支持 macOS 12+，窗口最小尺寸 800×600。

---

### Task 1: 文档结构派生模型

**Files:**
- Create: `src/core/document-structure.ts`
- Create: `src/core/document-structure.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `HyloNode` from `@/types`（测试使用相对路径）。
- Produces: `OutlineItem`, `buildDocumentOutline(root)`, `findNodeTrail(root, nodeId)`, `isUsableHtmlClipboard(text)`。

- [x] **Step 1: 写入失败测试**：覆盖过滤非元素与无源码节点、层级保留、id/class 标签、breadcrumb 查找、空白与普通文本拒绝。
- [x] **Step 2: 运行 `npm test`，确认因模块不存在而失败。**
- [x] **Step 3: 实现最小纯函数模块。**
- [x] **Step 4: 再运行 `npm test`，确认全部通过。**

### Task 2: 文档结构组件

**Files:**
- Create: `src/components/DocumentOutline.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `OutlineItem[]`, `selectedNodeId`, `onSelect(nodeId)`。
- Produces: 可折叠、键盘可操作的树形导航。

- [x] **Step 1: 用已有纯函数测试保护数据契约。**
- [x] **Step 2: 实现递归树节点、选中态、自动展开祖先与空状态。**
- [x] **Step 3: 添加中英文文案及结构侧栏样式。**
- [x] **Step 4: 运行测试与 TypeScript 构建。**

### Task 3: 剪贴板载入与工作区编排

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/components/MonacoPanel.tsx`
- Modify: `src/components/PreviewPanel.tsx`

**Interfaces:**
- Consumes: `isUsableHtmlClipboard`, `buildDocumentOutline`, `findNodeTrail`, existing `editor.loadContent` and `editor.handlePreviewClick`。
- Produces: `handlePasteHtml`, 结构面板开关、breadcrumb、更新后的工作栏。

- [x] **Step 1: 将纯函数测试扩展为剪贴板边界用例并确认失败。**
- [x] **Step 2: 实现剪贴板读取、无效内容错误和未保存确认。**
- [x] **Step 3: 接入结构组件与 breadcrumb，保持现有同步回调。**
- [x] **Step 4: 运行测试与构建。**

### Task 4: 视觉体系深化

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.tsx`
- Modify: `src/components/SplitView.tsx`
- Modify: `src/components/DropdownMenu.tsx`

**Interfaces:**
- Consumes: 现有 class names 与主题 class。
- Produces: 新 token、工作栏、映射轨道、面板头、按钮与响应式状态。

- [x] **Step 1: 用设计规格逐项建立 CSS token 和组件状态清单。**
- [x] **Step 2: 重构标题栏、主动作、布局与主题图标。**
- [x] **Step 3: 实现映射轨道、焦点态、窄窗口和 reduced-motion。**
- [x] **Step 4: 运行测试与完整构建。**

### Task 5: 界面验证与回归

**Files:**
- Modify: `docs/视觉设计.md`

**Interfaces:**
- Consumes: 完成后的本地界面。
- Produces: 与实现一致的视觉说明和验证证据。

- [x] **Step 1: 启动本地应用并检查默认、结构展开、节点选中、浅色和窄窗口。**
- [x] **Step 2: 修复视觉或交互问题并重新检查。**
- [x] **Step 3: 更新视觉设计文档。**
- [x] **Step 4: 新鲜运行 `npm test` 与 `npm run build`。**
