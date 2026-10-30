/**
 * @fileoverview 状态变更日志格式化工具
 * 将原始的 StateChangeLog 对象转换为人类可读的、具有游戏语义的格式。
 */

import type { StateChangeLog, StateChange, Item } from '@/types/game';
import { get, isObject, isArray } from 'lodash';

// --- 核心数据结构 ---

/** 格式化后的单条变更项 */
export interface FormattedChange {
  icon: 'add' | 'remove' | 'update' | 'info' | 'error'; // 用于UI显示的图标类型
  color: 'green' | 'red' | 'blue' | 'gray' | 'orange'; // 用于UI显示的颜色
  title: string; // 变更的标题，例如 "获得物品"
  description: string; // 变更的详细描述，例如 "【玄铁剑】x 1"
  details?: string[]; // 更详细的属性变化列表
}

/** 格式化后的变更日志 */
export interface FormattedStateChangeLog {
  summary: {
    added: number;
    removed: number;
    updated: number;
    errors: number;
  };
  changes: FormattedChange[];
}

// --- 辅助函数 ---

function getItemName(item: Item | Record<string, any>): string {
  if (!isObject(item)) return '未知物品';
  return (item as any).名称 || (item as any).name || '无名物品';
}

function getQuantity(item: Item | Record<string, any>): number {
  if (!isObject(item)) return 1;
  return (item as any).数量 || 1;
}

// --- 解析器模块 ---

/**
 * 解析物品变更
 * V3：角色.背包.物品
 * @param change - 单条变更记录
 * @returns FormattedChange | null
 */
function parseItemChange(change: StateChange): FormattedChange | null {
  const { key, action, oldValue, newValue } = change;

  const isInventoryItem = key.includes('角色.背包.物品');

  if (isInventoryItem) {
    if (action === 'set' && newValue && !oldValue) {
      // 新增物品（从无到有）
      const item = newValue as any;
      return {
        icon: 'add',
        color: 'green',
        title: '获得物品',
        description: `【${getItemName(item)}】x ${getQuantity(item)}`,
      };
    }
    if (action === 'push') {
      // 新增物品（push操作）
      const item = newValue as any;
      return {
        icon: 'add',
        color: 'green',
        title: '获得物品',
        description: `【${getItemName(item)}】x ${getQuantity(item)}`,
      };
    }
    if (action === 'delete' || action === 'pull' || (action === 'set' && !newValue && oldValue)) {
      // 删除物品
      const item = oldValue as any;
      return {
        icon: 'remove',
        color: 'red',
        title: '失去物品',
        description: `【${getItemName(item)}】x ${getQuantity(item)}`,
      };
    }
    if (action === 'set' && oldValue && newValue) {
      // 物品数量变更
      const oldQty = getQuantity(oldValue);
      const newQty = getQuantity(newValue);
      if (oldQty !== newQty) {
        const diff = newQty - oldQty;
        return {
          icon: diff > 0 ? 'add' : 'remove',
          color: diff > 0 ? 'green' : 'red',
          title: diff > 0 ? '获得物品' : '消耗物品',
          description: `【${getItemName(newValue)}】${diff > 0 ? '+' : ''}${diff}`,
        };
      }
    }
  }

  // 货币（角色.背包.货币.<币种ID>.数量）
  if (key.startsWith('角色.背包.货币.') && key.endsWith('.数量')) {
    const parts = key.split('.');
    const currencyId = parts.length >= 4 ? parts[3] : '货币';
    const oldNum = typeof oldValue === 'number' ? oldValue : 0;
    const newNum = typeof newValue === 'number' ? newValue : 0;
    const diff = newNum - oldNum;

    if (diff > 0) {
      return {
        icon: 'add',
        color: 'green',
        title: `获得${currencyId}`,
        description: `+ ${diff}`,
      };
    } else if (diff < 0) {
      return {
        icon: 'remove',
        color: 'red',
        title: `消耗${currencyId}`,
        description: `${diff}`,
      };
    }
  }

  return null;
}

/**
 * 解析角色核心属性变更 (修为、气血等)
 * V3：角色.属性 / 角色.位置 / 社交.关系.[NPC名].属性
 * @param change - 单条变更记录
 * @returns FormattedChange | null
 */
