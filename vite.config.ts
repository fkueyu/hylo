import fs from "node:fs";

// 解决老旧依赖在 Node 22+ 下对 fs.rmdirSync { recursive: true } 报错的兼容性问题
if (fs && fs.rmdirSync) {
  const originalRmdirSync = fs.rmdirSync;
  fs.rmdirSync = function (path: any, options: any) {
    if (options && options.recursive) {
      if (fs.rmSync) {
        return fs.rmSync(path, options);
      }
    }
    return originalRmdirSync.call(fs, path, options);
  } as any;
}

import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import monacoEditorPlugin from "vite-plugin-monaco-editor";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/**
 * 裁掉 Monaco 未使用的 TypeScript / JSON 语言贡献。
 * 只编辑 HTML 时无需 ts.worker(6.7MB) 与 json.worker(374KB)，
 * 否则 monaco-editor 的根入口会把它们带进安装包。
 */
function trimUnusedMonacoLanguages(): Plugin {
  const stub = path.resolve(__dirname, "src/shims/monaco-unused-language.ts");
  const pattern = /\/language\/(typescript|json)\/monaco\.contribution(?:\.js)?$/;
  return {
    name: "trim-unused-monaco-languages",
    enforce: "pre",
    resolveId(source) {
      if (pattern.test(source)) return stub;
      return null;
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    trimUnusedMonacoLanguages(),
    react(),
    nodePolyfills(),
    (monacoEditorPlugin as unknown as typeof monacoEditorPlugin.default).default({
      // 编辑器只处理 HTML（含内嵌 <style>），保留 html/css 即可；
      // 之前连 ts/java? 工作线程一起打包会多出 ~15MB（ts.worker 13MB）。
      languageWorkers: ["editorWorkerService", "html", "css"],
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
