import assert from "node:assert/strict";
import test from "node:test";
import { translations } from "./index.ts";

test("zh and en translation tables expose exactly the same keys", () => {
  const zhKeys = Object.keys(translations.zh).sort();
  const enKeys = Object.keys(translations.en).sort();
  assert.deepEqual(enKeys, zhKeys);
});

test("no translation value is empty or a placeholder", () => {
  for (const locale of ["zh", "en"] as const) {
    for (const [key, value] of Object.entries(translations[locale])) {
      assert.equal(typeof value, "string", `${locale}.${key} must be a string`);
      assert.ok(value.trim().length > 0, `${locale}.${key} must not be empty`);
      assert.doesNotMatch(value, /PLACEHOLDER|TODO|FIXME/i, `${locale}.${key} looks unfinished`);
    }
  }
});
