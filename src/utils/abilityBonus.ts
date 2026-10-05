/**
 * 客观能力加成：功法、天赋技能加成、特殊能力、灵根资质、天资资质。
 *
 * 设计原则（与判定系统一致）：
 * - 「能力」直接进基础值/判定值：功法、技能加成、灵根、天资
 * - 「情境」由 AI 调整难度：材料、地利、偷袭、好感、师傅指点等
 * - 无法量化的特殊能力只列出名称与数值，交给 AI 判断
 *
 * 本模块对「玩家」与「NPC」通用：玩家读 角色.身份.*，NPC 直接读自身字段，
 * 双方用同一套公式，避免玩家单方面获益。
 */

import type { SaveData } from '@/types/game'
import { diag } from '@/utils/diagnostics'

/** 判定类型（与 judgement.ts 的 TYPE_WEIGHTS 对齐） */
export type AbilityActionType =
  | '战斗攻' | '战斗防' | '修炼' | '突破'
  | '炼丹' | '炼器' | '制符' | '布阵'
  | '探索' | '社交' | '逃跑' | '感知'

/** 天赋「技能加成」的技能名 → 判定类型 */
const SKILL_TO_ACTION: Record<string, AbilityActionType[]> = {
  剑法: ['战斗攻', '战斗防'],
  刀法: ['战斗攻', '战斗防'],
  拳法: ['战斗攻', '战斗防'],
  毒术: ['战斗攻'],
  炼丹: ['炼丹'],
  炼器: ['炼器'],
  符箓: ['制符'],
  阵法: ['布阵'],
  医术: ['炼丹'],
}

/** 特殊能力名 → 可能影响的判定类型（供 AI 参考，不直接算数值） */
const ABILITY_KEYWORDS: Record<string, AbilityActionType[]> = {
  逢凶化吉: ['探索', '逃跑', '感知'],
  寻宝天赋: ['探索'],
  材料感知: ['炼丹', '炼器'],
  极品概率: ['炼丹', '炼器'],
  预知危险: ['感知', '逃跑'],
  危险感知: ['感知', '逃跑'],
  闪避天赋: ['逃跑', '战斗防'],
  社交天赋: ['社交'],
  魅力光环: ['社交'],
  防欺诈: ['社交'],
  符箓变异: ['制符'],
  符箓精通: ['制符'],
  灵植亲和: ['炼丹'],
  心魔抗性: ['突破', '修炼'],
  突破成功率: ['突破'],
  绝境突破: ['突破'],
  走火入魔: ['突破', '修炼'],
  万法精通: ['修炼', '突破'],
  剑意感悟: ['战斗攻'],
  近战增幅: ['战斗攻'],
  体修天赋: ['战斗攻', '战斗防'],
}

/**
 * 灵根品阶 → 资质加成比例（影响修炼与突破）。
 * 7 个等级：凡品 < 下品 < 中品 < 上品 < 极品 < 仙品 < 神品
 * 依据 data/creationData.ts 的 base_multiplier(1.0/1.1/1.3/1.6/2.0/—/2.8~3.2) 定档。
 * 「特殊」不是等级而是异变标记(倍率跨0.5~1.8)，固定按中品档计，不入色阶。
 */
const ROOT_TIER_BONUS: Record<string, number> = {
  凡品: 0,
  下品: 0.02,
  中品: 0.05,
  上品: 0.10,
  极品: 0.15,
  仙品: 0.22,
  神品: 0.40,
  特殊: 0.05,
}

/** 非法品阶的保守兜底值（按中品计，并记入诊断告警） */
const ROOT_TIER_FALLBACK = 0.05

/** 功法品质 → 基础加成比例 */
const TECHNIQUE_QUALITY_BONUS: Record<string, number> = {
  凡: 0.04, 凡品: 0.04,
  黄: 0.10, 黄品: 0.10,
  玄: 0.18, 玄品: 0.18,
  地: 0.28, 地品: 0.28,
  天: 0.40, 天品: 0.40,
  仙: 0.55, 仙品: 0.55,
  神: 0.75, 神品: 0.75,
}

/** 功法排序用：品质序号×10 + 品级，用于 NPC 兜底时挑最强的一本 */
function gradeRank(item: any): number {
  const order = ['凡', '黄', '玄', '地', '天', '仙', '神']
  const q = String(item?.品质?.quality || '').replace('品', '')
  const qi = order.indexOf(q)
  const g = Number(item?.品质?.grade)
  return (qi < 0 ? 0 : qi + 1) * 10 + (Number.isFinite(g) ? g : 0)
}

/** 天资稀有度(1-10) → 资质加成比例 */
function talentTierBonus(rarity: number): number {
  if (!Number.isFinite(rarity) || rarity <= 0) return 0
  const r = Math.min(10, Math.max(1, Math.round(rarity)))
  return (r - 1) * 0.03
}

