// ============================================================
// welcome.ts — 应用首屏欢迎文档（中/英两个版本）
// ============================================================

// 内置欢迎文档（中/英）
export const INITIAL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>欢迎使用 Hylo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', sans-serif;
      margin: 0;
      padding: 32px 40px;
      line-height: 1.75;
      color: #1a1a2e;
      box-sizing: border-box;
    }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.25rem; color: #111; }
    h2 { font-size: 1.15rem; font-weight: 600; margin-top: 2rem; color: #222; }
    p  { margin: 0.75rem 0; color: #444; }
    code {
      background: #f0f0f5;
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.875em;
      font-family: 'JetBrains Mono', monospace;
    }
    blockquote {
      border-left: 3px solid #6366f1;
      margin: 1.25rem 0;
      padding: 0.75rem 1.25rem;
      background: #f5f5ff;
      border-radius: 0 6px 6px 0;
      color: #555;
    }
    ul { padding-left: 1.5rem; }
    li { margin: 0.4rem 0; color: #444; }
    .tag { color: #6366f1; font-weight: 500; }
    a { color: #007aff; text-decoration: none; border-bottom: 1px solid transparent; transition: all 0.2s; }
    a:hover { border-bottom-color: #007aff; }
  </style>
</head>
<body>

  <h1>欢迎使用 Hylo ✦</h1>

  <blockquote>
    <p>HTML 的 Typora — AI 生成 HTML 的快捷微调工具</p>
  </blockquote>

  <p>
    Hylo 消除了 <strong>源代码</strong> 与 <strong>渲染预览</strong> 之间的割裂感，
    将 HTML 视为文档格式，而不是 Web 开发产物。
  </p>

  <h2>快速体验</h2>
  <ul>
    <li>点击右侧预览区的任意元素 → 左侧立即定位对应源码</li>
    <li>在编辑器中移动光标 → 右侧高亮对应的渲染元素</li>
    <li>拖动中间分隔线调整面板宽度</li>
    <li>点击工具栏「打开文件」加载本地 HTML 文档</li>
  </ul>

  <h2>为 AI 生成的 HTML 而生</h2>
  <p>
    大语言模型越来越多地直接生成 <code>HTML</code>。
    把 Agent 产出的 HTML 粘进来（可替换 / 插入 / 新建），在双栏预览里点选定位、查找替换，几分钟完成微调。
  </p>

  <h2>架构原理</h2>
  <p>
    每个渲染元素都通过 <code>parse5</code> AST 映射回精确的源码位置。
    文档在隔离的沙盒 <code>iframe</code> 中渲染；安全预览默认阻止脚本与远程资源，
    同时用稳定节点标识符保持源码与预览双向定位。
  </p>

  <h2>获取更多</h2>
  <ul>
    <li>官网：<a href="https://ainx.ink/hylo/" target="_blank">ainx.ink/hylo/</a></li>
    <li>VS Code 插件：<a href="https://marketplace.visualstudio.com/items?itemName=AINX.hylo-html-preview" target="_blank">在插件市场获取</a></li>
    <li>GitHub 源码：<a href="https://github.com/fkueyu/hylo" target="_blank">fkueyu/hylo</a></li>
  </ul>

</body>
</html>`;

export const INITIAL_HTML_EN = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Welcome to Hylo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 32px 40px;
      line-height: 1.75;
      color: #1a1a2e;
      box-sizing: border-box;
    }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.25rem; color: #111; }
    h2 { font-size: 1.15rem; font-weight: 600; margin-top: 2rem; color: #222; }
    p  { margin: 0.75rem 0; color: #444; }
    code {
      background: #f0f0f5;
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.875em;
      font-family: 'JetBrains Mono', monospace;
    }
    blockquote {
      border-left: 3px solid #6366f1;
      margin: 1.25rem 0;
      padding: 0.75rem 1.25rem;
      background: #f5f5ff;
      border-radius: 0 6px 6px 0;
      color: #555;
    }
    ul { padding-left: 1.5rem; }
    li { margin: 0.4rem 0; color: #444; }
    .tag { color: #6366f1; font-weight: 500; }
    a { color: #007aff; text-decoration: none; border-bottom: 1px solid transparent; transition: all 0.2s; }
    a:hover { border-bottom-color: #007aff; }
  </style>
</head>
<body>

  <h1>Welcome to Hylo ✦</h1>

  <blockquote>
    <p>Typora for HTML — quick fine-tuning for AI-generated HTML</p>
  </blockquote>

  <p>
    Hylo eliminates the disconnect between <strong>Source Code</strong> and <strong>Render Preview</strong>,
    treating HTML as a document format rather than a raw web development artifact.
  </p>

  <h2>Quick Start</h2>
  <ul>
    <li>Click any element in the preview pane on the right → instantly locates and highlights the corresponding source code on the left.</li>
    <li>Move your cursor in the editor → highlights the corresponding rendered element in the preview.</li>
    <li>Drag the middle splitter to adjust the widths of the panes.</li>
    <li>Click "Open File" in the titlebar to load your local HTML files.</li>
  </ul>

  <h2>Built for AI-generated HTML</h2>
  <p>
    Large Language Models increasingly generate direct <code>HTML</code> output.
    Paste HTML from your agent (replace / insert / new doc), jump between preview and source, and fine-tune in minutes.
  </p>

  <h2>How It Works</h2>
  <p>
    Every rendered element is mapped back to its precise source location using the <code>parse5</code> AST.
    The document renders in an isolated sandbox <code>iframe</code>. Safe Preview blocks scripts and remote
    resources by default while stable node identifiers preserve bidirectional source mapping.
  </p>

  <h2>Learn More</h2>
  <ul>
    <li>Website: <a href="https://ainx.ink/hylo/" target="_blank">ainx.ink/hylo/</a></li>
    <li>VS Code Extension: <a href="https://marketplace.visualstudio.com/items?itemName=AINX.hylo-html-preview" target="_blank">Available in VS Code Marketplace</a></li>
    <li>GitHub Repository: <a href="https://github.com/fkueyu/hylo" target="_blank">fkueyu/hylo</a></li>
  </ul>

</body>
</html>`;
