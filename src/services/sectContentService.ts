/**
 * 宗门事务的写操作与 AI 生成（原先散在 Sect*Content.vue 里）。
 * 统一做法：取当前存档副本 → 修改 → loadFromSaveData → 存档。
 */
import type { WorldFaction } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore';
import { generateWithRawPrompt } from '@/utils/tavernCore';
import { parseJsonFromText, parseJsonSmart } from '@/utils/jsonExtract';
import { aiService } from '@/services/aiService';
import { AIBidirectionalSystem } from '@/utils/AIBidirectionalSystem';
import { createJoinedSectState } from '@/utils/sectSystemFactory';
import { rollD20 } from '@/utils/diceRoller';
import { realmRank } from '@/utils/realmOrder';
import {
  buildSectEvolvePrompt, buildSectLeadershipPrompt, buildSectLibraryPrompt, buildSectManageInitPrompt,
  buildSectManageSettlePrompt, buildSectMembersPrompt, buildSectShopPrompt, buildSectTasksPrompt, type TaskMapContext,
} from '@/utils/prompts/tasks/sectPrompts';
import type { SectContext } from '@/composables/useSectContext';

const gs = () => useGameStateStore();
const clone = <T>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

function editSave(mutate: (save: any) => void) {
  const save = gs().getCurrentSaveData();
  if (!save) throw new Error('未加载存档');
  const next = clone(save) as any;
  mutate(next);
  gs().loadFromSaveData(next);
}

const sectRootOf = (save: any) => ((save.社交 ??= {}).宗门 ??= {});
const commit = () => useCharacterStore().saveCurrentGame();

async function askJson<T>(title: string, prompt: string): Promise<T> {
  const raw = await generateWithRawPrompt(title, prompt, false, 'sect_generation');
  return parseJsonSmart(raw, aiService.isForceJsonEnabled('sect_generation')) as T;
}

function bumpStatus(root: Record<string, any>, sectName: string, patch: Record<string, unknown>, parsed: { evolve_count?: number; last_updated?: string }, nowIso: string) {
  const status = (root[sectName] ??= {});
  const prev = typeof status.演变次数 === 'number' ? status.演变次数 : 0;
  Object.assign(status, patch, {
    最后更新时间: typeof parsed.last_updated === 'string' && parsed.last_updated.trim() ? parsed.last_updated : nowIso,
    演变次数: typeof parsed.evolve_count === 'number' && Number.isFinite(parsed.evolve_count) ? parsed.evolve_count : prev + 1,
  });
}

const existingNames = (list: unknown, keys: string[]) =>
  (Array.isArray(list) ? list : [])
    .map((v: any) => String(keys.map((k) => v?.[k]).find(Boolean) || '').trim())
    .filter(Boolean)
    .slice(0, 20);

// ─── 概览：加入 / 退出 / 删除势力 ───

export async function joinSect(sect: WorldFaction) {
  const { sectSystem, memberInfo } = createJoinedSectState(sect);
  gs().updateState('sectMemberInfo', memberInfo);
  gs().updateState('sectSystem', sectSystem);
  await commit();
}

export async function leaveSect() {
  gs().updateState('sectMemberInfo', null);
  gs().updateState('sectSystem', null);
  await commit();
}

/** 同时从 世界.信息.势力信息 与 社交.宗门.宗门档案 删除 */
export async function deleteFaction(sect: WorldFaction) {
  const name = String(sect.名称 || '').trim();
  const id = String((sect as any).id || '').trim();
  const hit = (f: any, key?: string) => {
    const n = String(f?.名称 || key || '').trim();
    const i = String(f?.id || '').trim();
    return (id && i && i === id) || (name && n === name);
  };
  editSave((save) => {
    const wi = save?.世界?.信息;
    if (Array.isArray(wi?.势力信息)) wi.势力信息 = wi.势力信息.filter((f: any) => !hit(f));
    const archive = save?.社交?.宗门?.宗门档案;
    if (archive && typeof archive === 'object') {
      for (const k of Object.keys(archive)) if (hit(archive[k], k)) delete archive[k];
    }
  });
  await commit();
}

// ─── 藏经阁 / 贡献商店 ───

const ensureQualitySuffix = (q: string) => {
  const s = String(q || '').trim() || '凡品';
  return s.endsWith('品') ? s : `${s}品`;
};

