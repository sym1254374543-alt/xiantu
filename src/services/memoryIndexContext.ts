/**
 * 本地记忆索引的作用域绑定
 *
 * 长期检索与叙事检索共用同一个作用域绑定，并且每次操作前都会与“当前激活存档”核对：
 * 角色或槽位切换后，旧存档的索引不会再被读取或写入。
 */
import { localMemoryIndex } from '@/services/localMemoryIndex';
import { buildRawSaveScope, normalizeScopeId } from '@/utils/saveIdentity';

let boundScope: string | null = null;

/** 绑定到指定存档作用域（raw 形如 `${角色ID}_${槽位}`），返回归一化后的 scope */
export async function bindMemoryScope(rawScope: string): Promise<string> {
  const scope = normalizeScopeId(rawScope);
  await localMemoryIndex.ensureScope(scope, rawScope);
  boundScope = scope;
  return scope;
}

function readActiveRawScope(): string | null | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useCharacterStore } = require('@/stores/characterStore');
    const active = useCharacterStore().rootState?.当前激活存档;
    if (!active?.角色ID || !active?.存档槽位) return null;
    return buildRawSaveScope(active.角色ID, active.存档槽位);
  } catch {
    // store 不可用（例如 Pinia 尚未挂载）时沿用显式绑定
    return undefined;
  }
}

/**
 * 获取当前应使用的作用域；没有激活存档时返回 null，调用方应视为“索引为空”。
 */
export async function resolveMemoryScope(): Promise<string | null> {
  const activeRaw = readActiveRawScope();
  if (activeRaw === null) return null;
  if (activeRaw === undefined) {
    if (!boundScope) return null;
    await localMemoryIndex.ensureScope(boundScope);
    return boundScope;
  }
  if (normalizeScopeId(activeRaw) !== boundScope) {
    return bindMemoryScope(activeRaw);
  }
  await localMemoryIndex.ensureScope(boundScope);
  return boundScope;
}

export function getBoundMemoryScope(): string | null {
  return boundScope;
}
