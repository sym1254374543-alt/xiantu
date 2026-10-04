/**
 * @fileoverview 角色初始化AI提示词
 *
 * 开局流程：世界生成 → 角色初始化（本文件）
 * - CHARACTER_INIT_TASK_PROMPT：开局任务说明，注册为提示词管理中的「角色初始化」（characterInit），用户可自定义
 * - TAVERN_BODY_RULES：酒馆端专属的玩家法身要求，按运行环境整块追加（不参与自定义，避免按行过滤残留半截规则）
 */

import type { World, TalentTier, Origin, SpiritRoot, Talent } from '@/types';
import type { WorldInfo, WorldMapConfig, SystemConfig } from '@/types/game';
import { stripNsfwContent } from '../definitions/dataDefinitions';
import { assembleSystemPrompt } from '../promptAssembler';
import { getPrompt } from '@/services/defaultPrompts';
import { isTavernEnv } from '@/utils/tavern';

// =====================================================================
// 开局任务说明（每条规则只写一处）
// =====================================================================

export const CHARACTER_INIT_TASK_PROMPT = `
# 当前任务：角色初始化

根据用户消息中的角色数据（姓名、性别、年龄、天资、出身、灵根、天赋等），一次完成：
1. 600-1000 字的开局叙事（text）
2. 用 tavern_commands 设置初始数据（时间、位置、资源、NPC 等）
3. 5 个行动选项（action_options）

## 输出格式（最高优先级）
只输出一个 JSON 对象，不要代码块、解释文字或 <thinking> 等标签。结构如下（数值须按角色实际情况填写，下面只是格式示意）：
{"text":"开局叙事正文","mid_term_memory":"50-100字开局摘要","tavern_commands":[
 {"action":"set","key":"元数据.时间","value":{"年":1050,"月":3,"日":12,"小时":8,"分钟":0}},
 {"action":"set","key":"角色.身份.出生日期","value":{"年":1034,"月":7,"日":2}},
 {"action":"set","key":"角色.位置","value":{"描述":"东荒大陆·青石村","x":3200,"y":4100,"灵气浓度":25}},
 {"action":"set","key":"角色.属性.声望","value":0},
 {"action":"set","key":"角色.背包.货币.灵石_下品","value":{"币种":"灵石_下品","名称":"下品灵石","数量":12,"价值度":1}}
],"action_options":["选项1","选项2","选项3","选项4","选项5"]}

- text：只写故事正文，不夹带游戏数据、JSON 或变量名
- mid_term_memory：必填，概括开局核心信息
- tavern_commands：开局只用 set（不用 add/push/delete）；key 以 元数据./角色./社交./世界./系统. 开头；数值写数字
- action_options：5 个贴合开局场景的选项

## 必须设置（缺一不可）
1. **时间与出生日期**（成对设置）：元数据.时间 {年,月,日,小时,分钟}；角色.身份.出生日期 {年,月,日}
   - 出生日期.年 = 元数据.时间.年 - 角色年龄（例：16岁、时间1050年 → 出生1034年）；漏设任一项会导致年龄显示异常
2. **位置**：角色.位置 {描述,x,y,灵气浓度}，放在 tavern_commands 前4条内，与正文地点一致
   - 描述按[位置更新]：大陆·世界地图地点(·建筑)，优先从「可用地点」中选；宗门/城镇直接作第二层，不挂在山脉等地形下
   - x/y 取 0-10000；灵气浓度 1-100（普通地点20-40，灵地50-70，洞天福地80+）
   - 禁止占位文本："位置生成失败"/"无名之地"/"待生成"/"暂无"/"unknown"/"undefined"/"null"
3. **声望**：角色.属性.声望（普通出身0-10｜宗门出身10-50｜名门出身50-100）
4. **初始资金**：角色.背包.货币.灵石_下品（完整对象，见上例）
5. **随机项**：灵根/出身为"随机"时，set 角色.身份.灵根 或 角色.身份.出生 为具体内容

## 视情况设置
- **NPC**：只为正文中出现、之后还会打交道的重要人物建档（0-3个，路人不建），写入 社交.关系.{NPC名}
  - 完整 NPCData：出生(出身背景，不是年龄)/出生日期/先天六司/外貌描述(50字+)/性格特征(3个+)/天赋/记忆(2条+)/属性等；不输出"年龄"字段
  - 初始好感不宜过高（血亲除外），体现人情冷暖
- **物品/功法**：正文中确实持有的才写入 角色.背包.物品.{物品ID}
- **大道**：天赋/出身直接关联某条大道时，写入 角色.大道.大道列表.{道名}

## 叙事要求
- **文风**：以「文风」提示词为准；未指定时保持修仙世界的称谓与规矩
- **沉浸**：写环境氛围、身体感受与可见动作，不罗列数据；不出现"玩家""获得""装备了""等级提升"等出戏词
- **成仙之难**：严禁"看一眼就学会""模仿一下就突破""瞬间踏入练气"；天才也只体现在感悟深度上，而非过程廉价
- **境界严谨**：凡人开局绝不在本次叙事中入道或突破
- **年龄与出身**：从所选年龄开始，言行符合年龄段（孩童不说老怪的话）；出身决定眼界与起点，必须与角色数据一致
- **时间感**：适当体现时间流逝（如"寒来暑往""枯坐数日"）

## 初始资源上限（严格执行）
- **资金**（折算下品灵石）：贫困/流浪 0-10｜普通 10-50｜修仙世家/宗门 100-300｜富裕/商贾 300-800
- **物品**：1-5件，以凡品为主；禁止开局给予地品及以上（除非出身明确是顶级"天选"类且有剧情铺垫）
- **功法**：0-2部；多数凡人开局没有功法，需在剧情中获取或入宗后获得
- **境界**：绝大多数开局为凡人（进度0）；只有修仙世家且年龄较大、或有特殊奇遇背景，才可为练气初期
`.trim();

