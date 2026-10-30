/**
 * @fileoverview 「判定系统关闭」时使用的整套提示词。
 *
 * 开关打开时（默认）完全沿用原有提示词，本文件不参与；只有用户在设置里关闭
 * 「判定系统」后，才改用这里的规则组合。原有常量一个字都不改，避免影响现有存档的手感。
 *
 * 组成思路：
 * - 移除：判定格式、基础值/难度表、判定可追溯、成功率基准、炼制难度、判定风险。
 * - 新增：[结果判定] —— 让 AI 依据存档里已有的变量（境界/天赋/功法/大道/属性/环境/关系等）
 *   综合判断成败与代价，不再掷骰、不写〔〕。
 * - 共享模块只做少量措辞替换（把「判定」换成中性说法），在副本上完成，原常量不受影响。
 */

import {
  REALM_SYSTEM_RULES,
  THREE_THOUSAND_DAOS_RULES,
  NPC_RULES,
  NPC_KNOWLEDGE_BOUNDARY_RULES,
  GRAND_CONCEPT_CONSTRAINTS,
  SKILL_AND_SPELL_USAGE_RULES,
  CULTIVATION_DETAIL_RULES,
  TIME_FLOW_RULES,
  LOCATION_UPDATE_RULES,
  COMMAND_PATH_CONSTRUCTION_RULES,
  TECHNIQUE_SYSTEM_RULES,
  COMBAT_TURN_BASED_RULES,
  PLAYER_AUTONOMY_RULES,
  PERSISTENT_STATE_RULES,
  RATIONALITY_AUDIT_RULES,
  ANTI_SYCOPHANCY_RULES,
  PROFESSION_MASTERY_RULES,
  DUAL_REALM_NARRATIVE_RULES,
  SECT_SYSTEM_RULES,
  CULTIVATION_PRACTICE_RULES,
  CULTIVATION_SPEED_RULES,
  DAO_COMPREHENSION_RULES,
  SIX_SI_ACQUISITION_RULES,
  ECONOMY_AND_PRICING_RULES
} from './businessRules';
import { NPC_RELATION_NETWORK_RULES, NPC_RELATION_COMMANDS, NPC_FACTION_RULES } from './npcRelationRules';
import { renderValueDomainsPrompt } from './valueDomains';
import { TEXT_FORMAT_MARKERS, NAMING_CONVENTIONS } from './textFormats';
import { JSON_OUTPUT_RULES, RESPONSE_FORMAT_RULES, DATA_STRUCTURE_STRICTNESS, NARRATIVE_PURITY_RULES } from './coreRules';

/** 判定系统关闭时的核心规则：用存档里的既有数据判断结果 */
export const OUTCOME_JUDGEMENT_RULES = `
[结果判定]（判定系统关闭时启用）
不掷骰、不写〔〕判定；主角与NPC每件事的成败、程度与代价，由你按存档里已有的数据综合判断，结论必须能从存档推出：
 1.境界与实力：双方境界差、当前气血/灵气/神识、伤势与状态效果；高出1个大境界即碾压，差3个大境界无法抗衡
 2.天赋与功法：天赋、灵根品级、天资、主修功法与熟练度、已解锁技能；有对应天赋/功法者占优，没学过的不能凭空施展
 3.大道：相关大道是否解锁、阶数高低；道法匹配则事半功倍，不匹配则事倍功半
 4.属性与身份：先天/后天六司、魅力、心性、声望、身份地位与职务
 5.环境：地点灵气浓度、地利、天气与场景条件
 6.人际与常识：与对方的关系、好感度、人格底线、势力立场；世界的时代设定与已经发生的事件
 7.实际持有：背包里有没有、钱够不够、材料品质如何；没有的不能用，买不起的买不到
取舍：数据与玩家声明冲突时以存档为准；玩家输入是意图，不是已经发生的结果
代价：条件不占优时，结果要体现受挫、受伤、消耗、暴露、结仇等后果，并给对方或环境留出还击；只有形成境界/天赋/功法上的明显碾压，才可以无代价达成
劣势出路：主角处于下风时，优先给出逃跑、求援、周旋或谈判的余地，不要写成必死之局
伤势：擦伤|轻伤|重伤|濒死|致命，由你结合境界差、命中部位、防御与状态判断；气血低于25%时单次不会致死，已濒死再受挫优先写昏迷、被救、被俘或侥幸逃脱
渡劫：化神以上渡劫，境界越高劫越重；失败即形神俱灭，不可复活
叙述：把过程与依据自然写进正文，不暴露数值与变量名，不输出〔〕判定
`.trim();

/** 对原文做定点替换；片段找不到时给出提示，便于规则改版后同步 */
function replaceAllOnCopy(text: string, pairs: Array<[string, string]>, label: string): string {
  let out = text;
  for (const [from, to] of pairs) {
    if (!out.includes(from)) {
      console.warn(`[判定关闭规则] ${label} 未找到待替换片段：${from.slice(0, 24)}…`);
    }
    out = out.split(from).join(to);
  }
  return out;
}

