import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./PreviewPanel.tsx", import.meta.url), "utf8");

test("desktop preview uses a script-only sandbox without same-origin access", () => {
  assert.match(source, /sandbox=["{]?["']allow-scripts["']/);
  assert.doesNotMatch(source, /allow-same-origin/);
});

test("desktop preview no longer portals user DOM into the host-accessible iframe", () => {
  assert.doesNotMatch(source, /createPortal|ASTRenderer/);
  assert.match(source, /isPreviewFrameMessage/);
});

test("interactive preview recreates its JavaScript realm on document updates", () => {
  assert.match(source, /previewMode === "interactive"/);
  assert.match(source, /frame\.srcdoc = frameDocument/);
});
