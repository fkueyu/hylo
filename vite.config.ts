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
import react from "@vitejs/plugin-react";
import monacoEditorPlugin from "vite-plugin-monaco-editor";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    (monacoEditorPlugin as unknown as typeof monacoEditorPlugin.default).default({
      languageWorkers: ["html", "css", "json", "typescript"],
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
