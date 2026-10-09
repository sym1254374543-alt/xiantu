/**
 * 宗门内容生成提示词（usageType 均为 sect_generation）
 * 字段名与 sectContentService 的解析 / normalizeTask 保持一致
 */

const cut = (v: unknown, n: number) => JSON.stringify(v ?? null).slice(0, n);

/** 所有宗门请求共用的输出约束 */
const JSON_ONLY = '只输出 1 个 JSON 对象：不要代码块、解释文字或 <thinking> 标签。';

/** 境界写法：与主系统一致（练气/筑基/金丹…+初期/中期/后期/圆满/极境） */
const REALM_FORMAT = '境界写作"大境界+阶段"，如 练气初期、筑基中期、金丹后期、元婴圆满（大境界：练气/筑基/金丹/元婴/化神/炼虚/合体/渡劫）';

/** 势力等级 → 宗主境界参考（与 worldStandards 的势力等级表一致） */
const SECT_TIER_REALM = '宗主境界参考势力等级：小门派筑基｜三流金丹｜二流元婴｜一流化神｜超级炼虚｜圣地合体';

export interface SectPromptBase {
  sectName: string;
  playerPosition: string;
  playerContribution: number;
  worldContext: unknown;
  sectContext: unknown;
  existingNames: string[];
  nowIso: string;
}

/** 藏经阁 */
export function buildSectLibraryPrompt(p: SectPromptBase): string {
  return `
# 任务：生成【宗门藏经阁】功法列表（单次功能请求）
你将为宗门「${p.sectName}」生成可兑换/可学习的功法条目。

## 输出格式（必须）
${JSON_ONLY}
{"text":"一句话简介","techniques":[...],"evolve_count":1,"last_updated":"${p.nowIso}"}
- 顶层只允许 text / techniques / evolve_count / last_updated，techniques 必须是数组

## 功法对象字段
{
  "id": "string（唯一）",
  "name": "string（功法名）",
  "quality": "凡品|黄品|玄品|地品|天品|仙品|神品",
  "cost": number（贡献点）,
  "description": "string（20-80字）"
}
可选字段："功法效果" "境界要求" "职位要求" "剩余数量"

## 约束
- 生成 16-30 条功法，至少覆盖 4 个品阶；低品阶数量最多，品阶越高越少
- cost 随品阶递增并拉开梯度（参考：凡品10-50｜黄品50-200｜玄品200-800｜地品800-3000｜天品3000+）
- 天品以上最多 1-2 部且需极高职位；仙品/神品一般不出现
- 功法风格与宗门特色、世界背景一致；名称不与现有功法重复

## 世界背景
${cut(p.worldContext, 600)}

## 宗门信息
- 玩家职位：${p.playerPosition}
- 玩家贡献点：${p.playerContribution}
- 宗门详情：${cut(p.sectContext, 1200)}

## 现有功法（避免重复）
${p.existingNames.join('，') || '（无）'}
  `.trim();
}

/** 贡献商店 */
export function buildSectShopPrompt(p: SectPromptBase & { playerRealm: string }): string {
  return `
# 任务：生成【宗门贡献商店】可兑换物品
你将为宗门「${p.sectName}」生成贡献点兑换商店的物品条目。

## 输出格式（必须）
${JSON_ONLY}
{"text":"一句话简介","items":[...],"evolve_count":1,"last_updated":"${p.nowIso}"}
- 顶层只允许 text / items / evolve_count / last_updated，items 必须是数组

## 物品对象字段
{
  "id": "string（唯一）",
  "name": "string（物品名）",
  "icon": "string（1-2字符）",
  "type": "丹药|功法|装备|材料|其他",
  "quality": "凡品|黄品|玄品|地品|天品|仙品|神品",
  "description": "string（20-80字）",
  "cost": number（贡献点）
}
可选字段："stock" "使用效果" "限购数量" "职位要求"

## 约束
- 生成 12-24 件物品，type 至少覆盖 4 类
- cost 需拉开梯度，高品阶更贵
- 物品风格与宗门特色、世界背景一致；名称不与现有物品重复
- 【境界匹配（重要）】玩家当前境界：${p.playerRealm}
  - 绝大多数物品适合该境界使用（如练气玩家主要上架聚气丹、练气功法）
  - 可有少量高一层次的物品作为追求目标，禁止大量上架远超当前境界的物品

## 世界背景
${cut(p.worldContext, 600)}

## 宗门信息
- 玩家职位：${p.playerPosition}
- 玩家境界：${p.playerRealm}
- 玩家贡献点：${p.playerContribution}
- 宗门详情：${cut(p.sectContext, 1200)}

## 现有物品（避免重复）
${p.existingNames.join('，') || '（无）'}
  `.trim();
}

