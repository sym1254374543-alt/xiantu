/**
 * 系统设置（局内设置页）：显示 / 阅读 / 游戏 / 高级偏好的读取、即时应用、自动保存、导入导出与重置。
 * 存储沿用 localStorage `dad_game_settings`，只写本页管理的字段，不覆盖 API 页写入的分步生成、重试等设置。
 */
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from 'vue';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useTheme } from '@/composables/useTheme';
import { confirmDialog } from '@/composables/useDialog';
import { unwrapDadBundle } from '@/utils/dadBundle';
import { downloadText } from '@/utils/gameDisplay';
import { debug } from '@/utils/debug';
import { toast } from '@/utils/toast';
import type { TextReplaceRule } from '@/types/textRules';
import {
  DEFAULT_FONT, DEFAULT_LEADING, DEFAULT_NARRATIVE_SIZE, DEFAULT_TONE, DEFAULT_UI_SCALE, FONT_OPTIONS,
  applyFont, applyNarrativeLeading, applyNarrativeSize, applyNarrativeTone, applyUIScale, ensureFontLoaded,
  type FontKey, type NarrativeLeading, type NarrativeTone,
} from '@/utils/readingPrefs';

const STORAGE_KEY = 'dad_game_settings';

export interface GameSettings {
  uiScale: number;
  fastAnimations: boolean;
  fontFamily: FontKey;
  narrativeTone: NarrativeTone;
  narrativeSize: number;
  narrativeLeading: NarrativeLeading;
  realmLayeredMap: boolean;
  debugMode: boolean;
  consoleDebug: boolean;
  performanceMonitor: boolean;
  replaceRules: TextReplaceRule[];
}

const defaults = (): GameSettings => ({
  uiScale: DEFAULT_UI_SCALE,
  fastAnimations: false,
  fontFamily: DEFAULT_FONT,
  narrativeTone: DEFAULT_TONE,
  narrativeSize: DEFAULT_NARRATIVE_SIZE,
  narrativeLeading: DEFAULT_LEADING,
  realmLayeredMap: false,
  debugMode: false,
  consoleDebug: false,
  performanceMonitor: false,
  replaceRules: [],
});
const MANAGED_KEYS = Object.keys(defaults()) as (keyof GameSettings)[];

const readStored = (): Record<string, unknown> => {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
};

export const normalizeReplaceRules = (raw: unknown): TextReplaceRule[] =>
  Array.isArray(raw)
    ? raw.slice(0, 50).map((r: any, i: number) => ({
        id: typeof r?.id === 'string' ? r.id.slice(0, 80) : `rule_${i}`,
        enabled: r?.enabled !== false,
        mode: r?.mode === 'text' ? 'text' : 'regex',
        pattern: typeof r?.pattern === 'string' ? r.pattern.slice(0, 500) : '',
        replacement: typeof r?.replacement === 'string' ? r.replacement.slice(0, 1500) : '',
        ignoreCase: !!r?.ignoreCase,
        global: r?.global !== false,
        multiline: !!r?.multiline,
        dotAll: !!r?.dotAll,
      }))
    : [];

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

