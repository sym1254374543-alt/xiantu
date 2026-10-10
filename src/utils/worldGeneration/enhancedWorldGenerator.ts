/**
 * 增强的世界生成器 - 集成数据校验和重试机制
 * 确保生成数据的质量和一致性
 */

import { getTavernHelper, isTavernEnv } from '../tavern';
import { EnhancedWorldPromptBuilder, type WorldPromptConfig, RealmMapPromptBuilder, type RealmMapPromptConfig } from './enhancedWorldPrompts';
import type { WorldInfo } from '@/types/game.d';
import { calculateSectData, type SectCalculationData } from './sectDataCalculator';
import { WorldMapConfig } from '@/types/worldMap';
import { promptStorage } from '@/services/promptStorage';
import { parseJsonSmart } from '@/utils/jsonExtract';
import { aiService } from '@/services/aiService';

// 重新定义 ValidationResult 接口，解除对外部文件的依赖
interface ValidationError {
  path: string;
  message: string;
  expected?: any;
  received?: any;
}
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

 interface RawWorldData {
   continents?: Record<string, any>[];
  factions?: Record<string, any>[];
  locations?: Record<string, any>[];
  [key: string]: any;
}

export interface EnhancedWorldGenConfig {
  worldName?: string;
  worldBackground?: string;
  worldEra?: string;
  factionCount: number;
  locationCount: number;
  secretRealmsCount: number;
  continentCount: number; // 新增大陆数量配置
  maxRetries: number;
  retryDelay: number;
  characterBackground?: string;
  mapConfig?: WorldMapConfig;
  onStreamChunk?: (chunk: string) => void; // 流式输出回调
  onRetry?: (attempt: number, reason: string) => void; // 重试回调（供加载遮罩显示）
  shouldAbort?: () => boolean; // 返回 true 时停止重试（用户取消）
  useStreaming?: boolean; // 是否使用流式传输（默认true）
  enableHehuanEasterEgg?: boolean; // 是否启用合欢宗彩蛋（仅在地图初始化时启用）
  existingFactions?: Array<{ 名称: string; 位置?: any; 势力范围?: any[] }>; // 现有势力（防止重叠）
  existingLocations?: Array<{ 名称: string; coordinates?: any }>; // 现有地点（防止重叠）
  /**
   * 现有大洲（追加势力/地点时必传）。
   * 追加模式下大洲不会重新生成，若不把既有边界喂给 AI，AI 会另排一套网格并按它摆势力，
   * 结果势力名与所在大洲错位（如中国机构被放进北美洲格）。
   */
  existingContinents?: Array<{ 名称?: string; 大洲边界?: any[] }>;
  /**
   * 指定势力（「按名字追加势力」用）。
   * 名称必须原样使用；`史实` 是从存档记忆/事件/叙事里检索到的相关片段，
   * 供 AI 把该势力写成与已发生的剧情一致的样子。
   */
  requiredFactions?: Array<{ 名称: string; 史实?: string[] }>;
}

export class EnhancedWorldGenerator {
  private config: EnhancedWorldGenConfig;
  private previousErrors: string[] = [];
  // 保存原始配置，用于重试时的数量计算
  private originalConfig: {
    factionCount: number;
    locationCount: number;
    secretRealmsCount: number;
    continentCount: number;
  };

  constructor(config: EnhancedWorldGenConfig) {
    this.config = config;
    // 保存原始数量配置
    this.originalConfig = {
      factionCount: config.factionCount,
      locationCount: config.locationCount,
      secretRealmsCount: config.secretRealmsCount,
      continentCount: config.continentCount
    };
  }

  /**
   * 生成验证过的世界数据 (重构后)
   */
  async generateValidatedWorld(): Promise<{ success: boolean; worldInfo?: WorldInfo; errors?: string[] }> {
    for (let i = 0; i <= this.config.maxRetries; i++) {
      if (this.config.shouldAbort?.()) {
        return { success: false, errors: ['已取消'] };
      }
      try {
        if (i > 0) {
          this.config.onRetry?.(i, this.previousErrors[0] ?? '');
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * i));
          this.reduceCountsForRetry(i);
        }

        const worldData = await this.generateWorldData();
        const validationResult = this.validateWorldData(worldData);

        if (validationResult.isValid) {
          return { success: true, worldInfo: worldData };
        } else {
          this.previousErrors = validationResult.errors.map(e => e.message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.previousErrors = [message];
      }
    }

    return { success: false, errors: this.previousErrors };
  }

