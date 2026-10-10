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
  SPIRIT_ROOT_TIERS,
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
 * 把揉进灵根名里的品级词拆出来。
 * AI 会写出「太阴极品冰灵根·极品」这类名字（品级混在名字里，`formatSpiritRoot`
 * 会把整串当名字显示）。这里把品级词从名字里剥掉，并回填到品级字段。
 * 只比对 `SPIRIT_ROOT_TIERS`（7 个品级），不动「特殊」这类异变标记，
 * 也不会误伤「太阴」这类道名。
 * @returns 是否发生了纠正
 */
function stripTierFromSpiritRootName(root: any, who: string): boolean {
  const nameKey = (['名称', 'name'] as const).find((k) => typeof root[k] === 'string')
  if (!nameKey) return false
  const original = String(root[nameKey]).trim()
  if (!original) return false

  let name = original
  const found: string[] = []
  // ① 尾巴形式：「冰灵根·极品」「冰灵根（极品）」「冰灵根 极品」
  for (const t of SPIRIT_ROOT_TIERS) {
    const tail = new RegExp(`[\\s·・().,，、\\-—]${t}[)）]?$`)
    while (tail.test(name)) {
      found.push(t)
      name = name.replace(tail, '').trim()
    }
  }
  // ② 内嵌形式：「太阴极品冰灵根」
  for (const t of SPIRIT_ROOT_TIERS) {
    if (name.includes(t)) {
      found.push(t)
      name = name.split(t).join('')
    }
  }
  name = name.trim()
  if (!found.length || !name) return false

  const tierKey = (['品级', 'tier', '品阶'] as const).find((k) => k in root) || '品级'
  root[nameKey] = name
  if (!isValidSpiritRootTier(root[tierKey])) root[tierKey] = found[found.length - 1]
  diag.warn('值域·灵根', `${who}灵根名「${original}」混入了品级，已拆分为 名「${name}」/ 品级「${root[tierKey]}」`,
    `名字只写灵根本身（如"冰灵根"），品级另填；合法品级：${SPIRIT_ROOT_ALL_TIERS.join('/')}`)
  return true
}

/**
 * 纠正灵根品级与灵根名（就地修改 holder.灵根.品级 / .tier / .名称）
 * @returns 是否发生了纠正
 */
export function guardSpiritRootTier(holder: any, who = ''): boolean {
  const root = holder?.灵根
  if (!root || typeof root !== 'object') return false

  let changed = stripTierFromSpiritRootName(root, who)

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
    changed = true
    break
  }
  return changed
}

/** 功法技能里可能被 AI 自造的"名字"键（契约只有 技能名称） */
const TECHNIQUE_SKILL_NAME_ALIASES = ['技能名', '技能光华', '名称', 'name'] as const
/** 系统兜底生成的占位技能名：`${功法名}·招式N` */
const PLACEHOLDER_SKILL_NAME = /·招式\d+$/

/**
 * 纠正功法技能的名字字段（就地修改）。
 * AI 会把真名写在非契约键上（实测出现过 `技能光华`），导致契约键缺失、被兜底成
 * 「某某·招式1」；而 掌握技能 / 已解锁技能 都从 `技能名称` 派生，于是整条链都显示占位符。
 * @returns 是否发生了纠正
 */
export function guardTechniqueSkill(item: any, who = ''): boolean {
  if (!item || typeof item !== 'object') return false
  const skills = item.功法技能
  if (!Array.isArray(skills)) return false

  let changed = false
  for (const sk of skills) {
    if (!sk || typeof sk !== 'object') continue
    const aliasKey = TECHNIQUE_SKILL_NAME_ALIASES.find(
      (k) => typeof sk[k] === 'string' && String(sk[k]).trim(),
    )
    const current = typeof sk.技能名称 === 'string' ? sk.技能名称.trim() : ''
    const aliasName = aliasKey ? String(sk[aliasKey]).trim() : ''

    if (aliasName && (!current || PLACEHOLDER_SKILL_NAME.test(current))) {
      sk.技能名称 = aliasName
      diag.warn('值域·功法技能', `${who}功法「${item.名称 || ''}」的技能名取自非契约键「${aliasKey}」，已归一到 技能名称`,
        `技能名="${aliasName}"；契约键只有 技能名称/技能描述/熟练度要求/消耗`)
      changed = true
    }
    // 清掉自造键，避免下次再被当成真名
    for (const k of TECHNIQUE_SKILL_NAME_ALIASES) {
      if (k in sk) {
        delete sk[k]
        changed = true
      }
    }
  }
  return changed
}

/**
 * 无门无派的**凡人**，势力归属应写「凡人」而不是「散修」。
 * （「散修」的前提是有修为、只是没有门派；凡人没有修为，谈不上散修。）
 * 只在境界**明确是凡人**时才改，境界缺失时不猜。
 * @returns 是否发生了纠正
 */
export function guardNpcFactionAffiliation(npc: any, who = ''): boolean {
  if (!npc || typeof npc !== 'object') return false
  if (String(npc.势力归属 || '').trim() !== '散修') return false

  const realm = npc.境界
  const realmName = typeof realm === 'string' ? realm.trim() : (typeof realm?.名称 === 'string' ? realm.名称.trim() : '')
  if (realmName !== '凡人') return false

  npc.势力归属 = '凡人'
  diag.warn('值域·势力归属', `${who}是无门无派的凡人，「势力归属」由"散修"改为"凡人"`,
    '散修=有修为但无门无派；没有修为的凡人直接写"凡人"')
  return true
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
      if (!item || typeof item !== 'object') continue
      guardItemQuality(item, who)
      if (item.类型 === '功法') guardTechniqueSkill(item, who)
    }
  }

  const daoList = source.角色?.大道?.大道列表
  if (daoList) guardDaoStages(daoList, who)

  // NPC：无门无派的凡人，势力归属写"凡人"而非"散修"（玩家对象上没有该字段，天然跳过）
  guardNpcFactionAffiliation(source, who)

  // 功法装备标记
  guardTechniqueEquip(source, who)
}

/**
 * 校验势力里的修为字段（世界.信息.势力信息 的 领导层.宗主修为、主要成员[].境界）。
 * 这些地方历史上出现过"练气初圆满"这类非法阶段。
 */
export function guardFactionRealm(source: any, who = ''): boolean {
  const list = source?.世界?.信息?.势力信息
  if (!Array.isArray(list)) return false
  let changed = false
  for (const f of list) {
    const name = String(f?.名称 || '')
    const L = f?.领导层
    if (L && typeof L === 'object') {
      // 领导层里每个具名职位都应带修为，一并校验
      for (const field of ['宗主修为', '副宗主修为', '太上长老修为', '圣女修为', '圣子修为'] as const) {
        if (guardRealmValue(L, field, `${who}${name} `)) changed = true
      }
      // leadership（英文镜像字段）同步
      const mirror = f?.leadership
      if (mirror && typeof mirror === 'object' && typeof mirror.宗主修为 === 'string') {
        mirror.宗主修为 = L.宗主修为
      }
    }
    // 主要成员的名字/职位/境界
    const members = f?.主要成员
    if (Array.isArray(members)) {
      for (const m of members) {
        if (!m || typeof m !== 'object') continue
        if (typeof m.境界 === 'string' && m.境界) {
          guardRealmValue(m, '境界', `${who}${name}·${m.名字 || '成员'} `)
        }
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