export interface TaskMapContext {
  firstLevel: Array<{ 名称: string; 来源境界?: string; 描述?: string }>;
  secondLevel: Array<{ 名称: string; 类型?: string; 来源境界?: string; 描述?: string }>;
  sourceRealms: string[];
}

/** 宗门任务（带地图上下文） */
export function buildSectTasksPrompt(p: SectPromptBase & { playerRealm: string; map: TaskMapContext }): string {
  const firstLevelLines = p.map.firstLevel
    .map((v) => `- ${v.名称}${v.来源境界 ? `（来源：${v.来源境界}）` : ''}${v.描述 ? `：${v.描述}` : ''}`)
    .slice(0, 80);
  const secondLevelLines = p.map.secondLevel
    .map((v) => `- ${v.名称}${v.类型 ? ` [${v.类型}]` : ''}${v.来源境界 ? `（来源：${v.来源境界}）` : ''}${v.描述 ? `：${v.描述}` : ''}`)
    .slice(0, 180);
  return `
# 任务：生成【宗门任务】列表（单次功能请求）
你将为宗门「${p.sectName}」生成任务条目。

## 输出格式（必须）
${JSON_ONLY}
{"text":"一句话简介","tasks":[...],"evolve_count":1,"last_updated":"${p.nowIso}"}
- 顶层只允许 text / tasks / evolve_count / last_updated，tasks 必须是数组
- 禁止输出 tavern_commands / action_options / 社交 / 宗门 / 系统 等其他字段

## 任务对象字段
{
  "任务ID": "string（唯一）",
  "任务名称": "string",
  "任务描述": "string（20-100字）",
  "任务类型": "巡逻|采集|护送|除魔|求援|侦查|炼丹|炼器|内门事务|秘境",
  "难度": "低|中|高|极",
  "贡献奖励": number,
  "额外奖励": "string or empty",
  "状态": "可接取"
}
可选字段："期限", "发布人", "要求"

## 约束
- 生成 6-12 个任务，至少 4 个可接取
- 奖励梯度：低(10-80) 中(80-200) 高(200-400) 极(400-800)
- 任务内容必须与宗门特色和世界背景匹配
- 【境界匹配约束（重要）】：任务难度和敌人/目标强度必须与玩家当前境界相适应
  - 玩家当前境界：${p.playerRealm}
  - 低难度任务应是该境界能轻松完成的，高难度任务需努力才能完成，极难度是极限挑战
  - 禁止生成远超玩家当前境界能力范围的任务（如练气期玩家不应承接元婴级任务）
- 【地图关联约束（重要）】：
  - 优先使用“已知二级地点”作为任务发生地（巡逻、护送、采集、除魔等都应落在这些地点或其周边）
  - 如确需新地点，必须与“已知一级地点（大陆/灵境）”建立明确隶属关系，并在任务描述中写清层级
  - 不要凭空脱离世界框架生成地点名

## 世界背景
${cut(p.worldContext, 800)}

## 地图活动范围（境界1~当前境界）
- 当前境界：${p.playerRealm}
- 地图来源境界：${p.map.sourceRealms.join('、') || '当前世界地图'}
- 已知一级地点（大陆/灵境）：
${firstLevelLines.join('\n') || '- 暂无'}
- 已知二级地点（宗门/城镇/秘境/地标）：
${secondLevelLines.join('\n') || '- 暂无'}

## 宗门信息
- 玩家职位：${p.playerPosition}
- 玩家境界：${p.playerRealm}
- 玩家贡献点：${p.playerContribution}
- 宗门详情：${cut(p.sectContext, 1500)}

## 现有任务（避免重复）
${p.existingNames.join('，') || '（无）'}
  `.trim();
}

