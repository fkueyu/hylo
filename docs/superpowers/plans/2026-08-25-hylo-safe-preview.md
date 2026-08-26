# Hylo Safe Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make safe, isolated HTML preview the default in Hylo and hylo-vscode while preserving an explicitly enabled interactive mode, bidirectional selection, local resources, and release quality gates.

**Architecture:** Each trusted host keeps parsing, NodeMap, toolbar, outline, and source navigation. User DOM moves into a sandbox iframe with no `allow-same-origin`; a narrow `postMessage` contract carries AST updates, highlights, and validated node selections. Pure security policy functions are tested independently before host integration.

**Tech Stack:** React 19, TypeScript, Tauri 2, VS Code Webview API, parse5, Node test runner, GitHub Actions, esbuild.

**Spec:** `docs/superpowers/specs/2026-08-25-hylo-safe-preview-design.md`

## Global Constraints

- Safe preview is the default and never executes user `<script>` nodes or `on*` attributes.
- Interactive preview requires explicit opt-in and is forbidden in untrusted VS Code workspaces.
- Preview iframe sandbox must be exactly `allow-scripts`; do not add `allow-same-origin`, navigation, popup, or download permissions.
- Relative local images and styles, outline, breadcrumb, and bidirectional selection must continue to work.
- Host CSP must not contain `unsafe-eval`, HTTP script sources, or `connect-src *`.
- Existing user changes in both worktrees must be preserved.

---

### Task 1: VS Code preview security contract

**Files:**
- Create: `../hylo-vscode/src/preview-security.ts`
- Create: `../hylo-vscode/test/preview-security.test.ts`
- Modify: `../hylo-vscode/package.json`

**Interfaces:**
- Produces: `type PreviewMode = "safe" | "interactive"`.
- Produces: `resolvePreviewMode(requested: PreviewMode, workspaceTrusted: boolean): PreviewMode`.
- Produces: `isPreviewFrameMessage(value: unknown): value is PreviewFrameMessage`.
- Produces: `createHostCsp(cspSource: string, nonce: string): string`.

- [x] **Step 1: Write failing policy tests**

```ts
test("untrusted workspaces always resolve to safe preview", () => {
  assert.equal(resolvePreviewMode("interactive", false), "safe");
});

test("host CSP excludes broad script and connection permissions", () => {
  const csp = createHostCsp("vscode-webview:", "abc");
  assert.doesNotMatch(csp, /unsafe-eval|http:|connect-src \*/);
});

test("frame messages reject unknown commands and malformed node IDs", () => {
  assert.equal(isPreviewFrameMessage({ type: "node-selected", nodeId: 3 }), false);
  assert.equal(isPreviewFrameMessage({ type: "open-file", path: "/tmp/x" }), false);
});
```

- [x] **Step 2: Run the focused test and confirm RED**

Run: `node --experimental-strip-types --test test/preview-security.test.ts`
Expected: FAIL because `src/preview-security.ts` does not exist.

- [x] **Step 3: Implement the minimal pure security contract**

```ts
export type PreviewMode = "safe" | "interactive";
export type PreviewFrameMessage =
  | { type: "preview-ready" }
  | { type: "node-selected"; nodeId: string }
  | { type: "render-stats"; nodeCount: number; renderTime: number };

export function resolvePreviewMode(requested: PreviewMode, trusted: boolean): PreviewMode {
  return trusted ? requested : "safe";
}
```

- [x] **Step 4: Run focused and existing tests**

Run: `npm test`
Expected: all preview-security and document-structure tests pass.

### Task 2: VS Code isolated frame runtime

**Files:**
- Create: `../hylo-vscode/media/preview-frame.js`
- Create: `../hylo-vscode/test/preview-frame.test.js`
- Modify: `../hylo-vscode/media/preview.js`
- Modify: `../hylo-vscode/media/preview.css`
- Modify: `../hylo-vscode/src/preview-panel.ts`
- Modify: `../hylo-vscode/src/types.ts`
- Modify: `../hylo-vscode/package.json`

**Interfaces:**
- Consumes: `PreviewMode`, `resolvePreviewMode`, `isPreviewFrameMessage`, `createHostCsp`.
- Produces frame commands: `render`, `highlight`, and `set-mode` under channel `hylo-preview`.
- Produces setting: `hylo.previewMode` with values `safe` and `interactive`, default `safe`.

- [x] **Step 1: Write failing renderer-contract tests**

```js
test("safe mode drops scripts, event handlers, and javascript URLs", () => {
  const result = sanitizeAttributes({ onclick: "x()", href: "javascript:x()", id: "ok" }, "safe");
  assert.deepEqual(result, { id: "ok" });
  assert.equal(shouldExecuteScript("safe"), false);
});

test("interactive mode still removes inline event attributes", () => {
  assert.deepEqual(sanitizeAttributes({ onclick: "x()", id: "ok" }, "interactive"), { id: "ok" });
  assert.equal(shouldExecuteScript("interactive"), true);
});
```

- [x] **Step 2: Confirm the frame tests fail for missing exports**

Run: `node --test test/preview-frame.test.js`
Expected: FAIL because `preview-frame.js` does not expose the contract.

- [x] **Step 3: Implement the sandboxed frame and narrow bridge**

The trusted shell creates:

```html
<iframe id="hylo-preview-frame" sandbox="allow-scripts"></iframe>
```

The frame runtime receives only channel-tagged commands, renders AST without `innerHTML`, excludes event attributes in both modes, excludes scripts and dangerous URLs in safe mode, and posts node IDs to the shell. The shell validates IDs through the extension-host NodeMap before moving the editor.

