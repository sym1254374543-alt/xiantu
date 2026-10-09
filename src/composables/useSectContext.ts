/**
 * 宗门页各标签共用的上下文：玩家名、世界宗门、领导地位、当前宗门、职位、贡献……
 * 取代旧版 6 个子组件各抄一遍的 computed（docs/功能页重写规格.md 8.3）。
 */
import { computed } from 'vue';
import type { NpcProfile, WorldFaction } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';
import { detectPlayerSectLeadership, isLeaderPosition } from '@/utils/sectLeadershipUtils';
import { validateAndFixSectDataList } from '@/utils/worldGeneration/sectDataValidator';
import { formatRealmWithStage } from '@/utils/realmUtils';

/** 职位等级：决定藏经阁可进入的层 */
export const POSITION_LEVELS: Record<string, number> = {
  记名弟子: 0, 外门弟子: 1, 内门弟子: 2, 真传弟子: 3, 核心弟子: 4, 长老: 5, 太上长老: 6,
  副宗主: 6, 副掌门: 6, 宗主: 7, 掌门: 7,
};

export function positionLevel(pos: string): number {
  if (POSITION_LEVELS[pos] !== undefined) return POSITION_LEVELS[pos];
  const sorted = Object.entries(POSITION_LEVELS).sort((a, b) => b[1] - a[1]);
  for (const [k, lv] of sorted) if (pos.includes(k)) return lv;
  return -1;
}

/** 成员分组：高层 / 真传 / 内门 / 外门 */
export function memberCategory(position: string | undefined): '高层' | '真传' | '内门' | '外门' {
  const p = position || '';
  if (/宗主|掌门|长老|太上|堂主|峰主|殿主|执事|职事|护法|执法|上人|尊者|使者|督统|统领/.test(p)) return '高层';
  if (/真传|核心/.test(p)) return '真传';
  if (p.includes('内门')) return '内门';
  return '外门';
}

export function useSectContext() {
  const gs = useGameStateStore();

  const playerName = computed(() => String((gs.character as any)?.名字 || ''));
  const memberInfo = computed(() => gs.sectMemberInfo);
  const sectSystem = computed(() => gs.sectSystem as any);

  /** 世界所有势力（按几流排序，数据先做一次境界字段校正） */
  const allSects = computed<WorldFaction[]>(() => {
    const list = (gs.worldInfo as any)?.势力信息;
    if (!Array.isArray(list)) return [];
    const fixed = validateAndFixSectDataList(list) as WorldFaction[];
    const order = ['超级', '一流', '二流', '三流', '末流'];
    const rank = (lv?: string) => {
      const i = order.findIndex((k) => (lv || '').includes(k));
      return i < 0 ? 999 : i;
    };
    return [...fixed].sort((a, b) => rank(a.等级) - rank(b.等级));
  });

  const leader = computed(() => detectPlayerSectLeadership(playerName.value, allSects.value, memberInfo.value));

  const sectName = computed(() =>
    String(memberInfo.value?.宗门名称 || leader.value.sectName || sectSystem.value?.当前宗门 || '').trim(),
  );
  const joined = computed(() => !!sectName.value);
  const position = computed(() => String(leader.value.position || memberInfo.value?.职位 || '散修'));
  const contribution = computed(() => Number(memberInfo.value?.贡献 ?? 0) || 0);
  const reputation = computed(() => Number(memberInfo.value?.声望 ?? 0) || 0);
  const joinDate = computed(() => String(memberInfo.value?.加入日期 || ''));
  const isLeader = computed(() => leader.value.isLeader || isLeaderPosition(position.value));
  const level = computed(() => positionLevel(position.value));

  /** 当前宗门档案：优先宗门系统里的档案，其次世界势力 */
  const profile = computed<any>(() => {
    if (!sectName.value) return null;
    return sectSystem.value?.宗门档案?.[sectName.value] ?? allSects.value.find((f) => f.名称 === sectName.value) ?? null;
  });

  const leadership = computed<any>(() => {
    const l = profile.value?.领导层;
    return l && typeof l === 'object' && String(l.宗主 || '').trim() ? l : null;
  });

  const playerRealm = computed(() => {
    const r = (gs.attributes as any)?.境界;
    if (!r) return '未知';
    if (typeof r === 'string') return r;
    return `${r.名称 || ''}${r.阶段 || ''}`.trim() || '未知';
  });

  /** 同门：人物关系里势力归属为本宗的 NPC + 宗门成员名单里的名字 */
  const members = computed(() => {
    if (!sectName.value) return [];
    const rel = (gs.relationships || {}) as Record<string, NpcProfile & { 职位?: string; 宗门?: string }>;
    const list = Object.entries(rel)
      .filter(([, n]) => n && (n.势力归属 === sectName.value || n.宗门 === sectName.value))
      .map(([key, n]) => ({
        key,
        name: n.名字 || key,
        gender: String(n.性别 || '男'),
        position: n.职位 || '弟子',
        realm: formatRealmWithStage(n.境界),
        favor: Number(n.好感度 ?? 0),
        category: memberCategory(n.职位),
        known: true,
      }));
    const names = new Set(list.map((m) => m.name));
    const roster = sectSystem.value?.宗门成员?.[sectName.value];
    if (Array.isArray(roster)) {
      for (const raw of roster) {
        const name = String(typeof raw === 'string' ? raw : raw?.名字 || '').trim();
        if (!name || names.has(name)) continue;
        names.add(name);
        list.push({ key: name, name, gender: '', position: '同门', realm: '', favor: 0, category: '外门', known: false });
      }
    }
    // 势力档案里的「主要成员」编制名单：可以有尚未登场的人（known=false），
    // 但带职位与境界；同名者以已登场的 NPC 档案为准（见上面第一段）。
    const rosterProfile = profile.value?.主要成员;
    if (Array.isArray(rosterProfile)) {
      for (const raw of rosterProfile) {
        const name = String(raw?.名字 || '').trim();
        if (!name || names.has(name)) continue;
        names.add(name);
        const pos = String(raw?.职位 || '成员');
        list.push({ key: name, name, gender: '', position: pos, realm: String(raw?.境界 || ''), favor: 0, category: memberCategory(pos), known: false });
      }
    }
    return list;
  });

  const worldContext = computed(() => {
    const w = gs.worldInfo as any;
    return w ? { 世界名称: w.世界名称, 世界背景: w.世界背景, 世界纪元: w.世界纪元 } : null;
  });

  return {
    playerName, memberInfo, sectSystem, allSects, leader, sectName, joined, position, contribution, reputation,
    joinDate, isLeader, level, profile, leadership, playerRealm, members, worldContext,
  };
}

export type SectContext = ReturnType<typeof useSectContext>;
