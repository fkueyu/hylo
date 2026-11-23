import assert from "node:assert/strict";
import test from "node:test";

import { parseHTML } from "./ast-parser.ts";
import type { HyloNode } from "../types/index.ts";

function elementId(root: HyloNode, tagName: string): string {
  if (root.type === "element" && root.tagName === tagName) return root.nodeId;
  for (const child of root.children ?? []) {
    const found = elementId(child, tagName);
    if (found) return found;
  }
  return "";
}

test("parsing unchanged HTML preserves element identities", () => {
  const first = parseHTML("<main><section>Hello</section></main>");
  const second = parseHTML("<main><section>Hello</section></main>");

  assert.equal(elementId(first.root, "section"), elementId(second.root, "section"));
});

test("editing text preserves surrounding element identities", () => {
  const first = parseHTML("<main><section>Hello</section></main>");
  const second = parseHTML("<main><section>Hello world</section></main>");

  assert.equal(elementId(first.root, "main"), elementId(second.root, "main"));
  assert.equal(elementId(first.root, "section"), elementId(second.root, "section"));
});

test("inserting a different tag keeps existing element identities", () => {
  const first = parseHTML("<main><section><p>Hello</p></section></main>");
  const second = parseHTML("<main><div>new block</div><section><p>Hello</p></section></main>");

  assert.equal(elementId(first.root, "main"), elementId(second.root, "main"));
  assert.equal(elementId(first.root, "section"), elementId(second.root, "section"));
  assert.equal(elementId(first.root, "p"), elementId(second.root, "p"));
});

test("explicit id anchors identity against same-tag sibling insertion", () => {
  const first = parseHTML('<main><section id="intro"><p>a</p></section></main>');
  const second = parseHTML(
    '<main><section><p>z</p></section><section id="intro"><p>a</p></section></main>',
  );

  const firstSectionIds = collectTagIds(first.root, "section");
  const secondSectionIds = collectTagIds(second.root, "section");
  assert.equal(firstSectionIds.length, 1);
  assert.equal(secondSectionIds.length, 2);
  // 带 id 的 section 在插入同标签兄弟后仍保持同一个 nodeId
  assert.ok(secondSectionIds.includes(firstSectionIds[0]));
});

test("text edits preserve text node identities", () => {
  const first = parseHTML("<p>Hello</p>");
  const second = parseHTML("<p>Hello world</p>");
  const textIds = (root: HyloNode) => {
    const ids: string[] = [];
    const visit = (node: HyloNode) => {
      if (node.type === "text") ids.push(node.nodeId);
      for (const child of node.children ?? []) visit(child);
    };
    visit(root);
    return ids;
  };
  const a = textIds(first.root);
  const b = textIds(second.root);
  assert.ok(a.length > 0 && a[0].includes("text_"));
  assert.deepEqual(b, a);
});

test("duplicate ids are disambiguated so node ids stay unique", () => {
  const parsed = parseHTML('<div id="dup"></div><div id="dup"></div>');
  const ids = [...parsed.nodeMap.keys()];
  const duplicateIds = ids.filter((id) => id.includes("div_id_dup"));
  assert.equal(duplicateIds.length, 2);
  assert.equal(new Set(ids).size, ids.length);
});

function collectTagIds(node: HyloNode, tagName: string): string[] {
  const ids: string[] = [];
  if (node.type === "element" && node.tagName === tagName) ids.push(node.nodeId);
  for (const child of node.children ?? []) ids.push(...collectTagIds(child, tagName));
  return ids;
}