/** 宗门高层 */
export function buildSectLeadershipPrompt(sectName: string, worldContext: unknown, sectProfile: unknown): string {
  return `
# 任务：生成【宗门高层】信息
为宗门「${sectName}」生成领导层信息。

## 输出格式
${JSON_ONLY}
{"leadership":{...}}

## leadership 对象字段
{
  "宗主": "string（名字）",
  "宗主修为": "string（境界）",
  "副宗主": "string（可选）",
  "太上长老": "string（可选）",
  "太上长老修为": "string（可选）"
}

## 约束
- ${REALM_FORMAT}
- ${SECT_TIER_REALM}；若宗门档案已写明宗主修为，以档案为准
- 太上长老修为 ≥ 宗主修为 ≥ 副宗主修为
- **不要**输出 长老数量 / 最强修为 / 综合战力 这类人数与战力统计
- 人名为具体中式姓名或道号，各不相同，避免烂大街名字

## 世界背景
${cut(worldContext, 400)}

## 宗门档案
${cut(sectProfile, 800)}
  `.trim();
}

/** 宗门同门 */
export function buildSectMembersPrompt(sectName: string, worldContext: unknown, sectProfile: unknown): string {
  return `
# 任务：生成【宗门同门】信息
为宗门「${sectName}」生成同门弟子信息。

## 输出格式
${JSON_ONLY}
{"members":[...]}

## member 对象字段
{
  "名字": "string",
  "性别": "男|女",
  "年龄": number（根据职位和境界合理设定，外门弟子15-25岁，内门25-40岁，真传40-80岁，长老80-200岁）,
  "职位": "外门弟子|内门弟子|真传弟子|核心弟子|长老|堂主|峰主|执事|护法|副宗主|宗主（视宗门规模选用）",
  "境界": "string（大境界+阶段）",
  "灵根": "string（如：五行杂灵根、金木双灵根、天灵根等，根据职位合理设定，高职位可有更好灵根）",
  "势力归属": "${sectName}",
  "好感度": number（30-70）
}

## 约束
- 生成 5-10 个同门，姓名、性格各不相同
- 职位分布合理（外门>内门>真传>长老级）
- ${REALM_FORMAT}
- 【境界层级约束（严格遵守）】：
  - 宗门整体实力上限由宗门档案中的 领导层.宗主修为 决定，以此为天花板
  - 层级规则：太上长老境界 > 宗主境界 > 副宗主境界 > 长老/堂主/峰主境界 > 真传/核心境界 > 内门弟子境界 > 外门弟子境界
  - 禁止低职位境界高于高职位，禁止随意使用超出宗门上限的境界

## 世界背景
${cut(worldContext, 400)}

## 宗门档案（含 领导层.宗主修为，据此判断境界上限）
${cut(sectProfile, 800)}
  `.trim();
}

/** 同门演化 */
export function buildSectEvolvePrompt(p: {
  sectName: string;
  member: { name: string; gender: string; position: string; realm: string };
  playerRealm: string;
  worldContext: unknown;
  sectProfile: unknown;
}): string {
  return `
# 任务：演化【宗门同门】实力
你将为宗门「${p.sectName}」的已有同门「${p.member.name}」进行实力演化。

## 输出格式
${JSON_ONLY}
{"名字":"${p.member.name}","职位":"...","境界":"..."}

## 角色基本信息
- 姓名：${p.member.name}
- 性别：${p.member.gender}
- 当前职位：${p.member.position}
- 当前境界：${p.member.realm}

## 约束
- 根据时间推移与玩家境界的提升，合理演化该角色的职位和境界：原本比玩家弱的可以适当精进；本就远强于玩家的（如长老）进步应很小
- 境界只进不退（除非档案中有受伤跌境的记录），单次最多提升一个大境界
- 【必选职位】：外门弟子|内门弟子|真传弟子|核心弟子|长老|堂主|峰主|执事|护法|副宗主
- 【境界层级约束（严格遵守）】：
  - 宗门整体实力上限由下方宗门档案的 领导层.宗主修为 决定，以此为天花板。
  - 太上长老境界 > 宗主境界 > 副宗主境界 > 长老/堂主/峰主境界 > 真传/核心境界 > 内门弟子境界 > 外门弟子境界，必须随职位匹配。
- 玩家当前境界：${p.playerRealm}
- ${REALM_FORMAT}

## 世界背景
${cut(p.worldContext, 400)}

## 宗门档案
${cut(p.sectProfile, 600)}
  `.trim();
}

