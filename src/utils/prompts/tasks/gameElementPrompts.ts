/**
 * 游戏元素生成提示词
 *
 * 【职责】
 * - 定义世界、天资、出身、灵根、天赋、功法等游戏元素的生成规则
 * - 字段名与角色创建各步骤（Step1~Step5）的解析逻辑保持一致
 *
 * 【设计原则】
 * - 专注于生成逻辑和字段定义
 * - 通用格式规则集中在 BASE_INSTRUCTION
 */


// 基础指令
const BASE_INSTRUCTION = `你是世界观内容生成器：根据用户描述的主题，生成一条可直接使用的游戏数据。

【风格】
- 严格遵循用户的要求与世界设定；用户指定了特定风格（武侠、科幻、现代等）时完全照该风格来
- 修仙/超凡体系只是背景，不预设剧情走向
- 名称与描述要具体、有辨识度，避免"天命之子""无上至尊"之类的空泛套话

【值域】
字段取值必须落在[值域规范]内（灵根品级7级、物品品质7级、境界9级、大道6阶段等）。
该规范是唯一来源；下方【字段】只补充本任务特有的写法，不得违反。

【输出】
- 只输出一个 JSON 对象，不要代码块、解释、确认语（如"明白了""收到"）或 <thinking> 标签
- 字段名严格使用下方给定的英文键名
- 数值字段必须是数字类型，不要写成字符串
`;

// 1. 世界生成
export const IMPROVED_WORLD_GENERATION_PROMPT = `${BASE_INSTRUCTION}

【任务】生成世界设定

【字段】
- name (字符串): 世界名称，2-6字
- era (字符串): 时代背景，5-10字，如"灵气复苏第三纪"
- description (字符串): 200-400字，写清世界格局、力量体系、主要矛盾与氛围

【示例结构】
{"name":"…","era":"…","description":"…"}
`;

// 2. 天资等级
export const IMPROVED_TALENT_TIER_PROMPT = `${BASE_INSTRUCTION}

【任务】生成天资等级（决定角色创建时可用的天道点总数）

【字段】
- name (字符串): 天资名称，2-6字
- description (字符串): 50-150字
- total_points (数字): 天道点总数，10-50；越稀有点数越高
- rarity (数字): 稀有度，1-10，数值越高越稀有
- color (字符串): 十六进制颜色，如 "#8B5CF6"，稀有度越高颜色越醒目

【示例结构】
{"name":"…","description":"…","total_points":20,"rarity":3,"color":"#4F9DDE"}
`;

// 3. 出身背景
export const IMPROVED_ORIGIN_PROMPT = `${BASE_INSTRUCTION}

【任务】生成出身背景

【字段】
- name (字符串): 出身名称，4-6字
- description (字符串): 100-300字的背景故事
- talent_cost (数字): 消耗天道点，0-10 的整数（出身越优越越贵）
- rarity (数字): 稀有度，1-10 的整数
- attribute_modifiers (对象): 先天六司修正，键只能是 根骨/灵性/悟性/气运/魅力/心性，值为整数，总和不超过 5，可有负值体现代价
- background_effects (数组): 1-2 个背景效果，每个为 {"type":"效果类别","description":"效果说明"}

【输出示例】
{
  "name": "山野遗孤",
  "description": "自幼流落山野，与野兽为伴，练就了一身野性与求生本能……",
  "talent_cost": 2,
  "rarity": 3,
  "attribute_modifiers": {"根骨": 2, "灵性": -1, "悟性": 0, "气运": 1, "魅力": -1, "心性": 1},
  "background_effects": [
    {"type": "野性直觉", "description": "在山林荒野中感知更敏锐"},
    {"type": "兽语通晓", "description": "能与低阶灵兽粗浅沟通"}
  ]
}
`;

