import assert from "node:assert/strict";
import test from "node:test";

import {
  NodeMapManager,
  normalizeExportDocument,
  parseHTML,
  shouldParseInWorker,
  type HyloNode,
} from "@ainx/hylo-core";

function findElement(root: HyloNode, tagName: string): HyloNode | null {
  if (root.type === "element" && root.tagName === tagName) return root;
  for (const child of root.children ?? []) {
    const found = findElement(child, tagName);
    if (found) return found;
  }
  return null;
}

test("shared core parser produces stable node identities", () => {
  const first = parseHTML("<main><p>one</p></main>");
  const second = parseHTML("<main><p>two</p></main>");
  const firstMain = findElement(first.root, "main");
  const secondMain = findElement(second.root, "main");
  assert.ok(firstMain);
  assert.ok(secondMain);
  assert.equal(firstMain?.nodeId, secondMain?.nodeId);
});

test("shared core normalizes fragments without nesting complete documents", () => {
  const complete = "<!doctype html><html><body><p>Complete</p></body></html>";
  assert.equal(normalizeExportDocument(complete), complete);
  assert.match(normalizeExportDocument("<p>Fragment</p>"), /^<!DOCTYPE html>/);
});

test("shared core exposes the location index contract", () => {
  const parsed = parseHTML("<main><p>Text</p></main>");
  const map = new NodeMapManager();
  map.update(parsed.nodeMap);
  assert.ok(map.findNodeAtOffset(8));
});

test("shared core schedules only large documents in a worker", () => {
  assert.equal(shouldParseInWorker(512 * 1024), false);
  assert.equal(shouldParseInWorker(512 * 1024 + 1), true);
});