  /**
   * 重试时减少数量参数，降低token消耗
   * 注意："仅生成大陆"模式下只减少大陆数量
   * @param retryCount 当前重试次数
   */
  private reduceCountsForRetry(retryCount: number): void {
    const reductionFactor = 0.8;
    const factor = Math.pow(reductionFactor, retryCount);

    // "仅生成大陆"模式：只减少大陆数量
    if (this.originalConfig.factionCount === 0) {
      this.config.continentCount = Math.max(2, Math.floor(this.originalConfig.continentCount * factor));
      return;
    }

    // 完整世界生成模式：减少所有数量
    this.config.factionCount = Math.max(3, Math.floor(this.originalConfig.factionCount * factor));
    this.config.locationCount = Math.max(5, Math.floor(this.originalConfig.locationCount * factor));
    this.config.secretRealmsCount = Math.max(2, Math.floor(this.originalConfig.secretRealmsCount * factor));
    this.config.continentCount = Math.max(2, Math.floor(this.originalConfig.continentCount * factor));
  }

  /**
   * 生成世界数据 (重构后)
   */
  private async generateWorldData(): Promise<WorldInfo> {
    const tavern = getTavernHelper();
    if (!tavern) {
      throw new Error('AI服务未初始化，请在设置中配置AI服务');
    }

    const prompt = await this.buildPromptWithErrors();

    // 🔥 检查是否启用了强JSON模式
    const forceJsonMode = aiService.isForceJsonEnabled('world_generation');
    console.log('[世界生成] 强JSON模式:', forceJsonMode);

    try {
      const orderedPrompts: Array<{ role: 'system' | 'user'; content: string }> = [
        {
          role: 'user',
          content: prompt
        },
        {
          role: 'user',
          content: '请根据上述要求生成完整的世界数据JSON。'
        }
      ];

      const response = await tavern.generateRaw({
        ordered_prompts: orderedPrompts,
        should_stream: this.config.useStreaming !== false,
        usageType: 'world_generation',
        overrides: {
          world_info_before: '',
          world_info_after: ''
        },
        onStreamChunk: (chunk: string) => {
          if (this.config.onStreamChunk) {
            this.config.onStreamChunk(chunk);
          }
        }
      });

      // 处理返回值：可能是字符串或对象
      let responseText: string;
      if (response && typeof response === 'object' && 'text' in response) {
        responseText = (response as { text: string }).text;
      } else if (typeof response === 'string') {
        responseText = response;
      } else {
        responseText = String(response);
      }

      console.log('[世界生成] 响应长度:', responseText?.length || 0);

      const worldData = this.parseAIResponse(responseText, forceJsonMode);
      return this.convertToWorldInfo(worldData);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`AI生成失败: ${message}`);
    }
  }

  /**
   * 构建带有错误修正信息的提示词
   * 注意：重试时不添加错误信息，因为数量参数已调整
   */
  private async buildPromptWithErrors(): Promise<string> {
    return await this.buildPrompt();
  }

  /**
   * 构建基础提示词
   * 优先使用用户自定义的提示词，如果没有则使用默认生成的
   */
  private async buildPrompt(): Promise<string> {
      // 优先从 promptStorage 获取用户修改过的提示词
      const customPrompt = await promptStorage.get('worldGeneration');

      // 🔥 彩蛋：合欢宗生成由调用方决定（通过 enableHehuanEasterEgg 参数）
      const shouldGenerateHehuan = this.config.enableHehuanEasterEgg && isTavernEnv();
      if (shouldGenerateHehuan) {
        console.log('[世界生成] 🎲 彩蛋触发：将强制生成合欢宗');
      }

      // 获取默认提示词用于比较
      // 🔥 使用 originalConfig 确保重试时提示词和第一次一样
      const { factionCount, locationCount, secretRealmsCount, continentCount } = this.originalConfig;
      const promptConfig: WorldPromptConfig = {
        factionCount,
        totalLocations: locationCount,
        secretRealms: secretRealmsCount,
        continentCount,
        characterBackground: this.config.characterBackground,
        worldBackground: this.config.worldBackground,
        worldEra: this.config.worldEra,
        worldName: this.config.worldName,
        mapConfig: this.config.mapConfig
      };
      const defaultPrompt = EnhancedWorldPromptBuilder.buildPrompt(promptConfig);

      // 🔥 注入合欢宗要求
      // 注入块单独累积：它们是"本次生成的世界事实约束"，与提示词风格无关，
      // 因此即便用户自定义了 worldGeneration 提示词也必须带上（否则指定势力/已有大洲会静默失效）
      let injections = '';

      if (shouldGenerateHehuan) {
        injections += `

【特殊要求】
请务必在势力列表中包含一个名为"合欢宗"的势力：
- 类型：修仙宗门（古老道统，此彩蛋视为已提前复苏）
- 等级：二流 或 三流（必须明确填写，不能为空）
- 特色：以双修采补闻名，风气开放
- 领导层中必须包含"圣女"字段（圣女姓名）`;
      }

      // 🔥 按名字追加势力：用户指定了势力名，必须原样生成
      injections += this.buildRequiredFactionsBlock();

      // 🔥 注入现有地点和势力信息（防止重叠）
      if (this.config.existingFactions?.length || this.config.existingLocations?.length) {
        injections += `

【已有地点势力（禁止重叠）】
新生成的地点和势力必须避开以下已有位置，坐标不能重叠：`;
        if (this.config.existingFactions?.length) {
          const factionList = this.config.existingFactions.map(f =>
            `- ${f.名称}${f.位置 ? `(位置:${JSON.stringify(f.位置)})` : ''}`
          ).join('\n');
          injections += `\n已有势力：\n${factionList}`;
        }
        if (this.config.existingLocations?.length) {
          const locationList = this.config.existingLocations.map(l =>
            `- ${l.名称}${l.coordinates ? `(坐标:x=${l.coordinates.x},y=${l.coordinates.y})` : ''}`
          ).join('\n');
          injections += `\n已有地点：\n${locationList}`;
        }
      }

      // 🔥 追加模式下大洲已确定：把既有边界喂给 AI 并要求照抄，否则 AI 会另排网格、
      // 按自己的网格摆新势力，导致势力名与所在大洲错位（用户报障"北美和亚洲反了"）。
      if (this.config.existingContinents?.length) {
        const continentList = this.config.existingContinents
          .map(c => `- ${c.名称}${c.大洲边界?.length ? ` 边界:${JSON.stringify(c.大洲边界)}` : ''}`)
          .join('\n');
        injections += `

【已有大洲（照抄，禁止重新设计）】
本次是在**已有世界**上追加内容，大洲已经确定——不要重新生成、不要重新排列大洲。
continents 数组必须原样照抄下列大洲（名称、顺序、边界坐标一字不改）：
${continentList}
新生成的势力与地点的坐标，必须落在**对应大洲**的边界内，且势力名与所在大洲的地域相符
（如中国机构放亚洲、美国机构放北美洲、欧洲机构放欧洲）。`;
      }

      let basePrompt = defaultPrompt;
      // 如果用户有自定义提示词且不为空，使用自定义的
      // 注意：promptStorage.get 在用户未修改时会返回默认值，所以需要检查是否真的被修改过
      if (customPrompt && customPrompt.trim()) {
        // 检查是否是用户修改过的（通过检查 modified 标记）
        const allPrompts = await promptStorage.loadAll();
        if (allPrompts['worldGeneration']?.modified) {
          basePrompt = customPrompt;
        }
      }

      return basePrompt + injections;
    }

  /**
   * 「按名字追加势力」的注入块：用户指定了势力名时，要求 AI 原样生成这些势力，
   * 并把从记忆里检索到的史实一并给出，使其与已发生的剧情一致。
   */
  private buildRequiredFactionsBlock(): string {
    const list = this.originalConfigRequiredFactions();
    if (!list.length) return '';
    const lines = list.map((f) => {
      const lore = (f.史实 || []).slice(0, 6);
      return [
        `### ${f.名称}`,
        '- 名称必须一字不改地使用；类型/等级/位置按世界背景与下列史实推断，坐标落在相应大洲内',
        '- 必须写全 领导层（首领/首领修为/副手）与 主要成员（3-6 个具名人物）',
        lore.length ? '- 剧情里已经提到过它，必须与下列史实一致：' : '- 剧情里尚未细写，按名字的字面含义合理发挥',
        ...lore.map((t) => `  · ${t}`),
      ].join('\n');
    });
    return `

【指定势力（必须生成，名称原样使用）】
本次必须生成且**只生成**下列 ${list.length} 个势力（factions 数组长度 = ${list.length}）：
${lines.join('\n')}`;
  }

  private originalConfigRequiredFactions(): Array<{ 名称: string; 史实?: string[] }> {
    return this.config.requiredFactions ?? [];
  }

  /**
   * 解析AI响应 - 智能处理强JSON模式和普通模式
   * @param response AI返回的原始文本
   * @param forceJsonMode 是否启用强JSON模式（API返回纯JSON）
   */
  private parseAIResponse(response: string, forceJsonMode: boolean = false): RawWorldData {
    try {
      // 1. 移除 <thinking> 标签（reasoner模型可能包含）
      let text = response.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
      text = text.replace(/<thinking>[\s\S]*/gi, ''); // 处理未闭合的情况

      console.log('[世界生成] 清理thinking后长度:', text?.length || 0);

      // 2. 使用智能JSON解析（根据forceJsonMode自动选择策略）
      const worldDataRaw = parseJsonSmart<RawWorldData>(text.trim(), forceJsonMode);

      // 3. 处理嵌套的 world_data
      const data = worldDataRaw.world_data && typeof worldDataRaw.world_data === 'object'
        ? worldDataRaw.world_data
        : worldDataRaw;

      return {
        continents: Array.isArray(data.continents) ? data.continents : [],
        factions: Array.isArray(data.factions) ? data.factions : [],
        locations: Array.isArray(data.locations) ? data.locations : []
      };

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[世界生成] JSON解析失败:', message);
      console.error('[世界生成] 原始响应前1000字符:', response?.substring(0, 1000));
      throw new Error(`JSON解析失败: ${message}`);
    }
  }

  /**
   * 转换为标准WorldInfo格式
   */
  private convertToWorldInfo(rawData: RawWorldData): WorldInfo {
    return {
      世界名称: this.config.worldName || rawData.world_name || rawData.worldName || '修仙界',
      世界背景: this.config.worldBackground || rawData.world_background || rawData.worldBackground || '',
      大陆信息: (rawData.continents || []).map((continent: Record<string, any>) => ({
        名称: continent.名称 || continent.name || '未名大陆',
        描述: continent.描述 || continent.description || '一片神秘的修仙大陆，灵气充沛，势力林立',
        地理特征: continent.terrain_features || continent.地理特征 || [],
        修真环境: continent.cultivation_environment || continent.修真环境 || '灵气充沛，适宜修行',
        气候: continent.climate || continent.气候 || '四季分明，温和宜人',
        天然屏障: continent.natural_barriers || continent.天然屏障 || [],
        大洲边界: continent.continent_bounds || continent.大洲边界 || []
      })),
      势力信息: (rawData.factions || []).map((faction: Record<string, any>) => {
        // 世界生成提示词要求输出中文键（领导层/主要成员），旧生成器用英文键，两种都接
        const rawLeadership = faction.leadership ?? faction.领导层;

        // 领导层键名：新提示词用 首领/首领修为/副手，旧数据用 宗主/宗主修为/副宗主。
        // 两种都读——只读旧键会丢掉 AI 按新规则给出的首领姓名。
        const leaderName = rawLeadership?.首领 ?? rawLeadership?.宗主;
        const leaderRealm = rawLeadership?.首领修为 ?? rawLeadership?.宗主修为;
        const deputyName = rawLeadership?.副手 ?? rawLeadership?.副宗主;

        const calculated = calculateSectData({
          名称: faction.name || faction.名称,
          类型: faction.type || faction.类型 || '官方机构',
          等级: faction.level || faction.等级 || '三流',
          宗主修为: leaderRealm,
        } as SectCalculationData);
        const factionName = String(faction.name || faction.名称 || '');
        const isHehuan = factionName.includes('合欢');

        // 每个具名职位都要带修为（提示词用 副手修为，旧数据可能写 副宗主修为）
        const deputyRealm = rawLeadership?.副手修为 ?? rawLeadership?.副宗主修为;
        const leadership = rawLeadership
          ? {
              宗主: leaderName,
              宗主修为: leaderRealm,
              副宗主: deputyName ?? undefined,
              副宗主修为: deputyRealm ?? undefined,
              圣女: isHehuan ? (rawLeadership.圣女 ?? undefined) : undefined,
              圣女修为: isHehuan ? (rawLeadership.圣女修为 ?? undefined) : undefined,
              圣子: isHehuan ? (rawLeadership.圣子 ?? undefined) : undefined,
              圣子修为: isHehuan ? (rawLeadership.圣子修为 ?? undefined) : undefined,
              太上长老: rawLeadership.太上长老 ?? undefined,
              太上长老修为: rawLeadership.太上长老修为 ?? undefined,
            }
          : undefined;

        // 具名成员名单（编制）：中文键 主要成员，兼容英文 members
        const rawMembers = faction.主要成员 ?? faction.members;
        const 主要成员 = Array.isArray(rawMembers)
          ? rawMembers
              .map((m: Record<string, any>) => ({
                名字: String(m.名字 ?? m.name ?? '').trim(),
                职位: String(m.职位 ?? m.position ?? m.title ?? '').trim(),
                境界: String(m.境界 ?? m.realm ?? '').trim() || undefined,
              }))
              .filter((m: { 名字: string }) => !!m.名字)
          : undefined;

        const territoryInfo = faction.territoryInfo
          ? {
              controlledAreas: faction.territoryInfo.controlledAreas || [],
              influenceRange: faction.territoryInfo.influenceRange,
              strategicValue: faction.territoryInfo.strategicValue
            }
          : undefined;

        return {
          名称: faction.name || faction.名称,
          类型: faction.type || faction.类型,
          等级: faction.level || faction.等级,
          位置: faction.location || faction.headquarters || faction.位置,
          势力范围: faction.territory || faction.territory_bounds || faction.势力范围 || [],
          描述: faction.description || faction.描述,
          特色: faction.specialties || faction.features || faction.特色 || [],
          与玩家关系: faction.与玩家关系 || '中立',
          声望值: calculated.声望值,

          // 同时提供中英字段，兼容旧UI/新生成器
          领导层: leadership,
          leadership,

          主要成员: 主要成员 && 主要成员.length ? 主要成员 : undefined,

          势力范围详情: territoryInfo
            ? {
                控制区域: territoryInfo.controlledAreas,
                影响范围: territoryInfo.influenceRange,
                战略价值: territoryInfo.strategicValue
              }
            : undefined,
          territoryInfo,

          可否加入: faction.canJoin !== undefined ? !!faction.canJoin : true,
          canJoin: faction.canJoin !== undefined ? !!faction.canJoin : true,
          加入条件: faction.joinRequirements || [],
          joinRequirements: faction.joinRequirements || [],
          加入好处: faction.benefits || [],
          benefits: faction.benefits || []
        };
      }),
      地点信息: (rawData.locations || []).map((location: Record<string, any>) => ({
        名称: location.name || location.名称,
        类型: location.type || location.类型,
        位置: location.位置,
        coordinates: location.coordinates || location.坐标,
        描述: location.description || location.描述,
        特色: location.features || location.特色,
        安全等级: location.safety_level || location.danger_level || location.安全等级 || '较安全',
        开放状态: location.status || location.开放状态 || '开放',
        相关势力: location.related_factions || location.相关势力 || [],
        特殊功能: location.special_functions || location.特殊功能 || []
      })),
      地图配置: this.config.mapConfig || (rawData as any).地图配置 || (rawData as any).map_config || {
        width: 10000,
        height: 10000,
        minLng: 0,
        maxLng: 10000,
        minLat: 0,
        maxLat: 10000,
      },
      生成时间: new Date().toISOString(),
      世界纪元: this.config.worldEra || rawData.world_era || '修仙纪元',
      特殊设定: rawData.special_settings || [],
      版本: '2.0-Enhanced'
    };
  }

  /**
   * 校验世界数据 (重构后)
   */
  private validateWorldData(worldInfo: WorldInfo): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [] };
    this.performCustomValidation(worldInfo, result);

    if (!result.isValid) {
      this.previousErrors = result.errors.map(e => e.message);
    }

    return result;
  }

  /**
   * 执行自定义校验
   * 注意：不再检查数量，AI生成多少就是多少
   */
  private performCustomValidation(worldInfo: WorldInfo, result: ValidationResult): void {
    // 势力数量和地点数量不再检查，AI生成多少都接受
    // 超级宗门数量也不再限制，避免因数量问题导致生成失败

    // 检查名称唯一性
    const factionNames = worldInfo.势力信息.map(f => f.名称);
    const uniqueFactionNames = new Set(factionNames);
    if (factionNames.length !== uniqueFactionNames.size) {
      result.errors.push({
        path: '势力信息.名称',
        message: '势力名称存在重复',
        expected: '所有名称唯一',
        received: '存在重复名称'
      });
    }

    const locationNames = worldInfo.地点信息.map(l => l.名称);
    const uniqueLocationNames = new Set(locationNames);
    if (locationNames.length !== uniqueLocationNames.size) {
      result.errors.push({
        path: '地点信息.名称',
        message: '地点名称存在重复',
        expected: '所有名称唯一',
        received: '存在重复名称'
      });
    }

    // 世界名称与用户选择一致性
    if (this.config.worldName && worldInfo.世界名称 !== this.config.worldName) {
      result.errors.push({
        path: '世界名称',
        message: '世界名称必须与玩家选择一致',
        expected: this.config.worldName,
        received: worldInfo.世界名称
      });
    }

    result.isValid = result.errors.length === 0;
  }
}

