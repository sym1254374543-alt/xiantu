/**
 * 世界地图的 AI 生成：初始化 / 追加地点势力 / 生成（或重新生成）当前境界地图 / 区域地图。
 * 提示词在 utils/worldGeneration/* 里；这里只收集上下文（NPC 线索、低境界背景）并写回存档。
 */
import { ref } from 'vue';
import type { WorldInfo } from '@/types/game';
import type { RegionMap } from '@/types/gameMap';
import { useGameStateStore } from '@/stores/gameStateStore';
import { EnhancedWorldGenerator, generateRealmMap } from '@/utils/worldGeneration/enhancedWorldGenerator';
import { generateRegionMap, type RegionNpcLocationHint } from '@/utils/worldGeneration/regionMapGenerator';
import { buildHehuanSaintess, HEHUAN_NPC_NAME } from '@/data/easterEggNpcs';
import { realmRank } from '@/utils/realmOrder';
import { isTavernEnv } from '@/utils/tavern';
import { num, parseLocationPath, type WorldMapData } from './useWorldMapData';

export type MapDensity = 'sparse' | 'normal' | 'dense';
export const DENSITY_OPTIONS: { value: MapDensity; label: string; desc: string }[] = [
  { value: 'sparse', label: '稀疏', desc: '势力 3–4 个，地点 6–8 个' },
  { value: 'normal', label: '正常', desc: '势力 5–8 个，地点 12–16 个' },
  { value: 'dense', label: '密集', desc: '势力 8–12 个，地点 20–30 个' },
];
const DENSITY_MUL: Record<MapDensity, number> = { sparse: 0.5, normal: 1, dense: 1.5 };

const npcRealmText = (npc: any): string => {
  for (const r of [npc?.境界, npc?.属性?.境界]) {
    if (typeof r === 'string') return r.trim();
    if (r && typeof r === 'object') return [r.名称, r.阶段].filter(Boolean).join('');
  }
  return typeof npc?.realm === 'string' ? npc.realm.trim() : '';
};
const npcLocDesc = (npc: any): string => {
  const p = npc?.当前位置 ?? npc?.位置;
  if (typeof p === 'string') return p.trim();
  return String(p?.描述 ?? p?.description ?? '').trim();
};
const sameRealm = (a: string, b: string) => {
  const ra = realmRank(a);
  const rb = realmRank(b);
  if (ra >= 0 && rb >= 0) return ra === rb;
  return !!a && !!b && (a.includes(b) || b.includes(a));
};

