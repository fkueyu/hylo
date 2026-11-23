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

test("desktop preview preserves html/body selectors and reports scroll height", () => {
  const html = buildPreviewFrameDocument({ mode: "safe", baseHref: null });
  assert.match(html, /applyRootAttributes\(message\.ast\)/);
  assert.match(html, /target\.setAttribute\("data-hylo-id", node\.nodeId\)/);
  assert.match(html, /TRANSPARENT\.has\(tag\) \|\| tag === "body"/);
  assert.doesNotMatch(html, /tag === "body" \? "div"/);
  // 打印由父页面（主 frame）发起；iframe 只上报真实高度供打印时展开
  assert.match(html, /type: "frame-height", height: height/);
  // 预览内就地编辑：可编辑文本包 data-hylo-text-id，双击进入编辑并发 text-edit
  assert.match(html, /data-hylo-text-id/);
  assert.match(html, /addEventListener\("dblclick"/);
  assert.match(html, /type: "text-edit", nodeId, text: next/);
  assert.match(html, /RAW_TEXT = new Set\(\["style","script","textarea","title"\]\)/);
  // 增量 patch：未变化的节点复用，避免每次输入都全量重建 DOM
  assert.match(html, /function patchChildren\(/);
  assert.match(html, /function keyOfNode\(/);
  assert.match(html, /patchChildren\(root, Array\.from\(content\.childNodes\)/);
  assert.match(html, /modeChanged/);
  // 交互脚本按最长公共前缀复用，避免每次输入重跑全部脚本
  assert.match(html, /function syncScripts\(/);
  assert.match(html, /function scriptKey\(/);
  assert.match(html, /activeScripts\[keep\]\.key === nextKeys\[keep\]/);
  assert.doesNotMatch(html, /activeScripts\.forEach\(\(script\) => script\.remove\(\)\)/);
  assert.doesNotMatch(html, /event\.data\.type === "print"/);
});

test("preview diagnostics messages are validated and reported", () => {
  assert.equal(
    isPreviewFrameMessage({
      channel: "hylo-preview",
      type: "diagnostics",
      mode: "safe",
      scripts: 2,
      remoteAssets: 3,
      embeds: 0,
      inlineHandlers: 1,
    }),
    true,
  );
  assert.equal(
    isPreviewFrameMessage({
      channel: "hylo-preview",
      type: "diagnostics",
      mode: "safe",
      scripts: -1,
      remoteAssets: 0,
      embeds: 0,
      inlineHandlers: 0,
    }),
    false,
  );
  const html = buildPreviewFrameDocument({ mode: "safe", baseHref: null });
  assert.match(html, /type: "diagnostics"/);
  assert.match(html, /remoteAssets: diagnostics\.remoteAssets/);
});

test("text-edit messages are validated before writing back to source", () => {
  assert.equal(
    isPreviewFrameMessage({ channel: "hylo-preview", type: "text-edit", nodeId: "n1", text: "hi" }),
    true,
  );
  assert.equal(
    isPreviewFrameMessage({ channel: "hylo-preview", type: "text-edit", nodeId: "", text: "hi" }),
    false,
  );
  assert.equal(
    isPreviewFrameMessage({ channel: "hylo-preview", type: "text-edit", nodeId: "n1", text: 42 }),
    false,
  );
});

test("frame height and link messages are validated before use", () => {
  assert.equal(
    isPreviewFrameMessage({ channel: "hylo-preview", type: "frame-height", height: 1200 }),
    true,
  );
  assert.equal(
    isPreviewFrameMessage({ channel: "hylo-preview", type: "frame-height", height: 0 }),
    false,
  );
  assert.equal(
    isPreviewFrameMessage({ channel: "hylo-preview", type: "frame-height", height: Number.NaN }),
    false,
  );
  assert.equal(
    isPreviewFrameMessage({ channel: "hylo-preview", type: "open-link", href: "https://example.com" }),
    true,
  );
  assert.equal(
    isPreviewFrameMessage({ channel: "hylo-preview", type: "open-link", href: 42 }),
    false,
  );
});

test("host sanitizer and iframe runtime share the same dangerous URL filter", () => {
  const html = buildPreviewFrameDocument({ mode: "safe", baseHref: null });
  // 运行时通过注入的同一份 pattern 构造正则，避免两份实现漂移
  assert.match(html, /new RegExp\("/);
  assert.match(html, /vbscript/);
  assert.match(html, /BAD_URL\.test\(value\)/);
  assert.doesNotMatch(html, /const BAD_URL = \/\^/);

  assert.deepEqual(
    sanitizePreviewAttributes({ href: " javascript:alert(1)" }, "safe"),
    {},
  );
  assert.deepEqual(
    sanitizePreviewAttributes({ src: "data:text/html;base64,AAAA", onclick: "x", srcdoc: "x" }, "safe"),
    {},
  );
  assert.deepEqual(
    sanitizePreviewAttributes({ href: "https://example.com" }, "safe"),
    { href: "https://example.com" },
  );
});

test("iframe runtime string is valid JavaScript", () => {
  const html = buildPreviewFrameDocument({ mode: "interactive", baseHref: "asset://localhost/tmp/" });
  const script = html.match(/<body><script>([\s\S]*)<\/script><\/body>/)?.[1] ?? "";
  assert.ok(script.length > 100, "frame runtime script should be embedded in the frame document");
  assert.doesNotThrow(() => new Function(script));
});