// 4. 灵根类型
export const IMPROVED_SPIRIT_ROOT_PROMPT = `${BASE_INSTRUCTION}

【任务】生成灵根（或该世界中对应的核心资质，如血统、体质）

【字段】
- name (字符串): 灵根名称，不含品级前缀（写"雷灵根"，不写"上品雷灵根"）
- tier (字符串): 品级，只能是 凡品/下品/中品/上品/极品/仙品/神品 之一
- description (字符串): 50-200字
- cultivation_speed (字符串): 修炼速度描述，格式"数字x"，与 base_multiplier 一致
- base_multiplier (数字): 修炼倍率，参考 凡品1.0｜下品1.1｜中品1.3｜上品1.6｜极品2.0｜仙品2.4｜神品2.8
- special_effects (数组): 1-3 个特殊效果（字符串）
- talent_cost (数字): 消耗天道点，参考 凡品0｜下品3｜中品6｜上品10｜极品15｜仙品20｜神品25
- rarity (数字): 稀有度，1-10 的整数

【输出示例】
{
  "name": "雷灵根",
  "tier": "上品",
  "description": "天生亲和雷霆之力，修炼雷法事半功倍，刚猛霸道……",
  "cultivation_speed": "1.6x",
  "base_multiplier": 1.6,
  "special_effects": ["雷法威力提升", "对雷属性伤害有抗性"],
  "talent_cost": 10,
  "rarity": 6
}
`;

// 5. 天赋
export const IMPROVED_TALENT_PROMPT = `${BASE_INSTRUCTION}

【任务】生成先天天赋

【字段】
- name (字符串): 天赋名称，4-6字
- description (字符串): 30-100字，写清效果与适用场景
- talent_cost (数字): 消耗天道点，1-10 的整数，效果越强越贵
- rarity (数字): 稀有度，1-10 的整数

【输出示例】
{"name":"过目不忘","description":"天生记忆超群，功法、阵图看过一遍便能记住，参悟典籍更快","talent_cost":3,"rarity":4}
`;

// 6. 功法
export const IMPROVED_TECHNIQUE_PROMPT = `${BASE_INSTRUCTION}

【任务】生成功法（本任务字段使用中文键名，与游戏物品结构一致）

【字段】
- 物品ID (字符串): "gongfa_" + 时间戳或拼音，唯一
- 名称 (字符串): 2-8字
- 类型 (字符串): 固定"功法"
- 品质 (对象): {"quality":"凡|黄|玄|地|天|仙|神","grade":0-10}
- 数量 (数字): 固定 1
- 描述 (字符串): 100-300字
- 功法效果 (字符串): 修炼加成与特殊能力的简述
- 功法技能 (数组): 2-5 个 {"技能名称","技能描述","熟练度要求","消耗"}，第一个的熟练度要求为 0，其余递增（0-100）
- 修炼进度 (数字): 0
- 已装备 (布尔): false

【品质】
- 默认凡品或黄品；剧情明确需要珍贵功法时才用玄品
- 地品及以上只在"上古遗迹"等特殊剧情出现；神品禁止生成
- "引气诀"这类基础功法名必须对应凡/黄品

【技能消耗】
- 只能用 灵气/神识/气血/寿元，写成百分比如"灵气15%"，寿元写"寿元5年"；禁止"精力/体力/能量"等其他资源
- 示例：[{"技能名称":"基础剑气","技能描述":"凝聚灵力化作剑气攻敌","熟练度要求":0,"消耗":"灵气8%"},{"技能名称":"御剑术","技能描述":"以神识御使飞剑","熟练度要求":30,"消耗":"灵气12%+神识5%"}]
`;

// 导出所有优化的提示词
export const IMPROVED_PROMPTS = {
  WORLD: IMPROVED_WORLD_GENERATION_PROMPT,
  TALENT_TIER: IMPROVED_TALENT_TIER_PROMPT,
  ORIGIN: IMPROVED_ORIGIN_PROMPT,
  SPIRIT_ROOT: IMPROVED_SPIRIT_ROOT_PROMPT,
  TALENT: IMPROVED_TALENT_PROMPT,
  TECHNIQUE: IMPROVED_TECHNIQUE_PROMPT,
};

// 向后兼容的导出（使用旧名称）
export const WORLD_ITEM_GENERATION_PROMPT = IMPROVED_WORLD_GENERATION_PROMPT;
export const TALENT_TIER_ITEM_GENERATION_PROMPT = IMPROVED_TALENT_TIER_PROMPT;
export const ORIGIN_ITEM_GENERATION_PROMPT = IMPROVED_ORIGIN_PROMPT;
export const SPIRIT_ROOT_ITEM_GENERATION_PROMPT = IMPROVED_SPIRIT_ROOT_PROMPT;
export const TALENT_ITEM_GENERATION_PROMPT = IMPROVED_TALENT_PROMPT;
export const TECHNIQUE_ITEM_GENERATION_PROMPT = IMPROVED_TECHNIQUE_PROMPT;