/** 宗门经营：初始化 */
export function buildSectManageInitPrompt(sectName: string, sectProfile: unknown, nowIso: string): string {
  return `
# 任务：初始化【宗门经营】数据（单次功能请求）
为宗门「${sectName}」写入轻度经营数据，用于宗主面板和后续宗门经营演变。

## 输出格式（必须）
${JSON_ONLY}
{"text":"一两句初始化说明","mid_term_memory":"50-100字：本次初始化的关键摘要","tavern_commands":[{"action":"set","key":"社交.宗门.宗门经营.${sectName}","value":{...下方对象...}}],"action_options":[]}

## 写入路径（必须）
- 只用一条 set 完整写入 社交.宗门.宗门经营.${sectName}

## 对象结构（必须）
{"宗门名称":"${sectName}","战力":number,"安定":number,"外门训练度":number,"府库":{"灵石":number,"灵材":number,"丹药":number,"阵材":number},"设施":{"练功房":number,"藏经阁":number,"炼丹房":number,"护山大阵":number},"最近结算":"${nowIso}","月报":[]}

## 数值约束（必须）
- 战力：综合等级与 领导层.宗主修为 估一个 30-80 的值（势力已不再有「综合战力」字段）
- 安定 55-85，外门训练度 35-75
- 灵石 20000-200000，灵材/丹药/阵材 0-5000，设施等级 0-5
- 所有数值为非负数字（不是字符串）

## 宗门档案（参考）
${cut(sectProfile, 1200)}
  `.trim();
}

/** 宗门经营：结算一旬（不推进游戏时间） */
export function buildSectManageSettlePrompt(sectName: string, management: unknown, d20: number, nowIso: string): string {
  return `
# 任务：宗门经营【结算一旬】（单次功能请求）
为宗门「${sectName}」进行一次轻度结算（不推进元数据.时间），更新府库/安定/训练度/战力，并追加一条月报记录。

## 随机因子（必须使用，不要自行重掷）
d20=${d20}

## 输出格式（必须）
${JSON_ONLY}
{"text":"一两句结算说明","mid_term_memory":"50-100字：本次结算的关键摘要","tavern_commands":[...],"action_options":[]}

## 写入方式（必须）
- 数值变化用 add 精准修改，如 {"action":"add","key":"社交.宗门.宗门经营.${sectName}.府库.灵石","value":5000}
- 月报用 push，最近结算用 set（见下）

## 约束（必须）
- d20 越高结果越好：1-5 偏差（小亏或动荡）｜6-15 平稳小赚｜16-20 丰收
- 不允许修改：元数据.时间
- 结算后所有数值不得为负
- 战力/安定/训练度 单次变化不超过 8 点
- 府库.灵石 单次变化建议在 -3000~+12000（根据d20与设施等级）
- 必须追加月报：push 到 社交.宗门.宗门经营.${sectName}.月报 一个对象：
  {"时间":"${nowIso}","摘要":"...","变化":{"灵石":5000,"安定":-2,"外门训练度":3,"战力":1}}（数值为本次实际变化量，负数写 -2，正数不要加 + 号）
- 更新 最近结算 为 "${nowIso}"

## 当前经营数据（必须以此为准）
${cut(management, 1200)}
  `.trim();
}

/** 发到主对话的宗门交互文案 */
export const SECT_CHAT_TEXTS = {
  visitMaster: (sect: string, name: string) => `我想拜见${sect}宗主「${name}」`,
  askVice: (sect: string, name: string) => `我想向${sect}副宗主「${name}」请教`,
  visitElder: (sect: string, name: string) => `我想拜见${sect}太上长老「${name}」`,
  talk: (name: string) => `我想和${name}交谈`,
  acceptTask: (taskName: string) => `已接取宗门任务：${taskName}`,
};
