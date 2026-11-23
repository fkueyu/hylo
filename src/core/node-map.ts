// ============================================================
// node-map — 在共享核心之上加一层「上一次光标位置」缓存
// ============================================================
//
// 共享核心的 findNodeAtPosition 是线性扫描；光标在同一个节点内连续移动时，
// 每次按键都重扫整张表。这里先验证上一次命中的节点是否仍包含当前光标，
// 命中则 O(1) 返回，否则回落到核心实现。update() 时缓存自动失效。

import {
  NodeMapManager as CoreNodeMapManager,
} from "@ainx/hylo-core";
import type { SourceLocation } from "@/types";


interface CachedLookup {
  nodeId: string | null;
}

function contains(source: SourceLocation, line: number, col: number): boolean {
  const afterStart =
    source.startLine < line || (source.startLine === line && source.startCol <= col);
  const beforeEnd =
    source.endLine > line || (source.endLine === line && source.endCol >= col);
  return afterStart && beforeEnd;
}

export class NodeMapManager extends CoreNodeMapManager {
  #lastLookup: CachedLookup | null = null;

  override update(map: Map<string, SourceLocation>): void {
    super.update(map);
    this.#lastLookup = null;
  }

  override findNodeAtPosition(line: number, col: number): string | null {
    const cached = this.#lastLookup;
    if (cached?.nodeId) {
      const location = this.getLocation(cached.nodeId) as SourceLocation | null;
      if (location && contains(location, line, col)) return cached.nodeId;
    }
    const nodeId = super.findNodeAtPosition(line, col);
    this.#lastLookup = { nodeId };
    return nodeId;
  }

  override clear(): void {
    super.clear();
    this.#lastLookup = null;
  }
}

export const nodeMapManager = new NodeMapManager();
