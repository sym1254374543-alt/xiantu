/**
 * 值域守卫（运行时兜底）
 *
 * AI 生成的数据可能落到值域之外（灵根品级写成"天品"、大道阶段列表不足6项、
 * 品质 grade 越界等）。本模块负责：
 * 1. 就地纠正能安全推断的（如物品品质当灵根品级 → 按位置映射）
 * 2. 不能纠正的记入诊断，交由界面展示（手机端看不到控制台）
 *
 * 值域定义见 utils/prompts/definitions/valueDomains.ts（唯一来源）。
 */

import {
  SPIRIT_ROOT_ALL_TIERS,
  ITEM_QUALITIES,
  DAO_STAGE_COUNT,
  REALMS,
  REALM_STAGES,
  isValidSpiritRootTier,
  isValidItemQuality,
} from '@/utils/prompts/definitions/valueDomains'
import { diag } from '@/utils/diagnostics'

/** 物品品质 → 灵根品级的位置映射（仅用于纠正误用；两套体系跨级不可按名对应） */
const QUALITY_TO_ROOT_TIER: Record<string, string> = {
  黄: '下品', 玄: '中品', 地: '上品', 天: '极品',
}
const QUALITY_TO_ROOT_TIER_PINYIN: Record<string, string> = {
  黄品: '下品', 玄品: '中品', 地品: '上品', 天品: '极品',
}

/**
 * 纠正灵根品级（就地修改 holder.灵根.品级 / .tier）
 * @returns 是否发生了纠正
 */
export function guardSpiritRootTier(holder: any, who = ''): boolean {
  const root = holder?.灵根
  if (!root || typeof root !== 'object') return false

  for (const key of ['品级', 'tier'] as const) {
    const raw = root[key]
    if (typeof raw !== 'string') continue
    const tier = raw.trim()
    if (!tier || isValidSpiritRootTier(tier)) continue

    // 单字形式（黄/玄/地/天）优先按位置映射；带"品"后缀的同理
    const bare = tier.replace(/品$/, '')
    const mapped =
      QUALITY_TO_ROOT_TIER_PINYIN[tier] ||
      QUALITY_TO_ROOT_TIER[bare] ||
      (ITEM_QUALITIES.includes(bare as any) ? '神品' : undefined)

    if (mapped) {
      root[key] = mapped
      diag.warn('值域·灵根', `${who}灵根品级「${tier}」是物品品质写法，已纠正为「${mapped}」`,
        `灵根名="${root.名称 || root.name || ''}"；合法值：${SPIRIT_ROOT_ALL_TIERS.join('/')}`)
    } else {
      root[key] = '中品'
      diag.warn('值域·灵根', `${who}灵根品级「${tier}」无法识别，已按「中品」兜底`,
        `合法值：${SPIRIT_ROOT_ALL_TIERS.join('/')}`)
    }
    return true
  }
  return false
}

/**
 * 校验物品品质（不改值，只报问题）
 */
export function guardItemQuality(item: any, who = ''): boolean {
  if (!item || typeof item !== 'object') return false
  const q = item?.品质
  if (!q || typeof q !== 'object') return false

  let ok = true
  if (q.quality !== undefined && !isValidItemQuality(q.quality)) {
    diag.warn('值域·品质', `${who}物品「${item.名称 || ''}」品质「${q.quality}」非法`,
      `合法值：${ITEM_QUALITIES.join('/')}`)
    ok = false
  }
  const g = Number(q.grade)
  if (q.grade !== undefined && (!Number.isInteger(g) || g < 0 || g > 10)) {
    diag.warn('值域·品质', `${who}物品「${item.名称 || ''}」品级「${q.grade}」越界（应为0-10）`)
    ok = false
  }
  return ok
}

/**
 * 校验并纠正境界写法（就地修改）。
 * 合法写法只有「大境界」或「大境界+小阶段」，如 练气 / 练气初期。
 * 曾出现"练气初圆满"这类由错误拼接产出的非法阶段（剥掉"期"字后直接加"圆满"），
 * 此处统一纠正：能识别大境界的，归一到「大境界圆满」。
 */
export function guardRealmValue(holder: any, field: string, who = ''): boolean {
  if (!holder || typeof holder !== 'object') return false
  const raw = holder[field]
  if (typeof raw !== 'string' || !raw.trim()) return false
  const t = raw.trim()

  // 合法：大境界名，或 大境界+小阶段
  if (REALMS.includes(t as any)) return false
  const big = REALMS.find((r) => t.startsWith(r))
  if (big) {
    const rest = t.slice(big.length)
    if (rest === '') return false
    if ((REALM_STAGES as readonly string[]).includes(rest)) return false
  }

  // 非法：能识别大境界则修正为「大境界圆满」，否则只报问题
  if (big) {
    holder[field] = `${big}圆满`
    diag.warn('值域·境界', `${who}${field}「${t}」不是合法阶段，已纠正为「${big}圆满」`,
      `合法写法：${REALMS.join('/')} 或 大境界+${REALM_STAGES.join('/')}`)
    return true
  }
  diag.warn('值域·境界', `${who}${field}「${t}」无法识别`, `合法写法：${REALMS.join('/')}`)
  return false
}

