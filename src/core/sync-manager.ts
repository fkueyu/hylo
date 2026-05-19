// ============================================================
// Hylo Sync Manager
// 协调预览→源码 和 源码→预览 的双向同步定位
// ============================================================

import type { EventBus } from "@/core/event-bus";
import type { NodeMapManager } from "@/core/node-map";

export class SyncManager {
  /** 防止双向同步循环触发 */
  private isSyncing = false;
  private disposeListeners: Array<() => void> = [];

  constructor(
    private nodeMap: NodeMapManager,
    private bus: EventBus
  ) {
    this.setupListeners();
  }

  private setupListeners(): void {
    // 预览点击 → 定位源码
    const off1 = this.bus.on("preview:click", ({ nodeId }) => {
      this.handlePreviewClick(nodeId);
    });

    // Monaco 光标变化 → 高亮预览
    const off2 = this.bus.on("source:cursorChange", ({ line, col }) => {
      this.handleCursorChange(line, col);
    });

    this.disposeListeners.push(off1, off2);
  }

  /**
   * 处理预览面板点击：查找 sourceLocation → 通知 Monaco 定位高亮
   */
  handlePreviewClick(nodeId: string): void {
    if (this.isSyncing) return;
    this.isSyncing = true;

    const location = this.nodeMap.getLocation(nodeId);
    if (location) {
      this.bus.emit("highlight:source", { location });
    }

    // 用 rAF 延迟重置，确保本轮事件处理完后才解锁
    requestAnimationFrame(() => {
      this.isSyncing = false;
    });
  }

  /**
   * 处理 Monaco 光标变化：查找对应 AST 节点 → 通知预览高亮
   */
  handleCursorChange(line: number, col: number): void {
    if (this.isSyncing) return;

    const nodeId = this.nodeMap.findNodeAtPosition(line, col);
    this.bus.emit("highlight:preview", { nodeId });
  }

  /**
   * 销毁，清理所有事件监听器
   */
  dispose(): void {
    this.disposeListeners.forEach((off) => off());
    this.disposeListeners = [];
  }
}