/** 功法作用范围：修炼/突破全额，战斗全额，感知减半，其余不受功法影响 */
const TECHNIQUE_ACTION_FACTOR: Partial<Record<AbilityActionType, number>> = {
  修炼: 1, 突破: 1,
  战斗攻: 1, 战斗防: 1,
  感知: 0.5,
}

/** 辅修权重：主修全额，辅修半额 */
const MAIN_WEIGHT = 1
const SUB_WEIGHT = 0.5

/** 功法加成总上限，避免主修+多本辅修叠出失控数值 */
const TECHNIQUE_RATIO_CAP = 1.5

/** 单类型技能加成上限：多个天赋叠加时防止失控 */
const SKILL_BONUS_CAP = 1.0

/**
 * 境界 → 典型功法品质（NPC 无功法数据时的兜底）。
 * 仙品极其罕见，故元婴及以上统一按天品推算，仅渡劫按仙品。
 */
const REALM_TYPICAL_TIER: Record<string, string> = {
  凡人: '凡',
  练气: '黄',
  筑基: '玄',
  金丹: '地',
  元婴: '天',
  化神: '天',
  炼虚: '天',
  合体: '天',
  渡劫: '仙',
}

export interface AbilitySource {
  名称: string
  类型: string
  数值: string
  影响: AbilityActionType[]
}

export interface AbilityBonus {
  来源: AbilitySource[]
  /** 各判定类型的技能加成比例（如炼丹 0.15） */
  技能加成: Partial<Record<AbilityActionType, number>>
  /** 各判定类型的功法加成比例 */
  功法加成: Partial<Record<AbilityActionType, number>>
  /** 资质加成比例：作用于修炼/突破/炼制 */
  资质加成: number
  资质来源: string[]
  /** 主修功法说明，用于展示 */
  功法来源: string[]
}

/** 空结果 */
function emptyBonus(): AbilityBonus {
  return { 来源: [], 技能加成: {}, 功法加成: {}, 资质加成: 0, 资质来源: [], 功法来源: [] }
}

/**
 * 规范化实体：兼容「玩家存档」与「NPC 对象」两种结构。
 * 玩家：角色.身份.{天赋,灵根,天资} + 角色.背包/功法
 * NPC ：{天赋,灵根,先天六司} + 自身背包/功法
 */
interface Entity {
  天赋: any[]
  灵根: any
  天资: any
  功法列表: any[]
  技能进度: Record<string, any>
  套装: any
  当前功法ID: unknown
  修炼功法ID: unknown
  /** 是否玩家实体：玩家不享受"按境界推算功法"的兜底 */
  是玩家: boolean
  /** 境界名称，用于兜底推算 */
  境界名: string
}

function resolveEntity(source: any): Entity {
  const empty: Entity = {
    天赋: [], 灵根: null, 天资: null, 功法列表: [], 技能进度: {},
    套装: {}, 当前功法ID: null, 修炼功法ID: null,
    是玩家: false, 境界名: '',
  }
  if (!source || typeof source !== 'object') return empty

  // 玩家存档
  const identity = source.角色?.身份
  if (identity) {
    const bag = source.角色?.背包?.物品 || {}
    const tech = source.角色?.功法 || {}
    return {
      天赋: Array.isArray(identity.天赋) ? identity.天赋 : [],
      灵根: identity.灵根 || null,
      天资: identity.天资 || null,
      功法列表: Object.values(bag).filter((i: any) => i?.类型 === '功法'),
      技能进度: tech.功法进度 || {},
      套装: tech.功法套装 || {},
      当前功法ID: tech.当前功法ID,
      修炼功法ID: source.角色?.修炼?.修炼功法?.物品ID,
      是玩家: true,
      境界名: String(source.角色?.属性?.境界?.名称 || ''),
    }
  }

  // NPC 对象
  const bag = source.背包?.物品 || {}
  const tech = source.功法 || {}
  return {
    天赋: Array.isArray(source.天赋) ? source.天赋 : [],
    灵根: source.灵根 || null,
    天资: source.天资 || null,
    功法列表: Object.values(bag).filter((i: any) => i?.类型 === '功法'),
    技能进度: tech.功法进度 || {},
    套装: tech.功法套装 || {},
    当前功法ID: tech.当前功法ID,
    修炼功法ID: source.修炼?.修炼功法?.物品ID,
    是玩家: false,
    境界名: String(source.境界?.名称 || ''),
  }
}

const isPlayerEntity = (entity: Entity) => entity.是玩家

/**
 * 计算一本功法提供的加成比例 = 品质基础 × 品级系数 × 熟练度系数
 * 未装备且非主修的功法不计入。
 */
