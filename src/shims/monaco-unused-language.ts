// 空模块：用于把 Monaco 中未使用的语言贡献（TypeScript / JSON）从 bundle 中裁掉。
// Hylo 只编辑 HTML（含内嵌 CSS/JS 的 tokenization 由 basic-languages 提供），
// 不需要 TS/JSON 的 worker（ts.worker 约 6.7MB、json.worker 约 374KB）。
export {};
