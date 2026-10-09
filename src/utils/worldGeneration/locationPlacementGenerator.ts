/**
 * 地点坐标 AI 定位器
 * 当 NPC 位置描述中出现世界地图未收录的地点时，
 * 调用 AI 根据世界上下文推断该地点应在地图上的坐标。
 */

import { getTavernHelper } from '../tavern';
import { parseJsonSmart } from '../jsonExtract';
import { promptStorage } from '@/services/promptStorage';
import { LOCATION_TYPES } from '@/utils/prompts/definitions/valueDomains';

/**
 * 地点类型的一句话说明。键必须与 valueDomains 的 LOCATION_TYPES 完全一致——
 * 用 Record<typeof LOCATION_TYPES[number], string> 约束，新增类型漏写会编译报错。
 */
const LOCATION_TYPE_DESC: Record<(typeof LOCATION_TYPES)[number], string> = {
  山川湖海: '自然地标（山脉、河流、湖泊、海岸）',
  城镇都市: '人类聚居地（城市、城镇、村落、街区）',
  势力据点: '势力的总部或分部（官方机构、财团、家族、研究所、教团；古老道统的道场亦属此类）',
  灵脉宝地: '灵气浓郁、适宜修炼之处',
  异变区域: '灵气复苏后出现异常的地点（异象、遗迹现世、生物异变）',
  凶险之地: '危险区域（凶兽领地、失控地带、禁地）',
  其他特殊: '不属于以上各类的特殊地点',
};

// ─── 类型 ─────────────────────────────────────────────────────────────────

export interface LocationPlacementParams {
  /** 新地点的候选名称（从 NPC 描述提取的最深未匹配段） */
  locationName: string;
  /** NPC 所在描述的完整路径，如"苍冥灵境·七玄山脉·青石村" */
  locationDesc: string;
  /** 所属大陆名 */
  continentName: string;
  /** 大陆边界点（用于约束坐标范围） */
  continentBounds?: { x: number; y: number }[];
  /** 相关 NPC 的名字 */
  npcName: string;
  /** NPC 境界 */
  npcRealm?: string;
  /** NPC 所属势力 */
  npcFaction?: string;
  /** 世界现有地点列表（防止坐标重叠） */
  existingLocations: Array<{ 名称?: string; name?: string; 坐标?: { x: number; y: number }; x?: number; y?: number }>;
  /** 地图宽高（用于坐标约束） */
  mapSize: { width: number; height: number };
}

export interface LocationPlacementResult {
  success: boolean;
  location?: {
    名称: string;
    类型: string;
    描述: string;
    坐标: { x: number; y: number };
    所属大陆?: string;
  };
  error?: string;
}

// ─── 默认提示词模板 ─────────────────────────────────────────────────────────

const DEFAULT_PROMPT = `你是修仙世界的地图规划师。为一个新出现的地点确定它在世界地图上的坐标。

【坐标系规则】
- 坐标中心为 (5000, 5000)，向东 x 增大，向西 x 减小，向南 y 增大，向北 y 减小
- 坐标为整数；若下文给出了所属大陆的范围，必须落在该范围内

【境界与活动范围约束】
- 凡人/练气期：只活动在本大陆较小范围内，距离宗门/城镇不超过大陆范围的 1/4
- 筑基期：可活动于整个所属大陆
- 金丹期及以上：可跨大陆活动

【地点类型】
${LOCATION_TYPES.map((t) => `- ${t}：${LOCATION_TYPE_DESC[t]}`).join('\n')}

【定位思路】
- 结合位置描述路径：路径里的上级地点附近优先
- 结合 NPC 境界：低境界 NPC 的常驻地点应靠近已有城镇/势力据点
- 与已有地点保持至少 200 的距离

【严格输出】只输出一个 JSON 对象，不要代码块或解释文字；名称照抄待确定地点名，类型从上面各类中选：
{"名称":"地点名称","类型":"城镇都市","描述":"一句话描述","坐标":{"x":数字,"y":数字}}`;

// ─── 主函数 ─────────────────────────────────────────────────────────────────

