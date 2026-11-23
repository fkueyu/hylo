#!/usr/bin/env node
/**
 * 版本号单一来源：package.json 的 version 是唯一事实来源。
 * 运行 `npm run version:sync` 把版本同步到 Cargo.toml / tauri.conf.json /
 * Info.plist / AboutModal.tsx，避免手工改漏导致安装包版本不一致。
 *
 * 发布流程：修改 package.json version → npm run version:sync → 提交 tag。
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const write = (relative, content) => writeFileSync(path.join(root, relative), content);

const packageJson = JSON.parse(read("package.json"));
const version = packageJson.version;
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`Invalid version in package.json: ${version}`);
  process.exit(1);
}

const updates = [];

// 1. Cargo.toml 的 [package] version
{
  const file = "src-tauri/Cargo.toml";
  const next = read(file).replace(
    /(\[package\][\s\S]*?\nversion = ")[^"]+(")/,
    `$1${version}$2`,
  );
  write(file, next);
  updates.push(file);
}

// 2. tauri.conf.json
{
  const file = "src-tauri/tauri.conf.json";
  const config = JSON.parse(read(file));
  config.version = version;
  write(file, `${JSON.stringify(config, null, 2)}\n`);
  updates.push(file);
}

// 3. mas 构建使用的 Info.plist
{
  const file = "src-tauri/Info.plist";
  const next = read(file)
    .replace(/(<key>CFBundleVersion<\/key>\s*<string>)[^<]+(<\/string>)/, `$1${version}$2`)
    .replace(
      /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]+(<\/string>)/,
      `$1${version}$2`,
    );
  write(file, next);
  updates.push(file);
}

// 4. 关于页展示版本
{
  const file = "src/components/AboutModal.tsx";
  const next = read(file).replace(
    /(const \[version, setVersion\] = useState\(")[^"]+("\))/,
    `$1${version}$2`,
  );
  write(file, next);
  updates.push(file);
}

console.log(`Synced version ${version} ->`);
for (const file of updates) console.log(`  - ${file}`);
