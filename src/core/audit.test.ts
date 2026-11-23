import assert from "node:assert/strict";
import test from "node:test";

import { parseHTML } from "@ainx/hylo-core";
import { auditDocument } from "./audit.ts";

function rulesFor(html: string) {
  const report = auditDocument(parseHTML(html).root);
  return {
    rules: report.findings.map((finding) => finding.rule),
    counts: report.counts,
    report,
  };
}

test("clean document reports no findings", () => {
  const { rules } = rulesFor(
    '<html><head><title>ok</title></head><body><h1>Title</h1><p>text</p><img src="a.png" alt="a"></body></html>',
  );
  assert.deepEqual(rules, []);
});

test("missing alt, remote resources, empty links and duplicates are reported", () => {
  const { rules, counts } = rulesFor(
    [
      '<html><body>',
      '<img src="https://cdn.example.com/a.png">',
      '<a href="#">empty</a>',
      '<a href="javascript:void(0)">js</a>',
      '<div id="dup"></div><div id="dup"></div>',
      "</body></html>",
    ].join(""),
  );
  assert.ok(rules.includes("missing-alt"));
  assert.ok(rules.includes("remote-resource"));
  assert.ok(rules.includes("empty-link"));
  assert.ok(rules.includes("duplicate-id"));
  assert.equal(counts["empty-link"], 2);
});

test("heading jumps and inline styles are reported", () => {
  const { rules, counts } = rulesFor(
    '<html><body><h1>a</h1><h3>b</h3><p style="color:red">x</p></body></html>',
  );
  assert.ok(rules.includes("heading-jump"));
  assert.ok(rules.includes("inline-style"));
  assert.equal(counts["heading-jump"], 1);
});

test("scripts are reported as blocked in safe preview", () => {
  const { rules, counts } = rulesFor(
    '<html><body><script src="https://x.test/a.js"></script><script>alert(1)</script></body></html>',
  );
  assert.equal(counts["blocked-script"], 2);
  assert.ok(rules.includes("blocked-script"));
});

test("findings carry node ids that exist in the node map", () => {
  const parsed = parseHTML('<html><body><img src="x.png"></body></html>');
  const report = auditDocument(parsed.root);
  const finding = report.findings[0];
  assert.ok(finding.nodeId);
  assert.ok(parsed.nodeMap.has(finding.nodeId!));
});
