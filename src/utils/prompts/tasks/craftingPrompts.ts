import { generateQualitySystemPrompt } from '@/data/itemQuality';
import type { CraftingType } from '@/utils/craftingSystem';
import type { ItemQuality } from '@/types/game';

export type CraftingFireInput = { percent: number; label: string };

export type CraftingFormationInput = {
  id: string;
  name: string;
  desc: string;
  extraManaPercent: number;
  extraSpiritPercent: number;
};

export type CraftingResourcePlan = {
  灵气: {
    当前: number;
    投入百分比: number;
    阵法额外百分比: number;
    基础消耗: number;
    额外消耗: number;
    总消耗: number;
  };
  神识: {
    当前: number;
    投入百分比: number;
    阵法额外百分比: number;
    基础消耗: number;
    额外消耗: number;
    总消耗: number;
  };
};

export interface CraftingMaterialSnapshot {
  名称: string;
  类型: string;
  品质: { quality: string; grade: number | string };
  描述?: string;
}

export interface CraftingNarrativeInput {
  type: CraftingType;
  fire: CraftingFireInput;
  formation: CraftingFormationInput;
  resources?: CraftingResourcePlan;
  successRate: number;
  success: boolean;
  resultQuality: ItemQuality;
  materials: CraftingMaterialSnapshot[];
}

export interface CraftingSimulationInput {
  type: CraftingType;
  fire: CraftingFireInput;
  formation: CraftingFormationInput;
  resources?: CraftingResourcePlan;
  materials: CraftingMaterialSnapshot[];
  characterSnapshot?: {
    先天六司?: Record<string, number>;
    后天六司?: Record<string, number>;
    大道摘要?: string[];
    境界?: string;
  };
}

export interface CraftingFinalizeInput {
  type: CraftingType;
  fire: CraftingFireInput;
  formation: CraftingFormationInput;
  resources?: CraftingResourcePlan;
  materials: CraftingMaterialSnapshot[];
  simulation?: {
    successRate?: number;
    predictedQuality?: ItemQuality;
  };
  characterSnapshot?: CraftingSimulationInput['characterSnapshot'];
}

// ─── 三个炼制请求共用的规则（推演 / 裁定 / 文案必须用同一套上限，否则前后矛盾）───

const CRAFTING_JSON_RULE = '只输出一个 JSON 对象：不要 Markdown、代码块、解释文字或任何前后缀。';

const REALM_QUALITY_CAP = `
## 境界 → 成品品质上限（硬性，任何情况下不可突破）
| 角色境界 | 品质上限 |
|---|---|
| 凡人 / 练气 | 黄品（通常只能出凡品） |
| 筑基 | 玄品 |
| 金丹 | 地品 |
| 元婴 / 化神 | 天品 |
| 炼虚及以上 | 仙品（极罕见） |
| 神品 | 仅存于传说，炼制不可得 |
另：成品品质不会超过主材料品质，通常还略低一些；凡品材料炼不出黄品以上。`.trim();

const DAO_PROFICIENCY_RULE = `
## 对应大道（炼丹看丹道，炼器看器道；角色信息里写作"丹道·阶段N"）
| 大道情况 | 成功率参考 | 品质参考 | 文案表现 |
|---|---|---|---|
| 无对应大道 / 阶段0 | 5-15% | 最高凡品下品 | 手法生疏、险象环生 |
| 阶段1 | 15-30% | 最高凡品中品 | 尚在摸索、偶有失误 |
| 阶段2 | 30-50% | 可尝试黄品 | 渐入门道 |
| 阶段3 | 40-60% | 黄品稳定 | 从容不迫 |
| 阶段4及以上 | 可更高 | 可尝试更高品质 | 技艺娴熟 |
大道只影响成功率与品质，品质仍受上面的境界上限约束。`.trim();

const RESOURCE_RULE = '若提供 resources（灵气/神识投入计划）：描写与数值都要与之一致，任何消耗都不得超过其中的"当前"值。';

function craftingInputLines(input: { type: CraftingType; fire: CraftingFireInput; formation: CraftingFormationInput }): string {
  return [
    `炼制类型：${input.type}`,
    `火候强度：${input.fire.percent}%（${input.fire.label}）`,
    `阵法：${input.formation.name}（额外消耗：灵气+${input.formation.extraManaPercent}% / 神识+${input.formation.extraSpiritPercent}%）`,
  ].join('\n');
}

const json = (v: unknown) => JSON.stringify(v ?? {}, null, 2);

