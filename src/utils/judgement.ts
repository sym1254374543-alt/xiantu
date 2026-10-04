/**
 * 回合判定：前端算好基础值、幸运点和环境/状态修正，模型只负责选用并写进〔〕。
 *
 * 有效属性 = 先天 × 0.7 + 后天 × 0.3
 * 属性加权 = 主 × 0.5 + 副 × 0.3 + 辅 × 0.2
 * 基础值 = 底子 10 + 属性加权 + 境界加成（炼丹/炼器/制符/布阵另计，见 getDaoStageBase）
 * 判定值 = 基础值 + 幸运点 + 环境修正 + 状态修正
 * 难度 = f(事情本身)，不随角色能力变化；各类型难度由 AI 按业务规则表取值
 *
 * 炼制门类（炼丹/炼器/制符/布阵）各自匹配对应大道，基础值由大道阶段决定。
 */

import { realmRank } from '@/utils/realmOrder'

export type SixSiKey = '根骨' | '灵性' | '悟性' | '气运' | '魅力' | '心性'

export interface SixSi {
  根骨: number
  灵性: number
  悟性: number
  气运: number
  魅力: number
  心性: number
}

/** 主 / 副 / 辅 */
const TYPE_WEIGHTS: Record<string, [SixSiKey, SixSiKey, SixSiKey]> = {
  战斗: ['根骨', '灵性', '气运'],
  战斗攻: ['根骨', '灵性', '气运'],
  战斗防: ['根骨', '心性', '灵性'],
  修炼: ['悟性', '灵性', '心性'],
  突破: ['悟性', '灵性', '心性'],
  炼丹: ['悟性', '灵性', '心性'],
  炼器: ['悟性', '灵性', '心性'],
  制符: ['悟性', '灵性', '心性'],
  布阵: ['悟性', '灵性', '心性'],
  探索: ['气运', '灵性', '悟性'],
  社交: ['魅力', '悟性', '心性'],
  逃跑: ['灵性', '气运', '根骨'],
  感知: ['灵性', '悟性', '气运'],
}

/**
 * 人人都有的底子。凡人属性加权只有 3～5，没有这 10 点，简单、极易会被"难度至少为 1"截住，
 * 跟普通几乎一样难，新手连极易的事都会失败。
 */
const BASE_FLOOR = 10

/** 与境界序号对齐：凡人0 … 渡劫9。同序号的武道境界共用这一档。 */
const REALM_BONUS_BY_RANK = [0, 5, 12, 20, 30, 42, 55, 70, 79, 88]

/** 大道阶段对应的炼制基础值：阶段0-5对应凡黄玄地天仙的上品难度
 * 阶段6及以上：超越仙品，使用仙品基础值+额外加成 */
const DAO_STAGE_BASE = [12, 25, 45, 70, 100, 135]

/** 获取大道阶段对应的基础值（兼容超出范围的阶段） */
function getDaoStageBase(stage: number): number {
  if (stage < 0) return 0
  if (stage < DAO_STAGE_BASE.length) return DAO_STAGE_BASE[stage]
  // 阶段6+：仙品基础值 + 每个额外阶段+20
  const extraStages = stage - (DAO_STAGE_BASE.length - 1)
  return DAO_STAGE_BASE[DAO_STAGE_BASE.length - 1] + extraStages * 20
}

export interface JudgementBaseLine {
  属性加权: number
  基础: number
  大道阶段?: number  // 炼制门类特有：使用的大道阶段
  炼制提示?: string  // 炼制门类特有：无对应大道时的失败提示
}

export interface DaoStageInfo {
  大道名: string
  当前阶段: number
  阶段名称: string
  是否解锁?: boolean
}

export interface JudgementRound {
  幸运点: number
  气运: number
  幸运下限: number
  幸运上限: number
  状态修正: number
  境界名: string
  境界加成: number
  环境: {
    灵气浓度: number
    修炼: number
    炼制: number
    战斗: number
  }
  分项: Record<string, JudgementBaseLine>
  目标境界?: string  // 目标的境界（用于境界压制）
  大道信息?: DaoStageInfo[]  // 大道阶段信息（用于炼制类加成）
}

const SIX_KEYS: SixSiKey[] = ['根骨', '灵性', '悟性', '气运', '魅力', '心性']

/**
 * 品质类型（凡黄玄地天仙神）
 */
