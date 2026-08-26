import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("desktop release runs tests and frontend build before packaging", () => {
  const workflow = readFileSync(new URL(".github/workflows/release.yml", root), "utf8");
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
  const source = readFileSync(new URL("src/App.tsx", root), "utf8");
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
  assert.match(source, /nodeMapRef\.current\.clear\(\)/);
  assert.match(source, /setParseResult\(null\)/);
});

test("desktop iframe has a load handshake fallback and frame-local PDF printing", () => {
  const panel = readFileSync(new URL("src/components/PreviewPanel.tsx", root), "utf8");
  const exporter = readFileSync(new URL("src/hooks/useFileExport.ts", root), "utf8");
  assert.match(panel, /onLoad=\{handleFrameLoad\}/);
  assert.match(panel, /preview:print/);
  assert.match(exporter, /eventBus\.emit\("preview:print"/);
  assert.doesNotMatch(exporter, /invoke\("export_pdf"\)/);
});