export function mapItemType(type: string): string {
  const t = String(type || '').trim();
  if (['丹药', '功法', '装备', '材料', '其他'].includes(t)) return t;
  if (t.includes('丹')) return '丹药';
  if (t.includes('功')) return '功法';
  if (t.includes('装') || t.includes('器')) return '装备';
  if (t.includes('材')) return '材料';
  return '其他';
}

const techniqueFields = (name: string, desc: string) => ({
  功法效果: desc || '',
  功法技能: [{ 技能名称: `${name}·入门`, 技能描述: '基础运转之法。', 熟练度要求: 0, 消耗: '灵气5%' }],
  修炼进度: 0,
  已解锁技能: [],
  已装备: false,
});

function spendContribution(save: any, cost: number) {
  const info = (sectRootOf(save).成员信息 ??= {});
  const cur = Number(info.贡献 ?? 0);
  if (!Number.isFinite(cur) || cur < cost) throw new Error('贡献不足');
  info.贡献 = Math.max(0, Math.floor(cur - cost));
}

/** 用贡献学习藏经阁功法：扣贡献、放入背包（物品ID = 功法 id，便于判断已学）、写短期记忆 */
export async function learnTechnique(tech: { id: string; name: string; cost: number; quality: string; description: string }) {
  let already = false;
  editSave((save) => {
    const items = ((((save.角色 ??= {}).背包 ??= {}).物品 ??= {}) as Record<string, any>);
    if (items[tech.id]) {
      already = true;
      return;
    }
    spendContribution(save, tech.cost);
    items[tech.id] = {
      物品ID: tech.id,
      名称: tech.name,
      类型: '功法',
      品质: { quality: ensureQualitySuffix(tech.quality), grade: 0 },
      数量: 1,
      描述: tech.description || `藏经阁所得之法：${tech.name}。`,
      ...techniqueFields(tech.name, tech.description),
    };
  });
  if (already) throw new Error('你已学过此功法');
  gs().addToShortTermMemory(`【藏经阁】以${tech.cost}贡献学习功法「${tech.name}」。`);
  await commit();
}

