export type PreviewMode = "safe" | "interactive";

export type PreviewFrameMessage =
  | { channel: "hylo-preview"; type: "preview-ready" }
  | { channel: "hylo-preview"; type: "frame-height"; height: number }
  | { channel: "hylo-preview"; type: "open-link"; href: string }
  | { channel: "hylo-preview"; type: "text-edit"; nodeId: string; text: string }
  | {
      channel: "hylo-preview";
      type: "diagnostics";
      mode: "safe" | "interactive";
      scripts: number;
      remoteAssets: number;
      embeds: number;
      inlineHandlers: number;
    }
  | { channel: "hylo-preview"; type: "node-selected"; nodeId: string }
  | {
      channel: "hylo-preview";
      type: "node-context-menu";
      nodeId: string | null;
      x: number;
      y: number;
    };

// 单一来源：宿主侧（sanitizePreviewAttributes）与 iframe 运行时共用同一 URL 过滤规则，
// 避免两份实现随迭代漂移。
const DANGEROUS_URL_SOURCE = String.raw`^\s*(?:javascript|vbscript|data\s*:\s*text\/html)`;
const DANGEROUS_URL = new RegExp(DANGEROUS_URL_SOURCE, "i");

export function sanitizePreviewAttributes(
  attrs: Record<string, string> | undefined,
  mode: PreviewMode,
): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [rawName, value] of Object.entries(attrs ?? {})) {
    const name = rawName.toLowerCase();
    if (name.startsWith("on") || name === "srcdoc") continue;
    if (["href", "src", "action", "formaction", "xlink:href"].includes(name)
      && DANGEROUS_URL.test(value)) continue;
    if (mode === "safe" && name === "http-equiv" && value.toLowerCase() === "refresh") continue;
    safe[rawName] = value;
  }
  return safe;
}

export type PreviewDiagnostics = Extract<PreviewFrameMessage, { type: "diagnostics" }>;

export function isPreviewFrameMessage(value: unknown): value is PreviewFrameMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  if (message.channel !== "hylo-preview") return false;
  if (message.type === "preview-ready") return true;
  if (message.type === "frame-height") {
    return typeof message.height === "number"
      && Number.isFinite(message.height)
      && message.height > 0
      && message.height <= 500_000;
  }
  if (message.type === "text-edit") {
    return typeof message.nodeId === "string"
      && message.nodeId.length > 0
      && message.nodeId.length <= 200
      && typeof message.text === "string"
      && message.text.length <= 200_000;
  }
  if (message.type === "diagnostics") {
    const counts = [message.scripts, message.remoteAssets, message.embeds, message.inlineHandlers];
    return (message.mode === "safe" || message.mode === "interactive")
      && counts.every(
        (count) =>
          typeof count === "number" &&
          Number.isFinite(count) &&
          count >= 0 &&
          count <= 100_000,
      );
  }
  if (message.type === "open-link") {
    return typeof message.href === "string"
      && message.href.length > 0
      && message.href.length <= 2048;
  }
  if (message.type === "node-selected") {
    return typeof message.nodeId === "string" && message.nodeId.length > 0;
  }
  return message.type === "node-context-menu"
    && (message.nodeId === null || typeof message.nodeId === "string")
    && typeof message.x === "number"
    && Number.isFinite(message.x)
    && typeof message.y === "number"
    && Number.isFinite(message.y);
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getLocalSource(baseHref: string | null): string {
  if (!baseHref) return "";
  return baseHref.match(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i)?.[0] ?? "";
}

