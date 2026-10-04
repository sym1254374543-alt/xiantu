/**
 * 获取记忆的时间
 * 记忆是字符串数组，不再有时间字段
 */
export const getMemoryTime = (memory: unknown): string => {
  // 字符串记忆没有时间
  return '';
};

/**
 * 获取记忆的事件内容
 * 直接返回字符串
 */
export const getMemoryEvent = (memory: unknown): string => {
  // 字符串就是记忆内容
  if (typeof memory === 'string') {
    return memory;
  }
  return '';
};