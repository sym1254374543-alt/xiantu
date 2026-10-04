/**
 * 跨组件广播：只剩记忆设置变更通知（记忆档案 → 主面板）。
 * 页面按钮已改为各页面通过 usePageActions 自行声明。
 */
type PanelAction = 'memory-settings-updated';

type Handler = (payload?: any) => void | Promise<void>;

class PanelBus {
  private listeners: Map<PanelAction, Set<Handler>> = new Map();

  on(action: PanelAction, handler: Handler) {
    if (!this.listeners.has(action)) this.listeners.set(action, new Set());
    this.listeners.get(action)!.add(handler);
  }

  off(action: PanelAction, handler: Handler) {
    this.listeners.get(action)?.delete(handler);
  }

  async emit(action: PanelAction, payload?: any) {
    const handlers = Array.from(this.listeners.get(action) || []);
    for (const h of handlers) {
      await h(payload);
    }
  }
}

export const panelBus = new PanelBus();
export type { PanelAction };