const FRAME_RUNTIME = String.raw`
(function () {
  const CHANNEL = "hylo-preview";
  const root = document.body;
  const VOID = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
  const TRANSPARENT = new Set(["html","head"]);
  const ACTIVE = new Set(["iframe","object","embed"]);
  // 这些元素里的文本是原始文本（CSS/JS 等），不能包 span，否则会破坏其语义
  const RAW_TEXT = new Set(["style","script","textarea","title"]);
  const REMOTE_ATTRS = new Set(["src","href","poster","data","srcset","background"]);
  const REMOTE_URL = /^(?:https?:)?\/\//i;
  let diagnostics = { scripts: 0, remoteAssets: 0, embeds: 0, inlineHandlers: 0 };
  const BAD_URL = new RegExp(${JSON.stringify(DANGEROUS_URL_SOURCE)}, "i");
  let mode = "safe";
  let scripts = [];
  let activeScripts = []; // { element, key }，按执行顺序保存已注入的脚本
  const appliedRootAttributes = { html: new Set(), head: new Set(), body: new Set() };

  function findElement(node, tagName) {
    if (!node || typeof node !== "object") return null;
    if (node.type === "element" && String(node.tagName).toLowerCase() === tagName) return node;
    for (const child of node.children || []) {
      const found = findElement(child, tagName);
      if (found) return found;
    }
    return null;
  }

  function applyRootAttributes(ast) {
    for (const [tag, target] of [["html", document.documentElement], ["head", document.head], ["body", document.body]]) {
      for (const name of appliedRootAttributes[tag]) target.removeAttribute(name);
      appliedRootAttributes[tag].clear();
      const node = findElement(ast, tag);
      if (node?.nodeId) {
        target.setAttribute("data-hylo-id", node.nodeId);
        appliedRootAttributes[tag].add("data-hylo-id");
      }
      for (const [name, value] of Object.entries(attrs(node?.attrs))) {
        if (tag === "html" && name.toLowerCase() === "style") continue;
        try { target.setAttribute(name, value); appliedRootAttributes[tag].add(name); } catch {}
      }
    }
  }

  function post(message) {
    parent.postMessage({ channel: CHANNEL, ...message }, "*");
  }

  // 报告内容高度：父页面在打印时按真实高度展开 iframe，避免长文档被截断。
  let heightTimer = 0;
  function reportHeight() {
    if (heightTimer) clearTimeout(heightTimer);
    heightTimer = setTimeout(function () {
      const height = Math.ceil(document.documentElement.scrollHeight);
      if (height > 0) post({ type: "frame-height", height: height });
    }, 60);
  }
  root.addEventListener("load", reportHeight, true);
  if (typeof ResizeObserver === "function") {
    try { new ResizeObserver(reportHeight).observe(document.documentElement); } catch (error) {}
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(reportHeight).catch(function () {});
  }

  function attrs(input) {
    const output = {};
    for (const [rawName, rawValue] of Object.entries(input || {})) {
      const name = rawName.toLowerCase();
      const value = String(rawValue);
      if (name.startsWith("on") || name === "srcdoc") continue;
      if (["href","src","action","formaction","xlink:href"].includes(name) && BAD_URL.test(value)) continue;
      if (mode === "safe" && name === "http-equiv" && value.toLowerCase() === "refresh") continue;
      output[rawName] = value;
    }
    return output;
  }

  function createNode(node, parentTag) {
    if (!node || typeof node !== "object") return null;
    if (node.type === "text") {
      const value = node.textContent || "";
      // 可编辑文本用 span 包一层（双击就地修改）；空白/原始文本保持纯文本节点
      if (!value.trim() || RAW_TEXT.has(parentTag) || !node.nodeId) {
        return document.createTextNode(value);
      }
      const span = document.createElement("span");
      span.setAttribute("data-hylo-text-id", node.nodeId);
      span.className = "hylo-preview-text";
      span.textContent = value;
      return span;
    }
    if (node.type === "comment" || node.type === "doctype") return null;
    if (node.type === "document") {
      const fragment = document.createDocumentFragment();
      for (const child of node.children || []) {
        const childNode = createNode(child, parentTag);
        if (childNode) fragment.appendChild(childNode);
      }
      return fragment;
    }
    if (node.type !== "element" || !node.tagName) return null;
    const tag = String(node.tagName).toLowerCase();
    if (tag === "script") {
      if (mode === "interactive") {
        scripts.push(node);
      } else {
        diagnostics.scripts += 1;
      }
      return document.createComment("script blocked by Hylo preview boundary");
    }
    if (mode === "safe" && ACTIVE.has(tag)) {
      diagnostics.embeds += 1;
      return document.createComment(tag + " blocked by Hylo safe preview");
    }
    if (TRANSPARENT.has(tag) || tag === "body") {
      const fragment = document.createDocumentFragment();
      for (const child of node.children || []) {
        const childNode = createNode(child, parentTag);
        if (childNode) fragment.appendChild(childNode);
      }
      return fragment;
    }
    const element = document.createElement(tag);
    if (node.nodeId) element.setAttribute("data-hylo-id", node.nodeId);
    if (mode === "safe") {
      for (const name of Object.keys(node.attrs || {})) {
        if (String(name).toLowerCase().startsWith("on")) diagnostics.inlineHandlers += 1;
      }
      const rawAttrs = node.attrs || {};
      for (const name of Object.keys(rawAttrs)) {
        if (REMOTE_ATTRS.has(String(name).toLowerCase()) && REMOTE_URL.test(String(rawAttrs[name]))) {
          diagnostics.remoteAssets += 1;
          break;
        }
      }
    }
    for (const [name, value] of Object.entries(attrs(node.attrs))) {
      try { element.setAttribute(name, value); } catch {}
    }
    if (!VOID.has(tag)) {
      for (const child of node.children || []) {
        const childNode = createNode(child, tag);
        if (childNode) element.appendChild(childNode);
      }
    }
    return element;
  }

  function scriptContent(node) {
    return node.children?.length === 1 && node.children[0].type === "text"
      ? node.children[0].textContent || "" : "";
  }

  function attributesKey(properties) {
    return Object.keys(properties)
      .sort()
      .map((name) => name + "=" + properties[name])
      .join("&");
  }

  function scriptKey(node) {
    const properties = attrs(node.attrs);
    if (properties.src) {
      return "src:" + properties.src + "|" + attributesKey(properties);
    }
    const content = scriptContent(node);
    let hash = 5381;
    for (let index = 0; index < content.length; index += 1) {
      hash = (hash * 33) ^ content.charCodeAt(index);
    }
    return "inline:" + (hash >>> 0) + ":" + content.length + "|" + attributesKey(properties);
  }

  // 交互预览的脚本按「最长公共前缀」复用：没变化的脚本不会在每次输入后重跑；
  // 只有脚本本身（或它前面的脚本）变化时，才从变化处重新执行，保持原有执行顺序。
  function syncScripts(nextNodes) {
    const nextKeys = nextNodes.map(scriptKey);
    let keep = 0;
    while (
      keep < nextKeys.length &&
      keep < activeScripts.length &&
      activeScripts[keep].key === nextKeys[keep]
    ) {
      keep += 1;
    }
    for (let index = activeScripts.length - 1; index >= keep; index -= 1) {
      activeScripts[index].element.remove();
      activeScripts.splice(index, 1);
    }
    let cursor = keep;
    const runNext = () => {
      if (cursor >= nextNodes.length) return;
      const node = nextNodes[cursor];
      const key = nextKeys[cursor];
      cursor += 1;
      const script = document.createElement("script");
      const properties = attrs(node.attrs);
      for (const [name, value] of Object.entries(properties)) script.setAttribute(name, value);
      activeScripts.push({ element: script, key: key });
      if (properties.src) {
        script.onload = runNext;
        script.onerror = runNext;
        document.head.appendChild(script);
        return;
      }
      const content = scriptContent(node);
      script.textContent = "try {\n{\n" + content + "\n}\n} catch (error) { console.error('Hylo preview script error', error); }";
      document.head.appendChild(script);
      runNext();
    };
    runNext();
  }

  function highlight(nodeId, scroll) {
    document.querySelectorAll(".hylo-preview-highlight").forEach((element) => element.classList.remove("hylo-preview-highlight"));
    if (typeof nodeId !== "string") return;
    const target = document.querySelector('[data-hylo-id="' + CSS.escape(nodeId) + '"]');
    target?.classList.add("hylo-preview-highlight");
    if (target && scroll) target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ── 增量 patch：按 data-hylo-id / data-hylo-text-id 复用现有 DOM ──
  // 全量 replaceChildren 会让滚动位置、表单状态、CSS 动画在每次输入后重置；
  // 这里只更新变化的节点，未变化的元素保持同一个 DOM 实例。
  let renderedMode = null;

  function keyOfNode(node) {
    if (!node || node.nodeType !== 1) return null;
    return node.getAttribute("data-hylo-id") || node.getAttribute("data-hylo-text-id");
  }

  function patchElement(current, next) {
    // 正在就地编辑的文本 span：先不覆盖用户正在输入的内容
    if (current.getAttribute("contenteditable") === "true") return;
    for (let index = current.attributes.length - 1; index >= 0; index -= 1) {
      const name = current.attributes[index].name;
      if (!next.hasAttribute(name)) current.removeAttribute(name);
    }
    for (let index = 0; index < next.attributes.length; index += 1) {
      const attr = next.attributes[index];
      if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
    }
    patchChildren(current, Array.from(next.childNodes), Array.from(current.childNodes));
  }

  function patchNode(current, next) {
    if (current.nodeType !== next.nodeType) return false;
    if (current.nodeType === 3 || current.nodeType === 8) {
      if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
      return true;
    }
    if (current.nodeType !== 1) return true;
    if (current.tagName !== next.tagName) return false;
    patchElement(current, next);
    return true;
  }

  function patchChildren(parent, nextNodes, prevNodes) {
    const byKey = new Map();
    for (const child of prevNodes) {
      const key = keyOfNode(child);
      if (key) byKey.set(key, child);
    }
    const used = new Set();
    let cursor = parent.firstChild;
    for (const next of nextNodes) {
      const key = keyOfNode(next);
      const existing = key ? byKey.get(key) : null;
      const matched = existing && !used.has(existing) && existing.tagName === next.tagName ? existing : null;
      if (matched) {
        used.add(matched);
        patchNode(matched, next);
        if (matched !== cursor) parent.insertBefore(matched, cursor);
        else cursor = cursor.nextSibling;
        continue;
      }
      if (!key && cursor && cursor.nodeType === next.nodeType && cursor.nodeType !== 1) {
        // 无 key 的文本/注释按位置就地更新
        used.add(cursor);
        patchNode(cursor, next);
        cursor = cursor.nextSibling;
        continue;
      }
      parent.insertBefore(next, cursor);
    }
    for (const child of prevNodes) {
      if (!used.has(child) && child.parentNode === parent) parent.removeChild(child);
    }
  }

  function render(message) {
    const nextMode = message.mode === "interactive" ? "interactive" : "safe";
    const modeChanged = nextMode !== renderedMode;
    mode = nextMode;
    diagnostics = { scripts: 0, remoteAssets: 0, embeds: 0, inlineHandlers: 0 };
    applyRootAttributes(message.ast);
    scripts = [];
    const content = createNode(message.ast);
    const nextScripts = scripts;
    scripts = [];
    if (modeChanged || !root.firstChild) {
      // 安全预览 ↔ 交互预览切换时结构可能整体变化，直接重建一次
      root.replaceChildren();
      if (content) root.appendChild(content);
      renderedMode = mode;
    } else if (content) {
      patchChildren(root, Array.from(content.childNodes), Array.from(root.childNodes));
    }
    syncScripts(mode === "interactive" ? nextScripts : []);
    highlight(message.highlightedNodeId, false);
    reportHeight();
    post({
      type: "diagnostics",
      mode: mode,
      scripts: diagnostics.scripts,
      remoteAssets: diagnostics.remoteAssets,
      embeds: diagnostics.embeds,
      inlineHandlers: diagnostics.inlineHandlers,
    });
  }

  // ── 预览内就地编辑文本 ─────────────────────────────────────
  let textEditState = null;

  function finishTextEdit(commit) {
    const state = textEditState;
    if (!state) return;
    textEditState = null;
    const { span, original, nodeId } = state;
    span.removeAttribute("contenteditable");
    span.classList.remove("hylo-preview-text--editing");
    span.removeEventListener("keydown", handleTextEditKeydown, true);
    span.removeEventListener("blur", handleTextEditBlur, true);
    const next = span.textContent || "";
    if (!commit || next === original) {
      span.textContent = original;
      return;
    }
    post({ type: "text-edit", nodeId, text: next });
  }

  function handleTextEditKeydown(event) {
    if (!textEditState) return;
    if (event.key === "Escape") {
      event.preventDefault();
      finishTextEdit(false);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      finishTextEdit(true);
    }
  }

  function handleTextEditBlur() {
    finishTextEdit(true);
  }

  function beginTextEdit(span) {
    if (textEditState) finishTextEdit(true);
    const nodeId = span.getAttribute("data-hylo-text-id");
    if (!nodeId) return;
    textEditState = { span, nodeId, original: span.textContent || "" };
    span.setAttribute("contenteditable", "true");
    span.classList.add("hylo-preview-text--editing");
    span.addEventListener("keydown", handleTextEditKeydown, true);
    span.addEventListener("blur", handleTextEditBlur, true);
    span.focus();
    const range = document.createRange();
    range.selectNodeContents(span);
    const selection = getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  root.addEventListener("dblclick", (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    const span = target.closest("[data-hylo-text-id]");
    if (!span) return;
    event.preventDefault();
    event.stopPropagation();
    beginTextEdit(span);
  }, true);

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    const anchor = target.closest("a[href]");
    if (anchor) {
      event.preventDefault();
      event.stopPropagation();
      const href = anchor.getAttribute("href") || "";
      // 安全预览一律不导航；交互预览仅把 http(s) 链接交给父页面用系统浏览器打开。
      if (mode === "interactive" && /^https?:/i.test(href)) post({ type: "open-link", href: href });
      return;
    }
    const nodeId = target.closest("[data-hylo-id]")?.getAttribute("data-hylo-id");
    if (nodeId) post({ type: "node-selected", nodeId });
  }, true);

  root.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const target = event.target;
    const nodeId = target && typeof target.closest === "function"
      ? target.closest("[data-hylo-id]")?.getAttribute("data-hylo-id") || null
      : null;
    post({ type: "node-context-menu", nodeId, x: event.clientX, y: event.clientY });
  }, true);

  addEventListener("message", (event) => {
    if (event.source !== parent || event.data?.channel !== CHANNEL) return;
    if (event.data.type === "render") render(event.data);
    if (event.data.type === "highlight") highlight(event.data.nodeId, event.data.scroll !== false);
  });
  post({ type: "preview-ready" });
})();`;

