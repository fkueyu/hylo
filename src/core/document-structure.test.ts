import test from "node:test";
import assert from "node:assert/strict";
import type { HyloNode, SourceLocation } from "../types/index.ts";
import {
  buildDocumentOutline,
  countOutlineItems,
  findNodeTrail,
  isUsableHtmlClipboard,
  normalizeHtmlClipboard,
} from "./document-structure.ts";

const location: SourceLocation = {
  startLine: 1,
  startCol: 1,
  endLine: 1,
  endCol: 2,
  startOffset: 0,
  endOffset: 1,
};

function element(
  nodeId: string,
  tagName: string,
  attrs: Record<string, string> = {},
  children: HyloNode[] = [],
  sourceLocation: SourceLocation | null = location,
): HyloNode {
  return { nodeId, type: "element", tagName, attrs, children, sourceLocation };
}

const tree: HyloNode = {
  nodeId: "document",
  type: "document",
  sourceLocation: null,
  children: [
    element("html", "html", {}, [
      element("body", "body", {}, [
        element("main", "main", { id: "app" }, [
          { nodeId: "text", type: "text", textContent: "hello", sourceLocation: location },
          element("section", "section", { class: "hero featured" }),
          element("implicit", "div", {}, [element("button", "button")], null),
        ]),
      ], null),
    ], null),
  ],
};

test("buildDocumentOutline filters non-editable wrappers while preserving editable descendants", () => {
  assert.deepEqual(buildDocumentOutline(tree), [
    {
      nodeId: "main",
      tagName: "main",
      detail: "#app",
      children: [
        { nodeId: "section", tagName: "section", detail: ".hero", children: [] },
        { nodeId: "button", tagName: "button", detail: "", children: [] },
      ],
    },
  ]);
});

test("countOutlineItems counts the full editable structure instead of top-level roots", () => {
  assert.equal(countOutlineItems(buildDocumentOutline(tree)), 3);
});

test("findNodeTrail returns the semantic element path to a selected node", () => {
  assert.deepEqual(
    findNodeTrail(tree, "section").map((item) => item.tagName),
    ["html", "body", "main", "section"],
  );
  assert.deepEqual(findNodeTrail(tree, "missing"), []);
});

test("isUsableHtmlClipboard accepts HTML elements and rejects empty or plain text", () => {
  assert.equal(isUsableHtmlClipboard("<main><h1>Hello</h1></main>"), true);
  assert.equal(isUsableHtmlClipboard("<!doctype html>\n<html><body></body></html>"), true);
  assert.equal(isUsableHtmlClipboard(""), false);
  assert.equal(isUsableHtmlClipboard("just a paragraph"), false);
  assert.equal(isUsableHtmlClipboard("2 < 3 and 5 > 4"), false);
});

test("normalizeHtmlClipboard removes an AI chat markdown fence without changing HTML", () => {
  assert.equal(
    normalizeHtmlClipboard("```html\n<!doctype html>\n<main>Hello</main>\n```"),
    "<!doctype html>\n<main>Hello</main>",
  );
  assert.equal(normalizeHtmlClipboard("  <section>Ready</section>  "), "<section>Ready</section>");
});
