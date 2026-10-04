export type ChatBusAction = 'prefill' | 'send';

export type ChatBusPayload = {
  text: string;
  focus?: boolean;
};

type Handler = (payload: ChatBusPayload) => void | Promise<void>;

class ChatBus {
  private listeners: Map<ChatBusAction, Set<Handler>> = new Map();
  private pending: Map<ChatBusAction, ChatBusPayload[]> = new Map();

  on(action: ChatBusAction, handler: Handler) {
    if (!this.listeners.has(action)) this.listeners.set(action, new Set());
    this.listeners.get(action)!.add(handler);
    const pending = this.pending.get(action);
    if (pending?.length) {
      this.pending.delete(action);
      void Promise.all(pending.map((payload) => handler(payload)));
    }
  }

  off(action: ChatBusAction, handler: Handler) {
    this.listeners.get(action)?.delete(handler);
  }

  async emit(action: ChatBusAction, payload: ChatBusPayload) {
    const handlers = Array.from(this.listeners.get(action) || []);
    if (handlers.length === 0) {
      const pending = this.pending.get(action) || [];
      pending.push(payload);
      this.pending.set(action, pending);
      return;
    }
    for (const h of handlers) {
      await h(payload);
    }
  }

  hasListeners(action: ChatBusAction) {
    return (this.listeners.get(action)?.size || 0) > 0;
  }
}

export const chatBus = new ChatBus();

export function prefillChat(text: string, focus: boolean = true) {
  return chatBus.emit('prefill', { text, focus });
}

export function sendChat(text: string, focus: boolean = true) {
  return chatBus.emit('send', { text, focus });
}