export function useMapGeneration(data: WorldMapData) {
  const gs = useGameStateStore();
  const busy = ref<'' | 'init' | 'append' | 'realm' | 'region'>('');
  const status = ref('');

  /** 酒馆环境 30% 概率触发合欢宗彩蛋，附带一位人物 */
  const addEasterEggNpc = (factions: any[]) => {
    const sect = factions.find((f) => String(f?.名称 || f?.name || '').includes('合欢'));
    const sectName = sect?.名称 || sect?.name || '合欢宗';
    const rel = gs.relationships || {};
    if (rel[HEHUAN_NPC_NAME]) return;
    gs.updateState('relationships', { ...rel, [HEHUAN_NPC_NAME]: buildHehuanSaintess(sectName, gs.gameTime) });
  };

  const mapConfigOf = (wi: any) =>
    wi?.地图配置 || { width: data.mapRenderConfig.value.width, height: data.mapRenderConfig.value.height, minLng: 0, maxLng: data.mapRenderConfig.value.width, minLat: 0, maxLat: data.mapRenderConfig.value.height };

  /** 初始化：按大陆数与密度生成势力与地点（保留大陆信息） */
  const initializeMap = async (density: MapDensity) => {
    const wi = data.getCurrentWorldInfo();
    if (!wi) throw new Error('未找到世界信息');
    busy.value = 'init';
    status.value = '开始生成地图内容…';
    try {
      const continents = (wi as any).大陆信息?.length || 3;
      const mul = DENSITY_MUL[density];
      const locationCount = Math.max(6, Math.round(continents * 4 * mul));
      const egg = isTavernEnv() && Math.random() < 0.3;
      const result = await new EnhancedWorldGenerator({
        worldName: (wi as any).世界名称,
        worldBackground: (wi as any).世界背景,
        worldEra: (wi as any).世界纪元 || '修真盛世',
        factionCount: Math.max(3, Math.round(continents * 2 * mul)),
        locationCount,
        secretRealmsCount: Math.max(2, Math.round(locationCount * 0.25)),
        continentCount: continents,
        mapConfig: mapConfigOf(wi),
        maxRetries: 3,
        retryDelay: 1000,
        enableHehuanEasterEgg: egg,
        // 大洲已由「世界框架」生成，此处只补势力与地点：把既有边界喂给 AI，
        // 否则它会另排一套网格摆势力，导致势力名与所在大洲错位（与追加模式同因）
        existingContinents: ((wi as any).大陆信息 || []).map((c: any) => ({ 名称: c.名称 || c.name, 大洲边界: c.大洲边界 || c.continent_bounds })),
        onStreamChunk: (chunk: string) => {
          status.value = chunk;
        },
      } as any).generateValidatedWorld();
      if (!result.success || !result.worldInfo) throw new Error(result.errors?.join('，') || '生成失败');
      const factions = result.worldInfo.势力信息 || [];
      if (!data.saveCurrentWorldInfo({ ...(wi as any), 势力信息: factions, 地点信息: result.worldInfo.地点信息 || [] })) return;
      if (egg) addEasterEggNpc(factions);
    } finally {
      busy.value = '';
      status.value = '';
    }
  };

  /** 追加生成：在现有基础上补地点 / 势力，避开已有名称与坐标 */
  const generateAdditional = async (opt: { locations: boolean; locationCount: number; factions: boolean; factionCount: number }) => {
    const wi = data.getCurrentWorldInfo() as any;
    if (!wi) throw new Error('未找到世界信息');
    if (!opt.locations && !opt.factions) throw new Error('请至少选择一种生成类型');
    busy.value = 'append';
    try {
      const egg = opt.factions && isTavernEnv() && Math.random() < 0.3;
      const result = await new EnhancedWorldGenerator({
        worldName: wi.世界名称,
        worldBackground: wi.世界背景,
        worldEra: wi.世界纪元 || '修真盛世',
        factionCount: opt.factions ? opt.factionCount : 0,
        locationCount: opt.locations ? opt.locationCount : 0,
        secretRealmsCount: 0,
        continentCount: wi.大陆信息?.length || 1,
        mapConfig: wi.地图配置 || { width: data.mapRenderConfig.value.width, height: data.mapRenderConfig.value.height },
        maxRetries: 2,
        retryDelay: 500,
        enableHehuanEasterEgg: egg,
        existingFactions: (wi.势力信息 || []).map((f: any) => ({ 名称: f.名称 || f.name, 位置: f.位置 || f.location, 势力范围: f.势力范围 || f.territory })),
        existingLocations: (wi.地点信息 || []).map((l: any) => ({ 名称: l.名称 || l.name, coordinates: l.coordinates || l.坐标 })),
        // 大洲不会重新生成，必须把既有边界喂给 AI——否则它另排一套网格摆新势力，势力会落到错误的洲
        existingContinents: (wi.大陆信息 || []).map((c: any) => ({ 名称: c.名称 || c.name, 大洲边界: c.大洲边界 || c.continent_bounds })),
      } as any).generateValidatedWorld();
      if (!result.success || !result.worldInfo) throw new Error(result.errors?.join('，') || '生成失败');
      const nf = result.worldInfo.势力信息 || [];
      const nl = result.worldInfo.地点信息 || [];
      if (!data.saveCurrentWorldInfo({ ...wi, 势力信息: [...(wi.势力信息 || []), ...nf], 地点信息: [...(wi.地点信息 || []), ...nl] })) return null;
      if (egg) addEasterEggNpc(nf);
      return { factions: nf.length, locations: nl.length };
    } finally {
      busy.value = '';
    }
  };

  /** 同境界 NPC 的位置线索（最多 80 个） */
  const realmNpcHints = (realm: string) =>
    Object.entries((gs.relationships || {}) as Record<string, any>)
      .map(([name, npc]) => ({ 名字: name, 境界: npcRealmText(npc) || realm, 当前位置: npcLocDesc(npc), ok: sameRealm(npcRealmText(npc), realm) }))
      .filter((h) => h.ok && h.当前位置)
      .slice(0, 80)
      .map(({ ok: _ok, ...h }) => h);

  /** 低境界地图的一二级地点，作为高境界地图的世界框架背景 */
  const historicalContext = (realm: string) => {
    const col = data.collection.value;
    const keys = Object.keys(col);
    const tRank = realmRank(realm);
    const tIdx = keys.indexOf(realm);
    const include = (k: string, i: number) => {
      if (k === realm) return false;
      const r = realmRank(k);
      if (tRank >= 0 && r >= 0) return r < tRank;
      return tIdx >= 0 ? i < tIdx : true;
    };
    const cs = new Set<string>();
    const ls = new Set<string>();
    const historicalContinents: Array<{ 名称: string; 来源境界?: string; 描述?: string }> = [];
    const historicalLocations: Array<{ 名称: string; 类型?: string; 描述?: string; 坐标?: { x: number; y: number }; 来源境界?: string }> = [];
    keys.filter(include).forEach((k) => {
      const wi: any = col[k];
      for (const c of wi?.大陆信息 ?? []) {
        const n = String(c?.名称 || c?.name || '').trim();
        if (!n || cs.has(n)) continue;
        cs.add(n);
        historicalContinents.push({ 名称: n, 来源境界: k, 描述: String(c?.描述 || c?.description || c?.特点 || '').trim() || undefined });
      }
      for (const l of wi?.地点信息 ?? []) {
        const n = String(l?.名称 || l?.name || '').trim();
        if (!n || ls.has(n)) continue;
        ls.add(n);
        const x = num(l?.坐标?.x ?? l?.coordinates?.x ?? l?.x);
        const y = num(l?.坐标?.y ?? l?.coordinates?.y ?? l?.y);
        historicalLocations.push({
          名称: n,
          类型: String(l?.类型 || l?.type || '').trim() || undefined,
          描述: String(l?.描述 || l?.description || '').trim() || undefined,
          坐标: x !== null && y !== null ? { x, y } : undefined,
          来源境界: k,
        });
      }
    });
    return { historicalContinents, historicalLocations };
  };

  /** 生成当前境界地图；overwrite = 覆盖当前 Tab */
  const generateCurrentRealmMap = async (overwrite = false) => {
    const realm = overwrite ? data.currentRealmKey.value || data.playerRealm.value : data.playerRealm.value || data.currentRealmKey.value;
    if (!realm) throw new Error('无法获取当前境界信息');
    if (!overwrite && data.collection.value[realm]) throw new Error(`【${realm}】已有地图，请使用重新生成`);
    busy.value = 'realm';
    try {
      const existing = (data.getCurrentWorldInfo() ?? gs.worldInfo) as any;
      const ch = gs.character as any;
      const result = await generateRealmMap({
        playerRealm: realm,
        playerRealmContext: existing?.世界背景 || realm,
        playerBackground: ch?.背景 || ch?.出身 || '',
        playerFaction: ch?.宗门 || (gs.attributes as any)?.宗门 || '',
        playerLocation: (gs.location as any)?.描述 || '',
        worldName: existing?.世界名称,
        worldBackground: existing?.世界背景,
        worldEra: existing?.世界纪元,
        npcHints: realmNpcHints(realm),
        ...historicalContext(realm),
      } as any);
      if (!result.success || !result.worldInfo) throw new Error(result.errors?.join('，') || '地图生成失败');
      data.setRealmMap(realm, result.worldInfo as WorldInfo);
      return realm;
    } finally {
      busy.value = '';
    }
  };

  /** 区域地图的 NPC 建筑线索：路径第二段 = 当前地点，建筑取最后一段 */
  const regionNpcHints = (locationName: string): RegionNpcLocationHint[] => {
    const out: RegionNpcLocationHint[] = [];
    for (const [npcName, npc] of Object.entries((gs.relationships || {}) as Record<string, any>)) {
      const desc = npcLocDesc(npc);
      const parts = parseLocationPath(desc);
      if (parts.length < 3 || parts[1] !== locationName) continue;
      out.push({ npcName, fullPath: desc, buildingName: parts[parts.length - 1] });
      if (out.length >= 40) break;
    }
    return out;
  };

  /** 进入区域地图：有缓存直接用，没有则 AI 生成并保存 */
  const openRegionMap = async (location: any): Promise<RegionMap> => {
    const name = location?.name || location?.名称;
    if (!name) throw new Error('地点缺少名称');
    const cached = gs.getRegionMap(name);
    if (cached) return cached;
    busy.value = 'region';
    try {
      const result = await generateRegionMap({
        locationName: name,
        locationType: location?.type || location?.类型 || '',
        locationDesc: location?.description || location?.描述 || '',
        npcLocationHints: regionNpcHints(name),
      });
      if (!result.success || !result.regionMap) throw new Error(result.errors?.join('，') || '区域地图生成失败');
      gs.saveRegionMap(result.regionMap);
      return result.regionMap;
    } finally {
      busy.value = '';
    }
  };

  return { busy, status, initializeMap, generateAdditional, generateCurrentRealmMap, openRegionMap };
}