/**
 * 校验大道阶段列表（不改值，只报问题）
 * 大道阶段固定 6 个（下标 0-5），阶段列表不足会导致阶段名缺失。
 */
export function guardDaoStages(daoList: any, who = ''): boolean {
  if (!daoList || typeof daoList !== 'object') return false
  let ok = true
  for (const [name, dao] of Object.entries(daoList as Record<string, any>)) {
    const list = dao?.阶段列表
    if (!Array.isArray(list)) {
      diag.warn('值域·大道', `${who}大道「${name}」缺少阶段列表`)
      ok = false
      continue
    }
    if (list.length !== DAO_STAGE_COUNT) {
      diag.warn('值域·大道', `${who}大道「${name}」阶段列表 ${list.length} 项，应为 ${DAO_STAGE_COUNT} 项(0-5)`,
        '阶段列表缺项只影响阶段名展示；基础值以当前阶段为准')
      ok = false
    }
    const stage = Number(dao?.当前阶段)
    if (Number.isFinite(stage) && stage >= DAO_STAGE_COUNT) {
      diag.warn('值域·大道', `${who}大道「${name}」当前阶段 ${stage} 超出 ${DAO_STAGE_COUNT} 阶段上限(0-5)`)
      ok = false
    }
  }
  return ok
}

/**
 * 一次性校验某实体的全部值域（玩家存档或 NPC）
 * 会纠正灵根品级；其余只报问题。
 */
export function guardEntityDomains(source: any, who = ''): void {
  if (!source || typeof source !== 'object') return
  const identity = source.角色?.身份 ?? source

  guardSpiritRootTier(identity, who)

  // 境界对象的 名称/阶段 校验（NPC 与玩家同构）
  const realm = source.角色?.属性?.境界 ?? source.境界
  if (realm && typeof realm === 'object') {
    guardRealmValue(realm, '名称', who)
    guardRealmValue(realm, '阶段', who)
  }

  const bag = source.角色?.背包?.物品 ?? source.背包?.物品
  if (bag && typeof bag === 'object') {
    for (const item of Object.values(bag as Record<string, any>)) {
      if (item && typeof item === 'object') guardItemQuality(item, who)
    }
  }

  const daoList = source.角色?.大道?.大道列表
  if (daoList) guardDaoStages(daoList, who)

  // 功法装备标记
  guardTechniqueEquip(source, who)
}

/**
 * 校验势力领导层的修为字段（世界.信息.势力信息 里的 宗主修为/最强修为）。
 * 这两处历史上出现过"练气初圆满"这类非法阶段。
 */
export function guardFactionRealm(source: any, who = ''): boolean {
  const list = source?.世界?.信息?.势力信息
  if (!Array.isArray(list)) return false
  let changed = false
  for (const f of list) {
    const L = f?.领导层
    if (!L || typeof L !== 'object') continue
    const name = String(f?.名称 || '')
    for (const field of ['宗主修为', '最强修为']) {
      if (guardRealmValue(L, field, `${who}${name} `)) changed = true
      // leadership（英文镜像字段）同步
      const mirror = f?.leadership
      if (mirror && typeof mirror === 'object' && typeof mirror[field] === 'string') {
        mirror[field] = L[field]
      }
    }
  }
  return changed
}

/**
 * 校验功法装备标记：有功法物品但未标 已装备 时提示（能力计算会兜底取用，
 * 但标记缺失会让 AI 与界面显示的"修炼中"失真）。
 */
export function guardTechniqueEquip(source: any, who = ''): boolean {
  const bag = source.角色?.背包?.物品 ?? source.背包?.物品
  if (!bag || typeof bag !== 'object') return false
  const list = Object.values(bag as Record<string, any>).filter((i) => i?.类型 === '功法')
  if (list.length === 0) return false

  const tech = source.角色?.功法 ?? source.功法 ?? {}
  const hasMain = !!(tech.功法套装?.主修 || tech.当前功法ID)
  const hasEquipped = list.some((i) => i?.已装备 === true)
  if (!hasMain && !hasEquipped) {
    diag.warn('值域·功法', `${who}有 ${list.length} 部功法但未标记主修/已装备`,
      `建议补 set 背包.物品.{功法ID}.已装备=true 与 功法.功法套装.主修；否则界面不会显示"修炼中"`)
    return true
  }
  return false
}