export function useGameSettings() {
  const gs = useGameStateStore();
  const characterStore = useCharacterStore();
  const { preference: theme, setTheme } = useTheme();

  const settings = reactive<GameSettings>(defaults());
  let ready = false;
  let timer: number | null = null;

  /** 从存储中取本页字段（缺失或非法的用默认值） */
  const load = () => {
    ready = false;
    const s = readStored();
    const d = defaults();
    Object.assign(settings, {
      uiScale: clamp(s.uiScale, 80, 130, d.uiScale),
      fastAnimations: s.fastAnimations === true,
      fontFamily: FONT_OPTIONS.some((f) => f.key === s.fontFamily) ? s.fontFamily : d.fontFamily,
      narrativeTone: s.narrativeTone === 'plain' ? 'plain' : 'vivid',
      narrativeSize: clamp(s.narrativeSize, 14, 22, d.narrativeSize),
      narrativeLeading: ['tight', 'normal', 'loose'].includes(s.narrativeLeading as string) ? s.narrativeLeading : d.narrativeLeading,
      realmLayeredMap: s.realmLayeredMap === true,
      debugMode: s.debugMode === true,
      consoleDebug: s.consoleDebug === true,
      performanceMonitor: s.performanceMonitor === true,
      replaceRules: normalizeReplaceRules(s.replaceRules),
    });
    syncRealmMap();
    // 等本轮 watch 回调过去再开启自动保存
    queueMicrotask(() => (ready = true));
  };

  const syncRealmMap = () => {
    const cur = gs.userSettings && typeof gs.userSettings === 'object' ? (gs.userSettings as Record<string, unknown>) : {};
    if (cur['境界分层地图'] !== settings.realmLayeredMap) gs.userSettings = { ...cur, 境界分层地图: settings.realmLayeredMap } as any;
  };

  const applyAll = () => {
    applyUIScale(settings.uiScale);
    applyFont(settings.fontFamily);
    applyNarrativeTone(settings.narrativeTone);
    applyNarrativeSize(settings.narrativeSize);
    applyNarrativeLeading(settings.narrativeLeading);
    document.documentElement.style.setProperty('--transition-fast', `all ${settings.fastAnimations ? 0.12 : 0.2}s ease-in-out`);
    debug.setMode(settings.debugMode);
  };

  // 拖动期间由滑块挂起缩放，松手后一次性应用
  const applyScale = () => applyUIScale(settings.uiScale);

  const persist = () => {
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
    const own = Object.fromEntries(MANAGED_KEYS.map((k) => [k, settings[k]]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), ...own, theme: theme.value }));
    syncRealmMap();
  };

  // 改动即时应用，400ms 后静默写入
  watch(
    settings,
    () => {
      if (!ready) return;
      applyFont(settings.fontFamily);
      applyNarrativeTone(settings.narrativeTone);
      applyNarrativeSize(settings.narrativeSize);
      applyNarrativeLeading(settings.narrativeLeading);
      document.documentElement.style.setProperty('--transition-fast', `all ${settings.fastAnimations ? 0.12 : 0.2}s ease-in-out`);
      debug.setMode(settings.debugMode);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(persist, 400);
    },
    { deep: true },
  );
  const flush = () => timer && persist();

  onMounted(() => {
    load();
    FONT_OPTIONS.forEach((f) => ensureFontLoaded(f.key));
  });
  onActivated(load);
  onDeactivated(flush);
  onBeforeUnmount(flush);

  // ─── 道号 ───
  const playerName = computed(() => String(gs.character?.名字 || ''));
  const renamePlayer = async (name: string) => {
    const next = name.trim();
    if (!next || next === playerName.value || !gs.character) return false;
    try {
      (gs.character as { 名字: string }).名字 = next;
      const slot = characterStore.rootState.当前激活存档?.存档槽位;
      if (slot) await characterStore.saveToSlot(slot);
      toast.success(`道号已改为「${next}」`);
      return true;
    } catch (e) {
      console.error('修改道号失败:', e);
      toast.error('修改道号失败，请重试');
      return false;
    }
  };

  // ─── 替换规则 ───
  const enabledRuleCount = computed(() => settings.replaceRules.filter((r) => r.enabled).length);
  const saveRules = (rules: TextReplaceRule[]) => {
    settings.replaceRules = normalizeReplaceRules(rules);
    persist();
  };

  // ─── 重置 / 缓存 / 导入导出 ───
  const reset = async () => {
    const ok = await confirmDialog({ title: '恢复默认', message: '把所有设置恢复为默认值？自定义的外观、阅读和调试选项都会还原，替换规则保留。', confirmText: '恢复默认', danger: true });
    if (!ok) return;
    setTheme('dark');
    Object.assign(settings, { ...defaults(), replaceRules: settings.replaceRules });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), splitResponseGeneration: false }));
    persist();
    applyAll();
    toast.info('设置已恢复默认');
  };

  const clearCache = async () => {
    const ok = await confirmDialog({ title: '清理缓存', message: '清理临时数据和缓存？不会影响存档。', confirmText: '清理', danger: true });
    if (!ok) return;
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('dad_cache_') || k.startsWith('temp_') || k.startsWith('debug_') || k.includes('_temp'))) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
      toast.success(`已清理 ${keys.length} 项缓存数据`);
    } catch (e) {
      debug.error('设置', '清理缓存失败', e);
      toast.error('清理缓存失败');
    }
  };

  const exportSettings = () => {
    flush();
    const data = {
      settings: { ...readStored(), theme: theme.value },
      exportInfo: { timestamp: new Date().toISOString(), version: '3.7.4', userAgent: navigator.userAgent, gameVersion: '仙途 v3.7.4' },
    };
    downloadText(`仙途-设置备份-${new Date().toISOString().split('T')[0]}.json`, JSON.stringify(data, null, 2));
    toast.success('设置已导出');
  };

  const importSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        const un = unwrapDadBundle(raw);
        const data =
          un.type === 'settings' ? un.payload : raw?.settings ? raw.settings : un.type === null && typeof un.payload === 'object' ? un.payload : null;
        if (!data || typeof data !== 'object') throw new Error('无效的设置文件格式');
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), ...(data as object) }));
        const t = (data as Record<string, unknown>).theme;
        if (t === 'light' || t === 'dark' || t === 'auto') setTheme(t);
        load();
        applyAll();
        toast.success('设置已导入并应用');
      } catch (e) {
        toast.error(`导入设置失败：${e instanceof Error ? e.message : '请检查文件格式'}`);
      }
    };
    input.click();
  };

  return {
    settings, theme, setTheme, playerName, renamePlayer, enabledRuleCount, saveRules, reset, clearCache, exportSettings, importSettings, applyScale,
  };
}
