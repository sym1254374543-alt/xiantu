/**
 * 炼制工坊流程：校验 → （可选）AI 推演 → 本地结算 → AI 叙事 → 写存档。
 * 组件只收参数、显示结果（docs/功能页重写规格.md 第 5 章）。
 */
import { cloneDeep } from 'lodash';
import type { Item, ItemQuality } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore';
import { computeCrafting, type CraftingType, type Formation } from '@/utils/craftingSystem';
import { generateWithRawPrompt } from '@/utils/tavernCore';
import { extractFirstJsonSnippet } from '@/utils/jsonExtract';
import {
  buildCraftingNarrativePrompts, buildCraftingSimulationPrompts,
  type CraftingMaterialSnapshot, type CraftingResourcePlan,
} from '@/utils/prompts/tasks/craftingPrompts';
import { fireLabel, type FormationOption } from '@/data/craftingFormations';
import { getGradeText } from '@/utils/gameDisplay';
import { daoStageIndex } from '@/utils/daoDisplay';

export interface CraftParams {
  type: CraftingType;
  /** 每个槽位一个物品ID（同一物品可占多槽） */
  slotItemIds: string[];
  firePercent: number;
  manaPercent: number;
  spiritPercent: number;
  formation: FormationOption;
}

export interface SimulationResult {
  successRate: number;
  predictedQuality?: ItemQuality;
  analysis: string;
  warnings: string[];
}

export interface CraftResult {
  success: boolean;
  successRate: number;
  quality: ItemQuality;
  item: Item;
  processText: string;
}

const costBy = (current: number, percent: number) => Math.max(0, Math.min(current, Math.floor((current * percent) / 100)));

export function resourcePlan(p: Pick<CraftParams, 'manaPercent' | 'spiritPercent' | 'formation'>): CraftingResourcePlan {
  const attrs = useGameStateStore().attributes as any;
  const mana = Math.max(0, Number(attrs?.灵气?.当前) || 0);
  const spirit = Math.max(0, Number(attrs?.神识?.当前) || 0);
  const mBase = costBy(mana, p.manaPercent);
  const mExtra = costBy(mana, p.formation.extraManaPercent);
  const sBase = costBy(spirit, p.spiritPercent);
  const sExtra = costBy(spirit, p.formation.extraSpiritPercent);
  return {
    灵气: { 当前: mana, 投入百分比: p.manaPercent, 阵法额外百分比: p.formation.extraManaPercent, 基础消耗: mBase, 额外消耗: mExtra, 总消耗: mBase + mExtra },
    神识: { 当前: spirit, 投入百分比: p.spiritPercent, 阵法额外百分比: p.formation.extraSpiritPercent, 基础消耗: sBase, 额外消耗: sExtra, 总消耗: sBase + sExtra },
  };
}

/** 校验并返回 物品ID → 需要数量 */
function validate(p: CraftParams): { need: Map<string, number>; materials: Item[] } {
  const gs = useGameStateStore();
  if (!(gs.character as any)?.先天六司) throw new Error('角色数据未就绪，无法炼制');
  if (!gs.attributes) throw new Error('角色属性未就绪，无法炼制');
  const ids = p.slotItemIds.filter(Boolean);
  if (!ids.length) throw new Error('请先放入材料');
  const items = ((gs.inventory as any)?.物品 || {}) as Record<string, Item>;
  const need = new Map<string, number>();
  for (const id of ids) need.set(id, (need.get(id) ?? 0) + 1);
  for (const [id, n] of need) {
    const it = items[id];
    if (!it) throw new Error(`背包中不存在物品：${id}`);
    if (it.已装备) throw new Error(`物品已装备，无法作为材料：${it.名称}`);
    if (it.类型 !== '材料') throw new Error(`不是材料，无法用于炼制：${it.名称}`);
    if ((it.数量 ?? 0) < n) throw new Error(`材料数量不足：${it.名称}`);
  }
  return { need, materials: ids.map((id) => items[id]) };
}

const snapshot = (materials: Item[]): CraftingMaterialSnapshot[] =>
  materials.map((m) => ({
    名称: m.名称,
    类型: m.类型,
    品质: { quality: (m.品质 as any)?.quality ?? '凡', grade: Number((m.品质 as any)?.grade ?? 0) },
    描述: m.描述,
  }));

function characterSnapshot() {
  const gs = useGameStateStore();
  const c = gs.character as any;
  const a = gs.attributes as any;
  const list = Object.entries(((gs.thousandDao as any)?.大道列表 || {}) as Record<string, any>)
    .filter(([, d]) => d && d.是否解锁 !== false)
    .map(([name, d]) => `${name}·阶段${daoStageIndex(d)}`)
    .slice(0, 20);
  return {
    先天六司: c?.先天六司 ?? {},
    后天六司: c?.后天六司 ?? {},
    大道摘要: list,
    境界: a?.境界?.名称 ? `${a.境界.名称}${a.境界.阶段 ? '·' + a.境界.阶段 : ''}` : '',
  };
}

function parseJson(raw: string): any | null {
  const text = String(raw || '').trim();
  const tries = [text, text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i)?.[1]?.trim(), extractFirstJsonSnippet(text)];
  for (const t of tries) {
    if (!t) continue;
    try {
      return JSON.parse(t);
    } catch {
      /* 下一种 */
    }
  }
  return null;
}