/** 酒馆端专属：玩家法身数据（网页版整块不发送） */
const TAVERN_BODY_RULES = `
## 玩家法身（酒馆端必须执行）
set 角色.身体 {身高,体重,体脂率,三围:{胸围,腰围,臀围},肤色,发色,瞳色,纹身与印记:[],穿刺:[],敏感点:[],开发度:{},其它:{},仪容:{品题,评分,概述,眉眼,发型,面部,感官,气质:{清纯,妖媚,性感,端庄,冷艳,灵动},衣着:[],穿搭,身材体态}}
- 按角色性别/年龄/种族生成具体数值：身高 男165-185cm、女155-170cm、儿童按年龄；体重与身高匹配；体脂率 男10-25%、女18-30%
- 纹身与印记/穿刺/敏感点为 []，开发度/其它为 {}
- 仪容写可见的容貌、体态、衣着和六维气质。品题四字且贴合此人，评分 0-100，六维必须拉开差距。不写性行为
- 女性或有胸部特征时，可在角色.身体.罩杯写单字母
- 新NPC建档时同时 set 社交.关系.{NPC名}.仪容（结构同上，三围写在仪容里）
- nsfwMode=true 时额外生成：胸部描述/私处描述/生殖器描述。这些敏感字段不要塞进仪容
- 严禁占位文本（"待AI生成"/"暂无"/"空"），严禁照抄示例数值
`.trim();


// =====================================================================
// 构建函数
// =====================================================================

interface ContextItem {
  name?: string;
  名称?: string;
  description?: string;
  描述?: string;
  type?: string;
  类型?: string;
}

/**
 * 构建玩家选择摘要（作为开局请求的 user 消息）
 */
