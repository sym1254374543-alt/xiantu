/**
 * 默认提示词集合 - 完整版
 *
 * 分类说明：
 * 1. 核心请求提示词 - 正常游戏请求时按顺序发送
 * 2. 总结请求提示词 - 记忆总结时使用
 * 3. 生成类提示词 - 世界/NPC/任务等生成
 * 4. 角色初始化提示词 - 创建角色时使用
 */
import { getSaveDataStructureForEnv } from '@/utils/prompts/definitions/dataDefinitions';
import { CHARACTER_INIT_TASK_PROMPT } from '@/utils/prompts/tasks/characterInitializationPrompts';
import { EnhancedWorldPromptBuilder } from '@/utils/worldGeneration/enhancedWorldPrompts';
import { promptStorage } from './promptStorage';
import { isTavernEnv } from '@/utils/tavern';
// 核心规则
import { JSON_OUTPUT_RULES, RESPONSE_FORMAT_RULES, DATA_STRUCTURE_STRICTNESS, NARRATIVE_PURITY_RULES } from '@/utils/prompts/definitions/coreRules';
// 业务规则
import {
  REALM_SYSTEM_RULES,
  THREE_THOUSAND_DAOS_RULES,
  LOCATION_UPDATE_RULES,
  COMMAND_PATH_CONSTRUCTION_RULES,
  TECHNIQUE_SYSTEM_RULES,
  CRAFTING_DIFFICULTY_RULES,
  PLAYER_AUTONOMY_RULES,
  RATIONALITY_AUDIT_RULES,
  PROFESSION_MASTERY_RULES,
  ANTI_SYCOPHANCY_RULES,
  JUDGMENT_TRACEABILITY_RULES,
  DUAL_REALM_NARRATIVE_RULES,
  DIFFICULTY_ENHANCEMENT_RULES,
  SECT_SYSTEM_RULES,
  COMBAT_ALCHEMY_RISK_RULES,
  CULTIVATION_PRACTICE_RULES,
  DAO_COMPREHENSION_RULES,
  CULTIVATION_SPEED_RULES,
  SIX_SI_ACQUISITION_RULES,
  SECT_DYNAMIC_GENERATION_RULES,
  COMBAT_TURN_BASED_RULES,
  NPC_RULES,
  GRAND_CONCEPT_CONSTRAINTS,
  SKILL_AND_SPELL_USAGE_RULES,
  ECONOMY_AND_PRICING_RULES,
  CULTIVATION_DETAIL_RULES
} from '@/utils/prompts/definitions/businessRules';
// 文本格式
import { TEXT_FORMAT_MARKERS, DICE_ROLLING_RULES, COMBAT_DAMAGE_RULES, NAMING_CONVENTIONS } from '@/utils/prompts/definitions/textFormats';
// 世界标准
import { REALM_ATTRIBUTE_STANDARDS, QUALITY_SYSTEM, REPUTATION_GUIDE } from '@/utils/prompts/definitions/worldStandards';
import { ACTION_OPTIONS_RULES } from '@/utils/prompts/definitions/actionOptions';
import { EVENT_SYSTEM_RULES } from '@/utils/prompts/definitions/eventSystemRules';
import { PLAYER_PERSONALITY_RULES } from '@/utils/prompts/definitions/playerPersonality';
import { NARRATIVE_PRESETS } from '@/data/stylePresets';
import { NPC_RELATION_NETWORK_RULES, NPC_RELATION_COMMANDS, NPC_FACTION_RULES } from '@/utils/prompts/definitions/npcRelationRules';

export interface PromptDefinition {
  name: string;
  content: string;
  category: string;
  description?: string;
  order?: number;
  weight?: number; // 权重 1-10，越高越重要
  condition?: 'onlineMode' | 'splitGeneration' | 'eventSystem' | 'always'; // 显示条件
  /** 默认是否启用（缺省为启用）；用户在提示词管理中手动切换后以用户设置为准 */
  defaultEnabled?: boolean;
}

/**
 * 提示词分类定义
 */