/** AI 推演成功率（usageType crafting），成功率夹在 5–95 */
export async function simulate(p: CraftParams): Promise<SimulationResult> {
  const { materials } = validate(p);
  const { systemPrompt, userPrompt } = buildCraftingSimulationPrompts({
    type: p.type,
    fire: { percent: p.firePercent, label: fireLabel(p.firePercent) },
    formation: p.formation,
    resources: resourcePlan(p),
    materials: snapshot(materials),
    characterSnapshot: characterSnapshot(),
  });
  const raw = await generateWithRawPrompt(userPrompt, systemPrompt, false, 'crafting');
  const parsed = parseJson(raw);
  const rate = Number(parsed?.successRate);
  if (!Number.isFinite(rate)) throw new Error('推演输出缺少成功率');
  return {
    successRate: Math.max(5, Math.min(95, Math.round(rate))),
    predictedQuality: parsed?.predictedQuality,
    analysis: typeof parsed?.analysis === 'string' ? parsed.analysis : '',
    warnings: Array.isArray(parsed?.warnings) ? parsed.warnings.map(String) : [],
  };
}

/** 结算 + 叙事 + 写存档。overrideRate 为推演确认后的成功率 */
export async function craft(p: CraftParams, overrideRate?: number): Promise<CraftResult> {
  const gs = useGameStateStore();
  const { need, materials } = validate(p);
  const snaps = snapshot(materials);
  const fire = fireLabel(p.firePercent);
  const plan = resourcePlan(p);

  const computed = computeCrafting({
    materials,
    innate: (gs.character as any)?.先天六司 ?? {},
    post: (gs.character as any)?.后天六司 ?? {},
    thousandDao: gs.thousandDao as any,
    options: {
      type: p.type,
      fire,
      formation: p.formation.name as Formation,
      firePowerPercent: p.firePercent,
      manaUsePercent: p.manaPercent,
      spiritUsePercent: p.spiritPercent,
      overrideSuccessRate: Number.isFinite(overrideRate as number) ? overrideRate : undefined,
    },
  });
  const { success, successRate, resultQuality } = computed;

  const { systemPrompt, userPrompt } = buildCraftingNarrativePrompts({
    type: p.type,
    fire: { percent: p.firePercent, label: fire },
    formation: p.formation,
    resources: plan,
    successRate,
    success,
    resultQuality,
    materials: snaps,
  });
  let parsed: any = null;
  try {
    parsed = parseJson(await generateWithRawPrompt(userPrompt, systemPrompt, false, 'crafting'));
  } catch (e) {
    console.warn('[炼制] 叙事生成失败，使用默认文案', e);
  }

  const processText = String(parsed?.processText ?? parsed?.process ?? '').trim() || '炉火翻卷，灵材于鼎中沉浮，气机收束，尘埃落定。';
  const grade = Number(resultQuality.grade);
  const quality = resultQuality.quality;
  const itemType: Item['类型'] = success ? (p.type === '炼丹' ? '丹药' : '装备') : '其他';
  const name = String(parsed?.itemName ?? '').trim()
    || (success ? (p.type === '炼丹' ? '灵丹' : '法宝') : p.type === '炼丹' ? '废丹' : '炉渣');
  const item = {
    物品ID: `craft_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    名称: name,
    类型: itemType,
    品质: { quality, grade },
    数量: 1,
    描述: String(parsed?.itemDesc ?? '').trim() || `品质：${quality}·${getGradeText(grade)}(${grade})`,
    可叠加: itemType !== '装备',
  } as Item;

  // 扣材料、放产物
  const inv = cloneDeep(gs.inventory) as any;
  for (const [id, n] of need) {
    const left = (inv.物品[id].数量 ?? 0) - n;
    if (left <= 0) delete inv.物品[id];
    else inv.物品[id].数量 = left;
  }
  inv.物品[item.物品ID] = item;
  gs.updateState('inventory', inv);

  // 扣灵气 / 神识（基础 + 阵法额外）
  gs.updateState('attributes.灵气.当前', Math.max(0, plan.灵气.当前 - plan.灵气.总消耗));
  gs.updateState('attributes.神识.当前', Math.max(0, plan.神识.当前 - plan.神识.总消耗));

  // 事件记录
  const names = snaps.map((m) => m.名称).join('、') || '（无）';
  const fallback = [
    `材料：${names}`,
    `火候强度：${p.firePercent}%（${fire}）；阵法：${p.formation.name}`,
    `灵气投入：${p.manaPercent}%（基础-${plan.灵气.基础消耗}，阵法额外-${plan.灵气.额外消耗}，合计-${plan.灵气.总消耗}）`,
    `神识投入：${p.spiritPercent}%（基础-${plan.神识.基础消耗}，阵法额外-${plan.神识.额外消耗}，合计-${plan.神识.总消耗}）`,
    `成功率：${successRate}%；结果：${success ? '成功' : '失败'}；品质：${quality}·${getGradeText(grade)}(${grade})`,
    '',
    processText,
  ].join('\n');
  gs.updateState('eventSystem.事件记录', [
    ...((gs.eventSystem as any)?.事件记录 || []),
    {
      事件ID: `event_craft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      事件名称: `${p.type}：${name}`,
      事件类型: p.type,
      事件描述: String(parsed?.eventDesc ?? '').trim() || fallback,
      事件来源: '系统',
      发生时间: gs.gameTime ?? { 年: 0, 月: 0, 日: 0, 小时: 0, 分钟: 0 },
      影响等级: '轻微',
    },
  ]);

  await useCharacterStore().saveCurrentGame();
  return { success, successRate, quality: { quality, grade } as ItemQuality, item, processText };
}
