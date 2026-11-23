import assert from "node:assert/strict";
import test from "node:test";

import {
  escapeTextForHtml,
  findStartTagRange,
  replaceSourceRange,
  serializeStartTag,
} from "./source-edit.ts";

test("text written back to source is escaped without touching quotes", () => {
  assert.equal(escapeTextForHtml("a & b < c > d"), "a &amp; b &lt; c &gt; d");
  assert.equal(escapeTextForHtml('say "hi" & \'bye\''), 'say "hi" &amp; \'bye\'');
  assert.equal(escapeTextForHtml("普通中文文本"), "普通中文文本");
});

test("escaping is idempotent only for already-escaped-free text", () => {
  assert.equal(escapeTextForHtml("&amp;"), "&amp;amp;");
});

test("start tag range ignores '>' inside quoted attribute values", () => {
  const content = '<div class="a > b" data-x=\'1>2\'>text</div>';
  const range = findStartTagRange(content, 0);
  assert.ok(range);
  assert.equal(content.slice(range.start, range.end), '<div class="a > b" data-x=\'1>2\'>');
  assert.equal(range.selfClosing, false);
  assert.equal(findStartTagRange(content, 5), null);
});

test("self-closing start tags are detected", () => {
  const content = '<img src="a.png" />';
  const range = findStartTagRange(content, 0);
  assert.ok(range);
  assert.equal(range.selfClosing, true);
  assert.equal(serializeStartTag("img", { src: "a.png" }, range.selfClosing), '<img src="a.png" />');
});

test("start tag serialization keeps attribute order and escapes quotes", () => {
  const tag = serializeStartTag(
    "a",
    { href: 'https://x.test/?a=1&b="2"', target: "_blank", download: "" },
    false,
  );
  assert.equal(
    tag,
    '<a href="https://x.test/?a=1&amp;b=&quot;2&quot;" target="_blank" download>',
  );
});

test("source range replacement validates bounds", () => {
  const content = "<p>hello</p>";
  assert.equal(replaceSourceRange(content, 3, 8, "world"), "<p>world</p>");
  assert.equal(replaceSourceRange(content, -1, 3, "x"), null);
  assert.equal(replaceSourceRange(content, 5, 3, "x"), null);
  assert.equal(replaceSourceRange(content, 0, content.length + 1, "x"), null);
  assert.equal(replaceSourceRange(content, 0.5, 2, "x"), null);
});