/** 贡献兑换：扣贡献、扣库存、放入背包、写短期记忆（不发主对话） */
export async function exchangeItem(sectName: string, item: { id: string; name: string; type: string; quality: string; description: string; cost: number }) {
  editSave((save) => {
    spendContribution(save, item.cost);
    const shop = (sectRootOf(save).宗门贡献商店 ??= {});
    const list = Array.isArray(shop[sectName]) ? shop[sectName] : [];
    const raw = list.find((v: any) => String(v?.id || v?.物品ID || '') === item.id);
    if (raw) {
      const stock = raw.库存 ?? raw.stock;
      if (stock !== undefined && Number.isFinite(Number(stock))) {
        if (Number(stock) <= 0) throw new Error('已售罄');
        const next = Math.max(0, Math.floor(Number(stock)) - 1);
        if ('stock' in raw) raw.stock = next;
        else raw.库存 = next;
      }
    }
    const items = (((save.角色 ??= {}).背包 ??= {}).物品 ??= {});
    const id = `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const type = mapItemType(item.type);
    items[id] = {
      物品ID: id,
      名称: item.name,
      类型: type,
      品质: { quality: ensureQualitySuffix(item.quality), grade: 0 },
      数量: 1,
      描述: item.description || `宗门兑换所得之物：${item.name}。`,
      ...(type === '功法' ? techniqueFields(item.name, item.description) : {}),
    };
  });
  gs().addToShortTermMemory(`【宗门兑换】以${item.cost}贡献兑换「${item.name}」。`);
  await commit();
}

export async function generateLibrary(ctx: SectContext) {
  const sectName = ctx.sectName.value;
  const nowIso = new Date().toISOString();
  const prompt = buildSectLibraryPrompt({
    sectName,
    playerPosition: ctx.position.value,
    playerContribution: ctx.contribution.value,
    worldContext: ctx.worldContext.value,
    sectContext: { 宗门档案: ctx.profile.value, 宗门成员: ctx.sectSystem.value?.宗门成员?.[sectName] },
    existingNames: existingNames(ctx.sectSystem.value?.宗门藏经阁?.[sectName], ['name', '名称']),
    nowIso,
  });
  const parsed = await askJson<{ techniques?: unknown; evolve_count?: number; last_updated?: string }>('生成宗门藏经阁', prompt);
  if (!Array.isArray(parsed.techniques)) throw new Error('techniques 字段缺失或不是数组');
  editSave((save) => {
    const root = sectRootOf(save);
    (root.宗门藏经阁 ??= {})[sectName] = parsed.techniques;
    bumpStatus((root.内容状态 ??= {}), sectName, { 藏经阁已初始化: true }, parsed, nowIso);
  });
  await commit();
}

export async function generateShop(ctx: SectContext) {
  const sectName = ctx.sectName.value;
  const nowIso = new Date().toISOString();
  const prompt = buildSectShopPrompt({
    sectName,
    playerPosition: ctx.position.value,
    playerContribution: ctx.contribution.value,
    playerRealm: ctx.playerRealm.value,
    worldContext: ctx.worldContext.value,
    sectContext: { 宗门档案: ctx.profile.value, 宗门成员: ctx.sectSystem.value?.宗门成员?.[sectName] },
    existingNames: existingNames(ctx.sectSystem.value?.宗门贡献商店?.[sectName], ['name', '名称']),
    nowIso,
  });
  const parsed = await askJson<{ items?: unknown; evolve_count?: number; last_updated?: string }>('生成宗门贡献商店', prompt);
  if (!Array.isArray(parsed.items)) throw new Error('items 字段缺失或不是数组');
  editSave((save) => {
    const root = sectRootOf(save);
    (root.宗门贡献商店 ??= {})[sectName] = parsed.items;
    bumpStatus((root.内容状态 ??= {}), sectName, { 贡献商店已初始化: true }, parsed, nowIso);
  });
  await commit();
}

// ─── 任务 ───

export interface SectTask {
  任务ID: string;
  任务名称: string;
  任务描述: string;
  任务类型: string;
  难度: string;
  贡献奖励: number;
  额外奖励: string;
  状态: string;
  期限: string;
  发布人: string;
  要求: string;
}

function normalizeStatus(v: unknown): string {
  const t = String(v ?? '').trim();
  if (!t || t.includes('可接取') || /available|open|accept/i.test(t)) return '可接取';
  if (t.includes('进行') || /in[- ]?progress|ongoing/i.test(t)) return '进行中';
  if (t.includes('完成') || /done|completed|finished/i.test(t)) return '已完成';
  return t;
}

function normalizeDifficulty(v: unknown): string {
  const t = String(v ?? '').trim();
  if (!t) return '中';
  if (t.includes('低') || /low/i.test(t)) return '低';
  if (t.includes('中') || /mid|medium/i.test(t)) return '中';
  if (t.includes('高') || /high/i.test(t)) return '高';
  if (t.includes('极') || /extreme|legendary/i.test(t)) return '极';
  return t;
}

export function normalizeTask(raw: any, i: number): SectTask {
  const reward = Number(raw?.贡献奖励 ?? raw?.reward_contribution ?? raw?.reward?.贡献 ?? raw?.reward ?? 0);
  return {
    任务ID: raw?.任务ID || raw?.id || `sect_task_${i}`,
    任务名称: raw?.任务名称 || raw?.name || '任务',
    任务描述: raw?.任务描述 || raw?.description || '',
    任务类型: raw?.任务类型 || raw?.type || '日常',
    难度: normalizeDifficulty(raw?.难度 ?? raw?.difficulty),
    贡献奖励: Number.isFinite(reward) ? reward : 0,
    额外奖励: raw?.额外奖励 || raw?.reward_extra || raw?.reward?.额外奖励 || '',
    状态: normalizeStatus(raw?.状态 ?? raw?.status),
    期限: raw?.期限 || raw?.deadline || '',
    发布人: raw?.发布人 || raw?.publisher || '',
    要求: raw?.要求 || raw?.requirements || '',
  };
}

export async function setTaskStatus(sectName: string, taskId: string, from: string, to: string) {
  editSave((save) => {
    const root = (sectRootOf(save).宗门任务 ??= {});
    const tasks = (Array.isArray(root[sectName]) ? root[sectName] : []).map(normalizeTask);
    root[sectName] = tasks.map((t: SectTask) => (t.任务ID === taskId && t.状态 === from ? { ...t, 状态: to } : t));
  });
  await commit();
}


/** 任务地图上下文：境界 1 ~ 当前境界的一二级地点（分层地图），否则用当前世界 */
function collectTaskMapContext(targetRealm: string): TaskMapContext {
  const col = gs().realmMapCollection as Record<string, any> | null;
  const target = String(targetRealm || '').trim();
  const out: TaskMapContext = { firstLevel: [], secondLevel: [], sourceRealms: [] };
  const seen1 = new Set<string>();
  const seen2 = new Set<string>();
  const push = (wi: any, source?: string) => {
    for (const c of wi?.大陆信息 ?? []) {
      const n = String(c?.名称 || c?.name || '').trim();
      if (!n || seen1.has(n) || out.firstLevel.length >= 80) continue;
      seen1.add(n);
      out.firstLevel.push({ 名称: n, 来源境界: source, 描述: String(c?.描述 || c?.description || c?.特点 || '').trim() || undefined });
    }
    for (const l of wi?.地点信息 ?? []) {
      const n = String(l?.名称 || l?.name || '').trim();
      if (!n || seen2.has(n) || out.secondLevel.length >= 180) continue;
      seen2.add(n);
      out.secondLevel.push({ 名称: n, 类型: String(l?.类型 || l?.type || '').trim() || undefined, 来源境界: source, 描述: String(l?.描述 || l?.description || '').trim() || undefined });
    }
  };
  if (col && typeof col === 'object' && Object.keys(col).length) {
    const keys = Object.keys(col);
    const tRank = realmRank(target);
    const tIdx = keys.indexOf(target);
    keys.forEach((k, idx) => {
      const ok = !target ? true : tRank >= 0 ? realmRank(k) >= 0 && realmRank(k) <= tRank : tIdx >= 0 ? idx <= tIdx : k === target;
      if (!ok) return;
      out.sourceRealms.push(k);
      push(col[k], k);
    });
  } else push(gs().worldInfo);
  return out;
}

export async function generateTasks(ctx: SectContext) {
  const sectName = ctx.sectName.value;
  const nowIso = new Date().toISOString();
  const w = gs().worldInfo as any;
  const prompt = buildSectTasksPrompt({
    sectName,
    playerPosition: ctx.position.value,
    playerContribution: ctx.contribution.value,
    playerRealm: ctx.playerRealm.value,
    worldContext: w ? { 世界名称: w.世界名称, 世界背景: w.世界背景, 世界纪元: w.世界纪元, 大陆信息: (w.大陆信息 || []).slice(0, 3).map((c: any) => c.名称 || c.name) } : null,
    sectContext: {
      宗门档案: ctx.profile.value,
      宗门成员: ctx.sectSystem.value?.宗门成员?.[sectName],
      宗门关系: ctx.sectSystem.value?.宗门关系?.[sectName],
    },
    existingNames: existingNames(ctx.sectSystem.value?.宗门任务?.[sectName], ['任务名称', 'name']),
    map: collectTaskMapContext(ctx.playerRealm.value),
    nowIso,
  });
  const parsed = await askJson<{ tasks?: unknown; evolve_count?: number; last_updated?: string }>('生成宗门任务', prompt);
  if (!Array.isArray(parsed.tasks)) throw new Error('tasks 字段缺失或不是数组');
  editSave((save) => {
    const root = sectRootOf(save);
    (root.宗门任务 ??= {})[sectName] = (parsed.tasks as any[]).map(normalizeTask);
    bumpStatus((root.宗门任务状态 ??= {}), sectName, { 已初始化: true }, parsed, nowIso);
  });
  await commit();
}

// ─── 成员 ───

export async function generateLeadership(ctx: SectContext) {
  const sectName = ctx.sectName.value;
  const parsed = await askJson<{ leadership?: any }>('生成宗门高层', buildSectLeadershipPrompt(sectName, ctx.worldContext.value, ctx.profile.value));
  if (!parsed.leadership) throw new Error('leadership 字段缺失');
  editSave((save) => {
    const archive = (sectRootOf(save).宗门档案 ??= {});
    (archive[sectName] ??= { ...(ctx.profile.value || { 名称: sectName }) }).领导层 = parsed.leadership;
  });
  await commit();
}

/** 生成同门：同名 NPC 跳过，保留已有剧情与好感 */
export async function generateMembers(ctx: SectContext): Promise<{ added: number; skipped: number }> {
  const sectName = ctx.sectName.value;
  const parsed = await askJson<{ members?: any[] }>('生成同门信息', buildSectMembersPrompt(sectName, ctx.worldContext.value, ctx.profile.value));
  if (!Array.isArray(parsed.members)) throw new Error('members 字段缺失');
  let added = 0;
  let skipped = 0;
  editSave((save) => {
    const rel = ((save.社交 ??= {}).关系 ??= {});
    for (const m of parsed.members!) {
      const name = String(m?.名字 || '').trim();
      if (!name) continue;
      if (rel[name]) {
        skipped++;
        continue;
      }
      rel[name] = {
        与玩家关系: '同门',
        好感度: 50,
        记忆: [],
        实时关注: false,
        背包: { 灵石: { 下品: 0, 中品: 0, 上品: 0, 极品: 0 }, 物品: {} },
        ...m,
        名字: name,
        势力归属: sectName,
        宗门: sectName,
      };
      added++;
    }
  });
  await commit();
  return { added, skipped };
}

export async function evolveMember(ctx: SectContext, member: { key: string; name: string; gender: string; position: string; realm: string }) {
  const sectName = ctx.sectName.value;
  const l = ctx.leadership.value || {};
  const parsed = await askJson<{ 职位?: string; 境界?: string }>('演化同门实力', buildSectEvolvePrompt({
    sectName,
    member,
    playerRealm: ctx.playerRealm.value,
    worldContext: ctx.worldContext.value,
    sectProfile: {
      宗门名称: sectName,
      宗门描述: ctx.profile.value?.描述 || '',
      宗主修为: l.宗主修为 || '',
      太上长老修为: l.太上长老修为 || '',
    },
  }));
  if (!parsed.职位 && !parsed.境界) throw new Error('演化数据缺失');
  editSave((save) => {
    const npc = save?.社交?.关系?.[member.key];
    if (!npc) throw new Error('找不到目标角色存档');
    if (parsed.职位) npc.职位 = parsed.职位;
    if (parsed.境界) npc.境界 = parsed.境界;
  });
  await commit();
}

// ─── 经营（宗主 / 掌门 / 副宗主 / 副掌门） ───

/** 高层却缺少成员信息时补一份，避免各标签判定「未加入宗门」 */
async function ensureLeaderMembership(ctx: SectContext) {
  if (ctx.memberInfo.value?.宗门名称) return;
  const sectName = String(ctx.leader.value.sectName || '').trim();
  if (!sectName) return;
  const profile = ctx.allSects.value.find((s) => String(s.名称 || '').trim() === sectName) ?? null;
  gs().updateState('sectMemberInfo', {
    宗门名称: sectName,
    宗门类型: (profile as any)?.类型 || '修仙宗门',
    职位: ctx.leader.value.position || '宗主',
    贡献: 0,
    关系: '友好',
    声望: 0,
    加入日期: new Date().toISOString(),
    描述: (profile as any)?.描述 || '',
  });
  if (!gs().sectSystem) {
    gs().updateState('sectSystem', {
      版本: 2, 当前宗门: sectName, 宗门档案: profile ? { [sectName]: profile } : {}, 宗门成员: {}, 宗门藏经阁: {}, 宗门贡献商店: {}, 宗门任务: {}, 宗门任务状态: {},
    });
  } else if (!(gs().sectSystem as any)?.当前宗门) {
    gs().updateState('sectSystem.当前宗门', sectName);
  }
  await commit();
}

async function applyGmResponse(raw: string) {
  const save = gs().getCurrentSaveData();
  if (!save) throw new Error('未加载存档');
  const parsed = parseJsonFromText(raw) as any;
  const { saveData } = await AIBidirectionalSystem.processGmResponse(parsed, save, false, undefined, { appendNarrativeHistory: false });
  gs().loadFromSaveData(saveData as any);
  await commit();
}

export async function initManagement(ctx: SectContext) {
  await ensureLeaderMembership(ctx);
  const sectName = ctx.sectName.value;
  const raw = await generateWithRawPrompt('初始化宗门经营', buildSectManageInitPrompt(sectName, ctx.profile.value, new Date().toISOString()), false, 'sect_generation');
  await applyGmResponse(raw);
}

/** 结算一旬：AI 按 d20 计算变化，不推进游戏时间 */
export async function settleTenDays(ctx: SectContext, management: unknown) {
  await ensureLeaderMembership(ctx);
  const sectName = ctx.sectName.value;
  const raw = await generateWithRawPrompt('宗门经营-结算一旬', buildSectManageSettlePrompt(sectName, management, rollD20(), new Date().toISOString()), false, 'sect_generation');
  await applyGmResponse(raw);
}
