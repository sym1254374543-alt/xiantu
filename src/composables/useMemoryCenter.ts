/**
 * 记忆档案页的数据层（docs/功能页重写规格.md 第 10 章）：
 * - useMemoryLists：短 / 中 / 长期记忆读取、删除（store + IndexedDB 存档 + 酒馆变量同步由 saveCurrentGame 完成）
 * - useNarrativeRag：叙事检索（LocalMemoryIndex 的 narrative 分区）状态、同步、清空、最近召回
 * - useMemoryConfig：memory-settings（短期上限、中期转化阈值等），保存后通知主界面
 */
import { computed, ref } from 'vue';
import { cloneDeep } from 'lodash';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore';
import { narrativeRagService, type NarrativeRagConfig } from '@/services/narrativeRagService';
import type { RecallLog } from '@/services/localMemoryIndex';
import { panelBus } from '@/utils/panelBus';
import { splitTimePrefix } from '@/utils/gameDisplay';
import { AIBidirectionalSystem } from '@/utils/AIBidirectionalSystem';

export type MemoryTier = 'short' | 'medium' | 'long';
export const TIER_FIELD: Record<MemoryTier, '短期记忆' | '中期记忆' | '长期记忆'> = {
  short: '短期记忆',
  medium: '中期记忆',
  long: '长期记忆',
};

export interface MemoryItem {
  index: number;
  raw: string;
  time: string;
  body: string;
}

export function useMemoryLists() {
  const gs = useGameStateStore();
  const cs = useCharacterStore();

  const listOf = (tier: MemoryTier): MemoryItem[] => {
    const arr = (gs.memory as any)?.[TIER_FIELD[tier]];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((raw: unknown, index: number) => ({ raw: String(raw ?? ''), index }))
      .filter((m) => m.raw)
      .map((m) => ({ ...m, ...splitTimePrefix(m.raw) }));
  };

  const short = computed(() => listOf('short'));
  const medium = computed(() => listOf('medium'));
  const long = computed(() => listOf('long'));

  /** 删除单条：短期记忆同时从隐式中期记忆里去掉同一条，避免溢出时又被转入中期 */
  const remove = async (tier: MemoryTier, item: MemoryItem) => {
    const mem = cloneDeep(gs.memory || { 短期记忆: [], 中期记忆: [], 长期记忆: [], 隐式中期记忆: [] }) as any;
    const field = TIER_FIELD[tier];
    const list: string[] = Array.isArray(mem[field]) ? mem[field] : [];
    if (list[item.index] !== item.raw) throw new Error('记忆已变化，请刷新后重试');
    list.splice(item.index, 1);
    mem[field] = list;
    if (tier === 'short' && Array.isArray(mem.隐式中期记忆)) {
      const i = mem.隐式中期记忆.indexOf(item.raw);
      if (i >= 0) mem.隐式中期记忆.splice(i, 1);
    }
    gs.updateState('memory', mem);
    await cs.saveCurrentGame();
  };

  return { short, medium, long, remove };
}

// ─── 叙事检索 ───