export type QualityType = '凡品' | '黄品' | '玄品' | '地品' | '天品' | '仙品' | '神品'

/**
 * 品级类型（下品、中品、上品、极品）
 */
export type GradeType = '下品' | '中品' | '上品' | '极品'

/**
 * 炼制固定难度表（根据计划）
 * 行：品质（凡黄玄地天仙神）
 * 列：品级（下品、中品、上品、极品）
 */
const CRAFTING_DIFFICULTY_TABLE: Record<QualityType, Record<GradeType, number>> = {
  '凡品': { '下品': 5, '中品': 8, '上品': 12, '极品': 18 },
  '黄品': { '下品': 15, '中品': 20, '上品': 25, '极品': 35 },
  '玄品': { '下品': 30, '中品': 38, '上品': 45, '极品': 60 },
  '地品': { '下品': 50, '中品': 60, '上品': 70, '极品': 90 },
  '天品': { '下品': 75, '中品': 88, '上品': 100, '极品': 125 },
  '仙品': { '下品': 105, '中品': 120, '上品': 135, '极品': 160 },
  '神品': { '下品': 150, '中品': 175, '上品': 200, '极品': 250 },
}

/**
 * 获取炼制固定难度
 * @param quality 品质（凡黄玄地天仙神）
 * @param grade 品级（下品、中品、上品、极品）
 * @returns 固定难度值
 */
export function getCraftingDifficulty(quality: QualityType, grade: GradeType = '中品'): number {
  const qualityRow = CRAFTING_DIFFICULTY_TABLE[quality]
  if (!qualityRow) {
    console.warn(`[getCraftingDifficulty] 未知品质: ${quality}`)
    return 50  // 默认难度
  }
  const difficulty = qualityRow[grade]
  if (difficulty === undefined) {
    console.warn(`[getCraftingDifficulty] 未知品级: ${grade}`)
    return qualityRow['中品']  // 降级到中品
  }
  return difficulty
}

/**
 * 战斗难度 = 对手基础值
 * @param opponentBase 对手的基础值
 * @returns 战斗难度
 */
export function getCombatDifficulty(opponentBase: number): number {
  return opponentBase
}

/**
 * 逃跑难度 = 对手基础值 × 0.7
 * @param opponentBase 对手的基础值
 * @returns 逃跑难度
 */
export function getEscapeDifficulty(opponentBase: number): number {
  return Math.round(opponentBase * 0.7)
}

/**
 * 社交难度计算
 * @param baseDifficulty 基础社交难度（5-90，取决于对方地位和关系）
 * @param favorability 好感度（可选，每10点调整±5难度）
 * @param hasInterest 是否有利益诱惑（-10到-30）
 * @param hasThreat 是否有威胁恐吓（-20）
 * @param isHostile 是否完全对立（+30）
 * @returns 最终社交难度
 */
export function getSocialDifficulty(
  baseDifficulty: number,
  favorability?: number,
  hasInterest?: number,
  hasThreat?: boolean,
  isHostile?: boolean
): number {
  let difficulty = baseDifficulty
  if (favorability !== undefined) {
    difficulty += Math.round((50 - favorability) / 10) * 5
  }
  if (hasInterest) difficulty += hasInterest
  if (hasThreat) difficulty -= 20
  if (isHostile) difficulty += 30
  return Math.max(5, difficulty)
}

/**
 * 修炼难度 = 自己基础值 × 0.5
 * @param ownBase 自己的修炼基础值
 * @returns 修炼难度
 */
export function getCultivationDifficulty(ownBase: number): number {
  return Math.round(ownBase * 0.5)
}

/** 突破难度表：目标境界 → {小阶段突破，大境界突破} */
const BREAKTHROUGH_DIFFICULTY: Record<string, { small: number; major: number }> = {
  '练气': { small: 15, major: 25 },
  '筑基': { small: 22, major: 40 },
  '金丹': { small: 30, major: 60 },
  '元婴': { small: 40, major: 85 },
  '化神': { small: 52, major: 115 },
  '炼虚': { small: 65, major: 145 },
  '合体': { small: 80, major: 180 },
  '渡劫': { small: 98, major: 220 },
}

/**
 * 突破难度计算
 * @param targetRealm 目标境界名称
 * @param isMajor 是否是大境界突破（如练气→筑基）
 * @param conditionBonus 条件修正（丹药、秘法等，-40到+50）
 * @returns 突破难度
 */
