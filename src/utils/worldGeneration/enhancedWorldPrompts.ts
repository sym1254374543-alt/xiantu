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

## 风格
- 命名、境界体系、势力类型都贴合上面的世界设定（武侠世界用门派/帮会与后天/先天/宗师，修仙世界用宗门/世家与练气/筑基/金丹……），全篇风格统一
- 名称要有辨识度、互不重复，避免方位词（东域/西洲）与模板化命名
- 禁用词根：${BANNED_NAME_ROOTS}
- 势力类型比例参考：宗门40-50% | 世家20-30% | 魔道10-20% | 散修联盟10-15% | 商会5-15% | 妖族5-10%

## 坐标系（游戏坐标，不是经纬度）
- x: ${minX}-${maxX}，y: ${minY}-${maxY}，整数；原点(${minX},${minY})在左上角，x 向右增大，y 向下增大
- 所有点位距地图边缘至少 2% 宽高；同一大洲内的势力与地点分散在不同象限，禁止扎堆在地图中心或同一区域

## 大洲（${finalContinentCount}个）
网格分割：${gridRows}行 × ${gridCols}列，每格宽 ${xStep}、高 ${yStep}，每个大洲占一格，拼起来必须完整覆盖地图${gridNote}
- 大洲边界：4-6 个点，按顺时针或逆时针排列成简单多边形（矩形、梯形或切角五边形；可在某条边中间加 1 个点做出凸起/凹陷）
- 相邻大洲共享网格角点，坐标完全一致，不留缝隙，不越过网格线
- 例：左上角大洲的四角是 (${minX},${minY}) (${minX + xStep},${minY}) (${minX + xStep},${minY + yStep}) (${minX},${minY + yStep})，其中 (${minX + xStep},${minY}) 同时是右侧大洲的左上角
- 地理特征 ≥3 个，天然屏障 ≥2 个；描述写清地理、气候与文化；每个大洲 1-3 个主要势力
- 大洲跨度约 ${continentMin}-${continentMax}

## 势力（${finalFactionCount}个）
- 每个大洲都要有势力；位置与势力范围必须落在所属大洲边界内
- 势力范围：4-5 个点的简单多边形，按顺序排列；跨度按等级：超级≈${Math.round(territoryMax * 1.2)} | 一流≈${Math.round((territoryMin + territoryMax) / 2)} | 二流≈${Math.round(territoryMin * 0.9)} | 三流≈${Math.round(territoryMin * 0.7)}，整体约占大洲 3%-8%，不要画太大
- 领导层（必填）：宗主（具体姓名或道号）、宗主修为、最强修为、综合战力(1-100)、核心/内门/外门弟子数；大势力可加 副宗主、太上长老、太上长老修为
- 修为写作"大境界+阶段"，如"化神中期""元婴圆满"；宗主修为参考等级：三流金丹 | 二流元婴 | 一流化神 | 超级炼虚
- 成员数量（必填）：总数 = 按职位各项之和 = 按境界各项之和；按境界里的最高境界不超过最强修为
- 人名：具体中式姓名（2-3字或复姓），全局唯一

## 地点（${finalLocationCount}个）
- 类型取[值域规范]的地点类型；本模式用：名山大川 / 城镇坊市 / 洞天福地 / 奇珍异地 / 凶险之地 / 其他特殊
  （「宗门势力」留给地图上直接标注的宗门所在地，由势力生成时产出）
- 数量分布：名山大川${naturalLandmarks} | 城镇坊市${cities} | 洞天福地+奇珍异地共${specialSites} | 凶险之地${dangerZones} | 其他特殊${otherSites}
- 其中 ${finalSecretRealmCount} 个带特殊属性（写进"特色"数组）：机遇之地${opportunityRealms} | 传承遗迹${heritageRealms} | 危险禁地${dangerousRealms}
- 坐标落在所属大洲边界内，彼此不重叠；每个大洲都要有地点
- 相关势力：列出控制或关联的势力名（中立地点可为空数组）

