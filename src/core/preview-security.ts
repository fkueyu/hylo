export type PreviewMode = "safe" | "interactive";

export type PreviewFrameMessage =
  | { channel: "hylo-preview"; type: "preview-ready" }
  | { channel: "hylo-preview"; type: "node-selected"; nodeId: string }
  | {
      channel: "hylo-preview";
      type: "node-context-menu";
      nodeId: string | null;
      x: number;
      y: number;
    };

const DANGEROUS_URL = /^\s*(?:javascript|vbscript|data\s*:\s*text\/html)/i;

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

export function isPreviewFrameMessage(value: unknown): value is PreviewFrameMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  if (message.channel !== "hylo-preview") return false;
  if (message.type === "preview-ready") return true;
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
  const BAD_URL = /^\s*(?:javascript|vbscript|data\s*:\s*text\/html)/i;
  let mode = "safe";
  let scripts = [];
  let activeScripts = [];
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

  function createNode(node) {
    if (!node || typeof node !== "object") return null;
    if (node.type === "text") return document.createTextNode(node.textContent || "");
    if (node.type === "comment" || node.type === "doctype") return null;
    if (node.type === "document") {
      const fragment = document.createDocumentFragment();
      for (const child of node.children || []) {
        const childNode = createNode(child);
        if (childNode) fragment.appendChild(childNode);
      }
      return fragment;
    }
    if (node.type !== "element" || !node.tagName) return null;
    const tag = String(node.tagName).toLowerCase();
    if (tag === "script") {
      if (mode === "interactive") scripts.push(node);
      return document.createComment("script blocked by Hylo preview boundary");
    }
    if (mode === "safe" && ACTIVE.has(tag)) return document.createComment(tag + " blocked by Hylo safe preview");
    if (TRANSPARENT.has(tag) || tag === "body") {
      const fragment = document.createDocumentFragment();
      for (const child of node.children || []) {
        const childNode = createNode(child);
        if (childNode) fragment.appendChild(childNode);
      }
      return fragment;
    }
    const element = document.createElement(tag);
    if (node.nodeId) element.setAttribute("data-hylo-id", node.nodeId);
    for (const [name, value] of Object.entries(attrs(node.attrs))) {
      try { element.setAttribute(name, value); } catch {}
    }
    if (!VOID.has(tag)) {
      for (const child of node.children || []) {
        const childNode = createNode(child);
        if (childNode) element.appendChild(childNode);
      }
    }
    return element;
  }

  function nextScript() {
    const node = scripts.shift();
    if (!node) return;
    const script = document.createElement("script");
    const properties = attrs(node.attrs);
    for (const [name, value] of Object.entries(properties)) script.setAttribute(name, value);
    if (properties.src) {
      script.onload = nextScript;
      script.onerror = nextScript;
    } else {
      const content = node.children?.length === 1 && node.children[0].type === "text"
        ? node.children[0].textContent || "" : "";
      script.textContent = "try {\\n{\\n" + content + "\\n}\\n} catch (error) { console.error('Hylo preview script error', error); }";
    }
    document.head.appendChild(script);
    activeScripts.push(script);
    if (!properties.src) nextScript();
  }

  function highlight(nodeId, scroll) {
    document.querySelectorAll(".hylo-preview-highlight").forEach((element) => element.classList.remove("hylo-preview-highlight"));
    if (typeof nodeId !== "string") return;
    const target = document.querySelector('[data-hylo-id="' + CSS.escape(nodeId) + '"]');
    target?.classList.add("hylo-preview-highlight");
    if (target && scroll) target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function render(message) {
    mode = message.mode === "interactive" ? "interactive" : "safe";
    applyRootAttributes(message.ast);
    activeScripts.forEach((script) => script.remove());
    activeScripts = [];
    scripts = [];
    const content = createNode(message.ast);
    root.replaceChildren();
    if (content) root.appendChild(content);
    highlight(message.highlightedNodeId, false);
    nextScript();
  }

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    if (target.closest("a[href]")) event.preventDefault();
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
    if (event.data.type === "print") print();
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

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}">${base}<style>html,body{min-height:100%;margin:0}body{color:#000;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}[data-hylo-id]:hover{cursor:pointer;outline:1px dashed rgba(34,199,184,.58);outline-offset:1px}.hylo-preview-highlight{background:rgba(117,111,242,.12)!important;outline:2px solid rgba(117,111,242,.66)!important;outline-offset:1px;border-radius:4px;box-shadow:0 0 0 4px rgba(34,199,184,.08)}</style></head><body><script>${FRAME_RUNTIME}</script></body></html>`;
}