// ─── 境界地图集 - 独立生成入口（新模式）────────────────────────────────────────

/** 境界地图生成配置 */
export interface RealmMapGenConfig extends RealmMapPromptConfig {
  maxRetries?: number;
  onStreamChunk?: (chunk: string) => void;
}

/** 境界地图生成结果 */
export interface RealmMapGenResult {
  success: boolean;
  worldInfo?: WorldInfo;
  errors?: string[];
}

const parseLocationPath = (desc: string): string[] => String(desc || '')
  .split(/[·\-—→>＞/]/)
  .map((s) => s.trim())
  .filter(Boolean);

const extractNpcWorldLocationName = (locationDesc: string): string => {
  const parts = parseLocationPath(locationDesc);
  if (parts.length >= 2) return parts[1];
  if (parts.length === 1) return parts[0];
  return '';
};

/**
 * 生成一张境界专属世界地图（境界地图集模式专用）。
 * 复用现有 AI 调用和 JSON 解析逻辑，不依赖 EnhancedWorldGenerator 的数量配置。
 */
export async function generateRealmMap(config: RealmMapGenConfig): Promise<RealmMapGenResult> {
  const maxRetries = config.maxRetries ?? 2;
  const prompt = RealmMapPromptBuilder.buildPrompt(config);
  const helper = isTavernEnv() ? getTavernHelper() : null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let rawText = '';

      if (helper) {
        const response = await helper.generateRaw({
          ordered_prompts: [
            { role: 'user', content: prompt },
            { role: 'user', content: '请直接输出 JSON，不要任何解释文字。' },
          ],
          should_stream: !!config.onStreamChunk,
          usageType: 'world_generation',
          overrides: { world_info_before: '', world_info_after: '' },
          onStreamChunk: (chunk: string) => { if (config.onStreamChunk) config.onStreamChunk(chunk); },
        });
        rawText = typeof response === 'string' ? response : (response as any)?.text ?? '';
      } else {
        rawText = await aiService.generateRaw({
          ordered_prompts: [
            { role: 'user', content: prompt },
            { role: 'user', content: '请直接输出 JSON，不要任何解释文字。' },
          ],
          should_stream: !!config.onStreamChunk,
          usageType: 'world_generation',
          onStreamChunk: config.onStreamChunk,
        });
      }

      rawText = rawText.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
      rawText = rawText.replace(/<thinking>[\s\S]*/gi, '').trim();

      const raw = parseJsonSmart<Record<string, any>>(rawText);
      if (!raw || typeof raw !== 'object') throw new Error('AI 返回的 JSON 格式无效');

      // 新境界地图应生成“新增地点”，不应与低境界已知地点重名
      const knownLocationNameSet = new Set(
        (config.historicalLocations ?? [])
          .map((l: any) => String(l?.名称 || l?.name || '').trim())
          .filter(Boolean)
      );
      const duplicatedKnownNames = ((raw.locations ?? []) as any[])
        .map((l: any) => String(l?.name ?? l?.名称 ?? '').trim())
        .filter((name: string) => !!name && knownLocationNameSet.has(name));
      if (duplicatedKnownNames.length > 0) {
        const uniq = Array.from(new Set(duplicatedKnownNames)).slice(0, 8);
        throw new Error(`生成结果包含低境界已知地点（需生成新增地点）：${uniq.join('、')}`);
      }

      // 同境界 NPC 世界地点（字段2）必须被本次 locations 覆盖，否则重试
      const requiredNpcLocationNames = Array.from(new Set(
        (config.npcHints ?? [])
          .map((n: any) => extractNpcWorldLocationName(String(n?.当前位置 || '')))
          .filter(Boolean)
      ));
      if (requiredNpcLocationNames.length > 0) {
        const generatedLocationNameSet = new Set(
          ((raw.locations ?? []) as any[])
            .map((l: any) => String(l?.name ?? l?.名称 ?? '').trim())
            .filter(Boolean)
        );
        const missingNpcLocationNames = requiredNpcLocationNames.filter(
          (name) => !generatedLocationNameSet.has(name)
        );
        if (missingNpcLocationNames.length > 0) {
          throw new Error(
            `生成结果未覆盖同境界 NPC 所在地点：${missingNpcLocationNames.slice(0, 12).join('、')}`
          );
        }
      }

      const continents = (raw.continents ?? []).map((c: any) => ({
        名称: c.name ?? c.名称 ?? '未命名大洲',
        描述: c.description ?? c.描述 ?? '',
        气候: c.climate ?? c.气候 ?? '',
        地理特征: c.terrain_features ?? c.地理特征 ?? [],
        大洲边界: c.continent_bounds ?? c.大洲边界 ?? [],
        主要势力: c.main_factions ?? c.主要势力 ?? [],
      }));

      const factions = (raw.factions ?? []).map((f: any) => ({
        名称: f.name ?? f.名称 ?? '未命名势力',
        类型: f.type ?? f.类型 ?? '官方机构',
        等级: f.level ?? f.等级 ?? '三流',
        描述: f.description ?? f.描述 ?? '',
        特色: f.feature ?? f.特色 ?? '',
        位置: f.location ?? f.位置 ?? '',
        与玩家关系: f.playerRelation ?? f.与玩家关系 ?? '中立',
        可否加入: f.canJoin ?? f.可否加入 ?? false,
        领导层: f.leaderRealm ? { 宗主: f.leader ?? '未知', 宗主修为: f.leaderRealm } : undefined,
        主要成员: Array.isArray(f.members) && f.members.length ? f.members : undefined,
      }));

      const locations = (raw.locations ?? []).map((l: any) => ({
        名称: l.name ?? l.名称 ?? '未命名地点',
        类型: l.type ?? l.类型 ?? '地点',
        位置: l.position ?? l.位置 ?? '',
        coordinates: l.coordinates ?? undefined,
        描述: l.description ?? l.描述 ?? '',
        特色: l.feature ?? l.特色 ?? '',
        安全等级: l.safetyLevel ?? l.安全等级 ?? '较安全',
        开放状态: l.openStatus ?? l.开放状态 ?? '开放',
        相关势力: l.relatedFactions ?? l.相关势力 ?? [],
        targetRealm: config.playerRealm,
      }));

      const worldInfo: WorldInfo = {
        世界名称: raw.worldName ?? raw.世界名称 ?? config.worldName ?? '修仙界',
        大陆信息: continents,
        势力信息: factions,
        地点信息: locations,
        区域地图: [],
        生成时间: new Date().toISOString(),
        世界背景: raw.worldBackground ?? raw.世界背景 ?? config.worldBackground ?? '',
        世界纪元: raw.worldEra ?? raw.世界纪元 ?? config.worldEra ?? '',
        特殊设定: raw.specialSettings ?? raw.特殊设定 ?? [],
        版本: '3.0-realm',
        targetRealm: config.playerRealm,
      };

      return { success: true, worldInfo };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[generateRealmMap] 第 ${attempt + 1} 次尝试失败:`, msg);
      if (attempt === maxRetries) return { success: false, errors: [msg] };
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  return { success: false, errors: ['超出最大重试次数'] };
}