## 输出结构（字段名照抄，数值只是格式示意）
{
  "continents": [
    {
      "id": "continent_1",
      "名称": "大洲名",
      "描述": "地理、气候与文化",
      "气候": "气候类型",
      "地理特征": ["特征1", "特征2", "特征3"],
      "天然屏障": ["屏障1", "屏障2"],
      "大洲边界": [{"x": ${minX}, "y": ${minY}}, {"x": ${minX + xStep}, "y": ${minY}}, {"x": ${minX + xStep}, "y": ${minY + yStep}}, {"x": ${minX}, "y": ${minY + yStep}}],
      "主要势力": ["faction_1"]
    }
  ],
  "factions": [
    {
      "id": "faction_1",
      "名称": "势力名",
      "类型": "修仙宗门",
      "等级": "一流",
      "描述": "背景与历史",
      "特色": ["专长1", "专长2"],
      "与玩家关系": "中立",
      "位置": {"x": ${sampleX}, "y": ${sampleY}},
      "势力范围": [{"x": ${sampleXMin}, "y": ${sampleYMin}}, {"x": ${sampleXMax}, "y": ${sampleYMin}}, {"x": ${sampleXMax}, "y": ${sampleYMax}}, {"x": ${sampleXMin}, "y": ${sampleYMax}}],
      "领导层": {"宗主": "姓名", "宗主修为": "化神中期", "副宗主": "姓名", "最强修为": "化神圆满", "综合战力": 80, "核心弟子数": 50, "内门弟子数": 300, "外门弟子数": 1200},
      "成员数量": {
        "总数": 1600,
        "按境界": {"练气期": 1220, "筑基期": 310, "金丹期": 55, "元婴期": 12, "化神期": 3},
        "按职位": {"外门弟子": 1200, "内门弟子": 300, "核心弟子": 50, "传承弟子": 10, "执事": 20, "长老": 16, "太上长老": 2, "副掌门": 1, "掌门": 1}
      },
      "所属大洲": "continent_1"
    }
  ],
  "locations": [
    {
      "id": "loc_1",
      "名称": "地点名",
      "类型": "城镇坊市",
      "坐标": {"x": 2500, "y": 1500},
      "描述": "地点描述",
      "安全等级": "安全",
      "特色": ["灵气充沛"],
      "相关势力": ["势力名"]
    }
  ]
}

## 输出前自检
1. 三个数组数量分别为 ${finalContinentCount} / ${finalFactionCount} / ${finalLocationCount}
2. 大洲边界 4-6 点、顺序正确、共享角点、无缝覆盖地图
3. 势力范围 ≥4 点且在所属大洲内；领导层与成员数量完整且数字自洽
4. 所有坐标是整数并在 x ${minX}-${maxX}、y ${minY}-${maxY} 内
5. 名称无重复、无禁用词根
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
- 大洲命名贴合世界设定，有辨识度，避免方位词与模板化命名
- 禁用词根：${BANNED_NAME_ROOTS}

## 坐标系（游戏坐标，不是经纬度）
x: ${minX}-${maxX}，y: ${minY}-${maxY}，整数；原点(${minX},${minY})在左上角，x 向右增大，y 向下增大

## 大洲（${finalContinentCount}个）
网格分割：${gridRows}行 × ${gridCols}列，每格宽 ${xStep}、高 ${yStep}，每个大洲占一格，拼起来必须完整覆盖地图${gridNote}
- 大洲边界：4-6 个点，按顺时针或逆时针排列成简单多边形（可在某条边中间加 1 个点做出凸起/凹陷）
- 相邻大洲共享网格角点，坐标完全一致，不留缝隙，不越过网格线
- 例：左上角大洲的四角是 (${minX},${minY}) (${minX + xStep},${minY}) (${minX + xStep},${minY + yStep}) (${minX},${minY + yStep})
- 地理特征 ≥3 个，天然屏障 ≥2 个；描述写清地理、气候与文化

## 输出结构（字段名照抄）
{
  "continents": [
    {
      "id": "continent_1",
      "名称": "大洲名",
      "描述": "地理、气候与文化",
      "气候": "气候类型",
      "地理特征": ["特征1", "特征2", "特征3"],
      "天然屏障": ["屏障1", "屏障2"],
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
