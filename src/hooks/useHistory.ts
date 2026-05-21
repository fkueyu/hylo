// ============================================================
// useHistory.ts — 历史记录管理 Hook（localStorage 持久化）
// ============================================================

import { useState, useCallback, useEffect } from "react";

export interface HistoryItem {
  path: string;
  name: string;
  timestamp: number;
}

const STORAGE_KEY = "hylo-open-history";
const MAX_HISTORY = 30;

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // 从 localStorage 加载
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  // 添加到历史记录
  const addHistory = useCallback((path: string, name: string) => {
    setHistory((prev) => {
      // 过滤掉同名同路径的，防止重复
      const filtered = prev.filter((item) => item.path !== path);
      const newItem: HistoryItem = {
        path,
        name,
        timestamp: Date.now(),
      };
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // 清空历史记录
  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  // 删除单条记录（用于文件不存在时清理）
  const removeHistory = useCallback((path: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.path !== path);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return {
    history,
    addHistory,
    clearHistory,
    removeHistory,
  };
}
