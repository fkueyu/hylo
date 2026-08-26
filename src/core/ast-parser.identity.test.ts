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