interface FrameDocumentOptions {
  mode: PreviewMode;
  baseHref: string | null;
}

export function buildPreviewFrameDocument({ mode, baseHref }: FrameDocumentOptions): string {
  const localSource = getLocalSource(baseHref);
  const localPolicy = localSource ? ` ${localSource}` : "";
  const remotePolicy = mode === "interactive" ? " https:" : "";
  const csp = [
    "default-src 'none'",
    `img-src data: blob:${localPolicy}${remotePolicy}`,
    `style-src 'unsafe-inline'${localPolicy}${remotePolicy}`,
    `font-src data:${localPolicy}${remotePolicy}`,
    `script-src 'unsafe-inline'${localPolicy}${remotePolicy}`,
    `connect-src ${mode === "interactive" ? "https:" : "'none'"}`,
    mode === "interactive" ? "frame-src https:" : "frame-src 'none'",
    "object-src 'none'",
    `base-uri ${localSource || "'none'"}`,
    "form-action 'none'",
  ].join("; ");
  const base = baseHref ? `<base href="${escapeAttribute(baseHref)}">` : "";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}">${base}<style>html,body{min-height:100%;margin:0}body{color:#000;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}[data-hylo-id]:hover{cursor:pointer;outline:1px dashed rgba(34,199,184,.58);outline-offset:1px}.hylo-preview-text:hover{outline:1px dashed rgba(99,102,241,.5);outline-offset:2px;cursor:text}.hylo-preview-text--editing{outline:2px solid rgba(99,102,241,.8)!important;outline-offset:2px;background:rgba(99,102,241,.06);border-radius:2px}.hylo-preview-highlight{background:rgba(117,111,242,.12)!important;outline:2px solid rgba(117,111,242,.66)!important;outline-offset:1px;border-radius:4px;box-shadow:0 0 0 4px rgba(34,199,184,.08)}</style></head><body><script>${FRAME_RUNTIME}</script></body></html>`;
}