function techniqueRatio(item: any, progressMap: Record<string, any>): number {
  const quality = String(item?.品质?.quality ?? '')
  const base = TECHNIQUE_QUALITY_BONUS[quality] || 0
  if (base === 0) return 0

  const gradeRaw = Number(item?.品质?.grade)
  const grade = Number.isFinite(gradeRaw) ? Math.min(10, Math.max(0, gradeRaw)) : 5
  const gradeFactor = 0.8 + (grade / 10) * 0.4  // 0→0.8, 10→1.2

  const id = String(item?.物品ID || '')
  const entry = progressMap[id]
  const rawProgress = Number(entry?.熟练度 ?? item?.修炼进度 ?? 0)
  const progress = Number.isFinite(rawProgress) ? Math.min(100, Math.max(0, rawProgress)) : 0
  const progressFactor = 0.3 + (progress / 100) * 0.7  // 0→0.3, 100→1.0

  return base * gradeFactor * progressFactor
}

/**
 * 解析主修/辅修功法槽位。
 * 主修优先级：功法套装.主修 > 已装备 > 当前修炼功法 > 当前功法ID
 * （历史存档里"当前功法ID"可能与"已装备"不一致，以实际装备/修炼状态为准）
 */
function resolveTechniqueSlots(entity: Entity): { 主修: any; 辅修: any[] } {
  const byId = new Map<string, any>()
  const byName = new Map<string, any>()
  for (const item of entity.功法列表) {
    if (item?.物品ID) byId.set(String(item.物品ID), item)
    if (item?.名称) byName.set(String(item.名称), item)
  }
  const lookup = (ref: unknown): any => {
    if (!ref) return null
    const key = String(ref)
    return byId.get(key) || byName.get(key) || null
  }

  const suit = entity.套装 || {}
  let main = lookup(suit.主修)
  if (!main) main = entity.功法列表.find((i: any) => i?.已装备) || null
  if (!main) main = lookup(entity.修炼功法ID)
  if (!main) main = lookup(entity.当前功法ID)

  const subs: any[] = []
  const subRefs = Array.isArray(suit.辅修) ? suit.辅修 : []
  for (const ref of subRefs) {
    const item = lookup(ref)
    if (item && item !== main) subs.push(item)
  }

  return { 主修: main, 辅修: subs }
}

function describeTechnique(item: any, progressMap: Record<string, any>, ratio: number, slot: string): string {
  const grade = Number(item?.品质?.grade)
  const progress = Number(progressMap?.[String(item?.物品ID)]?.熟练度 ?? item?.修炼进度 ?? 0)
  const quality = String(item?.品质?.quality || '')
  return `${item?.名称 || '功法'}[${slot}](${quality}${Number.isFinite(grade) ? grade : ''}品·熟练${Math.round(progress)}%·${Math.round(ratio * 100)}%)`
}

/**
 * 计算实体（玩家或 NPC）的客观能力加成。
 */
