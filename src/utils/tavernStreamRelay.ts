/**
 * 流式内容中继。
 *
 * 酒馆（SillyTavern）默认 API 下，TavernHelper.generate 不会回调 onStreamChunk，
 * 流式 token 只通过 STREAM_TOKEN_RECEIVED_INCREMENTALLY 事件广播（局内由 MainGamePanel 监听，
 * 局外没有人监听）。独立 API 则相反：只走 onStreamChunk 回调。
 *
 * 这里在一段生成期间同时接收两路，锁定先到的一路，避免同一内容显示两遍。
 */
export interface StreamRelay {
  /** 传给 onStreamChunk 的回调 */
  direct: (chunk: string) => void;
  /** 新的一次请求开始（分步第 2 步、重试等）时调用，重新判定来源 */
  resetSource: () => void;
  /** 生成结束后必须调用，移除事件监听 */
  dispose: () => void;
}

export function createStreamRelay(onChunk: (chunk: string) => void): StreamRelay {
  let source: 'direct' | 'event' | null = null;

  const direct = (chunk: string) => {
    if (!chunk || source === 'event') return;
    source = 'direct';
    onChunk(chunk);
  };

  const handleEvent = (chunk: unknown) => {
    if (typeof chunk !== 'string' || !chunk || source === 'direct') return;
    source = 'event';
    onChunk(chunk);
  };

  const eventName = typeof window !== 'undefined'
    ? window.TavernHelper?.iframe_events?.STREAM_TOKEN_RECEIVED_INCREMENTALLY
    : undefined;
  const eventOn = typeof window !== 'undefined' ? window.eventOn : undefined;
  const eventOff = typeof window !== 'undefined' ? window.eventOff : undefined;
  const tavernEvents = eventName && typeof eventOn === 'function' && typeof eventOff === 'function'
    ? { name: eventName, on: eventOn, off: eventOff }
    : null;

  if (tavernEvents) {
    try {
      tavernEvents.on(tavernEvents.name, handleEvent);
    } catch (error) {
      console.warn('[流式中继] 注册酒馆流式事件失败:', error);
    }
  }

  let disposed = false;
  return {
    direct,
    resetSource: () => {
      source = null;
    },
    dispose: () => {
      if (disposed || !tavernEvents) return;
      disposed = true;
      try {
        tavernEvents.off(tavernEvents.name, handleEvent);
      } catch {
        // 忽略
      }
    },
  };
}
