/**
 * 存档身份规则（角色 / 槽位 / 存档数据 / 本地记忆索引）
 *
 * 所有需要“定位一个存档”的地方都应通过这里生成 key，避免各处手拼字符串导致串档：
 * - 存档数据（IndexedDB DAD_SAVES_DB）：savedata_<角色ID>_<槽位>
 * - 本地记忆索引（RAG）：scope = normalizeScopeId(`<角色ID>_<槽位>`)
 *
 * 为兼容已有数据，key 格式与历史版本保持一致，不做重命名。
 */

/** 云端存档（联机模式）唯一槽位 */
export const CLOUD_SLOT_KEY = '云端修行';
/** 历史版本联机槽位别名 */
export const LEGACY_CLOUD_SLOT_KEY = '存档';
/** 对话前自动备份槽位（用于回滚） */
export const LAST_CONVERSATION_SLOT_KEY = '上次对话';
/** 按时间间隔覆盖的自动存档槽位 */
export const TIME_BASED_SLOT_KEY = '时间点存档';

export const SAVEDATA_KEY_PREFIX = 'savedata_';

export function buildSaveDataKey(characterId: string, slotId: string): string {
  return `${SAVEDATA_KEY_PREFIX}${characterId}_${slotId}`;
}

/**
 * 判断存档数据 key 是否属于指定角色。
 * 角色ID 本身可能含下划线，前缀匹配会误伤“以本角色ID为前缀的其他角色”，
 * 因此需要传入全部已知角色ID做排除。
 */
export function isSaveDataKeyOfCharacter(key: string, characterId: string, knownCharacterIds: string[] = []): boolean {
  const prefix = `${SAVEDATA_KEY_PREFIX}${characterId}_`;
  if (!key.startsWith(prefix)) return false;
  for (const otherId of knownCharacterIds) {
    if (!otherId || otherId === characterId) continue;
    if (otherId.startsWith(`${characterId}_`) && key.startsWith(`${SAVEDATA_KEY_PREFIX}${otherId}_`)) {
      return false;
    }
  }
  return true;
}

/** 原始存档作用域字符串（与旧版向量库命名一致，用于迁移旧数据） */
export function buildRawSaveScope(characterId: string, slotId: string): string {
  return `${characterId}_${slotId}`;
}

/** 本地记忆索引作用域：只保留字母数字、下划线、中文和连字符 */
export function normalizeScopeId(raw: string): string {
  return (raw || 'default').replace(/[^\w一-鿿-]/g, '_');
}

export function buildSaveScopeId(characterId: string, slotId: string): string {
  return normalizeScopeId(buildRawSaveScope(characterId, slotId));
}