export function calculateAbilityBonus(source: unknown): AbilityBonus {
  const result = emptyBonus()
  const entity = resolveEntity(source as any)

  // ─── 天赋：技能加成 + 特殊能力 ───
  for (const talent of entity.天赋) {
    if (!talent || typeof talent !== 'object') continue
    const talentName = String(talent.名称 || talent.name || '')
    const effects = Array.isArray(talent.effects) ? talent.effects : []

    for (const effect of effects) {
      if (!effect || typeof effect !== 'object') continue
      const kind = String(effect.类型 || '')

      if (kind === '技能加成') {
        const skill = String(effect.技能 || '')
        const value = Number(effect.数值) || 0
        const actions = SKILL_TO_ACTION[skill] || []
        if (!actions.length || value === 0) continue
        for (const action of actions) {
          const prev = result.技能加成[action] || 0
          result.技能加成[action] = Math.min(SKILL_BONUS_CAP, prev + value)
        }
        result.来源.push({
          名称: talentName, 类型: '技能加成',
          数值: `${skill} +${Math.round(value * 100)}%`, 影响: actions,
        })
      }

      if (kind === '特殊能力') {
        // 特殊能力语义各异，不统一折算为判定加成：
        // 「极品概率」影响品质、「寿命延长」与判定无关、「近战增幅」偏伤害、
        // 「材料感知」偏感知能力——盲目并入会虚高且语义错误，故只列名与数值，交 AI 判断适用性。
        const abilityName = String(effect.名称 || '')
        const value = Number(effect.数值) || 0
        result.来源.push({
          名称: talentName, 类型: '特殊能力',
          数值: value > 1 ? `${abilityName} +${value}` : `${abilityName} +${Math.round(value * 100)}%`,
          影响: ABILITY_KEYWORDS[abilityName] || [],
        })
      }
    }
  }

  // ─── 功法：主修全额 + 辅修半额（累加，受总上限约束） ───
  const slots = resolveTechniqueSlots(entity)
  let totalRatio = 0
  let mainRatio = 0
  const parts: string[] = []

  if (slots.主修) {
    mainRatio = techniqueRatio(slots.主修, entity.技能进度)
    totalRatio += mainRatio * MAIN_WEIGHT
    if (mainRatio > 0) parts.push(describeTechnique(slots.主修, entity.技能进度, mainRatio, '主修'))
    for (const sub of slots.辅修) {
      const r = techniqueRatio(sub, entity.技能进度) * SUB_WEIGHT
      if (r > 0) {
        totalRatio += r
        parts.push(describeTechnique(sub, entity.技能进度, r, '辅修'))
      }
    }
  } else if (!isPlayerEntity(entity) && entity.功法列表.length > 0) {
    // NPC 有功法物品但没写 已装备/功法套装.主修：取品质最高的一本兜底
    // （AI 常漏写装备标记，若严格按 已装备 判定会把已有功法白丢）
    const best = entity.功法列表.slice().sort((a: any, b: any) => gradeRank(b) - gradeRank(a))[0]
    mainRatio = techniqueRatio(best, entity.技能进度)
    totalRatio = mainRatio
    if (mainRatio > 0) {
      parts.push(describeTechnique(best, entity.技能进度, mainRatio, '按品质取用·未标装备'))
      diag.warn('能力·功法', `NPC 有功法但未标记装备，已按品质最高兜底取用`,
        `${best?.名称}（${best?.品质?.quality}${best?.品质?.grade}品）；建议 AI 补 set 已装备=true 与 功法套装.主修`)
    }
  } else if (!isPlayerEntity(entity)) {
    // NPC 无功法数据：按境界推算其"应有功法"，避免玩家单方面吃满加成
    const tier = REALM_TYPICAL_TIER[entity.境界名] || ''
    const base = TECHNIQUE_QUALITY_BONUS[tier] || 0
    if (base > 0) {
      mainRatio = base
      totalRatio = base
      parts.push(`按境界推算(${entity.境界名}·${tier}品·${Math.round(base * 100)}%)`)
      diag.info('能力·功法', 'NPC 无功法数据，按境界推算兜底',
        `${entity.境界名} → ${tier}品 ${Math.round(base * 100)}%`)
    } else {
      diag.warn('能力·功法', 'NPC 无功法且境界无法识别，功法加成按 0 计',
        `境界名="${entity.境界名}"`)
    }
  } else if (entity.功法列表.length === 0) {
    diag.warn('能力·功法', '玩家背包中没有功法物品，功法加成按 0 计', '')
  }

  if (totalRatio > TECHNIQUE_RATIO_CAP) totalRatio = TECHNIQUE_RATIO_CAP

  if (totalRatio > 0) {
    for (const [action, factor] of Object.entries(TECHNIQUE_ACTION_FACTOR)) {
      result.功法加成[action as AbilityActionType] = totalRatio * (factor as number)
    }
    if (parts.length) {
      result.功法来源.push(`${parts.join(' + ')}，合计${Math.round(totalRatio * 100)}%`)
    }
  }

  // ─── 灵根：资质加成 ───
  // 玩家结构 {name,tier}，NPC 结构 {名称,品级}，两种键名都要兼容
  const root = entity.灵根
  if (root && typeof root === 'object') {
    const rootTier = String((root as any).tier || (root as any).品级 || '')
    const rootName = String((root as any).name || (root as any).名称 || '灵根')
    const known = rootTier in ROOT_TIER_BONUS
    const bonus = known ? ROOT_TIER_BONUS[rootTier] : ROOT_TIER_FALLBACK
    if (known) {
      if (bonus > 0) {
        result.资质加成 += bonus
        result.资质来源.push(`${rootName}(${rootTier} +${Math.round(bonus * 100)}%)`)
      }
    } else {
      // 未知品阶：给保守默认值而非归零，避免 AI 换用新词导致加成凭空消失
      result.资质加成 += bonus
      result.资质来源.push(`${rootName}(${rootTier}·未知品阶按中品 +${Math.round(bonus * 100)}%)`)
      diag.warn('能力·灵根', `灵根品阶「${rootTier}」无法识别，暂按中品 ${Math.round(bonus * 100)}% 计`,
        `灵根="${rootName}"，已知品阶：${Object.keys(ROOT_TIER_BONUS).join('/')}`)
    }
  }

  // ─── 天资：资质加成（NPC 通常无此字段）───
  const tier = entity.天资
  if (tier && typeof tier === 'object') {
    const rarity = Number((tier as any).rarity ?? (tier as any).稀有度)
    const bonus = talentTierBonus(rarity)
    if (bonus > 0) {
      const tierName = String((tier as any).name || (tier as any).名称 || '天资')
      result.资质加成 += bonus
      result.资质来源.push(`${tierName}(+${Math.round(bonus * 100)}%)`)
    }
  }

  return result
}
