/**
 * 世界事件：事件记录读 / 删、事件规则（eventSystem.配置）整体读写、重新抽取下次事件时间。
 */
import { computed } from 'vue';
import { cloneDeep } from 'lodash';
import type { EventSystemConfig, GameEvent, GameTime } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore';
import { gameTimeValue } from '@/utils/gameDisplay';

/** 可开关的事件类型（宗门大战已删除） */
export const EVENT_TYPES = ['世界变革', '异宝降世', '秘境现世', '人物风波', '势力变动', '天灾人祸', '特殊NPC'] as const;
export const IMPACT_LEVELS = ['轻微', '中等', '重大', '灾难'] as const;

export function defaultEventConfig(): EventSystemConfig {
  return {
    启用随机事件: true,
    最小间隔年: 1,
    最大间隔年: 10,
    事件提示词: '',
    启用事件类型: Object.fromEntries(EVENT_TYPES.map((t) => [t, true])) as EventSystemConfig['启用事件类型'],
    特殊NPC概率: 10,
    自定义事件: [],
  };
}

/** 兼容旧存档把启用事件类型存成数组的写法 */
function normalizeConfig(raw: unknown): EventSystemConfig {
  const base = defaultEventConfig();
  const c = (raw && typeof raw === 'object' ? cloneDeep(raw) : {}) as any;
  const types = c.启用事件类型;
  if (Array.isArray(types)) c.启用事件类型 = Object.fromEntries(EVENT_TYPES.map((t) => [t, types.includes(t)]));
  return {
    ...base,
    ...c,
    启用事件类型: { ...base.启用事件类型, ...(c.启用事件类型 || {}) },
    自定义事件: Array.isArray(c.自定义事件) ? c.自定义事件 : [],
  };
}

export function useEventSystem() {
  const gs = useGameStateStore();
  const characterStore = useCharacterStore();

  const events = computed<GameEvent[]>(() => {
    const list = (gs.eventSystem as any)?.事件记录;
    return (Array.isArray(list) ? [...list] : []).sort((a, b) => gameTimeValue(b?.发生时间) - gameTimeValue(a?.发生时间));
  });

  const nextEventTime = computed<GameTime | null>(() => (gs.eventSystem as any)?.下次事件时间 ?? null);
  const config = computed(() => normalizeConfig((gs.eventSystem as any)?.配置));

  const deleteEvent = async (ev: GameEvent) => {
    const list = ((gs.eventSystem as any)?.事件记录 || []) as GameEvent[];
    const next = list.filter((e) => !(e === ev || (ev.事件ID && e.事件ID === ev.事件ID)));
    gs.updateState('eventSystem.事件记录', next);
    await characterStore.saveCurrentGame();
  };

  const saveConfig = async (next: EventSystemConfig) => {
    const c = cloneDeep(next);
    c.最小间隔年 = Math.max(1, Math.floor(Number(c.最小间隔年) || 1));
    c.最大间隔年 = Math.max(c.最小间隔年, Math.floor(Number(c.最大间隔年) || c.最小间隔年));
    c.特殊NPC概率 = Math.max(0, Math.min(100, Math.round(Number(c.特殊NPC概率) || 0)));
    gs.updateState('eventSystem.配置', c);
    await characterStore.saveCurrentGame();
  };

  /** 在 [最小, 最大] 年内随机 */
  const rerollNextEvent = async (cfg: EventSystemConfig = config.value) => {
    const now = gs.gameTime;
    if (!now) throw new Error('无法获取当前游戏时间');
    const min = Math.max(1, Math.floor(cfg.最小间隔年));
    const max = Math.max(min, Math.floor(cfg.最大间隔年));
    const years = Math.floor(Math.random() * (max - min + 1)) + min;
    gs.updateState('eventSystem.下次事件时间', { 年: now.年 + years, 月: now.月, 日: now.日, 小时: now.小时, 分钟: now.分钟 });
    await characterStore.saveCurrentGame();
  };

  return { events, nextEventTime, config, deleteEvent, saveConfig, rerollNextEvent };
}
