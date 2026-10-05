/**
 * 值域总表（唯一来源）
 *
 * 游戏里多类数据有固定取值（灵根品级、物品品质、境界、大道阶段……）。
 * 这些值域此前散落在 业务规则/数据结构/元素生成器 等多个提示词文件里各写一份，
 * 出现过"三处三个版本"（如灵根倍率）与入口覆盖不全（初始化/事件生成没写灵根值域）的问题。
 *
 * 本文件是这些值域的唯一权威定义：
 * - 代码用 VALUE_DOMAINS 常量做校验/兜底（见 utils/valueGuard.ts）
 * - 提示词用 renderValueDomainsPrompt() 注入，各入口不再重复定义
 *
 * 修改值域时只改这里。
 */

// ─── 灵根 ────────────────────────────────────────────────
/** 灵根品级（7 个等级，由弱到强） */
export const SPIRIT_ROOT_TIERS = ['凡品', '下品', '中品', '上品', '极品', '仙品', '神品'] as const
/** 灵根异变标记（不是等级，倍率跨 0.5~1.8） */
export const SPIRIT_ROOT_SPECIAL = '特殊'
export const SPIRIT_ROOT_ALL_TIERS = [...SPIRIT_ROOT_TIERS, SPIRIT_ROOT_SPECIAL] as const

/** 灵根品级 → 修炼倍率参考值（与 data/creationData.ts 的 base_multiplier 对齐） */
export const SPIRIT_ROOT_MULTIPLIER: Record<string, number> = {
  凡品: 1.0, 下品: 1.1, 中品: 1.3, 上品: 1.6, 极品: 2.0, 仙品: 2.4, 神品: 2.8,
}

/** 灵根品级 → 资质加成比例（判定系统用，见 utils/abilityBonus.ts） */
export const SPIRIT_ROOT_BONUS: Record<string, number> = {
  凡品: 0, 下品: 0.02, 中品: 0.05, 上品: 0.10, 极品: 0.15, 仙品: 0.22, 神品: 0.40, 特殊: 0.05,
}

// ─── 物品 / 功法品质 ──────────────────────────────────────
/** 物品与功法品质（7 级，由弱到强） */
export const ITEM_QUALITIES = ['凡', '黄', '玄', '地', '天', '仙', '神'] as const
/** 品级数值区间：0 残缺；1-3 下品；4-6 中品；7-9 上品；10 极品 */
export const ITEM_GRADE_RANGES = [
  { range: '0', name: '残缺' },
  { range: '1-3', name: '下品' },
  { range: '4-6', name: '中品' },
  { range: '7-9', name: '上品' },
  { range: '10', name: '极品' },
] as const