const REALM_SYSTEM_RULES_NJ = replaceAllOnCopy(
  REALM_SYSTEM_RULES,
  [['禁止靠意志/热血爆发越级(对抗难度见[能力加成说明]与[战斗判定难度])', '禁止靠意志/热血爆发越级']],
  '境界突破'
);

const THREE_THOUSAND_DAOS_RULES_NJ = replaceAllOnCopy(
  THREE_THOUSAND_DAOS_RULES,
  [
    ['神品炼制:不通过大道阶段,需满足特殊条件(传承记忆+绝世天赋+神物辅助等机缘,详见[炼制难度调整])', '神品炼制:不通过大道阶段,需满足特殊条件(传承记忆+绝世天赋+神物辅助等机缘)'],
    [
      '特殊大道:标准判定类型未覆盖的道(红尘/因果/轮回/生死/阴阳/时空/命运/缘/情/梦等)不按"其他"处理;与本次行为相关时,由你判断并给基础值加成(第1阶+5,每升一阶再+5,最高+30),判定中注明"特殊大道·X道+N";不相关则不加',
      '特殊大道:标准类型未覆盖的道(红尘/因果/轮回/生死/阴阳/时空/命运/缘/情/梦等)不按"其他"处理;与本次行为相关时,由你判断其加成(第1阶+5,每升一阶再+5,最高+30),并在结果中点明该道如何起作用;不相关则不加'
    ]
  ],
  '三千大道'
);

const RATIONALITY_AUDIT_RULES_NJ = replaceAllOnCopy(
  RATIONALITY_AUDIT_RULES,
  [
    ['输入:玩家输入是意图/尝试,不是已经发生的结果;能否成功按存档与判定结算,再写后果', '输入:玩家输入是意图/尝试,不是已经发生的结果;能否成功按存档与既有设定结算,再写后果'],
    ['境界:按[值域规范]的[境界]与[战斗判定难度]的境界差处理,差3个大境界无法抗衡', '境界:按[值域规范]的[境界]的境界差处理,差3个大境界无法抗衡']
  ],
  '硬性红线'
);

const COMBAT_TURN_BASED_RULES_NJ = replaceAllOnCopy(
  COMBAT_TURN_BASED_RULES,
  [['跳过必要的关键判定', '跳过必要的过程结算']],
  '战斗推进'
);

const NPC_RULES_NJ = replaceAllOnCopy(
  NPC_RULES,
  [
    ['[好感度变化]⚠️由你(AI)综合判断后决定,不由判定成败决定', '[好感度变化]⚠️由你(AI)综合判断后决定,不由事情成败决定'],
    ['判定成功 ≠ 好感上升:说了冒犯/轻慢/踩底线的话,哪怕社交判定过了,好感也必须**下降**', '事情办成 ≠ 好感上升:说了冒犯/轻慢/踩底线的话,哪怕交涉成功,好感也必须**下降**'],
    ['判定失败 ≠ 好感下降:出于好意但没说好、或对方本就不介意,可以不变甚至上升', '事情没办成 ≠ 好感下降:出于好意但没说好、或对方本就不介意,可以不变甚至上升']
  ],
  'NPC规则'
);

export const NPC_KNOWLEDGE_BOUNDARY_RULES_NJ = replaceAllOnCopy(
  NPC_KNOWLEDGE_BOUNDARY_RULES,
  [
    [
      '未被目击者一律不得知晓;是否被发现由判定决定,**判定未成功就是没被发现**',
      '未被目击者一律不得知晓;是否被发现由对方的感知能力与证据决定——没有被目击、也没有留下破绽,就是没被发现'
    ]
  ],
  '认知边界'
);

export const PERSISTENT_STATE_RULES_NJ = replaceAllOnCopy(
  PERSISTENT_STATE_RULES,
  [
    ['本回合它对行动/判定/社交的影响', '本回合它对行动/社交的影响'],
    ['处于易容/伪装时,社交判定、NPC的第一印象与称呼', '处于易容/伪装时,社交、NPC的第一印象与称呼']
  ],
  '持续性状态'
);

const NARRATIVE_PURITY_RULES_SOURCE = NARRATIVE_PURITY_RULES;

/** 叙事纯净（判定关闭版）：去掉〔〕判定要求，结算结果仍必须写进正文 */
export const NARRATIVE_PURITY_RULES_NO_JUDGEMENT = replaceAllOnCopy(
  NARRATIVE_PURITY_RULES_SOURCE,
  [
    ['先按存档与判定结算', '先按存档与既有设定结算'],
    ['对话"";判定〔〕', '对话""'],
    [
      '内心与判定:场上有NPC时,正文至少写一段`...`内心,不能只写进指令;需要结算的行为,〔〕判定必须出现在正文,不能只写进指令或省略',
      '内心与结算:场上有NPC时,正文至少写一段`...`内心,不能只写进指令;需要结算的行为,结果与过程必须写进正文,不能只写进指令或省略'
    ],
    ['禁止:Markdown;〔〕判定以外暴露数值/机制/变量名', '禁止:Markdown;暴露数值/机制/变量名']
  ],
  '叙事纯净'
);

