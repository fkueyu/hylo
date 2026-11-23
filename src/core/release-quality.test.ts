import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("version number has a single source and a sync script", () => {
  const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  assert.ok(pkg.scripts["version:sync"], "package.json must expose npm run version:sync");
  const script = readFileSync(new URL("scripts/sync-version.mjs", root), "utf8");
  assert.match(script, /src-tauri\/Info\.plist/);
  assert.match(script, /src-tauri\/Cargo\.toml/);
  assert.match(script, /src-tauri\/tauri\.conf\.json/);
  assert.match(script, /AboutModal\.tsx/);
});

test("CI runs typecheck, lint, tests, rustfmt and clippy quality gates", () => {
  const workflow = readFileSync(new URL(".github/workflows/release.yml", root), "utf8");
  assert.match(workflow, /npx tsc --noEmit/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /cargo fmt --all -- --check/);
  assert.match(workflow, /cargo clippy/);
  const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  assert.match(pkg.scripts.lint, /eslint/);
  const config = readFileSync(new URL("eslint.config.js", root), "utf8");
  assert.match(config, /eslint-plugin-react-hooks/);
});

test("desktop release runs tests and frontend build before packaging", () => {
  const workflow = readFileSync(new URL(".github/workflows/release.yml", root), "utf8");
  assert.match(workflow, /node-version:\s*22/);
  const testIndex = workflow.indexOf("run: npm test");
  const buildIndex = workflow.indexOf("run: npm run build");
  const packageIndex = workflow.indexOf("uses: tauri-apps/tauri-action");

  assert.ok(testIndex >= 0, "release workflow must run npm test");
  assert.ok(buildIndex > testIndex, "release workflow must build after tests");
  assert.ok(packageIndex > buildIndex, "Tauri packaging must happen after quality gates");
});

test("desktop version metadata stays aligned", () => {
  const packageVersion = JSON.parse(
    readFileSync(new URL("package.json", root), "utf8"),
  ).version;
  for (const path of [
    "src-tauri/Cargo.toml",
    "src-tauri/tauri.conf.json",
    "src-tauri/Info.plist",
    "src/components/AboutModal.tsx",
  ]) {
    assert.match(
      readFileSync(new URL(path, root), "utf8"),
      new RegExp(packageVersion.replaceAll(".", "\\.")),
      `${path} must contain desktop version ${packageVersion}`,
    );
  }
});

test("desktop documentation describes sandbox iframe instead of Shadow DOM", () => {
  for (const path of ["README.md", "docs/架构设计.md", "docs/功能特性.md"]) {
    const content = readFileSync(new URL(path, root), "utf8");
    assert.doesNotMatch(content, /Shadow DOM/i, `${path} still claims Shadow DOM isolation`);
    assert.match(content, /sandbox|沙盒 iframe/i, `${path} must describe the sandbox iframe`);
  }
});

test("welcome document describes the current sandbox architecture", () => {
  const source = readFileSync(new URL("src/assets/welcome.ts", root), "utf8");
  assert.doesNotMatch(source, /No <code>iframe|无\s*<code>iframe/);
  assert.doesNotMatch(source, /React render tree|React 渲染树/);
  assert.match(source, /sandbox|沙盒/);
});

test("browser development skips native-only startup calls", () => {
  const app = readFileSync(new URL("src/App.tsx", root), "utf8");
  const updater = readFileSync(new URL("src/components/UpdateModal.tsx", root), "utf8");
  assert.match(app, /if \(!isTauriRuntime\) return;[\s\S]{0,160}update_menu/);
  assert.match(updater, /if \(!isTauriRuntime\) return;/);
});

