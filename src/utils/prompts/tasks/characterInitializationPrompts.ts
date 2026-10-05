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
只输出一个 JSON 对象，不要代码块、解释文字或 <thinking> 等标签。结构如下（数值须按角色实际情况填写，下面只是格式示意，不代表玩家一定出生在村落或身无长物）：
{"text":"开局叙事正文","mid_term_memory":"50-100字开局摘要","tavern_commands":[
 {"action":"set","key":"元数据.时间","value":{"年":1050,"月":3,"日":12,"小时":8,"分钟":0}},
 {"action":"set","key":"角色.身份.出生日期","value":{"年":1034,"月":7,"日":2}},
 {"action":"set","key":"角色.位置","value":{"描述":"东荒大陆·青石村","x":3200,"y":4100,"灵气浓度":25}},
 {"action":"set","key":"角色.属性.声望","value":0},
 {"action":"set","key":"角色.背包.货币.灵石_下品","value":{"币种":"灵石_下品","名称":"下品灵石","数量":12,"价值度":1}}
],"action_options":["选项1","选项2","选项3","选项4","选项5"]}
tavern_commands 条数不设上限：剧情需要多少条就写多少条（多部功法、多件物品、多个NPC、多条大道都要逐条写出）

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
3. **声望**：角色.属性.声望——优先按出身背景定；背景未提时，普通出身0-10｜宗门出身10-50｜名门出身50-100
4. **初始资金**：角色.背包.货币.{币种}.{数量}——严格按出身背景写（背景说"10000颗极品灵石"就写 10000）
   背景未提及时，才按身份给：平民 10-50 下品｜世家/宗门 100-300 下品；币种用背景中提到的（如"极品灵石"）
5. **随机项**：灵根/出身为"随机"时，set 角色.身份.灵根 或 角色.身份.出生 为具体内容

## 视情况设置
- **NPC**：只为正文中出现、之后还会打交道的重要人物建档（0-3个，路人不建），写入 社交.关系.{NPC名}
  - 完整 NPCData：出生(出身背景，不是年龄)/出生日期/先天六司/外貌描述(50字+)/性格特征(3个+)/天赋/记忆(2条+)/属性等；不输出"年龄"字段
  - 初始好感不宜过高（血亲除外），体现人情冷暖
- **物品**：出身背景与正文中确实持有的才写入 角色.背包.物品.{物品ID}；多个物品逐个 set，不要只写一件
- **功法**：出身背景中有几部就写几部（多部功法要逐部写入，禁止只写一部）
  - 每部功法写法：set 角色.背包.物品.{功法ID} = {物品ID,名称,类型:"功法",品质:{quality,grade},修炼进度,功法技能}
  - 修炼进度按背景的修炼程度给（如"已然大成""臻至化境"应为高分，不是0）
  - 主修功法再 set 角色.背包.物品.{功法ID}.已装备=true，并 set 角色.功法.当前功法ID 与 角色.功法.功法进度.{功法ID}.熟练度
- **剑灵/器灵等关系**：背景提到的灵体一律建档到 社交.关系.{名字}，名字严格照背景，不得改名
- **大道**：出身/背景中提到的大道与境界必须写全
  - set 角色.大道.大道列表.{道名} = {道名,描述,是否解锁:true,当前阶段,当前经验,总经验,阶段列表}
  - ⚠️阶段列表固定6项（下标0-5），名称贴合该道意境且各道不同；当前阶段按背景的造诣填（0-5）
  - 背景说"对某道已臻化境"就该给高阶段，不是0

## 叙事要求
- **文风**：以「文风」提示词为准；未指定时保持修仙世界的称谓与规矩
- **沉浸**：写环境氛围、身体感受与可见动作，不罗列数据；不出现"玩家""获得""装备了""等级提升"等出戏词
- **成仙之难**：严禁"看一眼就学会""模仿一下就突破""瞬间踏入练气"；天才也只体现在感悟深度上，而非过程廉价
- **境界严谨**：开局境界必须与出身背景一致——背景是凡人则本次叙事不入道不突破；背景已是高阶修士则如实呈现其修为，并交代来由（如沉睡千年、传承顿悟）
- **年龄与出身**：从所选年龄开始，言行符合年龄段（孩童不说老怪的话）；出身决定眼界与起点，必须与角色数据一致
- **时间感**：适当体现时间流逝（如"寒来暑往""枯坐数日"）

## 初始资源与境界：以出身背景为准（最高优先级）
出身背景效果里写明的功法/资源/关系/境界/感悟，一律如实落实，不受任何上限限制。
背景未写明时，才按身份合理推断：
- 凡人平民：无功法、少量凡品物品与钱财、境界凡人（进度0）
- 世家/宗门子弟：可有黄品~玄品功法、对应资源、境界练气
- 有奇遇或传承背景：按背景描述给，可高于常规

原则：**忠于背景，不要"平衡"**。背景说他有几本功法就是几本，说他是炼虚就是炼虚，说剑灵叫什么就叫什么。
不得为迁就"新手开局"而降格；也不得凭空添加背景未提及的高阶资源。
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

  // 出身背景效果：这是开局最重要的依据，早期遗漏导致 AI 不知道背景里有什么，
  // 进而丢物品、丢功法、剑灵名字写错、境界不符。此处必须完整透传。
  const originObj = originIsObj ? (origin as Origin) : null;
  const originEffects = Array.isArray(originObj?.background_effects)
    ? originObj!.background_effects!.filter(e => e && (e.type || e.description))
    : [];
  // 按类别分组，便于 AI 逐项落实
  const groupOrder = ['功法', '资源', '关系', '境界', '感悟', '物品', '其他'];
  const effectsByType = new Map<string, string[]>();
  for (const e of originEffects) {
    const key = groupOrder.includes(e.type) ? e.type : '其他';
    if (!effectsByType.has(key)) effectsByType.set(key, []);
    effectsByType.get(key)!.push(e.description);
  }
  const originEffectsBlock = originEffects.length
    ? [...effectsByType.entries()]
        .sort((a, b) => groupOrder.indexOf(a[0]) - groupOrder.indexOf(b[0]))
        .map(([type, items]) => `### ${type}\n${items.map(i => `- ${i}`).join('\n')}`)
        .join('\n')
    : '(无背景效果)';

  const originMods = originObj?.attribute_modifiers && Object.keys(originObj.attribute_modifiers).length
    ? Object.entries(originObj.attribute_modifiers).map(([k, v]) => `${k}${Number(v) >= 0 ? '+' : ''}${v}`).join(' ')
    : '';

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
${originMods ? `\n### 出身属性修正\n${originMods}` : ''}

### ⚠️ 出身背景效果（必须逐项落实为开局数据）
${originEffectsBlock}
以上每一条都是角色的既有经历与持有物，不是可选设定：
- 【功法】有几部就写几部，并按描述给出匹配的品质与已修进度
- 【资源】逐个写进背包（物品/货币），数量与描述一致
- 【关系】逐个建立 NPC 档案，姓名、身份、境界严格照描述写
- 【境界】按描述设置 角色.属性.境界（不是凡人开局）
- 【感悟】转成对应的大道与阶段
禁止遗漏、禁止改名、禁止降格；与下文"初始资源上限"冲突时，以本节为准

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