function parsePlayerStatusChange(change: StateChange): FormattedChange | null {
  const { key, action, oldValue, newValue } = change;

  const isPlayerStatus =
    key.startsWith('角色.属性.') ||
    key.startsWith('角色.位置.') ||
    key.includes('.角色.属性.') ||
    key.includes('.角色.位置.') ||
    key.includes('.气血') ||
    key.includes('.灵气') ||
    key.includes('.神识') ||
    key.includes('.寿命');

  // 🔥 新增：检测NPC属性变更（路径格式：社交.关系.[NPC名].属性.xxx）
  const isNpcStatus = key.startsWith('社交.关系.') && key.includes('.属性.');

  if (!isPlayerStatus && !isNpcStatus) return null;

  // 🔥 提取NPC名称（如果是NPC属性）
  let npcName: string | null = null;
  if (isNpcStatus) {
    const parts = key.split('.');
    // 路径格式：社交.关系.[NPC名].属性.xxx
    if (parts.length >= 3 && parts[0] === '社交' && parts[1] === '关系') {
      npcName = parts[2];
    }
  }

  const attributeName = key.split('.').pop() || '属性';

  // 境界突破
  if (key === '角色.属性.境界.名称' || key.endsWith('.境界.名称')) {
    return {
      icon: 'add',
      color: 'green',
      title: npcName ? `【${npcName}】境界突破` : '境界突破',
      description: `${oldValue || '凡人'} → ${newValue}`,
    };
  }

  if (key === '角色.属性.境界.阶段' || key.endsWith('.境界.阶段')) {
    return {
      icon: 'update',
      color: 'blue',
      title: npcName ? `【${npcName}】境界阶段提升` : '境界阶段提升',
      description: `${oldValue || '无'} → ${newValue}`,
    };
  }

  // 位置变更
  if (key === '角色.位置.描述' || key.endsWith('.位置.描述')) {
    // 提取描述字符串（处理对象和字符串两种情况）
    const extractLocation = (val: unknown): string => {
      if (!val) return '未知';
      if (typeof val === 'string') return val;
      if (typeof val === 'object' && val !== null) {
        const obj = val as Record<string, unknown>;
        if (typeof obj.描述 === 'string') return obj.描述;
        if (typeof obj.description === 'string') return obj.description;
      }
      return String(val);
    };

    return {
      icon: 'update',
      color: 'blue',
      title: npcName ? `【${npcName}】位置变更` : '位置变更',
      description: `${extractLocation(oldValue)} → ${extractLocation(newValue)}`,
    };
  }

  // 🔥 修复：识别"上限"和"当前"的单独变更
  // 路径格式: 角色.属性.气血.上限 / 角色.属性.气血.当前（以及其它属性同理）
  const pathParts = key.split('.');
  const fieldType = pathParts[pathParts.length - 1]; // "上限"/"当前"/"最大"
  const attributeBaseName = pathParts[pathParts.length - 2] || attributeName; // "气血"/"灵气"/"神识"

  if ((fieldType === '上限' || fieldType === '最大') && typeof newValue === 'number') {
    const diff = typeof oldValue === 'number' ? newValue - oldValue : newValue;
    let description = '';
    if (typeof oldValue === 'number') {
      description = `${oldValue} -> ${newValue}`;
      if (diff > 0) description += ` (+${diff})`;
    } else {
      description = `设为 ${newValue}`;
    }
    return {
      icon: 'update',
      color: 'blue',
      title: npcName ? `【${npcName}】${attributeBaseName}上限变化` : `${attributeBaseName}上限变化`,
      description,
    };
  }

  if (fieldType === '当前' && typeof newValue === 'number') {
    const diff = typeof oldValue === 'number' ? newValue - oldValue : newValue;
    let description = '';
    if (typeof oldValue === 'number') {
      description = `${oldValue} -> ${newValue}`;
      if (diff > 0) description += ` (+${diff})`;
      if (diff < 0) description += ` (${diff})`;
    } else {
      description = `设为 ${newValue}`;
    }
    return {
      icon: 'update',
      color: 'blue',
      title: npcName ? `【${npcName}】${attributeBaseName}当前值变化` : `${attributeBaseName}当前值变化`,
      description,
    };
  }

  // 处理 ValuePair 结构, e.g., { 当前: 100, 最大: 100 }
  if (isObject(newValue) && '当前' in newValue && isObject(oldValue) && '当前' in oldValue) {
    const diff = (newValue as any).当前 - (oldValue as any).当前;
    const maxChanged = (newValue as any).最大 !== (oldValue as any).最大;

    let description = `${(oldValue as any).当前} -> ${(newValue as any).当前}`;
    if (diff > 0) description += ` (+${diff})`;
    if (diff < 0) description += ` (${diff})`;
    if (maxChanged) description += ` (上限变为 ${(newValue as any).最大})`;

    return {
      icon: 'update',
      color: 'blue',
      title: npcName ? `【${npcName}】${attributeName}变化` : `${attributeName}变化`,
      description,
    };
  }

  // 处理直接的数值变更
  if (typeof newValue === 'number' && typeof oldValue === 'number') {
    const diff = newValue - oldValue;
    let description = `${oldValue} -> ${newValue}`;
    if (diff > 0) description += ` (+${diff})`;
    if (diff < 0) description += ` (${diff})`;

    return {
      icon: 'update',
      color: 'blue',
      title: npcName ? `【${npcName}】${attributeName}变化` : `${attributeName}变化`,
      description,
    };
  }

  return null;
}

