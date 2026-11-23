// ============================================================
// useHistory.ts — 打开历史管理（localStorage 持久化 + 数据校验）
// ============================================================

import { useCallback, useEffect, useState } from "react";

export interface HistoryItem {
  path: string;
  name: string;
  timestamp: number;
}

const STORAGE_KEY = "hylo-open-history";
const MAX_HISTORY = 30;

/** 读取并校验历史记录：损坏/旧格式数据不能让历史弹窗崩溃。 */
function loadHistory(): HistoryItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is HistoryItem => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Partial<HistoryItem>;
        return (
          typeof candidate.path === "string" &&
          candidate.path.length > 0 &&
          typeof candidate.name === "string" &&
          typeof candidate.timestamp === "number" &&
          Number.isFinite(candidate.timestamp)
        );
      })
      .slice(0, MAX_HISTORY);
  } catch (error) {
    console.error("Failed to load history", error);
    return [];
  }
}

export function useHistory() {
  // 惰性初始化，避免“先写空数组再读”的竞态
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);

  // 持久化放在 effect 中（不在 setState updater 里产生副作用）
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("Failed to persist history", error);
    }
  }, [history]);

  const addHistory = useCallback((path: string, name: string) => {
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.path !== path);
      const newItem: HistoryItem = { path, name, timestamp: Date.now() };
      return [newItem, ...filtered].slice(0, MAX_HISTORY);
    });
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setHistory([]);
  }, []);

  const removeHistory = useCallback((path: string) => {
    setHistory((prev) => prev.filter((item) => item.path !== path));
  }, []);

  return { history, addHistory, clearHistory, removeHistory };
}