export const PROMPT_CATEGORIES = {
  style: {
    name: '文风与人设',
    description: '文风与主角性格，可选预设或自定义',
    icon: '文'
  },
  coreRequest: {
    name: '核心请求提示词',
    description: '正常游戏请求时按顺序发送的提示词',
    icon: '📨'
  },
  summary: {
    name: '总结请求提示词',
    description: '记忆总结时使用的提示词',
    icon: '📝'
  },
  initialization: {
    name: '开局初始化提示词',
    description: '开局时世界生成和角色初始化的提示词',
    icon: '🚀'
  },
  generation: {
    name: '动态生成提示词',
    description: '游戏中动态生成世界事件的提示词',
    icon: '🎨'
  }
};

// 合并核心输出规则
const CORE_OUTPUT_RULES = [JSON_OUTPUT_RULES, RESPONSE_FORMAT_RULES, DATA_STRUCTURE_STRICTNESS, NARRATIVE_PURITY_RULES].join('\n\n');

// 合并业务规则（每次请求都发送）
// 注：三千大道 / NPC / 大概念约束 / 技能法术 / 修炼细节 / 状态效果 / 位置更新 在 2026-01-07（fdcef06）
// 被移入「扩展规则」，而扩展规则当时并未接入请求，导致这些规则长期未发给 AI；现已恢复到核心。
const BUSINESS_RULES = [
  RATIONALITY_AUDIT_RULES,
  ANTI_SYCOPHANCY_RULES,
  JUDGMENT_TRACEABILITY_RULES,
  PROFESSION_MASTERY_RULES,
  DUAL_REALM_NARRATIVE_RULES,
  DIFFICULTY_ENHANCEMENT_RULES,
  REALM_SYSTEM_RULES,
  THREE_THOUSAND_DAOS_RULES,
  CRAFTING_DIFFICULTY_RULES,
  NPC_RULES,
  GRAND_CONCEPT_CONSTRAINTS,
  SKILL_AND_SPELL_USAGE_RULES,
  CULTIVATION_DETAIL_RULES,
  LOCATION_UPDATE_RULES,
  COMMAND_PATH_CONSTRUCTION_RULES,
  TECHNIQUE_SYSTEM_RULES,
  COMBAT_ALCHEMY_RISK_RULES,
  COMBAT_TURN_BASED_RULES,
  PLAYER_AUTONOMY_RULES
].join('\n\n');

// 扩展业务规则（默认关闭，可在提示词管理中开启；开启后随核心规则一起发送）
const EXTENDED_BUSINESS_RULES = [
  SECT_SYSTEM_RULES,
  SECT_DYNAMIC_GENERATION_RULES,
  CULTIVATION_PRACTICE_RULES,
  CULTIVATION_SPEED_RULES,
  DAO_COMPREHENSION_RULES,
  SIX_SI_ACQUISITION_RULES,
  NPC_RELATION_NETWORK_RULES,
  NPC_RELATION_COMMANDS,
  NPC_FACTION_RULES,
  ECONOMY_AND_PRICING_RULES
].join('\n\n');

// 合并文本格式规范
const TEXT_FORMAT_RULES = [TEXT_FORMAT_MARKERS, DICE_ROLLING_RULES, COMBAT_DAMAGE_RULES, NAMING_CONVENTIONS].join('\n\n');

// 合并世界观标准
const WORLD_STANDARDS = [REALM_ATTRIBUTE_STANDARDS, QUALITY_SYSTEM, REPUTATION_GUIDE].join('\n\n');

// ==================== 分步生成 / 总结 / 事件 / 润色 提示词正文 ====================