test("desktop Word export uses shared normalization and lazy-loads the converter", () => {
  const source = readFileSync(new URL("src/hooks/useFileExport.ts", root), "utf8");
  assert.match(source, /normalizeExportDocument/);
  assert.match(source, /await import\(["']html-to-docx["']\)/);
  assert.doesNotMatch(source, /^import HTMLtoDOCX/m);
  assert.doesNotMatch(source, /const fullHtml = `<!DOCTYPE/);
  assert.match(source, /invoke\("write_docx_atomic"/);
  const rust = readFileSync(new URL("src-tauri/src/lib.rs", root), "utf8");
  assert.match(rust, /tempfile_in\(parent\)/);
  assert.match(rust, /sync_all\(\)/);
  assert.match(rust, /persist\(&target\)/);
});

test("VS Code extension core copy stays in sync when present", () => {
  const vscodeCore = new URL("hylo-vscode/vendor/hylo-core/dist/index.js", root);
  let exists = true;
  try {
    readFileSync(vscodeCore);
  } catch {
    exists = false;
  }
  if (!exists) return; // 独立 checkout / CI 中可能没有扩展目录
  const desktop = readFileSync(new URL("vendor/hylo-core/dist/index.js", root), "utf8");
  assert.equal(
    readFileSync(vscodeCore, "utf8"),
    desktop,
    "hylo-vscode vendor core drifted; run npm run sync:core-vscode",
  );
});

test("vendored shared core build artifacts remain trackable", () => {
  const ignore = readFileSync(new URL(".gitignore", root), "utf8");
  assert.match(ignore, /!vendor\/hylo-core\/dist\/\*\*/);
});

test("desktop sends large documents to a versioned parser worker", () => {
  const source = readFileSync(new URL("src/hooks/useEditor.ts", root), "utf8");
  assert.match(source, /shouldParseInWorker/);
  assert.match(source, /new Worker/);
  assert.match(source, /parseVersion/);
  assert.match(source, /parser\.worker\.ts/);
  assert.match(source, /parserWorker\.onerror/);
  assert.match(source, /parserWorkerAvailableRef/);
  assert.match(source, /parserTimeoutRef/);
  assert.match(source, /8000/);
  assert.doesNotMatch(source, /setParseResult\(null\)/);
});

test("desktop PDF printing happens from the main frame with print-height expansion", () => {
  const app = readFileSync(new URL("src/App.tsx", root), "utf8");
  const panel = readFileSync(new URL("src/components/PreviewPanel.tsx", root), "utf8");
  const css = readFileSync(new URL("src/index.css", root), "utf8");
  const exporter = readFileSync(new URL("src/hooks/useFileExport.ts", root), "utf8");
  assert.match(panel, /onLoad=\{handleFrameLoad\}/);
  // macOS 上 iframe 内的 window.print 不会走 Tauri 的打印桥接，必须由主 frame 触发
  assert.match(app, /handleExportPDF/);
  assert.match(app, /invoke\("export_pdf"\)/);
  assert.match(app, /setIsPrinting\(true\)/);
  assert.match(panel, /printing \?/);
  assert.match(css, /@media print/);
  assert.doesNotMatch(exporter, /preview:print/);
});

test("main window CSP allows the preview iframe asset base without weakening scripts", () => {
  const config = JSON.parse(readFileSync(new URL("src-tauri/tauri.conf.json", root), "utf8"));
  const security = config.app.security;
  const csp = String(security.csp ?? "");
  assert.ok(csp.length > 0, "main window must define a CSP");
  // 相对图片依赖 iframe 内的 <base href="asset://...">，父文档不能把 base-uri 锁成 'none'
  assert.doesNotMatch(csp, /base-uri 'none'/);
  assert.match(csp, /base-uri[^;]*asset:/);
  assert.match(csp, /img-src[^;]*asset:/);
  // srcdoc 预览运行时是内联脚本，必须保留 script-src 的 unsafe-inline（并禁用 Tauri 的 nonce 注入）
  assert.match(csp, /script-src[^;]*'unsafe-inline'/);
  assert.deepEqual(security.dangerousDisableAssetCspModification, ["script-src"]);
});

test("clipboard goes through native commands instead of only the web API", () => {
  const rust = readFileSync(new URL("src-tauri/src/lib.rs", root), "utf8");
  const clipboard = readFileSync(new URL("src/core/clipboard.ts", root), "utf8");
  const app = readFileSync(new URL("src/App.tsx", root), "utf8");
  assert.match(rust, /tauri_plugin_clipboard_manager::init\(\)/);
  assert.match(rust, /fn read_clipboard_text/);
  assert.match(rust, /fn write_clipboard_text/);
  assert.match(clipboard, /invoke<string>\("read_clipboard_text"\)/);
  assert.match(clipboard, /invoke\("write_clipboard_text"/);
  assert.match(app, /readClipboardText/);
});

test("document outline is virtualized for large documents", () => {
  const component = readFileSync(new URL("src/components/DocumentOutline.tsx", root), "utf8");
  const core = readFileSync(new URL("src/core/document-structure.ts", root), "utf8");
  assert.match(component, /flattenOutline/);
  assert.match(component, /ROW_HEIGHT/);
  assert.match(component, /startIndex/);
  assert.match(component, /document-outline__viewport/);
  assert.match(core, /export function flattenOutline/);
});

test("preview supports in-place text editing written back to source", () => {
  const panel = readFileSync(new URL("src/components/PreviewPanel.tsx", root), "utf8");
  const editor = readFileSync(new URL("src/hooks/useEditor.ts", root), "utf8");
  const app = readFileSync(new URL("src/App.tsx", root), "utf8");
  assert.match(panel, /onTextEdit/);
  assert.match(editor, /applyTextEdit/);
  assert.match(editor, /escapeTextForHtml/);
  assert.match(editor, /hylo-source-edit/);
  assert.match(app, /handlePreviewTextEdit/);
});

test("open files are watched for external changes", () => {
  const app = readFileSync(new URL("src/App.tsx", root), "utf8");
  const hook = readFileSync(new URL("src/hooks/useFileWatcher.ts", root), "utf8");
  const capability = JSON.parse(
    readFileSync(new URL("src-tauri/capabilities/default.json", root), "utf8"),
  );
  assert.match(hook, /from "@tauri-apps\/plugin-fs"/);
  assert.match(hook, /stat\(filepath\)/);
  assert.match(hook, /readTextFile\(filepath\)/);
  assert.match(hook, /POLL_INTERVAL_MS/);
  assert.match(hook, /externalChangeTitle/);
  assert.match(app, /useFileWatcher/);
  assert.match(app, /watcherIgnoreBeforeRef/);
  assert.ok(capability.permissions.includes("fs:allow-stat"));
});

test("unsaved drafts are autosaved and restored after a crash", () => {
  const app = readFileSync(new URL("src/App.tsx", root), "utf8");
  const draft = readFileSync(new URL("src/core/draft.ts", root), "utf8");
  const rust = readFileSync(new URL("src-tauri/src/lib.rs", root), "utf8");
  assert.match(draft, /invoke\("save_draft"/);
  assert.match(draft, /invoke<DraftSnapshot \| null>\("read_draft"\)/);
  assert.match(draft, /invoke\("clear_draft"/);
  assert.match(app, /saveDraft/);
  assert.match(app, /readDraft/);
  assert.match(app, /clearDraft/);
  assert.match(app, /draftRestoreTitle/);
  assert.match(rust, /fn save_draft/);
  assert.match(rust, /fn read_draft/);
  assert.match(rust, /fn clear_draft/);
  assert.match(rust, /DraftPayload/);
});

test("offline audit surfaces common AI HTML issues and locates them", () => {
  const audit = readFileSync(new URL("src/core/audit.ts", root), "utf8");
  const modal = readFileSync(new URL("src/components/AuditModal.tsx", root), "utf8");
  const app = readFileSync(new URL("src/App.tsx", root), "utf8");
  const panel = readFileSync(new URL("src/components/PreviewPanel.tsx", root), "utf8");
  for (const rule of [
    "missing-alt",
    "remote-resource",
    "empty-link",
    "duplicate-id",
    "heading-jump",
    "inline-style",
    "blocked-script",
  ]) {
    assert.ok(audit.includes(rule), `audit must implement rule ${rule}`);
  }
  assert.match(app, /auditDocument/);
  assert.match(app, /AuditModal/);
  assert.match(app, /auditReport/);
  assert.match(modal, /onSelectNode/);
  // 预览诊断：安全预览拦截的脚本/远程资源以徽标提示
  assert.match(panel, /preview-panel__diagnostics/);
  assert.match(panel, /diagnosticsScripts/);
});

test("selected nodes can be edited through an attribute modal", () => {
  const app = readFileSync(new URL("src/App.tsx", root), "utf8");
  const modal = readFileSync(new URL("src/components/NodeAttributesModal.tsx", root), "utf8");
  const panel = readFileSync(new URL("src/components/PreviewPanel.tsx", root), "utf8");
  const editor = readFileSync(new URL("src/hooks/useEditor.ts", root), "utf8");
  assert.match(app, /NodeAttributesModal/);
  assert.match(app, /handleSaveAttributes/);
  assert.match(app, /findStartTagRange/);
  assert.match(app, /serializeStartTag/);
  assert.match(modal, /attrNameInvalid/);
  assert.match(panel, /"editAttributes"/);
  assert.match(editor, /applySourceReplace/);
});

test("paste flow offers replace / insert-at-cursor / new document", () => {
  const app = readFileSync(new URL("src/App.tsx", root), "utf8");
  const editor = readFileSync(new URL("src/hooks/useEditor.ts", root), "utf8");
  const modal = readFileSync(new URL("src/components/PasteHtmlModal.tsx", root), "utf8");
  assert.match(app, /PasteHtmlModal/);
  assert.match(app, /applyPaste/);
  assert.match(editor, /insertAtCursor/);
  assert.match(editor, /executeEdits\("hylo-insert"/);
  for (const mode of ["replace", "insert", "new"]) {
    assert.ok(modal.includes(`"${mode}"`), `paste modal must expose ${mode} mode`);
  }
});

test("native Edit menu routes find and replace into Monaco actions", () => {
  const rust = readFileSync(new URL("src-tauri/src/lib.rs", root), "utf8");
  const app = readFileSync(new URL("src/App.tsx", root), "utf8");
  assert.match(rust, /"find-in-editor"/);
  assert.match(rust, /"replace-in-editor"/);
  assert.match(rust, /CmdOrCtrl\+F/);
  assert.match(app, /actions\.find/);
  assert.match(app, /editor\.action\.startFindReplaceAction/);
  assert.match(app, /triggerEditorAction/);
});

test("text saves go through the Rust atomic writer", () => {
  const hook = readFileSync(new URL("src/hooks/useFileSave.ts", root), "utf8");
  const rust = readFileSync(new URL("src-tauri/src/lib.rs", root), "utf8");
  assert.match(hook, /invoke\("write_text_atomic"/);
  assert.match(rust, /fn write_text_atomic/);
  assert.match(rust, /prefix\("\.hylo-save-"\)/);
  assert.match(rust, /sync_all\(\)/);
  assert.match(rust, /persist\(&target\)/);
});

test("unused Monaco language services are trimmed from the bundle", () => {
  const viteConfig = readFileSync(new URL("vite.config.ts", root), "utf8");
  assert.match(viteConfig, /trim-unused-monaco-languages/);
  assert.ok(viteConfig.includes("(typescript|json)"));
  assert.ok(viteConfig.includes("contribution"));
  const stub = readFileSync(new URL("src/shims/monaco-unused-language.ts", root), "utf8");
  assert.match(stub, /export \{\}/);
});

test("Monaco is bundled locally instead of fetched from the CDN at runtime", () => {
  const loader = readFileSync(new URL("src/core/monaco-loader.ts", root), "utf8");
  const panel = readFileSync(new URL("src/components/MonacoPanel.tsx", root), "utf8");
  assert.match(loader, /await import\(\s*["']monaco-editor["']\)|import\(["']monaco-editor["']\)/);
  assert.match(loader, /loader\.config\(\{\s*monaco/);
  assert.match(panel, /ensureLocalMonaco\(\)/);
  assert.match(panel, /monaco-panel__loading/);
});

test("system open-with files bypass the fs plugin scope and survive startup races", () => {
  const app = readFileSync(new URL("src/App.tsx", root), "utf8");
  const bridge = readFileSync(new URL("src/core/system-file.ts", root), "utf8");
  const rust = readFileSync(new URL("src-tauri/src/lib.rs", root), "utf8");
  const config = JSON.parse(readFileSync(new URL("src-tauri/tauri.conf.json", root), "utf8"));

  // 系统事件路径不在 fs 插件 scope 内，必须由 Rust 侧读取
  assert.match(bridge, /invoke<string>\("read_system_open_file"/);
  assert.match(bridge, /invoke<string\[\]>\("take_pending_open_files"/);
  assert.match(app, /takePendingSystemFiles\(\)/);
  assert.match(app, /readSystemFile\(path\)/);
  assert.doesNotMatch(app, /get_opened_file/);
  assert.doesNotMatch(app, /readTextFile\(path\)/);

  // 冷启动时事件可能早于前端监听器，Rust 侧改为入队 + drain
  assert.match(rust, /struct PendingOpenFiles/);
  assert.match(rust, /fn take_pending_open_files/);
  assert.match(rust, /fn enqueue_system_open_file/);
  assert.match(rust, /RunEvent::Opened/);
  assert.match(rust, /allow_file\(path\)/);

  // macOS 需要声明文档类型，否则 Finder「打开方式」不会把文件交给 Hylo
  const association = (config.bundle.fileAssociations ?? [])[0];
  assert.ok(association, "tauri.conf.json must declare bundle.fileAssociations");
  assert.deepEqual(association.ext, ["html", "htm", "xhtml"]);
  assert.ok(association.contentTypes.includes("public.html"));
  assert.equal(association.role, "Editor");
});

