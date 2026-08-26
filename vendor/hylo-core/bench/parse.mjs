import { parseHTML } from "../dist/index.js";

const cases = [
  { label: "100 KB", sections: 2_000 },
  { label: "1 MB", sections: 20_000 },
  { label: "4 MB", sections: 80_000 },
];

for (const benchmark of cases) {
  const html = `<main>${"<section><h2>Title</h2><p>Text content</p></section>".repeat(benchmark.sections)}</main>`;
  const started = performance.now();
  const result = parseHTML(html);
  const elapsed = performance.now() - started;
  console.log(`${benchmark.label.padEnd(6)} ${String(result.nodeCount).padStart(7)} nodes ${elapsed.toFixed(1).padStart(7)} ms`);
}