const SPLIT_GENERATION_STEP1_PROMPT = `
# 分步生成 1/2：只写正文

本步骤只负责叙事正文；数据指令、摘要与行动选项由第2步生成，这里不要输出。

## 输出格式
只输出一个JSON对象：{"text":"叙事正文"}
- 不要代码块，不要JSON前后的任何文字，不要 <thinking> 等标签
- 正文换行写 \\n，不要在字符串里直接回车

## 正文要求
1. 承接上文与玩家本次操作，只写本回合发生的事；不替玩家做决定
2. 字数：常规500-1000字；突破/大战/关键剧情可至1500字；战斗回合制每回合300-500字
3. 画面感：至少1个具体动作细节 + 1次人物互动（对话或NPC内心）；动作细节自然融入叙事，不要写成"动作细节一/二"
4. 标记：【环境】只在场景变化或必要时写1-2句；NPC内心用 \`...\`；对话用 ""；判定用 〔〕
5. 结尾留钩子，停在需要玩家回应的地方

## 判定
战斗/修炼/突破/炼制/探索/社交/逃跑等场景必须判定，格式与数值见后文[判定系统]：
〔类型:结果,判定值:X,难度:Y,基础:B,幸运:±L,环境:±E,状态:±S〕
- ✅ 〔修炼:成功,判定值:37,难度:30,基础:30,幸运:+5,环境:+2,状态:0〕（37=30+5+2+0；普通难度等于基础，不要写死35）
- ❌ 【当前状态】气血：95/100（【】只能写环境）
- ❌ 单独一行"系统提示：……"
战斗中每次攻防都判定，结果决定伤害与后果（大失败≈重伤，大成功≈重创对手）

## 禁止
- 输出 text 以外的字段（mid_term_memory / tavern_commands / action_options）
- 正文里出现指令、变量名或JSON路径
`.trim();

const SPLIT_GENERATION_STEP2_PROMPT = `
# 分步生成 2/2：只生成数据指令

输入包含【用户本次操作】与【第1步正文】。任务：把正文中已经发生的变化准确同步为存档指令。不要改写或续写剧情。

## 输出格式
只输出一个JSON对象：
{"mid_term_memory":"50-100字本回合摘要","tavern_commands":[{"action":"add","key":"元数据.时间.分钟","value":30}],"action_options":["选项1","选项2","选项3","选项4","选项5"]}
- 不要代码块，不要JSON前后的任何文字，不要 <thinking> 等标签，不要 text 字段
- 未启用行动选项时 action_options 输出 []
- 只用英文半角符号作JSON结构（" , : [ ] { }）；字符串内换行写 \\n

## key 规则
- 必须以 元数据./角色./社交./世界./系统. 开头
- {NPC名}/{道名}/{功法ID}/{物品ID}/{币种ID} 是占位符，输出时换成存档里的真实值，不保留括号
- 方括号只用于数组下标，如 角色.效果[0]
- 数值必须是数字，不能写成字符串

## 同步清单（逐项对照第1步正文：发生了才写，没发生的不写）
### 基础
□ 时间流逝 → add 元数据.时间.分钟（按正文实际耗时，每回合必有；修炼/闭关按实际时长）
□ 位置变化 → set 角色.位置 {描述,x,y,灵气浓度}
□ 货币变化 → add 角色.背包.货币.{币种ID}.数量
□ 物品增减 → 获得 set 完整物品对象 / 消耗 add 数量(负) / 用尽 delete
□ 声望变化 → add 角色.属性.声望

### 修炼与突破
□ 修炼 → add 角色.属性.境界.当前进度
□ 功法熟练 → add 角色.功法.功法进度.{功法ID}.熟练度；解锁技能 → push 角色.功法.功法进度.{功法ID}.已解锁技能
□ 悟道 → add 角色.大道.大道列表.{道名}.当前经验；首次领悟 → set 完整DaoData；升阶 → add 当前阶段 1
□ 小阶段突破 → set 角色.属性.境界.阶段（初期/中期/后期/圆满/极境）
□ 大境界突破 → set 角色.属性.境界.名称（凡人/练气/筑基/金丹/元婴/化神/炼虚/合体/渡劫）+ 阶段重置为"初期" + 按[境界属性标准]更新气血/灵气/神识/寿命上限
□ 渡劫（必须跨多回合）：开始时 push 角色.效果"渡劫中"；每道天雷 add 气血/灵气.当前(负)；成败都 push 社交.事件.事件记录

### 战斗与消耗（所有参与者都要更新）
□ 施法/出招 → add 角色.属性.灵气.当前（负，按[技能消耗]）；禁术折寿 → add 角色.属性.寿命.上限（负）
□ 玩家受伤 → add 角色.属性.气血.当前（负）；神识消耗 → add 角色.属性.神识.当前（负）
□ NPC受伤/消耗 → add 社交.关系.{NPC名}.属性.气血/灵气/神识.当前（负）
□ 状态效果 → push 角色.效果（中毒/重伤/虚弱等，含生成时间与持续时间分钟）

### NPC
□ 有名有姓、之后还会打交道的人物首次登场 → set 社交.关系.{NPC名}（完整NPCData对象）；路人不建档
□ 好感变化 → add 社交.关系.{NPC名}.好感度
□ 值得记住的互动 → push 社交.关系.{NPC名}.记忆
□ 心态/外貌/位置变化 → set 当前内心想法 / 当前外貌状态 / 当前位置
□ 境界变化 → set 社交.关系.{NPC名}.境界 {名称,阶段}，并同步属性上限

### 世界与宗门
□ 重大事件 → push 社交.事件.事件记录（记录标准见[世界事件系统]）
□ 宗门贡献 → add 社交.宗门.成员信息.贡献

## mid_term_memory
50-100字，概括本回合关键事实：人物、地点、事件、得失、境界变化；不写对话与修辞

## 实时关注NPC
名单内的NPC即使不在玩家身边，也要根据时间推移推演其动态，至少更新 当前内心想法
`.trim();

