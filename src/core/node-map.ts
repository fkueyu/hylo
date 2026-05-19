// ============================================================
// Hylo Node Map Manager
// 维护 nodeId ↔ SourceLocation 映射，支持快速位置查找
// ============================================================

import type { SourceLocation } from "@/types";

interface IndexEntry {
  nodeId: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export class NodeMapManager {
  private locationMap = new Map<string, SourceLocation>();
  /** 按 startOffset 升序排列的辅助索引，用于二分查找 */
  private sortedIndex: IndexEntry[] = [];

  /**
   * 用新解析结果更新整个映射表
   */
  update(map: Map<string, SourceLocation>): void {
    this.locationMap = new Map(map);
    this.buildIndex();
  }

  /**
   * 获取节点的源码位置
   */
  getLocation(nodeId: string): SourceLocation | null {
    return this.locationMap.get(nodeId) ?? null;
  }

  /**
   * 根据字符偏移量查找最内层节点（最小包围节点）
   */
  findNodeAtOffset(offset: number): string | null {
    const candidates: IndexEntry[] = [];

    // 从已排序索引中找所有包含该 offset 的节点
    for (const entry of this.sortedIndex) {
      if (entry.startOffset > offset) break; // 利用有序性提前退出
      if (entry.endOffset >= offset) {
        candidates.push(entry);
      }
    }

    if (candidates.length === 0) return null;

    // 选最内层（范围最小）的节点
    candidates.sort(
      (a, b) =>
        a.endOffset - a.startOffset - (b.endOffset - b.startOffset)
    );
    return candidates[0].nodeId;
  }

  /**
   * 根据行列号查找最内层节点
   * line/col 均为 1-based（Monaco 格式）
   */
  findNodeAtPosition(line: number, col: number): string | null {
    const candidates: IndexEntry[] = [];

    for (const entry of this.sortedIndex) {
      const afterStart =
        entry.startLine < line ||
        (entry.startLine === line && entry.startCol <= col);
      const beforeEnd =
        entry.endLine > line ||
        (entry.endLine === line && entry.endCol >= col);

      if (afterStart && beforeEnd) {
        candidates.push(entry);
      }
    }

    if (candidates.length === 0) return null;

    // 选最内层
    candidates.sort(
      (a, b) =>
        a.endOffset - a.startOffset - (b.endOffset - b.startOffset)
    );
    return candidates[0].nodeId;
  }

  /**
   * 获取所有已注册的 nodeId
   */
  getAllNodeIds(): string[] {
    return [...this.locationMap.keys()];
  }

  /**
   * 清空映射
   */
  clear(): void {
    this.locationMap.clear();
    this.sortedIndex = [];
  }

  // ── 私有方法 ─────────────────────────────────────────────

  private buildIndex(): void {
    const entries: IndexEntry[] = [];
    for (const [nodeId, loc] of this.locationMap) {
      entries.push({
        nodeId,
        startOffset: loc.startOffset,
        endOffset: loc.endOffset,
        startLine: loc.startLine,
        startCol: loc.startCol,
        endLine: loc.endLine,
        endCol: loc.endCol,
      });
    }
    // 按 startOffset 升序排列
    entries.sort((a, b) => a.startOffset - b.startOffset);
    this.sortedIndex = entries;
  }
}

/** 全局单例 NodeMap */
export const nodeMapManager = new NodeMapManager();