export function getBreakthroughDifficulty(
  targetRealm: string,
  isMajor: boolean = false,
  conditionBonus: number = 0
): number {
  const config = BREAKTHROUGH_DIFFICULTY[targetRealm]
  if (!config) {
    console.warn(`[getBreakthroughDifficulty] 未知境界: ${targetRealm}`)
    return 50
  }
  const baseDifficulty = isMajor ? config.major : config.small
  return Math.max(10, baseDifficulty + conditionBonus)
}

/**
 * 探索/感知难度计算
 * @param targetType 探索目标类型（普通搜索、隐藏物品、破解阵法、感知NPC等）
 * @param targetLevel 目标等级（如阵法品质、NPC境界基础值）
 * @returns 探索难度
 */
export function getExploreDifficulty(targetType: '普通搜索' | '隐藏物品' | '破解阵法' | '感知NPC' | '洞悉宝物', targetLevel?: number | string): number {
  switch (targetType) {
    case '普通搜索':
      return 15
    case '隐藏物品':
      return 30
    case '破解阵法':
      if (typeof targetLevel === 'string') {
        const formationDifficulty: Record<string, number> = { '黄品': 25, '玄品': 45, '地品': 70, '天品': 100 }
        return formationDifficulty[targetLevel] || 45
      }
      return 45
    case '感知NPC':
      return typeof targetLevel === 'number' ? targetLevel : 20
    case '洞悉宝物':
      return typeof targetLevel === 'string' ? getCraftingDifficulty(targetLevel as QualityType) : 30
    default:
      return 25
  }
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function readSix(raw: unknown, fallback: number): SixSi {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  const read = (key: SixSiKey) => {
    if (!src || src[key] === undefined || src[key] === null || src[key] === '') return fallback
    return num(src[key], fallback)
  }
  return {
    根骨: read('根骨'),
    灵性: read('灵性'),
    悟性: read('悟性'),
    气运: read('气运'),
    魅力: read('魅力'),
    心性: read('心性'),
  }
}

/** 先天 70%，后天 30%。装备、功法、大道对六司的提升算在后天里。 */
export function effectiveAttribute(innate: number, acquired: number): number {
  return innate * 0.7 + acquired * 0.3
}

export function effectiveSix(innate: SixSi, acquired: SixSi): SixSi {
  return SIX_KEYS.reduce((acc, key) => {
    acc[key] = effectiveAttribute(innate[key], acquired[key])
    return acc
  }, {} as SixSi)
}

export function weightedAttribute(attrs: SixSi, [main, sub, aux]: [SixSiKey, SixSiKey, SixSiKey]): number {
  return attrs[main] * 0.5 + attrs[sub] * 0.3 + attrs[aux] * 0.2
}

export function realmJudgementBonus(realmName: string): number {
  const rank = realmRank(realmName)
  if (rank < 0) return 0
  if (rank < REALM_BONUS_BY_RANK.length) return REALM_BONUS_BY_RANK[rank]
  const last = REALM_BONUS_BY_RANK.length - 1
  return REALM_BONUS_BY_RANK[last] + (rank - last) * 12
}

/**
 * 计算境界压制后的实际基础值。
 * 当对低境界目标行动时，高境界修士的基础值会降低，避免"渡劫修士对凡人做事仍然很难"的问题。
 *
 * @param selfBase 自己的原始基础值
 * @param selfRealm 自己的境界名
 * @param targetRealm 目标的境界名（可选，无目标时不压制）
 * @param actionType 行动类型，用于判断是否需要压制
 * @returns 压制后的基础值
 */
export function realmSuppressionBase(
  selfBase: number,
  selfRealm: string,
  targetRealm?: string,
  actionType?: string
): number {
  // 无目标或无需压制的行动类型：保持原基础值
  if (!targetRealm) return selfBase

  // 修炼、突破类行动不压制（越高越难是合理的）
  if (actionType === '修炼' || actionType === '突破') return selfBase

  const selfRank = realmRank(selfRealm)
  const targetRank = realmRank(targetRealm)

  // 无法识别境界或目标更高：不压制
  if (selfRank < 0 || targetRank < 0 || selfRank <= targetRank) return selfBase

  const rankDiff = selfRank - targetRank

  // 每高一个大境界，基础值降低10点
  const suppression = rankDiff * 10

  // 但不能低于目标境界应有的基础值（避免过度压制）
  const targetBaseFloor = BASE_FLOOR + (targetRank < REALM_BONUS_BY_RANK.length ? REALM_BONUS_BY_RANK[targetRank] : 0)

  // 最终基础值 = 原基础值 - 压制，但不低于目标基础值
  return Math.max(targetBaseFloor, selfBase - suppression)
}

/**
 * 气运取有效值后限制在 0–10。区间随气运上移，均匀抽取：
 * 气运 0：-8～+6；气运 5：-6～+11；气运 10：-3～+16。
 */
export function luckyRange(fortune: number): { min: number; max: number } {
  const f = Math.min(10, Math.max(0, Math.round(fortune)))
  return {
    min: -8 + Math.floor(f * 0.5),
    max: 6 + f,
  }
}

export function rollLuckyPoints(fortune: number, random: () => number = Math.random): number {
  const { min, max } = luckyRange(fortune)
  const span = max - min + 1
  return min + Math.floor(random() * span)
}

export function environmentModifier(spiritDensity: number, kind: '修炼' | '炼制' | '战斗'): number {
  const density = num(spiritDensity, 50)
  const divisor = kind === '修炼' ? 10 : kind === '炼制' ? 15 : 20
  return Math.round((density - 50) / divisor)
}

function ratioOf(current: unknown, max: unknown): number | null {
  const cap = num(max, NaN)
  const now = num(current, NaN)
  if (!Number.isFinite(cap) || cap <= 0 || !Number.isFinite(now)) return null
  return now / cap
}

function effectSign(effect: unknown): number | null {
  if (!effect || typeof effect !== 'object') return null
  const kind = String((effect as { 类型?: unknown }).类型 || '').toLowerCase()
  if (kind === 'buff' || kind === '增益') return 1
  if (kind === 'debuff' || kind === '减益') return -1
  return null
}

/**
 * 气血、灵气、神识与增益/减益，合计限制在 -10～+15。
 * 伤病只取最重的一项，不叠加：受伤后减值叠满，下一次判定几乎必败，会一路输到死。
 */
export function statusModifier(attributes: unknown, effects: unknown): number {
  const attrs = attributes && typeof attributes === 'object' ? (attributes as Record<string, any>) : {}
  let injury = 0

  const hp = ratioOf(attrs.气血?.当前, attrs.气血?.上限)
  if (hp !== null) {
    if (hp < 0.25) injury = -6
    else if (hp < 0.5) injury = -3
  }
  const spirit = ratioOf(attrs.灵气?.当前, attrs.灵气?.上限)
  if (spirit !== null && spirit < 0.3) injury = Math.min(injury, -2)
  const sense = ratioOf(attrs.神识?.当前, attrs.神识?.上限)
  if (sense !== null && sense < 0.3) injury = Math.min(injury, -3)
  let mod = injury

  if (Array.isArray(effects)) {
    for (const effect of effects) {
      const sign = effectSign(effect)
      if (sign === null) continue
      const raw = num((effect as { 强度?: unknown }).强度, 2)
      const magnitude = Math.min(10, Math.max(1, Math.round(Math.abs(raw))))
      mod += sign * magnitude
    }
  }

  return Math.min(15, Math.max(-10, mod))
}

/** 结果分档：与难度+数值的差决定成败档位。 */
export function computeJudgementResult(finalValue: number, difficulty: number): string {
  if (finalValue >= difficulty + 15) return '完美'
  if (finalValue >= difficulty + 8) return '大成功'
  if (finalValue >= difficulty) return '成功'
  if (finalValue < difficulty - 12) return '大失败'
  return '失败'
}

function realmNameOf(attributes: unknown): string {
  const realm = attributes && typeof attributes === 'object' ? (attributes as { 境界?: unknown }).境界 : undefined
  if (typeof realm === 'string') return realm
  if (realm && typeof realm === 'object' && '名称' in realm) return String((realm as { 名称?: unknown }).名称 || '')
  return ''
}

/** 炼制门类 → 对应大道的名称关键字 */
const CRAFT_DAO_KEYWORDS: Record<string, string[]> = {
  炼丹: ['丹', '药', '医'],
  炼器: ['器', '铸', '锻'],
  制符: ['符'],
  布阵: ['阵'],
}

/** 炼制门类 → 无匹配大道时的失败提示 */
const CRAFT_DAO_HINT: Record<string, string> = {
  炼丹: '你没有丹道修为，强行炼丹几乎必败，可借此入丹道之门',
  炼器: '你没有器道修为，强行炼器几乎必败，可借此入器道之门',
  制符: '你没有符道修为，强行制符几乎必败，可借此入符道之门',
  布阵: '你没有阵道修为，强行布阵几乎必败，可借此入阵道之门',
}

/**
 * 查找与炼制门类匹配的大道，返回该大道的当前阶段；无匹配返回 -1。
 * 只认本门类的关键字，避免炼丹误用器道、更不会误用剑道。
 */
function findMatchingDaoStage(daoList: DaoStageInfo[], craftType: string): number {
  const keywords = CRAFT_DAO_KEYWORDS[craftType]
  if (!keywords) {
    console.warn(`[大道匹配] 未知炼制门类 "${craftType}"，无法匹配大道`)
    return -1
  }
  if (!daoList || daoList.length === 0) return -1

  // 取阶段最高的匹配大道（同一门类可能有多条相关大道）
  let best = -1
  for (const dao of daoList) {
    if (dao.是否解锁 === false) continue
    if (keywords.some((k) => dao.大道名.includes(k)) && dao.当前阶段 > best) {
      best = dao.当前阶段
    }
  }
  return best
}

export function buildJudgementRound(input: {
  先天六司?: unknown
  后天六司?: unknown
  属性?: unknown
  效果?: unknown
  灵气浓度?: unknown
  random?: () => number
  目标境界?: string  // 目标的境界名，用于境界压制
  大道?: unknown  // 新增：大道数据，用于炼制类加成
}): JudgementRound {
  const innate = readSix(input.先天六司, 5)
  const acquired = readSix(input.后天六司, 0)
  const attrs = effectiveSix(innate, acquired)
  const fortune = Math.min(10, Math.max(0, Math.round(attrs.气运)))
  const range = luckyRange(fortune)
  const realmName = realmNameOf(input.属性)
  const realmBonus = realmJudgementBonus(realmName)
  const density = num(input.灵气浓度, 50)

  // 提取大道信息用于提示词展示
  const daoInfoList: DaoStageInfo[] = []

  // 处理大道数据：支持数组格式和对象格式
  let daoList: unknown[] = []
  if (Array.isArray(input.大道)) {
    daoList = input.大道
  } else if (input.大道 && typeof input.大道 === 'object') {
    // 对象格式：{ 大道列表: { 丹道: {...}, 剑道: {...} } }
    const daoObj = input.大道 as Record<string, unknown>
    const list = daoObj['大道列表']
    if (list && typeof list === 'object' && !Array.isArray(list)) {
      // 大道列表是对象，提取所有大道
      daoList = Object.values(list)
    } else if (Array.isArray(list)) {
      daoList = list
    }
  }

  console.log('[判定系统] 提取大道数据，原始input.大道:', input.大道)
  console.log('[判定系统] 转换后的daoList:', daoList)

  for (const dao of daoList) {
    if (!dao || typeof dao !== 'object') continue
    const daoName = String((dao as { 道名?: unknown }).道名 || '')
    const stage = Number((dao as { 当前阶段?: unknown }).当前阶段 ?? 0)
    const unlocked = (dao as { 是否解锁?: unknown }).是否解锁
    const stageList = (dao as { 阶段列表?: unknown[] }).阶段列表
    const stageName = Array.isArray(stageList) && stageList[stage]
      ? String((stageList[stage] as { 名称?: unknown }).名称 || '')
      : ''
    if (daoName) {
      daoInfoList.push({
        大道名: daoName,
        当前阶段: stage,
        阶段名称: stageName,
        是否解锁: unlocked === undefined ? true : Boolean(unlocked),
      })
    }
  }

  const 分项: Record<string, JudgementBaseLine> = {}
  for (const [type, weights] of Object.entries(TYPE_WEIGHTS)) {
    if (type === '战斗') continue
    const weighted = Math.round(weightedAttribute(attrs, weights))

    // 炼制门类：基础值 = 对应大道阶段基础值 + 境界加成 × 0.3
    if (type in CRAFT_DAO_KEYWORDS) {
      const matchedStage = findMatchingDaoStage(daoInfoList, type)
      if (matchedStage >= 0) {
        const daoBase = getDaoStageBase(matchedStage)
        分项[type] = {
          属性加权: weighted,
          基础: Math.round(daoBase + realmBonus * 0.3),
          大道阶段: matchedStage,
        }
      } else {
        // 无对应大道：只有底子，几乎必败；提示词会引导 AI 在失败后解锁该大道
        分项[type] = {
          属性加权: weighted,
          基础: 5,
          炼制提示: CRAFT_DAO_HINT[type],
        }
      }
      continue
    }

    // 其他类型：基础值 = 底子 + 属性加权 + 境界加成
    const rawBase = BASE_FLOOR + weighted + realmBonus
    const actualBase = realmSuppressionBase(rawBase, realmName, input.目标境界, type)
    分项[type] = { 属性加权: weighted, 基础: actualBase }
  }

  return {
    幸运点: rollLuckyPoints(fortune, input.random),
    气运: fortune,
    幸运下限: range.min,
    幸运上限: range.max,
    状态修正: statusModifier(input.属性, input.效果),
    境界名: realmName || '未知',
    境界加成: realmBonus,
    环境: {
      灵气浓度: density,
      修炼: environmentModifier(density, '修炼'),
      炼制: environmentModifier(density, '炼制'),
      战斗: environmentModifier(density, '战斗'),
    },
    分项,
    目标境界: input.目标境界,
    大道信息: daoInfoList.length > 0 ? daoInfoList : undefined,
  }
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n)
}

