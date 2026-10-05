import { WorldMapConfig } from '@/types/worldMap';

/**
 * 增强的世界生成提示词系统
 * 解决势力重复、命名固化、规模不合理等问题
 * 支持不同修仙世界背景适配
 * 使用游戏坐标系统 (可配置范围)
 */

export interface WorldPromptConfig {
  factionCount: number;
  totalLocations: number;
  secretRealms: number;
  continentCount: number;
  characterBackground?: string;
  worldBackground?: string;
  worldEra?: string;
  worldName?: string;
  mapConfig?: WorldMapConfig;
}

/** 两种世界生成模式共用：坐标系与网格计算 */
function computeMapGeometry(mapConfig: WorldMapConfig | undefined, continentCount: number) {
  const minX = Number(mapConfig?.minLng ?? 0);
  const minY = Number(mapConfig?.minLat ?? 0);
  const width = Number(mapConfig?.width) || 10000;
  const height = Number(mapConfig?.height) || 10000;
  const maxX = Number(mapConfig?.maxLng ?? (minX + width));
  const maxY = Number(mapConfig?.maxLat ?? (minY + height));
  const mapWidth = Math.max(1, Math.floor(maxX - minX));
  const mapHeight = Math.max(1, Math.floor(maxY - minY));
  const gridRows = Math.ceil(Math.sqrt(continentCount));
  const gridCols = Math.ceil(continentCount / gridRows);
  const xStep = Math.floor(mapWidth / gridCols);
  const yStep = Math.floor(mapHeight / gridRows);
  // 网格格数多于大洲数时（如 3 个大洲用 2×2），让最后一行的大洲横向占满剩余格子，才能完整覆盖地图
  const spareCells = gridRows * gridCols - continentCount;
  const gridNote = spareCells > 0
    ? `
- 格子比大洲多 ${spareCells} 个：最后一行的大洲横向拉伸，把该行剩余格子一起占满`
    : '';
  return { minX, minY, maxX, maxY, mapWidth, mapHeight, gridRows, gridCols, xStep, yStep, gridNote };
}