export function useNarrativeRag() {
  const gs = useGameStateStore();
  const cs = useCharacterStore();

  const config = ref<NarrativeRagConfig>(narrativeRagService.getConfig());
  const stats = ref<{ total: number; usable: number } | null>(null);
  const pending = ref(0);
  const vectorizable = ref(0);
  const lastRecall = ref<RecallLog | null>(null);
  const embedding = ref(narrativeRagService.getEmbeddingStatus());
  const busy = ref(false);
  const progress = ref({ done: 0, total: 0 });
  const error = ref('');

  const bind = async () => {
    const a = cs.rootState.当前激活存档;
    if (a?.角色ID && a?.存档槽位) await narrativeRagService.init(`${a.角色ID}_${a.存档槽位}`);
  };

  const refresh = async () => {
    error.value = '';
    try {
      await bind();
      config.value = narrativeRagService.getConfig();
      embedding.value = narrativeRagService.getEmbeddingStatus();
      const s = await narrativeRagService.getStats();
      stats.value = { total: s.total, usable: s.usable };
      const save = gs.toSaveData();
      vectorizable.value = save ? narrativeRagService.countVectorizableNarratives(save) : 0;
      pending.value = save ? await narrativeRagService.countPending(save) : 0;
      lastRecall.value = narrativeRagService.getLastRecall();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  };

  const saveConfig = (patch: Partial<NarrativeRagConfig>) => {
    narrativeRagService.saveConfig(patch);
    config.value = narrativeRagService.getConfig();
  };

  const sync = async () => {
    if (busy.value) return 0;
    const save = gs.toSaveData();
    if (!save) throw new Error('当前没有可索引的存档数据');
    busy.value = true;
    progress.value = { done: 0, total: 0 };
    try {
      await bind();
      const added = await narrativeRagService.ensureIndexed(save, {
        batchSize: 32,
        onProgress: (done, total) => {
          progress.value = { done, total };
        },
      });
      await refresh();
      return added;
    } finally {
      busy.value = false;
      progress.value = { done: 0, total: 0 };
    }
  };

  /** 模型更换后：清空再全部重建 */
  const rebuild = async () => {
    await bind();
    await narrativeRagService.clear();
    return sync();
  };

  const clear = async () => {
    await bind();
    await narrativeRagService.clear();
    await refresh();
  };

  const modelChanged = computed(() => !!stats.value && stats.value.total > 0 && stats.value.usable !== stats.value.total);

  return { config, stats, pending, vectorizable, lastRecall, embedding, busy, progress, error, modelChanged, refresh, saveConfig, sync, rebuild, clear };
}

// ─── 记忆设置 ───

export interface MemorySettings {
  shortTermLimit: number;
  midTermTrigger: number;
  midTermKeep: number;
  autoSummaryEnabled: boolean;
  midTermFormat: string;
  longTermFormat: string;
  useRawMode: boolean;
  useStreaming: boolean;
}

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  shortTermLimit: 5,
  midTermTrigger: 25,
  midTermKeep: 8,
  autoSummaryEnabled: true,
  midTermFormat: '',
  longTermFormat: '',
  useRawMode: true,
  useStreaming: true,
};

const STORAGE_KEY = 'memory-settings';

export function readMemorySettings(): MemorySettings {
  try {
    return { ...DEFAULT_MEMORY_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_MEMORY_SETTINGS };
  }
}

export function useMemoryConfig() {
  const settings = ref<MemorySettings>(readMemorySettings());

  const save = (next: MemorySettings = settings.value) => {
    const clean: MemorySettings = {
      ...next,
      shortTermLimit: Math.max(1, Math.min(50, Math.floor(Number(next.shortTermLimit) || DEFAULT_MEMORY_SETTINGS.shortTermLimit))),
      midTermTrigger: Math.max(5, Math.min(200, Math.floor(Number(next.midTermTrigger) || DEFAULT_MEMORY_SETTINGS.midTermTrigger))),
      midTermKeep: Math.max(0, Math.min(100, Math.floor(Number(next.midTermKeep) || 0))),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    settings.value = clean;
    // 主界面（MainGamePanel）据此刷新短期记忆上限等
    panelBus.emit('memory-settings-updated', clean);
  };

  const reset = () => save({ ...DEFAULT_MEMORY_SETTINGS });
  const reload = () => {
    settings.value = readMemorySettings();
  };

  /** 中期 → 长期 的 AI 总结（AIBidirectionalSystem 内自带提示与错误处理） */
  const summarize = () =>
    AIBidirectionalSystem.triggerMemorySummary({
      useRawMode: settings.value.useRawMode,
      useStreaming: settings.value.useStreaming,
    });

  return { settings, save, reset, reload, summarize };
}

/** 把叙事历史导出成小说文本 */
export function narrativeToNovel(history: Array<{ type?: string; content?: string }>, characterName: string, worldName: string): string {
  const lines: string[] = [`《${characterName}修仙录》`, '', `世界：${worldName}`, `导出时间：${new Date().toLocaleString('zh-CN')}`, `总段落数：${history.length}`, '', '='.repeat(40), ''];
  history.forEach((entry, i) => {
    const isPlayer = entry.type === 'user' || entry.type === 'player';
    const content = String(entry.content || '').replace(/【.*?】/g, '').trim();
    if (!content) return;
    lines.push(isPlayer ? `我说：“${content}”` : content, '');
    if ((i + 1) % 10 === 0) lines.push('', `—— 第 ${Math.floor((i + 1) / 10)} 章 ——`, '');
  });
  return lines.join('\n');
}