const PROMPT_TYPES = ['战斗攻', '战斗防', '修炼', '突破', '炼丹', '炼器', '制符', '布阵', '探索', '社交', '逃跑', '感知'] as const

function environmentForType(type: string, round: JudgementRound): number {
  if (type === '修炼' || type === '突破') return round.环境.修炼
  if (type in CRAFT_DAO_KEYWORDS) return round.环境.炼制
  if (type === '战斗攻' || type === '战斗防') return round.环境.战斗
  return 0
}

/** 贴在玩家操作旁边。同数值的类型合并成一行。正常行事用简单，够到所选难度就必须写成功。 */
export function formatJudgementBlock(round: JudgementRound): string {
  // 按判定值分组（不再计算固定难度带）
  const groups = new Map<string, { types: string[]; base: number; env: number; value: number }>()
  const craftNotes: string[] = []
  for (const type of PROMPT_TYPES) {
    const line = round.分项[type]
    const env = environmentForType(type, round)
    const value = line.基础 + round.幸运点 + env + round.状态修正
    const key = `${line.基础}|${env}|${value}`
    const group = groups.get(key)
    if (group) group.types.push(type)
    else groups.set(key, { types: [type], base: line.基础, env, value })
    if (line.炼制提示) craftNotes.push(`- ${type}：${line.炼制提示}`)
  }
  const lines = [...groups.values()].map((group) => {
    return `- ${group.types.join('、')}: 判定值${group.value} (基础${group.base} + 环境${signed(group.env)} + 幸运${signed(round.幸运点)} + 状态${signed(round.状态修正)})`
  })

  // 大道阶段说明
  const daoNote = round.大道信息 && round.大道信息.length > 0
    ? `\n【大道修为】${round.大道信息.map(d => `${d.大道名}阶段${d.当前阶段}${d.阶段名称 ? '(' + d.阶段名称 + ')' : ''}`).join('、')}`
    : ''

  return `# 本回合判定（数值已掷好，禁止重算，禁止改结果）
境界：${round.境界名}。${daoNote}
判定值 ≥ 难度值 → 成功；判定值 ≥ 难度+8 → 大成功；判定值 ≥ 难度+15 → 完美。
判定值 < 难度-12 → 大失败；其他情况 → 失败。
${lines.join('\n')}
${craftNotes.length ? `\n【无对应大道】\n${craftNotes.join('\n')}` : ''}

【难度选择规则】
**战斗/逃跑**：难度 = 对手基础值（从对手数据获取）。逃跑难度 = 对手基础值 × 0.7
**炼丹/炼器/制符/布阵**：难度 = 物品品质品级固定值（见业务规则中的炼制难度表），按炼制方式乘系数后再加减其他因素
**社交**：难度 = 对方基础社交难度（5-90，取决于地位、立场、好感度）
**修炼**：难度 = 你的修炼基础值 × 0.5
**突破**：难度 = 目标境界标准值（小境界15-98，大境界25-220，见业务规则）
**探索/感知**：难度 = 目标隐藏等级（普通15，隐藏物30，阵法25-100）

具体难度值详见【业务规则】章节的各类型难度表。`
}