/**
 * 解析NPC关系变更
 * V3：社交.关系
 * @param change - 单条变更记录
 * @returns FormattedChange | null
 */
function parseRelationshipChange(change: StateChange): FormattedChange | null {
  const { key, action, oldValue, newValue } = change;

  if (key.startsWith('社交.关系.') || key.includes('.社交.关系.')) {
    const parts = key.split('.');
    const npcName = parts[2] || '某人'; // 社交.关系.云裳仙子.好感度 -> 云裳仙子
    const field = parts[parts.length - 1]; // 好感度

    // 好感度变化
    if (field === '好感度' && typeof oldValue === 'number' && typeof newValue === 'number') {
      const diff = newValue - oldValue;
      return {
        icon: diff > 0 ? 'add' : 'remove',
        color: diff > 0 ? 'green' : 'red',
        title: `【${npcName}】好感度变化`,
        description: `${oldValue} → ${newValue} (${diff > 0 ? '+' : ''}${diff})`,
      };
    }

    // 人物记忆新增（路径是 社交.关系.X.记忆；旧日志字段名写作 人物记忆）
    if ((field === '人物记忆' || field === '记忆') && action === 'push') {
      // 提取记忆内容
      let memoryContent = '新增了关于你的记忆';
      if (newValue) {
        // 如果是摘要格式（包含 __last）
        if (isObject(newValue) && '__last' in newValue) {
          const lastMemory = (newValue as any).__last;
          if (typeof lastMemory === 'string') {
            memoryContent = lastMemory.length > 50 ? lastMemory.substring(0, 50) + '...' : lastMemory;
          }
        } else if (typeof newValue === 'string') {
          // 如果是直接的字符串
          memoryContent = newValue.length > 50 ? newValue.substring(0, 50) + '...' : newValue;
        }
      }

      return {
        icon: 'add',
        color: 'blue',
        title: `【${npcName}】记忆更新`,
        description: memoryContent,
      };
    }

    // 关系状态变化
    if (field === '关系状态') {
      return {
        icon: 'update',
        color: 'blue',
        title: `【${npcName}】关系变化`,
        description: `${oldValue || '初识'} → ${newValue}`,
      };
    }

    // 通用关系属性变更，处理深层嵌套路径
    const subPathParts = parts.slice(2);
    if (subPathParts.length > 0) {
      const subPath = subPathParts.join('.');
      // 将 a.b.0.c 格式化为 a.b[0].c，支持数字索引
      const readablePath = subPath.replace(/\.([0-9]+)(?=\.|$)/g, '[$1]');

      let description = `'${readablePath}' 已更新`;
      // 对于简单值的变更，直接在描述中显示
      if (
        (typeof newValue !== 'object' || newValue === null) &&
        (typeof oldValue !== 'object' || oldValue === null)
      ) {
        description = `'${readablePath}' 从 ${JSON.stringify(oldValue)} 变为 ${JSON.stringify(newValue)}`;
      }

      return {
        icon: 'update',
        color: 'blue',
        title: `【${npcName}】信息更新`,
        description: description,
      };
    }
  }

  return null;
}

/**
 * 解析验证错误
 * @param change - 单条变更记录
 * @returns FormattedChange | null
 */
function parseValidationError(change: StateChange): FormattedChange | null {
  const { key, action, newValue } = change;

  // 检查是否是验证错误（支持两种key格式）
  if (action === 'validation_error' && (key === '❌ 错误指令' || key === '❌ 格式错误（已拒绝）')) {
    const errorData = newValue as any;
    const errors = errorData?.errors || [];
    const command = errorData?.command || '未知指令';

    return {
      icon: 'error',
      color: 'red',
      title: '❌ AI指令格式错误',
      description: `以下指令验证失败，未被执行`,
      details: [
        `指令内容:\n${command}`,
        `\n错误原因:`,
        ...errors.map((err: string) => `  • ${err}`)
      ]
    };
  }

  return null;
}

/**
 * 通用解析器，用于处理未被特殊解析的变更
 * @param change - 单条变更记录
 * @returns FormattedChange
 */
