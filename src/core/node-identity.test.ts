import assert from "node:assert/strict";
import test from "node:test";

import { createNodeId } from "./node-identity.ts";

test("node identity is deterministic for the same structural path", () => {
  assert.equal(createNodeId("element", "section", [0, 1, 2]), createNodeId("element", "section", [0, 1, 2]));
});

test("node identity changes for a different sibling path", () => {
  assert.notEqual(createNodeId("element", "li", [0, 1]), createNodeId("element", "li", [0, 2]));
});

test("node identity remains safe to transport through DOM attributes", () => {
  assert.match(createNodeId("text", "#text", [0, 3, 2]), /^[a-z0-9_-]+$/);
});