export function buildCraftingNarrativePrompts(input: CraftingNarrativeInput): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `
你是修仙游戏的炼制文案作者。成败与品质已经由系统算定，你只负责把这次炼制写出来。

## 规则
1. ${CRAFTING_JSON_RULE}
2. 结果不可改：success=false 就写失败（产物为废丹/废器/炉渣等），success=true 就写成功；成品品质严格使用给定的 resultQuality，不自行升降。
3. 只使用材料清单里的材料，不虚构关键材料；火候变化、气机流转、药香、金铁之声等细节可以合理补充。
4. ${RESOURCE_RULE}
5. 文案要与角色能力相称，参考下方两张表（例如无对应大道时应写得生疏吃力）。

${REALM_QUALITY_CAP}

${DAO_PROFICIENCY_RULE}

## 输出结构
{
  "processText": "炼制过程描写，150-400字，分段用\\n",
  "itemName": "成品名称（失败也要给名称，如某某废丹）",
  "itemDesc": "成品描述：品质、大致功效；失败时写明副作用或无效",
  "eventDesc": "写入事件记录的一句话概述，含主要材料与结果"
}

${generateQualitySystemPrompt()}
`.trim();

  const userPrompt = `
请为这次炼制生成文案（JSON 输出）。

${craftingInputLines(input)}
成功率：${input.successRate}%
结果：${input.success ? '成功' : '失败'}
成品品质：${input.resultQuality.quality}品·${String(input.resultQuality.grade)}

灵气/神识投入计划：
${json(input.resources)}

材料清单（只能使用这些材料）：
${json(input.materials)}
  `.trim();

  return { systemPrompt, userPrompt };
}

export function buildCraftingSimulationPrompts(input: CraftingSimulationInput): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `
你是修仙游戏的炼制推演器。根据材料、火候、阵法、角色信息与大道，推演这次炼制的成功率与预期品质。这只是推演，不产出成品。

## 规则
1. ${CRAFTING_JSON_RULE}
2. successRate 为 5-95 的整数。
3. predictedQuality.quality 只能是 凡/黄/玄/地/天/仙/神 之一，grade 为 0-10 的整数。
4. 不输出成品物品，不延伸剧情。
5. ${RESOURCE_RULE}
6. 火候越猛、成功率越低但品质上限略高；阵法按其说明加减。

${REALM_QUALITY_CAP}

${DAO_PROFICIENCY_RULE}

## 输出结构
{
  "successRate": 5-95的整数,
  "predictedQuality": {"quality": "凡|黄|玄|地|天|仙|神", "grade": 0-10的整数},
  "analysis": "1-3句推演依据（境界、大道、材料、火候各起了什么作用）",
  "warnings": ["风险提示，没有则为空数组"]
}

${generateQualitySystemPrompt()}
`.trim();

  const userPrompt = `
请推演一次炼制（JSON 输出）。

${craftingInputLines(input)}

材料清单：
${json(input.materials)}

灵气/神识投入与上限：
${json(input.resources)}

角色信息（可能为空）：
${json(input.characterSnapshot)}
  `.trim();

  return { systemPrompt, userPrompt };
}

export function buildCraftingFinalizePrompts(input: CraftingFinalizeInput): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `
你是修仙游戏的炼制裁定器。输出这次炼制的最终结果：是否成功、产出物品、过程描写与事件描述。

## 规则
1. ${CRAFTING_JSON_RULE}
2. 必须包含 success(布尔)、successRate(数字)、item(对象)、processText(字符串)、eventDesc(字符串)。
3. 给了推演结果时，successRate 与推演一致；没给则按规则推导 5-95 的整数。predictedQuality 仅作参考，最终品质仍受境界上限约束。
4. item 使用中文字段：物品ID(留空字符串即可)、名称、类型、品质{quality,grade}、数量、描述、可叠加(可选)。
5. 炼丹成功 → 类型为"丹药"；炼器成功 → 类型为"装备"；失败产物（废丹/炉渣等）类型可为"丹药"或"材料/其他"，但必须与描述一致。
6. ${RESOURCE_RULE}

${REALM_QUALITY_CAP}
超出上限的输出会被系统拒绝。

${DAO_PROFICIENCY_RULE}

## 输出结构
{
  "success": true或false,
  "successRate": 5-95的整数,
  "item": {
    "物品ID": "",
    "名称": "成品名",
    "类型": "丹药|装备|材料|其他",
    "品质": {"quality": "凡|黄|玄|地|天|仙|神", "grade": 0-10的整数},
    "数量": 数字,
    "描述": "品质、功效或缺陷",
    "可叠加": true或false
  },
  "processText": "炼制过程描写，150-400字，分段用\\n",
  "eventDesc": "一句话概述，含主要材料与结果"
}

${generateQualitySystemPrompt()}
`.trim();

  const userPrompt = `
请裁定这次炼制的最终结果（JSON 输出）。

${craftingInputLines(input)}

材料清单：
${json(input.materials)}

灵气/神识投入与上限：
${json(input.resources)}

推演结果（如果有）：
${json(input.simulation)}

角色信息（可能为空）：
${json(input.characterSnapshot)}
  `.trim();

  return { systemPrompt, userPrompt };
}
