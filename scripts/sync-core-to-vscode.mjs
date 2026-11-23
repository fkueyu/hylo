#!/usr/bin/env node
/**
 * 把桌面端共享核心（vendor/hylo-core/dist）同步到 VS Code 扩展的 vendor 副本。
 *
 * 共享核心是两侧共用的一份 AST/节点映射实现，桌面端修 bug 或改节点 ID 方案后
 * 需要显式同步，避免两个产品行为漂移。扩展目录不存在时静默跳过（CI/单仓库场景）。
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceDir = path.join(root, "vendor", "hylo-core", "dist");
const targetDir = path.join(root, "hylo-vscode", "vendor", "hylo-core", "dist");

if (!existsSync(path.join(root, "hylo-vscode"))) {
  console.log("hylo-vscode/ not found, skip core sync");
  process.exit(0);
}
if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

const files = ["index.js", "index.d.ts", "browser.js"];
for (const file of files) {
  const source = path.join(sourceDir, file);
  if (!existsSync(source)) {
    console.error(`missing core artifact: ${source}`);
    process.exit(1);
  }
  copyFileSync(source, path.join(targetDir, file));
  console.log(`synced ${file}`);
}
