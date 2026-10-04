/**
 * 未收录地点：NPC 位置描述里的「字段2 地点」在地图上找不到（但大陆能匹配）时列出来，
 * 「添加」让 AI 定坐标写入地图，「忽略」只在本次会话有效。
 */
import { computed, ref } from 'vue';
import { useGameStateStore } from '@/stores/gameStateStore';
import { generateLocationPlacement } from '@/utils/worldGeneration/locationPlacementGenerator';
import { realmRank } from '@/utils/realmOrder';
import type { WorldMapData } from './useWorldMapData';

export interface UnmappedNpc {
  npcName: string;
  /** 完整位置描述，如「苍冥灵境·七玄山脉·青石村」 */
  locationDesc: string;
  /** 字段 2：要添加到世界地图的地点 */
  locationHint: string;
  /** 字段 3：区域内建筑（仅展示） */
  buildingHint?: string;
  continentName: string;
  continentBounds?: { x: number; y: number }[];
  npcData: any;
}

type AddState = 'idle' | 'loading' | 'success' | 'error';

const ignored = ref(new Set<string>());

export function useUnmappedNpcs(data: WorldMapData) {
  const gs = useGameStateStore();
  const states = ref(new Map<string, AddState>());
  const errors = ref(new Map<string, string>());

  const all = computed<UnmappedNpc[]>(() => {
    const rel = gs.relationships;
    if (!rel) return [];
    const wi = (data.getCurrentWorldInfo() ?? gs.worldInfo) as any;
    const known = new Set<string>();
    const addName = (l: any) => {
      const n = String(l?.名称 || l?.name || '').trim();
      if (n) known.add(n);
    };
    const continents: any[] = [...(wi?.大陆信息 ?? [])];
    const cNames = new Set(continents.map((c) => String(c?.名称 || c?.name || '').trim()).filter(Boolean));
    const addContinent = (c: any) => {
      const n = String(c?.名称 || c?.name || '').trim();
      if (n && !cNames.has(n)) {
        cNames.add(n);
        continents.push(c);
      }
    };
    (wi?.地点信息 ?? []).forEach(addName);
    // 分层模式遍历整个地图集，避免低境界地点被误报
    if (data.realmMapEnabled.value) {
      Object.values(data.collection.value).forEach((w: any) => {
        (w?.地点信息 ?? []).forEach(addName);
        (w?.大陆信息 ?? []).forEach(addContinent);
      });
    }
    const base = gs.worldInfo as any;
    (base?.地点信息 ?? []).forEach(addName);
    (base?.大陆信息 ?? []).forEach(addContinent);

    const out: UnmappedNpc[] = [];
    for (const [npcName, npc] of Object.entries(rel as Record<string, any>)) {
      const raw = npc?.当前位置 || npc?.位置;
      if (!raw || typeof raw !== 'object') continue;
      const desc = String(raw.描述 || raw.description || '');
      const parts = desc.split('·').map((s) => s.trim()).filter(Boolean);
      if (parts.length < 2 || known.has(parts[1])) continue;
      const c = continents.find((x) => x.名称 === parts[0] || x.name === parts[0]);
      if (!c) continue;
      out.push({
        npcName,
        locationDesc: desc,
        locationHint: parts[1],
        buildingHint: parts[2],
        continentName: c.名称 || c.name || '',
        continentBounds: c.大洲边界 ?? c.continent_bounds ?? [],
        npcData: npc,
      });
    }
    return out;
  });

  const list = computed(() => all.value.filter((n) => !ignored.value.has(n.npcName)));

  const stateOf = (name: string): AddState => states.value.get(name) ?? 'idle';
  const errorOf = (name: string) => errors.value.get(name) ?? '定位失败';
  const setState = (name: string, s: AddState, err?: string) => {
    const m = new Map(states.value);
    m.set(name, s);
    states.value = m;
    const e = new Map(errors.value);
    if (err) e.set(name, err);
    else e.delete(name);
    errors.value = e;
  };

  const ignore = (name: string) => {
    ignored.value = new Set(ignored.value).add(name);
  };

  /** 分层模式优先写入玩家当前境界的地图，其次最高境界，最后当前 Tab */
  const preferredRealmKey = (): string | undefined => {
    const col = data.collection.value;
    const keys = Object.keys(col);
    if (!keys.length) return data.currentRealmKey.value || undefined;
    if (data.playerRealm.value && col[data.playerRealm.value]) return data.playerRealm.value;
    return [...keys].sort((a, b) => realmRank(b) - realmRank(a))[0] || data.currentRealmKey.value || undefined;
  };

  const add = async (npc: UnmappedNpc): Promise<string | null> => {
    setState(npc.npcName, 'loading');
    const d = npc.npcData || {};
    const realmKey = data.realmMapEnabled.value ? preferredRealmKey() : undefined;
    const col = data.collection.value;
    const wi = ((realmKey && col[realmKey]) || gs.worldInfo) as any;
    const cfg = wi?.地图配置 ?? {};
    const result = await generateLocationPlacement({
      locationName: npc.locationHint,
      locationDesc: npc.locationDesc,
      continentName: npc.continentName,
      continentBounds: npc.continentBounds,
      npcName: npc.npcName,
      npcRealm: typeof d.境界 === 'string' ? d.境界 : [d.境界?.名称, d.境界?.阶段].filter(Boolean).join(''),
      npcFaction: d.势力归属 ?? d.所属势力 ?? d.faction ?? '',
      existingLocations: wi?.地点信息 ?? [],
      mapSize: { width: Number(cfg.width) || 10000, height: Number(cfg.height) || 10000 },
    });
    if (!result.success || !result.location) {
      setState(npc.npcName, 'error', result.error ?? '定位失败');
      return null;
    }
    if (realmKey && col[realmKey]) gs.addWorldLocationToRealm(realmKey, result.location);
    else gs.addWorldLocation(result.location);
    setState(npc.npcName, 'success');
    setTimeout(() => ignore(npc.npcName), 2000);
    return result.location.名称;
  };

  return { list, stateOf, errorOf, ignore, add };
}