function parseGenericChange(change: StateChange): FormattedChange {
  const { key, action, oldValue, newValue } = change;

  // 🔥 特殊处理：AI 指令执行错误（指令通过了格式校验，但在本地执行时抛错）
  if (action === 'execution_error' && (key === '? 执行失败' || key.includes('执行失败'))) {
    const errorData = (isObject(newValue) ? (newValue as any) : {}) as any;
    const command = typeof errorData?.command === 'string' ? errorData.command : '未知指令';
    const errorMessage = typeof errorData?.error === 'string' ? errorData.error : '未知错误';

    return {
      icon: 'error',
      color: 'red',
      title: '? AI指令执行失败',
      description: '指令在执行阶段报错，已跳过（存档未被该指令修改）。',
      details: [
        `指令内容:\n${command}`,
        `\n错误原因:\n${errorMessage}`,
      ],
    };
  }

  // 🔥 特殊处理：叙事正文的 push（正文全文在 系统.历史.叙事[].content，日志里只留摘要）
  if (key.includes('系统.历史.叙事') && action === 'push') {
    const content = isObject(newValue) ? (newValue as any).content : undefined;
    const preview = typeof content === 'string' && content ? content : '新增一段正文';
    return {
      icon: 'add',
      color: 'blue',
      title: '新增叙事',
      description: preview.length > 60 ? preview.substring(0, 60) + '...' : preview,
    };
  }

  // 🔥 特殊处理：事件记录的 push 操作
  if ((key.includes('社交.事件') || key.includes('系统.事件')) && action === 'push') {
    let eventDesc = '新增事件';
    if (newValue) {
      // 如果是摘要格式
      if (isObject(newValue) && '__last' in newValue) {
        const lastEvent = (newValue as any).__last;
        if (isObject(lastEvent)) {
          const eventObj = lastEvent as any;
          eventDesc = eventObj.描述 || eventObj.description || eventObj.事件 || '新增事件';
        }
      } else if (isObject(newValue)) {
        const eventObj = newValue as any;
        eventDesc = eventObj.描述 || eventObj.description || eventObj.事件 || '新增事件';
      }
    }
    return {
      icon: 'add',
      color: 'blue',
      title: '事件记录',
      description: eventDesc.length > 60 ? eventDesc.substring(0, 60) + '...' : eventDesc,
    };
  }

  // 🔥 特殊处理：记忆相关的 push 操作
  if ((key.includes('短期记忆') || key.includes('中期记忆') || key.includes('隐式中期记忆')) && action === 'push') {
    let memoryDesc = '新增记忆';
    if (newValue) {
      // 如果是摘要格式
      if (isObject(newValue) && '__last' in newValue) {
        const lastMemory = (newValue as any).__last;
        if (typeof lastMemory === 'string') {
          memoryDesc = lastMemory;
        }
      } else if (typeof newValue === 'string') {
        memoryDesc = newValue;
      }
    }

    const memoryType = key.includes('短期记忆') ? '短期记忆' :
                       key.includes('隐式中期记忆') ? '隐式中期记忆' : '中期记忆';

    return {
      icon: 'add',
      color: 'blue',
      title: `${memoryType}更新`,
      description: memoryDesc.length > 60 ? memoryDesc.substring(0, 60) + '...' : memoryDesc,
    };
  }

  let description = '';
  if (action === 'set' || action === 'update') {
    description = `值从 ${JSON.stringify(oldValue)} 变为 ${JSON.stringify(newValue)}`;
  } else if (action === 'add') {
    description = `数值增加了 ${newValue}`;
  } else if (action === 'delete') {
    description = `移除了该字段`;
  } else if (action === 'push') {
    description = `执行了 ${action} 操作`;
  } else {
    description = `执行了 ${action} 操作`;
  }

  return {
    icon: 'info',
    color: 'gray',
    title: `数据变更: ${key}`,
    description,
  };
}


// --- 主函数 ---

/**
 * 格式化完整的状态变更日志
 * @param log - 原始的 StateChangeLog
 * @returns FormattedStateChangeLog
 */
export function formatStateChanges(log: StateChangeLog): FormattedStateChangeLog {
  const formatted: FormattedStateChangeLog = {
    summary: {
      added: 0,
      removed: 0,
      updated: 0,
      errors: 0,
    },
    changes: [],
  };

  if (!log || !isArray(log.changes)) {
    return formatted;
  }

  for (const change of log.changes) {
    let parsedChange: FormattedChange | null = null;

    // 按优先级尝试不同的解析器
    // 🔥 优先检查验证错误
    parsedChange = parseValidationError(change);
    if (!parsedChange) {
      parsedChange = parseItemChange(change);
    }
    if (!parsedChange) {
      parsedChange = parsePlayerStatusChange(change);
    }
    if (!parsedChange) {
      parsedChange = parseRelationshipChange(change);
    }
    // ... 可以继续添加更多专用解析器（大道、技能等）

    // 如果所有特殊解析器都失败了，使用通用解析器
    if (!parsedChange) {
      parsedChange = parseGenericChange(change);
    }

    formatted.changes.push(parsedChange);

    // 更新统计信息
    if (parsedChange.icon === 'add') formatted.summary.added++;
    else if (parsedChange.icon === 'remove') formatted.summary.removed++;
    else if (parsedChange.icon === 'update') formatted.summary.updated++;
    else if (parsedChange.icon === 'error') formatted.summary.errors++;
  }

  return formatted;
}