- [x] **Step 4: Add mode command, status UI, and Workspace Trust fallback**

The extension resolves configured mode through `resolvePreviewMode(configured, vscode.workspace.isTrusted)`. A toolbar button toggles modes only in trusted workspaces and persists with `Workspace` configuration target.

- [x] **Step 5: Tighten host CSP and remove direct user-script execution**

Generate the host CSP through `createHostCsp`; the host loads only nonce-bearing extension scripts. Remove user AST rendering and `pendingScripts` execution from the trusted shell.

- [x] **Step 6: Run tests, typecheck, syntax checks, and build**

Run: `npm test`
Run: `npm run typecheck`
Run: `node --check media/preview.js`
Run: `node --check media/preview-frame.js`
Run: `npm run build`
Expected: all commands exit 0.

### Task 3: Desktop preview security contract

**Files:**
- Create: `src/core/preview-security.ts`
- Create: `src/core/preview-security.test.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces the same `PreviewMode` semantics as the extension.
- Produces: `sanitizePreviewAttributes(attrs, mode)` and `isPreviewFrameMessage(value)`.
- Produces: `buildPreviewFrameDocument(options): string`.

- [x] **Step 1: Write failing desktop policy tests**

```ts
test("safe frame document blocks user scripts and remote connections", () => {
  const html = buildPreviewFrameDocument({ mode: "safe", baseHref: null });
  assert.doesNotMatch(html, /connect-src https:|allow-same-origin/);
});

test("safe attributes reject handlers and javascript URLs", () => {
  assert.deepEqual(sanitizePreviewAttributes({ onclick: "x()", src: "javascript:x()", alt: "ok" }, "safe"), { alt: "ok" });
});
```

- [x] **Step 2: Confirm RED**

Run: `node --experimental-strip-types --test src/core/preview-security.test.ts`
Expected: FAIL because the production module does not exist.

- [x] **Step 3: Implement minimal policy and frame-document generation**

Frame HTML contains a mode-specific CSP, a runtime bridge, AST renderer, click handling, selection highlighting, and no host API references.

- [x] **Step 4: Run focused and full tests**

Run: `npm test`
Expected: all document-structure and preview-security tests pass.

### Task 4: Desktop sandbox integration

**Files:**
- Modify: `src/components/PreviewPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `buildPreviewFrameDocument`, `PreviewMode`, and validated frame messages.
- Preserves existing `PreviewPanelProps` selection and context-menu callbacks.

- [x] **Step 1: Add a failing source-level sandbox assertion**

Add a test that reads `PreviewPanel.tsx` and asserts the iframe contains `sandbox="allow-scripts"` without `allow-same-origin`, and that `createPortal`/`ASTRenderer` are no longer used by the panel.

- [x] **Step 2: Confirm the assertion fails against the current Portal implementation**

Run: `node --experimental-strip-types --test src/components/PreviewPanel.security.test.ts`
Expected: FAIL on missing sandbox and retained Portal renderer.

- [x] **Step 3: Replace Portal rendering with the message-driven sandbox iframe**

Initialize the iframe from `buildPreviewFrameDocument`, post AST/highlight updates, validate `event.source`, validate the message shape, and preserve source navigation. Context-menu actions remain in the trusted host and only receive validated node IDs.

- [x] **Step 4: Add safe/interactive UI and localized copy**

Default to safe mode, persist explicit interactive opt-in locally, explain blocked scripts once, and keep current outline/breadcrumb behavior.

- [x] **Step 5: Run tests and production build**

Run: `npm test`
Run: `npm run build`
Expected: tests and TypeScript/Vite build exit 0.

### Task 5: Release gates, package hygiene, and accurate docs

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `README.md`
- Modify: `docs/架构设计.md`
- Modify: `docs/功能特性.md`
- Modify: `../hylo-vscode/.github/workflows/publish.yml`
- Modify: `../hylo-vscode/esbuild.js`
- Modify: `../hylo-vscode/.vscodeignore`
- Modify: `../hylo-vscode/README.md`
- Modify: `../hylo-vscode/CHANGELOG.md`

**Interfaces:**
- Release workflows require the exact verification commands from Tasks 2 and 4.
- Production extension packages exclude `dist/*.map`; watch builds retain source maps.

- [x] **Step 1: Add release workflow assertions to the security tests**

Tests read workflow/build files and require `npm test`, appropriate type/build checks, conditional development source maps, and `dist/*.map` exclusion.

- [x] **Step 2: Confirm assertions fail against current workflows**

Run the two project test commands and confirm failures name the missing quality gates.

- [x] **Step 3: Add release gates and conditional source maps**

Hylo release runs tests and build before Tauri packaging. Extension publish runs tests, typecheck, build, and package inspection before publishing. `esbuild.js` sets `sourcemap: watch`; `.vscodeignore` excludes `dist/*.map`.

- [x] **Step 4: Replace inaccurate Shadow DOM claims**

Document sandbox iframe isolation, safe default behavior, interactive opt-in, Workspace Trust behavior, and HTTPS-only remote resources.

- [x] **Step 5: Run full verification and package inspection**

Run in Hylo: `npm test`, `npm run build`, `git diff --check`.
Run in hylo-vscode: `npm test`, `npm run typecheck`, `npm run build`, `npm run package`, `unzip -l extension.vsix`.
Expected: all commands exit 0 and the VSIX listing contains no `.map` or test files.