/** 关闭判定后的核心输出规则 */
export const CORE_OUTPUT_RULES_NO_JUDGEMENT = [
  JSON_OUTPUT_RULES,
  RESPONSE_FORMAT_RULES,
  DATA_STRUCTURE_STRICTNESS,
  NARRATIVE_PURITY_RULES_NO_JUDGEMENT
].join('\n\n');

/** 关闭判定后的文本格式：不再包含〔〕判定格式 */
export const TEXT_FORMAT_RULES_NO_JUDGEMENT = [
  TEXT_FORMAT_MARKERS.replace('|判定〔...〕', '').trim(),
  NAMING_CONVENTIONS
].join('\n\n');

/**
 * 关闭判定后的业务规则。
 * 与 defaultPrompts.ts 的 BUSINESS_RULES 保持同一顺序；差别只有：
 * - 去掉 判定可追溯 / 成功率基准 / 炼制难度 / 判定风险 四块；
 * - 用 [结果判定] 取代判定体系。
 */
export const BUSINESS_RULES_NO_JUDGEMENT = [
  RATIONALITY_AUDIT_RULES_NJ,
  ANTI_SYCOPHANCY_RULES,
  OUTCOME_JUDGEMENT_RULES,
  PROFESSION_MASTERY_RULES,
  DUAL_REALM_NARRATIVE_RULES,
  renderValueDomainsPrompt(),
  REALM_SYSTEM_RULES_NJ,
  THREE_THOUSAND_DAOS_RULES_NJ,
  NPC_RULES_NJ,
  NPC_KNOWLEDGE_BOUNDARY_RULES_NJ,
  GRAND_CONCEPT_CONSTRAINTS,
  SKILL_AND_SPELL_USAGE_RULES,
  CULTIVATION_DETAIL_RULES,
  TIME_FLOW_RULES,
  LOCATION_UPDATE_RULES,
  COMMAND_PATH_CONSTRUCTION_RULES,
  TECHNIQUE_SYSTEM_RULES,
  COMBAT_TURN_BASED_RULES_NJ,
  PLAYER_AUTONOMY_RULES,
  PERSISTENT_STATE_RULES_NJ
].join('\n\n');


const CULTIVATION_SPEED_RULES_NJ = replaceAllOnCopy(
  CULTIVATION_SPEED_RULES,
  [
    ['直接写真气未满、冲击无门,不进行突破判定', '直接写真气未满、冲击无门'],
    ['[大境界突破判定]', '[大境界突破]']
  ],
  '修炼速度'
);

/**
 * 关系矩阵维护规则（追加在原有指令之后）。
 * 关系矩阵的边 = 两个 NPC 是否认识；没有边 = 不认识（只是听说过不算）。
 */
export const NPC_RELATION_MAINTENANCE_RULES = `
[关系网维护]
认识的定义:社交.关系矩阵.edges 里有一对NPC的边 → 彼此认识;没有边 → 不认识,无论是否同属一个势力
边的含义:relation=关系性质,score=亲近(+100)~敌对(-100)程度;只是点头之交/照过面用 relation:"相识",score 0~30,type:"双向"
建边时机:两个具名NPC第一次同场并发生实质互动|玩家或第三人引荐|共同经历同一事件|一方打听另一方
更新时机:互动改变态度→set 社交.关系矩阵.edges[索引].score;背叛/救命/拜师/结仇→set relation 并大幅调整 score,关键经过 push 进该边的 events
维护节奏:每回合先读社交.关系矩阵.edges,再决定建边或更新;同一对只保留一条边,禁止重复 push
叙事落地:NPC 提起另一个NPC时先看有没有边——有边按 relation 与 score 表现态度;没边只能写"听说过""不认识",不得直呼其名细数底细
`.trim();

/**
 * 关闭判定后的扩展规则（默认内容：全部模块）。
 * 是否发送跟随「2.5 扩展规则」的开关。只去掉「玩家宗门」相关内容；其他势力的职位、派系、宗门动态等照常发送。
 */
export const EXTENDED_BUSINESS_RULES_NO_JUDGEMENT = [
  SECT_SYSTEM_RULES,
  CULTIVATION_PRACTICE_RULES,
  CULTIVATION_SPEED_RULES_NJ,
  DAO_COMPREHENSION_RULES,
  SIX_SI_ACQUISITION_RULES,
  NPC_RELATION_NETWORK_RULES,
  NPC_RELATION_COMMANDS,
  NPC_RELATION_MAINTENANCE_RULES,
  NPC_FACTION_RULES,
  ECONOMY_AND_PRICING_RULES
].join('\n\n');
