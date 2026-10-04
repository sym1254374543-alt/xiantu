/**
 * 世界地图数据：当前世界 / 境界分层地图集、境界 Tab、读写当前地图、玩家与 NPC 坐标解析。
 * 渲染引擎 utils/gameMapManager 不在这里，页面只负责把数据喂给它。
 */
import { computed, ref, watch } from 'vue';
import type { WorldInfo } from '@/types/game';
import type { GameCoordinates } from '@/types/gameMap';
import { useGameStateStore } from '@/stores/gameStateStore';
import { toast } from '@/utils/toast';

export const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** 位置路径分隔：· - — → > ＞ / */
export const parseLocationPath = (desc: string): string[] =>
  String(desc || '').split(/[·\-—→>＞/]/).map((s) => s.trim()).filter(Boolean);

const locCoords = (loc: any): GameCoordinates | null => {
  const x = num(loc?.坐标?.x ?? loc?.x ?? loc?.coordinates?.x);
  const y = num(loc?.坐标?.y ?? loc?.y ?? loc?.coordinates?.y);
  return x !== null && y !== null ? { x, y } : null;
};

const centroid = (continent: any): GameCoordinates | null => {
  const b: { x: number; y: number }[] = continent?.大洲边界 ?? continent?.continent_bounds ?? [];
  if (!b.length) return null;
  const x = b.reduce((s, p) => s + (p.x ?? 0), 0) / b.length;
  const y = b.reduce((s, p) => s + (p.y ?? 0), 0) / b.length;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

// 境界 Tab 在页面间共享（地图页 / 未收录面板 / 生成都要知道当前是哪张图）
const activeRealmTab = ref('');

export function useWorldMapData() {
  const gs = useGameStateStore();

  const realmMapEnabled = computed(() => !!(gs.userSettings as any)?.境界分层地图);
  const collection = computed<Record<string, WorldInfo>>(() => (gs.realmMapCollection as any) || {});
  const realmTabs = computed(() => (realmMapEnabled.value ? Object.keys(collection.value) : []));

  const currentRealmKey = computed(() => {
    if (!realmMapEnabled.value) return '';
    const keys = Object.keys(collection.value);
    if (!keys.length) return '';
    return activeRealmTab.value && collection.value[activeRealmTab.value] ? activeRealmTab.value : keys[0];
  });

  const activeWorldInfo = computed<WorldInfo | null>(() => {
    if (!realmMapEnabled.value) return gs.worldInfo;
    const k = currentRealmKey.value;
    return k ? collection.value[k] ?? null : null;
  });

  const currentRealmHasMap = computed(() => (realmMapEnabled.value ? !!(currentRealmKey.value && collection.value[currentRealmKey.value]) : !!gs.worldInfo));

  const playerRealm = computed(() => {
    const r = (gs.attributes as any)?.境界;
    return String(r?.名称 || (typeof r === 'string' ? r : '') || '');
  });

  const worldName = computed(() => (activeWorldInfo.value as any)?.世界名称 || '修仙界');
  const worldBackground = computed(() => (activeWorldInfo.value as any)?.世界背景 || '');

  const hasMapContent = computed(() => {
    const wi = activeWorldInfo.value as any;
    return !!wi && ((wi.地点信息?.length || 0) > 0 || (wi.势力信息?.length || 0) > 0);
  });

  const mapRenderConfig = computed(() => {
    const cfg = (activeWorldInfo.value as any)?.地图配置;
    const width = Number(cfg?.width) || 10000;
    const height = Number(cfg?.height) || 10000;
    return { width, height, tileSize: Math.max(80, Math.round(Math.min(width, height) / 80)), minZoom: 0.1, maxZoom: 4 };
  });

  const getCurrentWorldInfo = (): WorldInfo | null => (realmMapEnabled.value ? activeWorldInfo.value : gs.worldInfo);

  /** 写回当前地图：旧模式写 worldInfo；分层模式写 realmMapCollection[当前境界] */
  const saveCurrentWorldInfo = (next: WorldInfo): boolean => {
    if (!realmMapEnabled.value) {
      gs.updateState('worldInfo', next);
      return true;
    }
    const key = currentRealmKey.value || playerRealm.value;
    if (!key) {
      toast.error('未找到当前境界地图，无法保存');
      return false;
    }
    gs.realmMapCollection = { ...collection.value, [key]: next };
    if (!activeRealmTab.value) activeRealmTab.value = key;
    return true;
  };

  const setRealmMap = (realm: string, wi: WorldInfo) => {
    gs.realmMapCollection = { ...collection.value, [realm]: wi };
    activeRealmTab.value = realm;
  };

  /** 候选世界：当前图优先，其次地图集，最后全局 worldInfo */
  const worldCandidates = (): any[] => {
    const out: any[] = [];
    const push = (w: any) => {
      if (w && typeof w === 'object' && !out.includes(w)) out.push(w);
    };
    push(getCurrentWorldInfo());
    if (realmMapEnabled.value) Object.values(collection.value).forEach(push);
    push(gs.worldInfo);
    return out;
  };

  /** 玩家坐标：描述匹配地点（最细粒度优先）→ 大陆重心 → 自身 x/y */
  const resolvePlayerCoordinates = (loc: any): GameCoordinates | null => {
    if (!loc || typeof loc !== 'object') return null;
    const desc = String(loc.描述 || loc.description || '');
    if (desc) {
      const parts = parseLocationPath(desc);
      const worlds = worldCandidates();
      for (const wi of worlds) {
        for (let i = parts.length - 1; i >= 0; i--) {
          const hit = (wi?.地点信息 ?? []).find((l: any) => l.名称 === parts[i] || l.name === parts[i]);
          const c = hit && locCoords(hit);
          if (c) return c;
        }
      }
      for (const wi of worlds) {
        for (const p of parts) {
          const c = centroid((wi?.大陆信息 ?? []).find((c: any) => c.名称 === p || c.name === p));
          if (c) return c;
        }
      }
    }
    return locCoords(loc);
  };

  /** NPC 坐标：描述匹配当前图地点 → 大陆重心；无描述用自身 x/y，再无则按名字散列兜底 */
  const resolveNpcCoordinates = (name: string, npc: any): GameCoordinates | null => {
    const raw = npc?.当前位置 || npc?.位置 || npc?.coordinates;
    if (!raw || typeof raw !== 'object') return null;
    const desc = String(raw.描述 || raw.description || '');
    if (desc) {
      const wi = (getCurrentWorldInfo() ?? gs.worldInfo) as any;
      const parts = desc.split('·').map((s) => s.trim()).filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i--) {
        const hit = (wi?.地点信息 ?? []).find((l: any) => l.名称 === parts[i] || l.name === parts[i]);
        const c = hit && locCoords(hit);
        if (c) return c;
      }
      for (const p of parts) {
        const c = centroid((wi?.大陆信息 ?? []).find((c: any) => c.名称 === p || c.name === p));
        if (c) return c;
      }
      return null; // 有描述但全都匹配不到：不乱放
    }
    const own = locCoords(raw);
    if (own) return own;
    const { width, height } = mapRenderConfig.value;
    const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return { x: width * 0.3 + (hash % 100) * (width * 0.004), y: height * 0.3 + ((hash * 7) % 100) * (height * 0.004) };
  };

  const npcMarkers = () =>
    Object.entries((gs.relationships || {}) as Record<string, any>)
      .map(([name, npc]) => ({ name, coordinates: resolveNpcCoordinates(name, npc) }))
      .filter((n): n is { name: string; coordinates: GameCoordinates } => !!n.coordinates);

  /** 首次开启境界分层地图：把现有 worldInfo 迁移成「当前境界」的地图 */
  watch(
    realmMapEnabled,
    (on) => {
      if (!on || Object.keys(collection.value).length) return;
      const wi = gs.worldInfo as any;
      if (!wi || (!wi.势力信息?.length && !wi.地点信息?.length)) return;
      const key = playerRealm.value || '初始境界';
      gs.realmMapCollection = { [key]: wi };
      activeRealmTab.value = key;
      toast.info(`已将现有地图迁移至【${key}】境界地图集`);
    },
    { immediate: true },
  );

  return {
    realmMapEnabled, collection, realmTabs, activeRealmTab, currentRealmKey, activeWorldInfo, currentRealmHasMap, playerRealm,
    worldName, worldBackground, hasMapContent, mapRenderConfig, getCurrentWorldInfo, saveCurrentWorldInfo, setRealmMap,
    resolvePlayerCoordinates, resolveNpcCoordinates, npcMarkers,
  };
}

export type WorldMapData = ReturnType<typeof useWorldMapData>;