const SPLIT_INIT_STEP1_PROMPT = `
# 开局生成 1/2：只写开局叙事

## 输出格式
只输出一个JSON对象：{"text":"开局叙事正文"}
- 不要代码块，不要JSON前后的任何文字，不要 <thinking> 等标签
- 正文换行写 \\n
- 不要输出 mid_term_memory / tavern_commands / action_options（由第2步生成）

## 叙事要求
- 600-1000字，第三人称
- 结构：交代时间与地点 → 展现角色的出身与处境 → 结尾留悬念
- 严格贴合角色设定：年龄、出身、灵根、天赋都要对得上；言行符合年龄段，孩童不说老成话
- 画面感：1段简短【环境】(1-2句) + 2-3个可见动作细节 + 1-2轮对话（或1轮对话+1段NPC内心 \`...\`）；动作细节融入叙事，不要编号
- 标记：环境【】、NPC内心 \`...\`、对话 ""
- 不出现游戏术语与数据（"玩家""获得""装备了""等级提升"、各种数值）
- 修仙艰难：凡人开局不会在这段叙事里入道或突破，天才也只体现在悟性上而非速成
`.trim();

const SPLIT_INIT_STEP2_PROMPT = `
# 开局生成 2/2：初始化数据

输入包含【开局用户提示】（角色设定）与【第1步正文】。根据两者生成开局数据指令，内容必须与正文一致。

## 输出格式
只输出一个JSON对象：
{"mid_term_memory":"50-100字开局摘要","tavern_commands":[...],"action_options":["选项1","选项2","选项3","选项4","选项5"]}
- 不要代码块，不要JSON前后的任何文字，不要 <thinking> 等标签，不要 text 字段
- 开局阶段 tavern_commands 只用 set
- key 以 元数据./角色./社交./世界./系统. 开头；占位符换成真实名称；数值写数字
- 未启用行动选项时 action_options 输出 []

## 必须设置
□ 时间：set 元数据.时间 {年,月,日,小时,分钟}
□ 出生日期：set 角色.身份.出生日期 {年,月,日}，年 = 元数据.时间.年 - 角色年龄（与时间成对设置，漏设会导致年龄异常）
□ 位置：set 角色.位置 {描述,x,y,灵气浓度}，与正文地点一致，优先从可用地点中选；描述按[位置更新]的层级格式
□ 声望：set 角色.属性.声望（普通出身0-10｜宗门出身10-50｜名门出身50-100）
□ 资金：set 角色.背包.货币.灵石_下品 {"币种":"灵石_下品","名称":"下品灵石","数量":数字,"价值度":1}

## 视情况设置
□ 灵根/出身为"随机"时：set 角色.身份.灵根 / 角色.身份.出生 为具体内容
□ 正文中出现、之后还会打交道的重要人物（0-3个）：set 社交.关系.{NPC名}（完整NPCData对象；初始好感不宜过高，血亲除外）
□ 正文中持有或得到的物品：set 角色.背包.物品.{物品ID}（1-5件）
□ 天赋/出身直接关联某条大道时：set 角色.大道.大道列表.{道名}

## 初始资源上限
- 资金（折算下品灵石）：贫困/流浪 0-10｜普通 10-50｜修仙世家/宗门 100-300｜富裕/商贾 300-800
- 物品以凡品为主，禁止开局给地品及以上；功法0-2部，多数凡人开局没有功法
- 境界：绝大多数开局为凡人；只有修仙世家且年龄较大、或有特殊奇遇背景，才可为练气初期
`.trim();