export function buildCharacterSelectionsSummary(
  userSelections: {
    name: string;
    gender: string;
    race: string;
    age: number;
    world: World;
    talentTier: TalentTier;
    origin: Origin | string;
    spiritRoot: SpiritRoot | string;
    talents: Talent[];
    attributes: Record<string, number>;
    difficultyPrompt?: string; // 难度提示词
  },
  worldContext?: {
    worldInfo?: WorldInfo;
    availableContinents?: ContextItem[];
    availableLocations?: ContextItem[];
    mapConfig?: WorldMapConfig;
    systemSettings?: SystemConfig;
  }
): string {
  const { name, gender, race, age, world, talentTier, origin, spiritRoot, talents, attributes, difficultyPrompt } = userSelections;

  const originIsObj = typeof origin === 'object' && origin !== null;
  const spiritRootIsObj = typeof spiritRoot === 'object' && spiritRoot !== null;

  const talentsList = talents.length > 0
    ? talents.map(t => `- ${t.name}: ${t.description}`).join('\n')
    : '无';

  const attrList = Object.entries(attributes).map(([k, v]) => `${k}:${v}`).join(', ');

  const continents = worldContext?.availableContinents
    ?.map(c => `- ${c.name || c.名称}`)
    .join('\n') || '(未生成)';

  const locations = worldContext?.availableLocations
    ?.slice(0, 8)
    .map(l => `- ${l.name || l.名称} (${l.type || l.类型})`)
    .join('\n') || '(未生成)';

  const settings = worldContext?.systemSettings;
  const nsfwScope = settings?.nsfwGenderFilter === 'all' ? '所有NPC' : settings?.nsfwGenderFilter === 'female' ? '仅女性NPC' : '仅男性NPC';

  return `
# 玩家角色数据

## 基础信息
姓名: ${name} | 性别: ${gender} | 种族: ${race} | 年龄: ${age}岁

## 世界
${world.name} (${world.era})
${world.description}

## 天资
${talentTier.name}: ${talentTier.description}

## 出身
${originIsObj ? (origin as Origin).name : origin}: ${originIsObj ? (origin as Origin).description : '(随机，需AI生成)'}

## 灵根
${spiritRootIsObj ? `${(spiritRoot as SpiritRoot).name} (${(spiritRoot as SpiritRoot).tier})` : spiritRoot}: ${spiritRootIsObj ? (spiritRoot as SpiritRoot).description : '(随机，需AI生成)'}

## 天赋
${talentsList}

## 先天六司
${attrList}

---

## 可用地点（角色.位置 优先从这里选择）
**大陆**:
${continents}

**地点**:
${locations}

---

## 难度设置
${difficultyPrompt || '【难度模式：普通】\n- 世界遵循正常修仙规则，机缘与危险并存'}

---

## 系统设置
- **运行环境**: ${settings?.isTavernEnv ? '酒馆端（必须生成玩家法身 角色.身体，以及玩家与新NPC的仪容，见任务说明）' : '单机端（不需要生成法身数据）'}
${settings?.nsfwMode ? `- **NSFW模式**: 已开启，私密信息生成范围：${nsfwScope}
  - 创建NPC时，若NPC性别符合上述范围，必须生成完整的"私密信息(PrivacyProfile)"字段：性经验等级/亲密节奏/亲密需求/安全偏好/避孕措施/生育状态/亲密偏好/禁忌清单/身体部位反应-偏好-禁忌
  - 玩家法身除基础体格外，还需生成敏感字段（胸部描述/私处描述/生殖器描述/敏感点/开发度）` : '- **NSFW模式**: 已关闭（不生成私密信息/敏感字段）'}
`.trim();
}

/**
 * 构建角色初始化系统提示词：核心规则 + 开局任务（可在提示词管理中自定义）+ 酒馆端法身要求
 */
export async function buildCharacterInitializationPrompt(): Promise<string> {
  const tavernEnv = isTavernEnv();
  const [basePrompt, taskPrompt] = await Promise.all([
    assembleSystemPrompt([]),
    getPrompt('characterInit'),
  ]);

  const sections = [
    basePrompt,
    taskPrompt.trim() || CHARACTER_INIT_TASK_PROMPT,
    tavernEnv ? TAVERN_BODY_RULES : '',
  ].filter(Boolean);

  const prompt = sections.join('\n\n---\n\n');
  return tavernEnv ? prompt : stripNsfwContent(prompt);
}
