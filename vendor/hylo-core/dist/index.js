import { parse } from "parse5";

export function createNodeId(kind, nodeName, structuralPath) {
  const safeName = String(nodeName)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "node";
  const path = structuralPath.length > 0 ? structuralPath.join("_") : "root";
  return `hylo_${kind}_${safeName}_${path}`;
}

function extractLocation(location) {
  if (!location) return null;
  return {
    startLine: location.startLine ?? 1,
    startCol: location.startCol ?? 1,
    endLine: location.endLine ?? 1,
    endCol: location.endCol ?? 1,
    startOffset: location.startOffset ?? 0,
    endOffset: location.endOffset ?? 0,
  };
}

function getNodeKind(nodeName) {
  if (nodeName === "#document") return "document";
  if (nodeName === "#document-type" || nodeName === "#documentType") return "doctype";
  if (nodeName === "#text") return "text";
  if (nodeName === "#comment") return "comment";
  return "element";
}

function traverseNode(node, nodeMap, counter, structuralPath) {
  const nodeName = node.nodeName ?? "";
  const kind = getNodeKind(nodeName);
  const nodeId = createNodeId(kind, nodeName, structuralPath);
  const sourceLocation = extractLocation(node.sourceCodeLocation);
  counter.count += 1;
  if (sourceLocation) nodeMap.set(nodeId, sourceLocation);

  if (kind === "document") {
    return {
      nodeId,
      type: "document",
      children: (node.childNodes ?? []).map((child, index) =>
        traverseNode(child, nodeMap, counter, [...structuralPath, index])),
      sourceLocation,
    };
  }
  if (kind === "doctype") return { nodeId, type: "doctype", sourceLocation };
  if (kind === "text") {
    return { nodeId, type: "text", textContent: node.value ?? "", sourceLocation };
  }
  if (kind === "comment") {
    return { nodeId, type: "comment", textContent: node.data ?? "", sourceLocation };
  }

  const attrs = {};
  for (const attr of node.attrs ?? []) attrs[attr.name] = attr.value;
  return {
    nodeId,
    type: "element",
    tagName: (node.tagName ?? nodeName).toLowerCase(),
    attrs,
    children: (node.childNodes ?? []).map((child, index) =>
      traverseNode(child, nodeMap, counter, [...structuralPath, index])),
    sourceLocation,
  };
}

export function parseHTML(html) {
  const started = performance.now();
  const ast = parse(html, { sourceCodeLocationInfo: true });
  const nodeMap = new Map();
  const counter = { count: 0 };
  const root = traverseNode(ast, nodeMap, counter, []);
  return {
    root,
    nodeMap,
    parseTime: performance.now() - started,
    nodeCount: counter.count,
  };
}

export class NodeMapManager {
  #locationMap = new Map();
  #sortedIndex = [];

  update(map) {
    this.#locationMap = new Map(map);
    this.#sortedIndex = [...map].map(([nodeId, location]) => ({ nodeId, ...location }))
      .sort((a, b) => a.startOffset - b.startOffset);
  }

  getLocation(nodeId) {
    return this.#locationMap.get(nodeId) ?? null;
  }

  findNodeAtOffset(offset) {
    let best = null;
    let bestSpan = Number.POSITIVE_INFINITY;
    for (const entry of this.#sortedIndex) {
      if (entry.startOffset > offset) break;
      if (entry.endOffset < offset) continue;
      const span = entry.endOffset - entry.startOffset;
      if (span < bestSpan) {
        best = entry;
        bestSpan = span;
      }
    }
    return best?.nodeId ?? null;
  }

  findNodeAtPosition(line, col) {
    let best = null;
    let bestSpan = Number.POSITIVE_INFINITY;
    for (const entry of this.#sortedIndex) {
      const afterStart = entry.startLine < line
        || (entry.startLine === line && entry.startCol <= col);
      const beforeEnd = entry.endLine > line
        || (entry.endLine === line && entry.endCol >= col);
      if (!afterStart || !beforeEnd) continue;
      const span = entry.endOffset - entry.startOffset;
      if (span < bestSpan) {
        best = entry;
        bestSpan = span;
      }
    }
    return best?.nodeId ?? null;
  }

  getAllNodeIds() {
    return [...this.#locationMap.keys()];
  }

  clear() {
    this.#locationMap.clear();
    this.#sortedIndex = [];
  }
}

function getDetail(node) {
  const id = node.attrs?.id?.trim();
  if (id) return `#${id}`;
  const firstClass = node.attrs?.class?.trim().split(/\s+/)[0];
  return firstClass ? `.${firstClass}` : "";
}

export function buildDocumentOutline(root) {
  function visit(node) {
    const children = (node.children ?? []).flatMap(visit);
    if (node.type !== "element" || !node.tagName || !node.sourceLocation) return children;
    return [{
      nodeId: node.nodeId,
      tagName: node.tagName,
      detail: getDetail(node),
      children,
    }];
  }
  return visit(root);
}

export function countOutlineItems(items) {
  return items.reduce((count, item) => count + 1 + countOutlineItems(item.children), 0);
}

export function findNodeTrail(root, nodeId) {
  function visit(node, trail) {
    const nextTrail = node.type === "element" && node.tagName
      ? [...trail, { nodeId: node.nodeId, tagName: node.tagName, detail: getDetail(node) }]
      : trail;
    if (node.nodeId === nodeId) return nextTrail;
    for (const child of node.children ?? []) {
      const found = visit(child, nextTrail);
      if (found) return found;
    }
    return null;
  }
  return visit(root, []) ?? [];
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function normalizeExportDocument(html, options = {}) {
  const trimmed = String(html).trim();
  const base = options.baseHref ? `<base href="${escapeAttribute(options.baseHref)}">` : "";
  if (/<html(?:\s|>)/i.test(trimmed)) {
    if (!base) return trimmed;
    if (/<head(?:\s|>)[^>]*>/i.test(trimmed)) {
      return trimmed.replace(/<head(?:\s|>)[^>]*>/i, (head) => `${head}${base}`);
    }
    return trimmed.replace(/<html(?:\s|>)[^>]*>/i, (root) => `${root}<head>${base}</head>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${base}</head><body>${trimmed}</body></html>`;
}

export function shouldParseInWorker(contentLength, threshold = 512 * 1024) {
  return contentLength > threshold;
}