const MEMORY_SUMMARY_PROMPT = `
# 记忆总结（中期记忆 → 长期记忆）
这是纯文本总结任务，不是续写剧情。把下方待总结记忆压缩为一段长期记忆。

## 要求
- 第一人称"我"（主角视角），按时间顺序，250-400字，连贯成段
- 保留：人名、地名、势力、关键事件与因果、物品得失、境界变化、重要承诺与恩怨
- 舍去：对话原文、情绪渲染、过程细节、重复信息
- 只依据待总结记忆；存档数据仅用于核对名称，不从中补充新情节

## 输出
只输出JSON，不要代码块或其他文字：{"text":"总结内容"}

## 待总结记忆
{{记忆内容}}
`.trim();

const EVENT_GENERATION_PROMPT = `
# 世界事件生成
生成一件"刚刚发生"的修仙世界事件，它会注入主线叙事并影响玩家。

## 要求
- 必须波及玩家：危险、资源、人际、所在地、修炼环境、势力格局，至少一项
- 类型从 宗门变动 / 世界变革 / 异宝降世 / 秘境现世 / 人物风波 中选
- 强度与玩家境界、声望、位置相称；涉及好友时参考其关系、好感与境界，不凭空超规格
- 写成现场快照（正在发生、刚刚发生），不要写成公告或总结
- 人名、地名优先取自下方状态；新出现的名字要合乎世界观

## 输出
只输出JSON，不要代码块、解释或其他文字：
{
  "event": {
    "事件名称": "4-12字",
    "事件类型": "宗门变动|世界变革|异宝降世|秘境现世|人物风波",
    "事件描述": "50-120字，事件的来龙去脉与影响",
    "影响等级": "轻微|中等|重大|灾难",
    "影响范围": "如：青云门一带 / 东荒全境",
    "相关人物": ["人名"],
    "相关势力": ["势力名"],
    "事件来源": "随机"
  },
  "prompt_addition": "80-200字，玩家能感知到的事件现场快照，将直接注入主线叙事"
}
`.trim();

const TEXT_OPTIMIZATION_PROMPT = `
# 文本润色
你是中文修仙小说编辑。对给定正文做润色与适度扩写，只输出润色后的正文。

## 必须保持
- 情节、人物行为、对话含义与先后顺序不变；不新增情节、人物、物品
- 〔...〕判定原样保留，一字不改；【】、\`...\`、"" 等标记继续使用且成对
- 视角与人称不变；不替主角增加内心独白

## 可以加强
- 动作、环境与感官（视听触嗅）细节，灵气运转、天地异象等修仙质感
- 对话的神态与语气，但不改台词原意
- 篇幅扩到原文的1.2-1.5倍左右，不压缩、不总结

## 输出
- 只输出正文本身：全部中文，不要标题、解释、JSON、Markdown
- 不要把"动作细节"写成编号或小标题
`.trim();

