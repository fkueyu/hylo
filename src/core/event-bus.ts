// ============================================================
// Hylo Event Bus
// 类型安全的发布-订阅通信中心
// ============================================================

import type { EventMap } from "@/types";

type Handler<T> = (payload: T) => void;

class EventBus {
  private handlers = new Map<string, Set<Handler<unknown>>>();

  /**
   * 发布事件
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.handlers.get(event as string);
    if (!set) return;
    set.forEach((handler) => {
      try {
        handler(payload as unknown);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${String(event)}":`, err);
      }
    });
  }

  /**
   * 订阅事件，返回取消订阅函数
   */
  on<K extends keyof EventMap>(
    event: K,
    handler: Handler<EventMap[K]>
  ): () => void {
    const key = event as string;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    this.handlers.get(key)!.add(handler as Handler<unknown>);

    return () => this.off(event, handler);
  }

  /**
   * 取消订阅
   */
  off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    this.handlers.get(event as string)?.delete(handler as Handler<unknown>);
  }

  /**
   * 清除所有事件监听器（测试/销毁时使用）
   */
  clear(): void {
    this.handlers.clear();
  }
}

/** 全局单例 EventBus */
export const eventBus = new EventBus();
export type { EventBus };