export async function generateLocationPlacement(
  params: LocationPlacementParams
): Promise<LocationPlacementResult> {
  const tavern = getTavernHelper();
  if (!tavern) {
    return { success: false, error: 'AI 服务未初始化，请在设置中配置 AI 服务' };
  }

  const {
    locationName,
    locationDesc,
    continentName,
    continentBounds,
    npcName,
    npcRealm,
    npcFaction,
    existingLocations,
    mapSize,
  } = params;

  // 读取用户自定义提示词基础部分
  const customBase = await promptStorage.get('locationPlacement');
  const baseRule = customBase?.trim() || DEFAULT_PROMPT;

  // 计算大陆边界范围（用于提示 AI）
  let boundsHint = '';
  if (continentBounds && continentBounds.length > 0) {
    const xs = continentBounds.map((p) => p.x);
    const ys = continentBounds.map((p) => p.y);
    const minX = Math.min(...xs).toFixed(0);
    const maxX = Math.max(...xs).toFixed(0);
    const minY = Math.min(...ys).toFixed(0);
    const maxY = Math.max(...ys).toFixed(0);
    boundsHint = `【重要约束】该地点位于「${continentName}」，坐标必须严格限制在其范围内：x ∈ [${minX}, ${maxX}]，y ∈ [${minY}, ${maxY}]。严禁超出此边界，否则在世界地图上会显示在其他大陆！`;
  } else {
    boundsHint = `地图总范围：x ∈ [1000, ${mapSize.width - 1000}]，y ∈ [1000, ${mapSize.height - 1000}]`;
  }

  // 已有地点列表（防止重叠）
  const existingList = existingLocations
    .slice(0, 30) // 最多 30 个，避免 token 过多
    .map((loc) => {
      const name = loc.名称 || loc.name || '?';
      const x = loc.坐标?.x ?? loc.x ?? '?';
      const y = loc.坐标?.y ?? loc.y ?? '?';
      return `${name}(${x},${y})`;
    })
    .join('、');

  const contextPrompt = `
【待确定地点】
地点名称：${locationName}
位置描述路径：${locationDesc}
所属大陆：${continentName}
${boundsHint}

【相关 NPC 信息】
NPC：${npcName}
境界：${npcRealm || '未知'}
所属势力：${npcFaction || '无'}

【已有地点（坐标不要与这些重叠，最小距离 200）】
${existingList || '暂无'}

请根据以上信息，结合 NPC 境界判断该地点的合理范围，输出地点的坐标和基本信息。`;

  try {
    const response = await tavern.generateRaw({
      ordered_prompts: [
        { role: 'user', content: `${baseRule}\n${contextPrompt}` },
        { role: 'user', content: '请直接输出 JSON，不要有任何其他文字。' },
      ],
      should_stream: false,
      usageType: 'world_generation',
      overrides: { world_info_before: '', world_info_after: '' },
    });

    let responseText: string;
    if (response && typeof response === 'object' && 'text' in response) {
      responseText = (response as { text: string }).text;
    } else if (typeof response === 'string') {
      responseText = response;
    } else {
      responseText = String(response);
    }

    // 移除 thinking 标签
    const cleaned = responseText
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<thinking>[\s\S]*/gi, '')
      .trim();

    const raw = parseJsonSmart<{
      名称?: string;
      类型?: string;
      描述?: string;
      坐标?: { x: number; y: number };
    }>(cleaned);

    if (!raw.坐标 || !Number.isFinite(raw.坐标.x) || !Number.isFinite(raw.坐标.y)) {
      return { success: false, error: 'AI 返回数据格式错误，缺少坐标' };
    }

    let finalX = Math.round(raw.坐标.x);
    let finalY = Math.round(raw.坐标.y);

    if (continentBounds && continentBounds.length > 0) {
      const xs = continentBounds.map((p) => p.x);
      const ys = continentBounds.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      // Clamp coordinates to continent bounding box if out of bounds
      const marginX = Math.max(10, (maxX - minX) * 0.05);
      const marginY = Math.max(10, (maxY - minY) * 0.05);

      if (finalX < minX) finalX = minX + marginX + Math.random() * marginX;
      if (finalX > maxX) finalX = maxX - marginX - Math.random() * marginX;
      if (finalY < minY) finalY = minY + marginY + Math.random() * marginY;
      if (finalY > maxY) finalY = maxY - marginY - Math.random() * marginY;
    } else {
      // Fallback: clamp to world map boundaries
      finalX = Math.max(100, Math.min(mapSize.width - 100, finalX));
      finalY = Math.max(100, Math.min(mapSize.height - 100, finalY));
    }

    return {
      success: true,
      location: {
        名称: locationName,
        类型: raw.类型 || '城镇都市',
        描述: raw.描述 || '',
        坐标: { x: Math.round(finalX), y: Math.round(finalY) },
        所属大陆: continentName,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[地点定位] 失败:', message);
    return { success: false, error: message };
  }
}