export function getSystemPrompts(): Record<string, PromptDefinition> {
  const tavernEnv = isTavernEnv();
  return {
    // ==================== 核心请求提示词（合并版） ====================
    coreOutputRules: {
      name: '1. 输出格式',
      content: CORE_OUTPUT_RULES,
      category: 'coreRequest',
      description: 'JSON格式、数据同步',
      order: 1,
      weight: 10
    },
    businessRules: {
      name: '2. 核心规则',
      content: BUSINESS_RULES,
      category: 'coreRequest',
      description: '境界、大道、NPC、位置、战斗等核心规则',
      order: 2,
      weight: 9
    },
    styleNarrative: {
      name: '文风',
      content: NARRATIVE_PRESETS[0].content,
      category: 'style',
      description: '语言格调、描写偏好与节奏。可选预设，也可自定义',
      order: 1,
      weight: 8
    },
    playerPersonality: {
      name: '主角性格',
      content: PLAYER_PERSONALITY_RULES,
      category: 'style',
      description: '主角行事倾向。可选预设，也可自定义',
      order: 2,
      weight: 6
    },
    extendedBusinessRules: {
      name: '2.5 扩展规则',
      content: EXTENDED_BUSINESS_RULES,
      category: 'coreRequest',
      description: '宗门、修炼速度、六司、NPC关系网、经济定价（默认关闭，开启后每次请求约多 3 千字）',
      order: 2.5,
      weight: 5,
      defaultEnabled: false
    },
    dataDefinitions: {
      name: '3. 数据结构',
      content: getSaveDataStructureForEnv(tavernEnv),
      category: 'coreRequest',
      description: '存档结构定义',
      order: 3,
      weight: 10
    },
    textFormatRules: {
      name: '4. 文本格式',
      content: TEXT_FORMAT_RULES,
      category: 'coreRequest',
      description: '判定、伤害、命名',
      order: 4,
      weight: 10
    },
    worldStandards: {
      name: '5. 世界标准',
      content: WORLD_STANDARDS,
      category: 'coreRequest',
      description: '境界属性、品质',
      order: 5,
      weight: 7
    },
    actionOptions: {
      name: '7. 行动选项',
      content: ACTION_OPTIONS_RULES,
      category: 'coreRequest',
      description: '生成玩家选项',
      order: 7,
      weight: 6
    },
    eventSystemRules: {
      name: '8. 世界事件',
      content: EVENT_SYSTEM_RULES,
      category: 'coreRequest',
      description: '世界事件演变与影响',
      order: 8,
      weight: 5,
      condition: 'eventSystem'
    },
    splitGenerationStep1: {
      name: '9. 分步正文',
      content: SPLIT_GENERATION_STEP1_PROMPT,
      category: 'coreRequest',
      description: '分步模式第1步',
      order: 9,
      weight: 7,
      condition: 'splitGeneration'
    },
    splitGenerationStep2: {
      name: '10. 分步指令',
      content: SPLIT_GENERATION_STEP2_PROMPT,
      category: 'coreRequest',
      description: '分步模式第2步',
      order: 10,
      weight: 7,
      condition: 'splitGeneration'
    },
    splitInitStep1: {
      name: '11. 开局正文',
      content: SPLIT_INIT_STEP1_PROMPT,
      category: 'coreRequest',
      description: '开局分步第1步',
      order: 11,
      weight: 7,
      condition: 'splitGeneration'
    },
    splitInitStep2: {
      name: '12. 开局指令',
      content: SPLIT_INIT_STEP2_PROMPT,
      category: 'coreRequest',
      description: '开局分步第2步',
      order: 12,
      weight: 7,
      condition: 'splitGeneration'
    },

    // ==================== 总结请求提示词 ====================
    memorySummary: {
      name: '记忆总结',
      content: MEMORY_SUMMARY_PROMPT,
      category: 'summary',
      description: '中期→长期记忆（{{记忆内容}} 处会填入待总结的记忆）',
      order: 1,
      weight: 6
    },

    // ==================== 动态生成提示词 ====================
    eventGeneration: {
      name: '事件生成',
      content: EVENT_GENERATION_PROMPT,
      category: 'generation',
      description: '动态生成世界事件',
      order: 2,
      weight: 5,
      condition: 'eventSystem'
    },

    // ==================== 开局初始化提示词 ====================
    worldGeneration: {
      name: '世界生成',
      content: EnhancedWorldPromptBuilder.buildPrompt({
        factionCount: 5,
        totalLocations: 10,
        secretRealms: 3,
        continentCount: 3
      }),
      category: 'initialization',
      description: '生成大陆、势力、地点',
      order: 1,
      weight: 8
    },
    characterInit: {
      name: '角色初始化',
      content: CHARACTER_INIT_TASK_PROMPT,
      category: 'initialization',
      description: '开局叙事与初始数据指令（酒馆端的法身要求会自动追加）',
      order: 2,
      weight: 9
    },

    // ==================== 文本优化提示词 ====================
    textOptimization: {
      name: '文本优化',
      content: TEXT_OPTIMIZATION_PROMPT,
      category: 'summary',
      description: '丰富润色AI生成的文本',
      order: 3,
      weight: 5
    }
  };
}

/**
 * 获取提示词（优先使用用户自定义的）
 * @param key 提示词键名
 * @returns 提示词内容（用户自定义 > 默认）
 */
export async function getPrompt(key: string): Promise<string> {
  return await promptStorage.get(key);
}
