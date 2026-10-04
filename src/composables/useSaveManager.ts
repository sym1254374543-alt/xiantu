/**
 * 保存游戏页的数据层：存档列表、特殊槽位规则、导入导出、修复。
 * 读档的云端冲突决策（decideCloudLoad）与旧结构迁移弹窗都在 characterStore.loadGame 内完成。
 */
import { computed } from 'vue';
import type { SaveSlot } from '@/types/game';
import { useCharacterStore } from '@/stores/characterStore';
import { createDadBundle, unwrapDadBundle } from '@/utils/dadBundle';
import { isSaveDataV3, migrateSaveDataToLatest } from '@/utils/saveMigration';
import { validateSaveDataV3 } from '@/utils/saveValidationV3';
import { repairSaveData } from '@/utils/dataRepair';
import { CLOUD_SLOT_KEY, LAST_CONVERSATION_SLOT_KEY, TIME_BASED_SLOT_KEY } from '@/utils/saveIdentity';
import { downloadText } from '@/utils/gameDisplay';

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** 尽量迁移到 V3 再导出；失败时导出原始数据，保证「能导出」 */
function toExportable(raw: unknown, label: string) {
  if (!raw) return raw;
  try {
    const v3 = isSaveDataV3(raw as any) ? raw : migrateSaveDataToLatest(raw as any).migrated;
    const v = validateSaveDataV3(v3 as any);
    if (!v.isValid) console.warn(`[存档导出] 「${label}」校验警告：${v.errors[0] || '未知原因'}`);
    return v3;
  } catch (e) {
    console.warn(`[存档导出] 「${label}」迁移失败，导出原始数据`, e);
    return raw;
  }
}

export type SlotKind = 'normal' | 'last' | 'timed' | 'cloud';

export function useSaveManager() {
  const cs = useCharacterStore();

  const profile = computed(() => cs.activeCharacterProfile);
  const isCloud = computed(() => profile.value?.模式 === '联机');
  const characterId = computed(() => cs.rootState.当前激活存档?.角色ID || '');
  const activeSlotKey = computed(() => cs.rootState.当前激活存档?.存档槽位 || '');

  const slots = computed<SaveSlot[]>(() => cs.saveSlots.filter((s) => s && (s.存档名 || s.id)));
  const current = computed(() => cs.activeSaveSlot);

  const keyOf = (s: SaveSlot) => s.id || s.存档名;
  const kindOf = (s: SaveSlot): SlotKind => {
    const k = keyOf(s);
    if (k === CLOUD_SLOT_KEY || isCloud.value) return 'cloud';
    if (k === LAST_CONVERSATION_SLOT_KEY) return 'last';
    if (k === TIME_BASED_SLOT_KEY) return 'timed';
    return 'normal';
  };
  const isActive = (s: SaveSlot) => keyOf(s) === activeSlotKey.value;

  const normalDeletable = computed(() => slots.value.filter((s) => kindOf(s) === 'normal' && !isActive(s)).length);

  /** 不能删的原因；可删返回空串 */
  const undeletableReason = (s: SaveSlot): string => {
    const kind = kindOf(s);
    if (kind === 'cloud') return '云端修行存档不能在这里删除';
    if (kind === 'last') return '上次对话存档用于回退，不可删除';
    if (kind === 'timed') return '时间点存档按间隔自动覆盖，不可删除';
    if (isActive(s)) return '当前正在使用的存档不可删除';
    if (normalDeletable.value <= 1) return '最后一个普通存档不可删除';
    return '';
  };

  const loadFull = async (slotKey: string) => {
    const { loadSaveData } = await import('@/utils/indexedDBManager');
    return loadSaveData(characterId.value, slotKey);
  };

  const exportSlot = async (s: SaveSlot) => {
    const data = await loadFull(keyOf(s));
    if (!data) throw new Error('无法加载存档数据');
    const bundle = createDadBundle('saves', {
      characterId: characterId.value,
      characterName: profile.value?.角色?.名字,
      saves: [{ ...s, 存档数据: toExportable(data, s.存档名) }],
    });
    downloadText(`仙途-${s.存档名}-${localDate()}.json`, JSON.stringify(bundle, null, 2));
  };

  /** 导出角色：角色信息 + 全部存档（不含「上次对话」） */
  const exportCharacter = async () => {
    if (!profile.value) throw new Error('无法获取角色信息');
    const saves = await Promise.all(
      slots.value
        .filter((s) => kindOf(s) !== 'last')
        .map(async (s) => {
          const data = await loadFull(keyOf(s));
          if (!data) throw new Error(`存档「${s.存档名}」缺少存档数据，无法导出`);
          return { ...s, 存档数据: toExportable(data, s.存档名) };
        }),
    );
    const bundle = createDadBundle('character', {
      角色ID: characterId.value,
      角色信息: JSON.parse(JSON.stringify(profile.value)),
      存档列表: saves,
    });
    const name = profile.value.角色?.名字 || '未命名角色';
    downloadText(`仙途-角色-${name}-${localDate()}.json`, JSON.stringify(bundle, null, 2));
    return saves.length;
  };

  const exportAll = async () => {
    if (!slots.value.length) throw new Error('没有可导出的存档');
    const saves = await Promise.all(
      slots.value.map(async (s) => ({ ...s, 存档数据: toExportable(await loadFull(keyOf(s)), s.存档名) })),
    );
    const bundle = createDadBundle('saves', {
      characterId: characterId.value,
      characterName: profile.value?.角色?.名字,
      saves,
    });
    downloadText(`仙途-存档备份-${localDate()}.json`, JSON.stringify(bundle, null, 2));
    return saves.length;
  };

  /** 导入 dad.bundle（type: saves）；旧结构存档在读档时由迁移弹窗处理 */
  const importFile = async (file: File) => {
    const unwrapped = unwrapDadBundle(JSON.parse(await file.text()));
    if (unwrapped.type !== 'saves' || !Array.isArray(unwrapped.payload?.saves)) {
      throw new Error('无效的存档文件，请使用本游戏导出的存档文件');
    }
    const list = unwrapped.payload.saves as SaveSlot[];
    if (!list.length) throw new Error('文件中没有存档');
    if (!characterId.value) throw new Error('当前没有激活的角色');
    for (const s of list) await cs.importSave(characterId.value, s);
    await cs.loadSaves();
    return list.length;
  };

  /** 修复当前存档：dataRepair 修复后写回同槽位并重新读档 */
  const repairCurrent = async () => {
    const slotKey = activeSlotKey.value;
    if (!slotKey || !characterId.value) throw new Error('没有当前激活的存档');
    const { loadSaveData, saveSaveData } = await import('@/utils/indexedDBManager');
    const raw = await loadSaveData(characterId.value, slotKey);
    if (!raw) throw new Error('无法加载存档数据');
    const repaired = repairSaveData(raw as any);
    await saveSaveData(characterId.value, slotKey, repaired);
    await cs.loadGameById(slotKey);
    await cs.loadSaves();
  };

  return {
    profile, isCloud, slots, current, activeSlotKey, keyOf, kindOf, isActive, undeletableReason,
    exportSlot, exportCharacter, exportAll, importFile, repairCurrent,
  };
}