// ─── 境界 ────────────────────────────────────────────────
/** 大境界（9 个，由低到高） */
export const REALMS = ['凡人', '练气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '渡劫'] as const
/** 小阶段（凡人无阶段） */
export const REALM_STAGES = ['初期', '中期', '后期', '圆满', '极境'] as const

// ─── 大道 ────────────────────────────────────────────────
/** 大道阶段总数（下标 0-5） */
export const DAO_STAGE_COUNT = 6
/** 大道阶段 → 可炼制的品质上限（上品难度） */
export const DAO_STAGE_QUALITY = ['凡品', '黄品', '玄品', '地品', '天品', '仙品'] as const

// ─── 天资 ────────────────────────────────────────────────
/** 天资稀有度范围 */
export const TALENT_TIER_RARITY = { min: 1, max: 10 } as const
/** 天资稀有度 → 资质加成比例 */
export function talentTierBonus(rarity: number): number {
  if (!Number.isFinite(rarity) || rarity <= 0) return 0
  const r = Math.min(TALENT_TIER_RARITY.max, Math.max(TALENT_TIER_RARITY.min, Math.round(rarity)))
  return (r - 1) * 0.03
}

// ─── 天赋效果 ────────────────────────────────────────────
/** 天赋效果类型 */
export const TALENT_EFFECT_TYPES = ['后天六司', '技能加成', '特殊能力'] as const
/** 「技能加成」可用的技能名 → 对应判定类型（见 utils/abilityBonus.ts） */
export const TALENT_SKILLS = ['剑法', '刀法', '拳法', '毒术', '炼丹', '炼器', '符箓', '阵法', '医术'] as const

// ─── 物品类型 ────────────────────────────────────────────
/** 背包物品类型（与 types/game.d.ts 的 ItemType 一致） */
export const ITEM_TYPES = ['装备', '功法', '丹药', '材料', '其他'] as const

// ─── 技能消耗 ────────────────────────────────────────────
/** 技能/法术只能消耗的资源名目（禁止 精力/体力/能量 等） */
export const SKILL_RESOURCES = ['灵气', '神识', '气血', '寿元'] as const

// ─── 势力 ────────────────────────────────────────────────
/**
 * 世界势力类型（AI 生成与档案存储统一用这一套）。仙凡融合：现代组织与古老道统并存。
 * 此前存在三套互不兼容的写法（SectType / WorldFaction.类型 / 生成提示词），已统一。
 */
export const FACTION_TYPES = [
  '官方机构', '财团企业', '家族世家', '研究所学院', '教团结社', '妖族',
  '修仙宗门',
] as const

/**
 * 开局即可出现（灵气复苏后新兴的现代组织，与已现形的妖族）。
 * 古老道统沉睡未醒，不可在开局登场。
 */
export const FACTION_TYPES_INITIAL = [
  '官方机构', '财团企业', '家族世家', '研究所学院', '教团结社', '妖族',
] as const

/**
 * 须在游戏过程中逐步复苏/现世（沉睡的古老道统）。
 * 起初至多是遗迹、传说、尚未苏醒的传承；随剧情推进才可能浮现。
 */
export const FACTION_TYPES_LATENT = ['修仙宗门'] as const

/** 势力等级 */
export const FACTION_LEVELS = ['超级', '一流', '二流', '三流'] as const
/** 势力与玩家关系 */
export const FACTION_RELATIONS = ['敌对', '中立', '友好'] as const

/**
 * 各势力类型的职位称谓（首领/副手/骨干/成员）。
 * 现代组织用现代职务，古老道统保留旧称——不要把"宗主/长老"套到财团上。
 */
export const FACTION_RANKS: Record<string, { 首领: string; 副手: string; 骨干: string; 成员: string }> = {
  官方机构: { 首领: '局长', 副手: '副局长', 骨干: '处长', 成员: '专员' },
  财团企业: { 首领: '董事长', 副手: '总裁', 骨干: '部门主管', 成员: '职员' },
  家族世家: { 首领: '家主', 副手: '长老', 骨干: '执事', 成员: '族人' },
  研究所学院: { 首领: '所长', 副手: '副所长', 骨干: '研究员', 成员: '助理研究员' },
  教团结社: { 首领: '教主', 副手: '护法', 骨干: '祭司', 成员: '信众' },
  妖族: { 首领: '妖王', 副手: '大妖', 骨干: '妖将', 成员: '小妖' },
  修仙宗门: { 首领: '宗主', 副手: '副宗主', 骨干: '长老', 成员: '弟子' },
}

// ─── 地点 ────────────────────────────────────────────────
/**
 * 地点类型（仙凡融合的现代地球用词）。
 * ⚠️这组值是**渲染契约**：gameMapManager 的配色与图形、WorldMapPage 的图例、
 * i18n 文案都按这些字面值匹配，改动必须六处同步，否则地图会掉色。
 * 顺序对应英文 key：natural_landmark/sect_power/city_town/blessed_land/treasure_land/dangerous_area/special_other
 */
export const LOCATION_TYPES = ['山川湖海', '势力据点', '城镇都市', '灵脉宝地', '异变区域', '凶险之地', '其他特殊'] as const
/** 地点安全等级（types/game.d.ts 定义，此前未在提示词中给出可选值） */
export const SAFETY_LEVELS = ['安全', '较安全', '危险', '极危险'] as const

// ─── 状态效果 ────────────────────────────────────────────
/** 状态效果类型（buff/debuff 用小写，见 utils/judgement.ts 的 effectSign） */
export const EFFECT_TYPES = ['buff', 'debuff'] as const

// ─── 消息/事件 ───────────────────────────────────────────
/** 世界事件类型 */
export const EVENT_TYPES = ['势力变动', '世界变革', '异宝降世', '秘境现世', '人物风波'] as const
/** 事件影响等级 */
export const EVENT_IMPACT_LEVELS = ['轻微', '中等', '重大', '灾难'] as const
/** 事件来源 */
export const EVENT_SOURCES = ['随机', '玩家影响', '系统'] as const

// ─── 功法 ────────────────────────────────────────────────
/** 功法装备标记写在哪（AI 漏写会导致功法不加成战力） */
export const TECHNIQUE_EQUIP_PATH = '背包.物品.{功法ID}.已装备 = true'
export const TECHNIQUE_MAIN_PATH = '功法.功法套装.主修 = {功法ID}'
export const TECHNIQUE_PROGRESS_PATH = '功法.功法进度.{功法ID}.熟练度 = 0-100'

// ─── 货币 ────────────────────────────────────────────────
/**
 * 货币体系：两套体系**互不兑换**（凡人不知灵石为何物）。
 * 价值度只在**体系内部**相对（灵石内 下品=1；现代货币内 人民币=1），
 * 不要给出任何跨体系汇率。
 */
export const CURRENCY_SYSTEMS: { 体系: string; 币种: string[]; 基准: string }[] = [
  { 体系: '灵石', 币种: ['下品灵石', '中品灵石', '上品灵石', '极品灵石'], 基准: '下品灵石=1' },
  { 体系: '现代货币', 币种: ['人民币', '美元', '欧元'], 基准: '人民币=1|美元≈7.2|欧元≈7.8' },
]

/** 灵根品级是否为合法值 */
export function isValidSpiritRootTier(tier: unknown): boolean {
  return typeof tier === 'string' && (SPIRIT_ROOT_ALL_TIERS as readonly string[]).includes(tier.trim())
}

/** 物品品质是否为合法值 */
export function isValidItemQuality(quality: unknown): boolean {
  return typeof quality === 'string' && (ITEM_QUALITIES as readonly string[]).includes(quality.trim())
}

/** 校验：返回问题描述数组，空数组表示合法 */
export function validateValueDomains(data: {
  灵根?: unknown
  品质?: unknown
  品级?: unknown
}): string[] {
  const problems: string[] = []
  if (data.灵根 !== undefined && !isValidSpiritRootTier(data.灵根)) {
    problems.push(`灵根品级「${data.灵根}」不在允许范围（${SPIRIT_ROOT_ALL_TIERS.join('/')}）`)
  }
  if (data.品质 !== undefined && !isValidItemQuality(data.品质)) {
    problems.push(`物品品质「${data.品质}」不在允许范围（${ITEM_QUALITIES.join('/')}）`)
  }
  if (data.品级 !== undefined) {
    const g = Number(data.品级)
    if (!Number.isInteger(g) || g < 0 || g > 10) problems.push(`物品品级「${data.品级}」应为 0-10 的整数`)
  }
  return problems
}

// ─── 提示词渲染 ──────────────────────────────────────────
/**
 * 渲染值域规范文本，供提示词注入。
 * 各入口（核心规则/初始化/元素生成/事件生成）统一引用本函数，不再各写一份。
 */
export function renderValueDomainsPrompt(): string {
  const rootTiers = SPIRIT_ROOT_TIERS.join(' < ')
  const rootMult = SPIRIT_ROOT_TIERS.map(t => `${t}${SPIRIT_ROOT_MULTIPLIER[t]}`).join('|')
  return `
[值域规范](唯一来源,所有生成场景通用:开局、剧情、NPC、事件、元素生成器)
⚠️以下字段只能取规定值，写错会导致系统无法识别、颜色/加成丢失。

[灵根品级]7个等级:${rootTiers};另有"特殊"(异变标记,非等级,如天妒之体)
 修炼倍率参考:${rootMult}
 灵根名与品级分开写:名字写"金灵根""混沌灵根",品级另填
 ❌禁止把物品品质当灵根品级:没有"黄品灵根""地品灵根""天品灵根"
 分布参考:凡人~练气多凡品~中品;筑基~金丹多中品~上品;元婴多极品;仙品/神品极罕,一个大陆不应扎堆

[物品/功法品质]7个等级:${ITEM_QUALITIES.join(' < ')};品级取0-10整数(${ITEM_GRADE_RANGES.map(g => `${g.range}=${g.name}`).join(',')})
 写法:{"quality":"玄","grade":5} 表示玄品中品

[境界]9个大境界:${REALMS.join('→')};小阶段:${REALM_STAGES.join('→')}
 凡人没有小阶段(只写"凡人");禁止"练气一层"这类层数写法
 突破只能是凡人→练气初期,或进入下一小阶段/大境界初期;不存在"突破到凡人中期"

[大道]阶段固定${DAO_STAGE_COUNT}个(下标0-5),阶段列表必须写满${DAO_STAGE_COUNT}项
 阶段名贴合该道意境且各道互不雷同(如丹道:辨药/控火/凝丹/丹纹/丹心/丹成九转)
 阶段与炼制能力:${DAO_STAGE_QUALITY.map((q, i) => `阶${i}→${q}`).join('|')}
 升阶用 add 当前阶段 +1;阶段名以该道自己的阶段列表为准

[天资]稀有度取 ${TALENT_TIER_RARITY.min}-${TALENT_TIER_RARITY.max} 整数

[天赋效果]类型只能是:${TALENT_EFFECT_TYPES.join('|')}
 后天六司:{"类型":"后天六司","目标":"根骨","数值":3}
 技能加成:{"类型":"技能加成","技能":"剑法","数值":0.2}  (技能∈${TALENT_SKILLS.join('/')},数值为比例)
 特殊能力:{"类型":"特殊能力","名称":"逢凶化吉","数值":0.1}

[功法装备]新建功法必须同时写全三处,缺任一项该功法都不加战力:
 ${TECHNIQUE_EQUIP_PATH}
 ${TECHNIQUE_MAIN_PATH}
 ${TECHNIQUE_PROGRESS_PATH}
 非主修功法放背包内 已装备=false 即可;一个角色只 equip 一本主修

[物品类型]只能是:${ITEM_TYPES.join('|')}

[技能消耗]资源名只能是:${SKILL_RESOURCES.map(r => r === '寿元' ? '寿元(禁术,写"寿元5年")' : r).join('|')}
 写成百分比如"灵气15%";❌禁止精力/体力/能量等其他名目

[势力]类型:${FACTION_TYPES.join('|')};等级:${FACTION_LEVELS.join('|')};与玩家关系:${FACTION_RELATIONS.join('|')}
 开局可生成(新兴):${FACTION_TYPES_INITIAL.join('|')}
 须游戏中复苏(古老道统沉睡未醒,不可开局登场):${FACTION_TYPES_LATENT.join('|')}
 职位按类型区分(不要把宗主/长老套到财团):
${Object.entries(FACTION_RANKS).map(([t, r]) => `  ${t}: 首领=${r.首领}|副手=${r.副手}|骨干=${r.骨干}|成员=${r.成员}`).join('\n')}

[地点]类型:${LOCATION_TYPES.join('|')}(「势力据点」用于地图上直接标注的势力所在地)
 安全等级:${SAFETY_LEVELS.join('|')}

[状态效果]类型只能是:${EFFECT_TYPES.join('|')}(小写);强度为数字

[世界事件]类型:${EVENT_TYPES.join('|')};影响等级:${EVENT_IMPACT_LEVELS.join('|')};来源:${EVENT_SOURCES.join('|')}

[货币]⚠️两套体系互不兑换,禁止给出跨体系汇率:
${CURRENCY_SYSTEMS.map(s => ` ${s.体系}:${s.币种.join('/')}(${s.基准})`).join('\n')}
 凡人不知灵石为何物;修士也极少用现代货币交易。两套体系各标各价,不要换算。
 币种字段是 CurrencyAsset:{币种,名称,数量,价值度,描述?,图标?} —— 没有"单位"字段
`.trim()
}
