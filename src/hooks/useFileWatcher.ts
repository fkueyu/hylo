// ============================================================
// useFileWatcher — 外部文件变更监听（2s stat 轮询）
// ============================================================
//
// 当前打开的文件被其他工具（编辑器 / AI CLI 等）改写时：
// - 文档干净：自动重新加载，避免"看到的是旧内容、保存却覆盖新内容"；
// - 文档有未保存修改：询问是否重新加载（会丢弃当前修改）；
// - 文件被删除/移动：提示当前内容仍在内存中，可另存为。
//
// 采用 stat 轮询而不是 fs 插件的 watch 特性：后者需要额外 cargo feature
// 与原生依赖，而轮询一个文件的开销可以忽略，且跨平台行为一致。

import { useEffect, type MutableRefObject } from "react";
import { readTextFile, stat } from "@tauri-apps/plugin-fs";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { t, type Locale } from "@/i18n";

const isTauriRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const POLL_INTERVAL_MS = 2000;
const SELF_SAVE_GRACE_MS = 1500;

interface UseFileWatcherOptions {
  filepath: string | null;
  isDirty: boolean;
  locale: Locale;
  /** 应用自身保存后忽略短时间内的变化 */
  ignoreBeforeRef: MutableRefObject<number>;
  onReload: (content: string) => void;
}

interface FileFingerprint {
  mtime: number;
  size: number;
}

export function useFileWatcher({
  filepath,
  isDirty,
  locale,
  ignoreBeforeRef,
  onReload,
}: UseFileWatcherOptions) {
  useEffect(() => {
    if (!isTauriRuntime || !filepath) return;
    let disposed = false;
    let checking = false;
    let baseline: FileFingerprint | null = null;
    let removedReported = false;

    const readFingerprint = async (): Promise<FileFingerprint | null> => {
      try {
        const info = await stat(filepath);
        return { mtime: info.mtime ? info.mtime.getTime() : 0, size: info.size };
      } catch {
        return null;
      }
    };

    void readFingerprint().then((fingerprint) => {
      baseline = fingerprint;
    });

    const reload = async (): Promise<boolean> => {
      try {
        const content = await readTextFile(filepath);
        if (disposed) return false;
        onReload(content);
        return true;
      } catch (error) {
        console.warn("[file-watcher] failed to reload file", error);
        return false;
      }
    };

    const check = async () => {
      if (disposed || checking) return;
      checking = true;
      try {
        const next = await readFingerprint();
        // 文件被删除/移动
        if (!next) {
          if (Date.now() - ignoreBeforeRef.current < SELF_SAVE_GRACE_MS) return;
          if (removedReported) return;
          removedReported = true;
          baseline = null;
          await message(t(locale, "fileRemovedDesc"), {
            title: t(locale, "fileRemovedTitle"),
            kind: "warning",
          });
          return;
        }
        removedReported = false;
        if (!baseline) {
          baseline = next;
          return;
        }
        const changed = next.mtime !== baseline.mtime || next.size !== baseline.size;
        if (!changed) return;
        // 忽略自身保存触发的变化
        if (Date.now() - ignoreBeforeRef.current < SELF_SAVE_GRACE_MS) {
          baseline = next;
          return;
        }
        baseline = next;
        if (!isDirty) {
          await reload();
          return;
        }
        const accepted = await ask(t(locale, "externalChangeDesc"), {
          title: t(locale, "externalChangeTitle"),
          kind: "warning",
          okLabel: t(locale, "externalChangeReload"),
          cancelLabel: t(locale, "externalChangeKeep"),
        });
        if (!disposed && accepted) {
          await reload();
        }
      } finally {
        checking = false;
      }
    };

    const timer = window.setInterval(() => {
      void check();
    }, POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [filepath, isDirty, locale, ignoreBeforeRef, onReload]);
}
