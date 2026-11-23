// ============================================================
// monaco-loader — 将 Monaco 固定为随应用打包的本地版本
// ============================================================
//
// @monaco-editor/react 默认在运行时从 jsdelivr CDN 拉取 monaco-editor。
// 在离线或受限网络（jsdelivr 在国内经常不可达）下，源码面板会永久停在
// Loading…，而 README 也承诺“纯本地运行”。这里显式使用 Vite 打包的本地
// ESM 版本，运行时不再发起任何 CDN 请求。

import { loader } from "@monaco-editor/react";

let monacoPromise: Promise<void> | null = null;

/** 预加载本地 Monaco 并注册给 @monaco-editor/react（幂等，只执行一次）。 */
export function ensureLocalMonaco(): Promise<void> {
  if (!monacoPromise) {
    monacoPromise = import("monaco-editor")
      .then((monaco) => {
        loader.config({ monaco });
      })
      .catch((error) => {
        // 本地 chunk 加载失败时允许下次重试，回退到 @monaco-editor/react 的默认策略
        monacoPromise = null;
        throw error;
      });
  }
  return monacoPromise;
}
