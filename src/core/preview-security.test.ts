import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPreviewFrameDocument,
  isPreviewFrameMessage,
  sanitizePreviewAttributes,
} from "./preview-security.ts";

test("safe frame document blocks user scripts and remote connections", () => {
  const html = buildPreviewFrameDocument({ mode: "safe", baseHref: null });

  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /allow-same-origin|window\.__TAURI__|https:\s*;/);
  assert.match(html, /closest\("a\[href\]"\)/);
  assert.match(html, /event\.preventDefault\(\)/);
});

test("interactive frame remains sandbox-oriented and allows HTTPS scripts", () => {
  const html = buildPreviewFrameDocument({ mode: "interactive", baseHref: "asset://localhost/" });

  assert.match(html, /script-src 'unsafe-inline'[^;]*https:/);
  assert.match(html, /asset:\/\/localhost\//);
  assert.doesNotMatch(html, /allow-same-origin|http:\s/);
});

test("safe attributes reject handlers, active documents, and javascript URLs", () => {
  assert.deepEqual(
    sanitizePreviewAttributes(
      { onclick: "run()", src: "javascript:run()", srcdoc: "<script />", alt: "ok" },
      "safe",
    ),
    { alt: "ok" },
  );
});

test("desktop frame messages accept only validated node selections and readiness", () => {
  assert.equal(isPreviewFrameMessage({ channel: "hylo-preview", type: "preview-ready" }), true);
  assert.equal(
    isPreviewFrameMessage({ channel: "hylo-preview", type: "node-selected", nodeId: "node-1" }),
    true,
  );
  assert.equal(
    isPreviewFrameMessage({ channel: "hylo-preview", type: "node-selected", nodeId: 4 }),
    false,
  );
  assert.equal(
    isPreviewFrameMessage({
      channel: "hylo-preview",
      type: "node-context-menu",
      nodeId: "node-1",
      x: 12,
      y: 24,
    }),
    true,
  );
  assert.equal(isPreviewFrameMessage({ channel: "hylo-preview", type: "open-file" }), false);
});

test("desktop preview preserves html/body selectors and prints inside the frame", () => {
  const html = buildPreviewFrameDocument({ mode: "safe", baseHref: null });
  assert.match(html, /applyRootAttributes\(message\.ast\)/);
  assert.match(html, /target\.setAttribute\("data-hylo-id", node\.nodeId\)/);
  assert.match(html, /TRANSPARENT\.has\(tag\) \|\| tag === "body"/);
  assert.doesNotMatch(html, /tag === "body" \? "div"/);
  assert.match(html, /event\.data\.type === "print"/);
});
