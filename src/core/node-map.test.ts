import assert from "node:assert/strict";
import test from "node:test";

import { NodeMapManager } from "./node-map.ts";
import type { SourceLocation } from "../types/index.ts";

const location = (startOffset: number, endOffset: number, startCol: number, endCol: number): SourceLocation => ({
  startLine: 1,
  endLine: 1,
  startCol,
  endCol,
  startOffset,
  endOffset,
});

test("offset lookup returns the smallest containing node", () => {
  const map = new NodeMapManager();
  map.update(new Map([
    ["outer", location(0, 30, 1, 31)],
    ["inner", location(5, 10, 6, 11)],
  ]));
  assert.equal(map.findNodeAtOffset(7), "inner");
});

test("position lookup returns the smallest containing node", () => {
  const map = new NodeMapManager();
  map.update(new Map([
    ["outer", location(0, 30, 1, 31)],
    ["inner", location(5, 10, 6, 11)],
  ]));
  assert.equal(map.findNodeAtPosition(1, 8), "inner");
});

test("updating the map removes stale nodes", () => {
  const map = new NodeMapManager();
  map.update(new Map([["old", location(0, 3, 1, 4)]]));
  map.update(new Map([["new", location(4, 7, 5, 8)]]));
  assert.equal(map.getLocation("old"), null);
  assert.equal(map.getLocation("new")?.startOffset, 4);
});

test("repeated cursor lookups inside the same node reuse the cached result", () => {
  const map = new NodeMapManager();
  map.update(new Map([
    ["outer", location(0, 30, 1, 31)],
    ["inner", location(5, 10, 6, 11)],
  ]));
  assert.equal(map.findNodeAtPosition(1, 7), "inner");
  assert.equal(map.findNodeAtPosition(1, 8), "inner");
  assert.equal(map.findNodeAtPosition(1, 9), "inner");
});

test("node map cache is invalidated after update and clear", () => {
  const map = new NodeMapManager();
  map.update(new Map([["first", location(0, 10, 1, 11)]]));
  assert.equal(map.findNodeAtPosition(1, 5), "first");

  map.update(new Map([["second", location(0, 10, 1, 11)]]));
  assert.equal(map.findNodeAtPosition(1, 5), "second");

  map.clear();
  assert.equal(map.findNodeAtPosition(1, 5), null);
});