function buildWorldSettingLines(config: WorldPromptConfig): string {
  const lines = [
    config.worldName ? `世界名称: ${config.worldName}` : '',
    config.worldEra ? `世界时代: ${config.worldEra}` : '',
    config.worldBackground ? `世界背景: ${config.worldBackground}` : '',
    config.characterBackground ? `角色出身: ${config.characterBackground}` : '',
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : '（未指定，按传统修仙世界处理）';
}

const BANNED_NAME_ROOTS = '本心、问心、见性、归一、太玄、太虚、紫薇、天机、青霞、无量、昊天、玄天、太清、太上、无极、九天';

/**
 * 现代地球（灵气复苏）设定块。
 * 用于「真实世界 + 灵气复苏」这类世界：保留真实地名与国族，势力现代化，境界极低。
 * 由 buildWorldSettingLines 之后的风格段引用。
 */
export const MODERN_EARTH_STYLE = `
## 世界性质（现代地球·灵气复苏初期）
这是**真实的地球**，不是架空大陆。灵气刚刚复苏，一切都还是雏形。

### 命名：必须用真实地名，禁止编造
- 大洲：用真实的七大洲原名——亚洲 / 欧洲 / 非洲 / 北美洲 / 南美洲 / 大洋洲 / 南极洲
- 地点：用**真实存在的**城市、山川、地标（如 北京、上海、东京、首尔、新加坡、纽约、洛杉矶、伦敦、巴黎、柏林、莫斯科、开罗、约翰内斯堡、悉尼、里约热内卢、布宜诺斯艾利斯、南极中山站……）
- ❌严禁编造"东荒大陆""青云城""苍冥灵境"这类架空名
- 描述要符合该地的真实地理与人文（气候、语言、文化、经济水平）

### 国族：不要只有中国人
- 每个大洲的势力与人物，国籍/族裔要与所在地一致
  · 亚洲：中/日/韩/东南亚/南亚/中东 各国
  · 欧洲：英/法/德/意/俄/北欧/东欧 各国
  · 美洲：美国/加拿大/墨西哥/巴西/阿根廷 等
  · 非洲：埃及/南非/尼日利亚/肯尼亚 等
  · 大洋洲：澳大利亚/新西兰/太平洋岛国
- 人物姓名按所在国族取（西方用"名·姓"，日本用日式姓名，韩国用韩式姓名，中东/南美各有其名）——不是所有NPC都叫中式名字

### 势力：现代组织形态，不是修仙宗门
真实世界没有"某某宗""某某门"，势力是现代社会里的组织，例如：
- 官方机构：各国政府设立的超凡事务部门、军方特殊单位（如"超自然事务管理局"）
- 财团/企业：跨界资本、科技公司，试图把灵气商业化
- 家族/世家：旧道统的血脉后裔、古武世家（对外是某某集团/某某家族）
- 研究所/学院：高校与科研机构，用科学手段研究灵气
- 教团/结社：宗教团体、地下秘密组织
- 妖族：开了灵智的异兽族群（多藏于深山、深海、极地）
命名风格照搬现实：如「青岚财团」「罗斯柴尔德家族」「国家超凡研究院」「南极观测站」，而非「青云门」「天剑宗」。

### 境界：极低，金丹是传说
灵气复苏初期，修行体系尚未成型：
- **绝大多数人是凡人**，完全不知修仙为何物，只当新闻里的"灵异事件"
- 觉醒者：多为**练气初期~中期**，已是各国争抢的人才
- 组织核心/顶尖战力：**练气后期~圆满**
- 超级势力的领袖：**筑基**（全球屈指可数）
- **金丹：全球不超过 3-5 人**，且均为特例——沉睡千年后提前苏醒的古修、苏醒不久的大妖、或极端机缘下偶然结丹；**世上不存在系统性的结丹法门**
- ❌禁止出现元婴及以上；禁止把"化神/炼虚/合体/渡劫"写进势力实力

### 认知：普通人不知修仙
- 大众只知"灵异事件""异常现象"：极光异象、动物变异、神秘失踪、无法解释的能量波动
- 官方在秘密调查、封锁消息；媒体与网民只能猜测
- 修士身份是隐秘的；公开暴露会引来官方与各方觊觎
- 生物也能被灵气侵染：少数开启灵智（可成妖），多数变异为凶兽
`.trim();

export class EnhancedWorldPromptBuilder {
  static buildPrompt(config: WorldPromptConfig): string {
    const finalFactionCount = config.factionCount;
    const finalLocationCount = config.totalLocations;
    const finalContinentCount = config.continentCount;
    const finalSecretRealmCount = Math.min(config.secretRealms, finalLocationCount);

    // 🔥 检测是否为"仅生成大陆"模式
    const continentsOnly = finalFactionCount === 0 && finalLocationCount === 0;

    if (continentsOnly) {
      // 仅生成大陆的简化提示词
      return this.buildContinentsOnlyPrompt(config);
    }

    // 动态计算地点分布 - 不再强制每个势力都有总部
    const cities = Math.max(2, Math.floor(finalLocationCount * 0.25));
    const specialSites = Math.max(2, Math.floor(finalLocationCount * 0.25));
    const dangerZones = Math.max(1, Math.floor(finalLocationCount * 0.15));
    const naturalLandmarks = Math.max(2, Math.floor(finalLocationCount * 0.2));
    const otherSites = Math.max(0, finalLocationCount - cities - specialSites - dangerZones - naturalLandmarks);

    // 特殊地点构成：固定比例，保证同一配置下提示词稳定（提示词管理据此判断用户是否改过）
    const opportunityRealms = Math.floor(finalSecretRealmCount * 0.45);
    const heritageRealms = Math.floor(finalSecretRealmCount * 0.35);
    const dangerousRealms = Math.max(0, finalSecretRealmCount - opportunityRealms - heritageRealms);

    const { minX, minY, maxX, maxY, mapWidth, mapHeight, gridRows, gridCols, xStep, yStep, gridNote } =
      computeMapGeometry(config.mapConfig, finalContinentCount);
    const scale = Math.max(0.6, Math.min(mapWidth, mapHeight) / 10000);
    const territoryMin = Math.max(120, Math.round(150 * scale));
    const territoryMax = Math.max(240, Math.round(400 * scale));
    const continentMin = Math.max(1000, Math.round(2000 * scale));
    const continentMax = Math.max(2400, Math.round(5000 * scale));

    const sampleXMin = Math.floor(minX + mapWidth * 0.23);
    const sampleXMax = Math.floor(minX + mapWidth * 0.27);
    const sampleYMin = Math.floor(minY + mapHeight * 0.13);
    const sampleYMax = Math.floor(minY + mapHeight * 0.17);
    const sampleX = Math.floor((sampleXMin + sampleXMax) / 2);
    const sampleY = Math.floor((sampleYMin + sampleYMax) / 2);

    return `# 世界地图生成：大洲 / 势力 / 地点

只输出一个 JSON 对象，恰好包含 continents、factions、locations 三个数组：
- continents：${finalContinentCount} 个大洲
- factions：${finalFactionCount} 个势力（不能为空）
- locations：${finalLocationCount} 个地点（不能为空）
不要代码块、注释、解释文字；不要输出 world_name / world_background / generation_info / player_spawn 等其他字段。

## 世界设定
${buildWorldSettingLines(config)}

${MODERN_EARTH_STYLE}

## 风格
- 全篇贴合上面的世界设定（现代地球·灵气复苏），命名用真实地名与国族，势力用现代组织形态
- 名称要有辨识度、互不重复
- 禁用词根：${BANNED_NAME_ROOTS}
- 势力类型比例参考：官方机构25-35% | 财团企业20-30% | 家族世家15-25% | 研究所学院10-15% | 教团结社10-15% | 妖族5-10%

## 坐标系（游戏坐标，不是经纬度）
- x: ${minX}-${maxX}，y: ${minY}-${maxY}，整数；原点(${minX},${minY})在左上角，x 向右增大，y 向下增大
- 所有点位距地图边缘至少 2% 宽高；同一大洲内的势力与地点分散在不同象限，禁止扎堆在地图中心或同一区域

## 大洲（${finalContinentCount}个）
网格分割：${gridRows}行 × ${gridCols}列，每格宽 ${xStep}、高 ${yStep}，每个大洲占一格，拼起来必须完整覆盖地图${gridNote}
- **大洲名必须用真实名称**（七大洲：亚洲/欧洲/非洲/北美洲/南美洲/大洋洲/南极洲）；数量少于7时按重要性取前几个
- 大洲边界：4-6 个点，按顺时针或逆时针排列成简单多边形（矩形、梯形或切角五边形；可在某条边中间加 1 个点做出凸起/凹陷）
- 相邻大洲共享网格角点，坐标完全一致，不留缝隙，不越过网格线
- 例：左上角大洲的四角是 (${minX},${minY}) (${minX + xStep},${minY}) (${minX + xStep},${minY + yStep}) (${minX},${minY + yStep})，其中 (${minX + xStep},${minY}) 同时是右侧大洲的左上角
- 地理特征 ≥3 个，天然屏障 ≥2 个；描述要写**真实的地理与气候**（如亚洲写东亚季风与青藏高原，欧洲写阿尔卑斯与地中海气候）
- 大洲跨度约 ${continentMin}-${continentMax}

## 势力（${finalFactionCount}个）
- 每个大洲都要有势力；位置与势力范围必须落在所属大洲边界内
- 势力范围：4-5 个点的简单多边形，按顺序排列；跨度按等级：超级≈${Math.round(territoryMax * 1.2)} | 一流≈${Math.round((territoryMin + territoryMax) / 2)} | 二流≈${Math.round(territoryMin * 0.9)} | 三流≈${Math.round(territoryMin * 0.7)}，整体约占大洲 3%-8%，不要画太大
- **现代组织形态**：官方机构 / 财团企业 / 家族世家 / 研究所学院 / 教团结社 / 妖族（见上方世界性质）
- 领导层（必填）：首脑（真实国族姓名）、首脑修为、最强修为、综合战力(1-100)、核心成员数/正式成员数/外围成员数
  （对应旧世界的"掌门/长老/弟子"，现代组织即 负责人/骨干/外围）
- **修为严格压低**（灵气复苏初期）：成员绝大多数是凡人（写"凡人"或留空）；觉醒者练气初期~中期；
  首脑与最强战力：三流≈练气中期 | 二流≈练气后期 | 一流≈练气圆满 | 超级≈筑基初期~圆满
  金丹仅限极个别组织的传说级人物，且全球不超过 3-5 人；**禁止元婴及以上**
- 成员数量（必填）：总数 = 按职位各项之和 = 按境界各项之和；按境界里的最高境界不超过最强修为
- 人名：按**所在国族**取真实风格姓名，全局唯一（不要清一色中式名）

## 地点（${finalLocationCount}个）
- **用真实地名**：城市、山川、地标都写现实存在的（如 上海、东京、纽约、开罗、悉尼、南极中山站）
- 类型取[值域规范]的地点类型；本模式用：名山大川 / 城镇坊市 / 洞天福地 / 奇珍异地 / 凶险之地 / 其他特殊
  （「宗门势力」留给地图上直接标注的势力所在地，由势力生成时产出）
- 数量分布：名山大川${naturalLandmarks} | 城镇坊市${cities} | 洞天福地+奇珍异地共${specialSites} | 凶险之地${dangerZones} | 其他特殊${otherSites}
- 其中 ${finalSecretRealmCount} 个带特殊属性（写进"特色"数组）：机遇之地${opportunityRealms} | 传承遗迹${heritageRealms} | 危险禁地${dangerousRealms}
- 灵气复苏后，部分真实地点发生异变（如 某地突现灵脉/凶兽出没/古遗迹显现）；描述要写得像真的新闻事件
- 坐标落在所属大洲边界内，彼此不重叠；每个大洲都要有地点
- 相关势力：列出控制或关联的势力名（中立地点可为空数组）

## 输出结构（字段名照抄，数值与名称只是格式示意——示意用的现代名称，不要照搬）
{
  "continents": [
    {
      "id": "continent_1",
      "名称": "亚洲",
      "描述": "东亚季风与青藏高原，人口稠密，灵气复苏后异象频发",
      "气候": "温带季风与亚热带季风",
      "地理特征": ["青藏高原", "长江黄河", "环太平洋地震带"],
      "天然屏障": ["喜马拉雅山脉", "太平洋"],
      "大洲边界": [{"x": ${minX}, "y": ${minY}}, {"x": ${minX + xStep}, "y": ${minY}}, {"x": ${minX + xStep}, "y": ${minY + yStep}}, {"x": ${minX}, "y": ${minY + yStep}}],
      "主要势力": ["faction_1"]
    }
  ],
  "factions": [
    {
      "id": "faction_1",
      "名称": "国家超凡事务管理局",
      "类型": "官方机构",
      "等级": "一流",
      "描述": "灵气复苏后由政府部门秘密组建，负责调查异象、管控觉醒者",
      "特色": ["官方背景", "资源雄厚"],
      "与玩家关系": "中立",
      "位置": {"x": ${sampleX}, "y": ${sampleY}},
      "势力范围": [{"x": ${sampleXMin}, "y": ${sampleYMin}}, {"x": ${sampleXMax}, "y": ${sampleYMin}}, {"x": ${sampleXMax}, "y": ${sampleYMax}}, {"x": ${sampleXMin}, "y": ${sampleYMax}}],
      "领导层": {"宗主": "陈正清", "宗主修为": "练气圆满", "副宗主": "李维安", "最强修为": "练气圆满", "综合战力": 62, "核心弟子数": 12, "内门弟子数": 80, "外门弟子数": 400},
      "成员数量": {
        "总数": 492,
        "按境界": {"凡人": 400, "练气初期": 60, "练气中期": 20, "练气后期": 10, "练气圆满": 2},
        "按职位": {"外门弟子": 400, "内门弟子": 80, "核心弟子": 12}
      },
      "所属大洲": "continent_1"
    }
  ],
  "locations": [
    {
      "id": "loc_1",
      "名称": "上海",
      "类型": "城镇坊市",
      "坐标": {"x": 2500, "y": 1500},
      "描述": "国际化大都市，超自然事务管理局华东分局所在；外滩一带曾出现极光状能量波动",
      "安全等级": "较安全",
      "特色": ["经济中心", "灵气复苏首批观测点"],
      "相关势力": ["国家超凡事务管理局"]
    }
  ]
}

## 输出前自检
1. 三个数组数量分别为 ${finalContinentCount} / ${finalFactionCount} / ${finalLocationCount}
2. 大洲用真实名称、边界 4-6 点、顺序正确、共享角点、无缝覆盖地图
3. 地点用真实地名；势力是现代组织形态；人物姓名与所在国族相符
4. 势力范围 ≥4 点且在所属大洲内；领导层与成员数量完整且数字自洽
5. **境界已压低**：成员绝大多数为凡人；最强战力不超过筑基圆满；元婴及以上一律不出现；金丹至多个别传说人物
6. 所有坐标是整数并在 x ${minX}-${maxX}、y ${minY}-${maxY} 内
7. 名称无重复、无禁用词根、无"宗门/掌门/弟子"这类旧称
`;
  }

  /**
   * 仅生成大陆的简化提示词
   * 用于开局优化模式，不生成势力和地点
   */
  static buildContinentsOnlyPrompt(config: WorldPromptConfig): string {
    const finalContinentCount = config.continentCount;
    const { minX, minY, maxX, maxY, gridRows, gridCols, xStep, yStep, gridNote } =
      computeMapGeometry(config.mapConfig, finalContinentCount);

    return `# 世界大陆框架生成（只生成大洲）

只输出一个 JSON 对象：continents 为 ${finalContinentCount} 个大洲，factions 与 locations 都是空数组 []（势力和地点会在游戏中逐步生成）。
不要代码块、注释或解释文字。

## 世界设定
${buildWorldSettingLines(config)}

## 风格
- **大洲名必须用真实的七大洲原名**（亚洲/欧洲/非洲/北美洲/南美洲/大洋洲/南极洲）
- 描述要写该洲**真实的地理与气候**，不要编造架空地理
- 禁用词根：${BANNED_NAME_ROOTS}

## 坐标系（游戏坐标，不是经纬度）
x: ${minX}-${maxX}，y: ${minY}-${maxY}，整数；原点(${minX},${minY})在左上角，x 向右增大，y 向下增大

## 大洲（${finalContinentCount}个）
网格分割：${gridRows}行 × ${gridCols}列，每格宽 ${xStep}、高 ${yStep}，每个大洲占一格，拼起来必须完整覆盖地图${gridNote}
- 大洲边界：4-6 个点，按顺时针或逆时针排列成简单多边形（可在某条边中间加 1 个点做出凸起/凹陷）
- 相邻大洲共享网格角点，坐标完全一致，不留缝隙，不越过网格线
- 例：左上角大洲的四角是 (${minX},${minY}) (${minX + xStep},${minY}) (${minX + xStep},${minY + yStep}) (${minX},${minY + yStep})
- 地理特征 ≥3 个，天然屏障 ≥2 个；描述写清真实地理、气候与文化

## 输出结构（字段名照抄）
{
  "continents": [
    {
      "id": "continent_1",
      "名称": "亚洲",
      "描述": "东亚季风与青藏高原，人口稠密，灵气复苏后异象频发",
      "气候": "温带季风与亚热带季风",
      "地理特征": ["青藏高原", "长江黄河", "环太平洋地震带"],
      "天然屏障": ["喜马拉雅山脉", "太平洋"],
      "大洲边界": [{"x": ${minX}, "y": ${minY}}, {"x": ${minX + xStep}, "y": ${minY}}, {"x": ${minX + xStep}, "y": ${minY + yStep}}, {"x": ${minX}, "y": ${minY + yStep}}],
      "主要势力": []
    }
  ],
  "factions": [],
  "locations": []
}
`;
  }
}



// ─── 境界地图集 - 新模式（不影响旧 buildPrompt）──────────────────────────────

/** NPC 位置摘要（精简传入，不传记忆/好感/属性） */
export interface NpcLocationHint {
  名字: string;      // NPC 姓名
  境界: string;      // NPC 当前境界
  当前位置: string;  // NPC 位置描述，如 "青云宗外门区"
}

/** 低境界已知一级地点（大陆/灵境）上下文 */
export interface RealmKnownContinentHint {
  名称: string;
  来源境界?: string;
  描述?: string;
}

/** 低境界已知二级地点上下文 */
export interface RealmKnownLocationHint {
  名称: string;
  类型?: string;
  描述?: string;
  坐标?: { x: number; y: number };
  来源境界?: string;
}

/** 境界感知地图生成配置 */
export interface RealmMapPromptConfig {
  // 角色信息
  /** 当前境界名称，如 "筑基期" */
  playerRealm: string;
  /** 完整境界体系序列（按修炼顺序），如 "凡人→练气期→筑基期→金丹期→..." */
  playerRealmContext: string;
  /** 角色出身背景 */
  playerBackground?: string;
  /** 所属宗门/势力（可无） */
  playerFaction?: string;
  /** 已知位置描述 */
  playerLocation?: string;

  // 世界信息
  worldName?: string;
  worldBackground?: string;
  worldEra?: string;

  // NPC 位置上下文（可选）
  npcHints?: NpcLocationHint[];

  // 低境界地图历史框架（仅作背景参考，不要求复写）
  historicalContinents?: RealmKnownContinentHint[];
  historicalLocations?: RealmKnownLocationHint[];

  // 地图坐标系配置
  mapConfig?: WorldMapConfig;
}

/** 境界感知提示词构建器（新模式专用） */
export class RealmMapPromptBuilder {
  /**
   * 构建境界专属地图的 AI 生成提示词。
   * 不使用硬编码数量，由 AI 根据境界自主决定规模和内容密度。
   */
  static buildPrompt(config: RealmMapPromptConfig): string {
    const {
      playerRealm,
      playerRealmContext,
      playerBackground,
      playerFaction,
      playerLocation,
      worldName,
      worldBackground,
      worldEra,
      npcHints,
      historicalContinents,
      historicalLocations,
      mapConfig,
    } = config;

    const minX = Number(mapConfig?.minLng ?? 0);
    const minY = Number(mapConfig?.minLat ?? 0);
    const width = Number(mapConfig?.width) || 10000;
    const height = Number(mapConfig?.height) || 10000;
    const maxX = minX + width;
    const maxY = minY + height;

    const lines: string[] = [];
    if (worldName) lines.push(`世界名称：${worldName}`);
    if (worldEra) lines.push(`世界纪元：${worldEra}`);
    if (worldBackground) lines.push(`世界背景：${worldBackground}`);
    if (playerBackground) lines.push(`角色背景：${playerBackground}`);
    lines.push(`所属势力/宗门：${playerFaction || '无'}`);
    if (playerLocation) lines.push(`已知所在位置：${playerLocation}`);

    const parseLocationPath = (desc: string): string[] =>
      String(desc || '')
        .split(/[·\-—→>＞/]/)
        .map((s) => s.trim())
        .filter(Boolean);

    const requiredNpcWorldLocations = Array.from(new Set(
      (npcHints ?? [])
        .map((n) => {
          const parts = parseLocationPath(n?.当前位置 || '');
          if (parts.length >= 2) return parts[1];
          if (parts.length === 1) return parts[0];
          return '';
        })
        .filter(Boolean)
    ));

    const npcSection = npcHints && npcHints.length > 0
      ? `\n\n## 已知相关人物（同境界，生成时必须优先覆盖其活动地点）\n${npcHints.map(n => `- ${n.名字}（${n.境界}）：${n.当前位置}`).join('\n')}`
      : '';
    const npcHardConstraintSection = requiredNpcWorldLocations.length > 0
      ? `\n\n## 同境界 NPC 地点硬约束（必须满足）
以下名称来自 NPC 位置路径的“世界地点层（字段2）”，请在 locations 中全部覆盖（名称需完全一致）：
${requiredNpcWorldLocations.map((name) => `- ${name}`).join('\n')}

若某地点主要是宗门/势力，也仍需在 locations 中保留同名地点锚点，避免出现“未收录地点”。`
      : '';

    const knownContinentLines = (historicalContinents ?? [])
      .filter((c) => String(c?.名称 || '').trim())
      .map((c) => {
        const name = String(c.名称).trim();
        const from = c.来源境界 ? `（来源：${c.来源境界}）` : '';
        const desc = c.描述 ? `：${c.描述}` : '';
        return `- ${name}${from}${desc}`;
      });

    const knownLocationLines = (historicalLocations ?? [])
      .filter((l) => String(l?.名称 || '').trim())
      .map((l) => {
        const name = String(l.名称).trim();
        const type = l.类型 ? ` [${l.类型}]` : '';
        const from = l.来源境界 ? `（来源：${l.来源境界}）` : '';
        const coord = l.坐标 && Number.isFinite(l.坐标.x) && Number.isFinite(l.坐标.y)
          ? ` @(${Math.round(l.坐标.x)},${Math.round(l.坐标.y)})`
          : '';
        return `- ${name}${type}${from}${coord}`;
      });

    const coveredTypes = Array.from(new Set(
      (historicalLocations ?? [])
        .map((l) => String(l?.类型 || '').trim())
        .filter(Boolean)
    ));
    const coveredTypesText = coveredTypes.length > 0 ? coveredTypes.join('、') : '暂无';

    const historicalSection = (knownContinentLines.length > 0 || knownLocationLines.length > 0)
      ? `\n\n## 低境界已知活动范围（世界框架背景，仅供参考）
以下信息来自低境界地图（境界1~${playerRealm}前），用于帮助你避免重复建设并补齐高阶区域：

### 已知一级地点（大陆/灵境）
${knownContinentLines.length > 0 ? knownContinentLines.join('\n') : '- 暂无'}

### 已知二级地点（地标/宗门/区域）
${knownLocationLines.length > 0 ? knownLocationLines.join('\n') : '- 暂无'}

### 低境界已覆盖类型
${coveredTypesText}`
      : '\n\n## 低境界已知活动范围（世界框架背景，仅供参考）\n暂无历史地图信息，可直接构建新境界地图。';

    // 输出格式说明段（使用变量拼接避免模板嵌套）
    const coordRange = `x 范围 [${minX}, ${maxX}]，y 范围 [${minY}, ${maxY}]`;
    const formatDesc = [
      '输出格式（只输出一个 JSON 对象，不要代码块、注释或说明文字）：',
      '{',
      '  "worldName": "世界名称",',
      '  "worldBackground": "世界背景简述",',
      '  "worldEra": "世界纪元",',
      '  "specialSettings": ["特殊设定"],',
      '  "continents": [{"name":"大洲名","description":"描述","climate":"气候","terrain_features":["地形"],"continent_bounds":[{"x":数字,"y":数字},...]}],',
      '  "factions": [{"name":"势力名","type":"修仙宗门|魔道宗门|...","level":"超级|一流|二流|三流","description":"描述","feature":"特色","location":{"x":数字,"y":数字},"leader":"宗主姓名","leaderRealm":"宗主境界(如金丹后期)","canJoin":true或false}],',
      '  "locations": [{"name":"地点名","type":"城池|宗门|秘境|险地|坊市|洞府|...","position":"描述性位置","coordinates":{"x":数字,"y":数字},"description":"描述","feature":"特色","safetyLevel":"安全|较安全|危险|极危险","openStatus":"开放|限制|封闭|未发现","relatedFactions":["相关势力"]}]',
      '}',
      '',
      '若境界较低，continents 可为空数组 []；factions 和 locations 的数量完全由你根据境界决定。',
    ].join('\n');

    return `你是修仙世界的地图设计师。请为处于【${playerRealm}】境界的角色生成一张专属世界地图。

## 角色与世界背景
${lines.join('\n')}
当前玩家境界：${playerRealm}
本世界完整境界体系（按修炼顺序）：${playerRealmContext}${npcSection}${historicalSection}
${npcHardConstraintSection}

## 核心要求

1. 地图规模自适应：参考上方境界体系序列，判断【${playerRealm}】在整个体系中的所处阶段。
   - 越早期的境界，地图越聚焦于角色周边局部区域（宗门/城镇/村落附近）
   - 越高阶的境界，地图越宏观（大陆级甚至多大陆格局）
   - 地点数量、势力数量、大陆数量不做硬性规定，由你自主决定，确保内容与该境界相称

2. 此地图仅代表【${playerRealm}】境界角色所能认知和涉足的世界范围，不是全世界地图。

3. 坐标系：游戏虚拟坐标，${coordRange}。坐标为整数，各地点间距不低于 200；地点坐标落在其所属大洲范围内。

4. 低境界已知地点仅作为背景参考，本次输出请聚焦【${playerRealm}】的新活动范围（只生成新内容，不复写旧地点）。

5. 禁止与“已知二级地点”重名；优先补充低境界未覆盖的高阶区域/类型。

6. 若上方提供了“同境界 NPC 地点硬约束”，则 locations 必须包含全部约束地点名（可额外扩展周边新地点）。

7. 命名贴合世界设定、互不重复；势力宗主写具体姓名，宗主境界与势力等级相称，且不超出本境界角色能接触的层次太多。

## ${formatDesc}`;
  }
}
