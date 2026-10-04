/**
 * 向量记忆服务
 *
 * 使用共享 Embedding API 存储长期记忆向量，实现智能检索
 * 支持标签提取、向量化、相似度检索
 *
 * 特点：
 * - 纯前端实现，存储统一在 LocalMemoryIndex（services/localMemoryIndex.ts）的 fact 分区
 * - 使用 API 管理里分配给 Embedding 的共享 API
 * - 支持标签过滤 + 向量相似度混合检索
 * - 保留全量发送模式作为备选
 */

import type { APIProvider } from '@/services/aiService';
import { isTavernEnv } from '@/utils/tavern';
import {
  createEmbeddings,
  isEmbeddingFunctionEnabled,
  normalizeToUnitVector,
  resolveEmbeddingConfig,
  type EmbeddingRequestConfig,
} from '@/services/embeddingService';
import {
  hashContent,
  localMemoryIndex,
  type MemoryRecord,
  type MemoryRecordInput,
  type RecallLog,
} from '@/services/localMemoryIndex';
import { bindMemoryScope, getBoundMemoryScope, resolveMemoryScope } from '@/services/memoryIndexContext';

// ============ 类型定义 ============

export interface VectorMemoryEntry {
  id: string;
  content: string;
  tags: string[];
  /** 向量已量化存储在本地索引中，检索结果不再携带原始向量 */
  vector?: number[];
  vectorType?: 'tfidf' | 'embedding';
  embeddingModel?: string;
  timestamp: number;
  importance: number;
  category: 'combat' | 'social' | 'cultivation' | 'exploration' | 'event' | 'other';
  metadata?: {
    npcs?: string[];
    locations?: string[];
    items?: string[];
    time?: string;
  };
}

export interface MemorySearchResult {
  entry: VectorMemoryEntry;
  score: number;
  matchedTags: string[];
}

export interface VectorMemoryConfig {
  enabled: boolean;
  maxRetrieveCount: number;  // 最多检索多少条
  minSimilarity: number;     // 最低相似度阈值
  tagWeight: number;         // 标签匹配权重 (0-1)
  vectorWeight: number;      // 向量相似度权重 (0-1)
  embeddingApiId?: string;   // Embedding API ID（可选，默认使用 'embedding' 类型分配的API）
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: VectorMemoryConfig = {
  enabled: false,  // 默认关闭，保留全量发送
  maxRetrieveCount: 10,
  minSimilarity: 0.3,
  tagWeight: 0.4,
  vectorWeight: 0.6,
  embeddingApiId: undefined,  // 默认使用 'embedding' 类型分配的API
};

// ============ 中文分词和关键词提取 ============

// 修仙相关关键词词典
const CULTIVATION_KEYWORDS = new Set([
  // 境界
  '凡人', '练气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '渡劫', '飞升',
  '初期', '中期', '后期', '圆满', '极境', '突破', '瓶颈',
  // 修炼
  '修炼', '闭关', '悟道', '感悟', '丹田', '经脉', '灵气', '真气', '法力', '神识',
  // 战斗
  '战斗', '交手', '斩杀', '击败', '重伤', '轻伤', '濒死', '陨落',
  // 物品
  '丹药', '法宝', '灵石', '功法', '秘籍', '材料', '灵草',
  // 关系
  '师父', '徒弟', '道友', '敌人', '仇人', '盟友', '宗门', '门派',
  // 地点
  '洞府', '山门', '秘境', '禁地', '坊市', '城池',
  // 事件
  '拜师', '入门', '出关', '历练', '任务', '机缘', '劫难',
]);

// 停用词
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '有', '和', '与', '或', '也', '都', '就', '着', '被', '让',
  '把', '给', '从', '到', '向', '往', '对', '于', '为', '而', '但', '却', '因', '所',
  '这', '那', '它', '他', '她', '我', '你', '们', '自', '其', '此', '彼',
  '一', '个', '些', '很', '更', '最', '非', '不', '无', '没', '未',
]);

/**
 * 简单中文分词（基于词典 + 单字切分）
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];

  // 先提取词典中的关键词
  for (const keyword of CULTIVATION_KEYWORDS) {
    if (text.includes(keyword)) tokens.push(keyword);
  }

  // 提取人名（两到四个汉字，前后没有常见词缀）
  const namePattern = /[\u4e00-\u9fa5]{2,4}/g;
  let match;
  while ((match = namePattern.exec(text)) !== null) {
    const word = match[0];
    if (!STOP_WORDS.has(word) && !CULTIVATION_KEYWORDS.has(word)) {
      tokens.push(word);
    }
  }

  return [...new Set(tokens)]; // 去重
}

/**
 * 从记忆内容中提取标签
 */
export function extractTags(content: string): string[] {
  const tags: string[] = [];
  const tokens = tokenize(content);

  for (const token of tokens) {
    // 优先添加修仙关键词
    if (CULTIVATION_KEYWORDS.has(token)) {
      tags.push(token);
    }
  }

  // 提取可能的人名（连续2-3个汉字，不在词典中）
  const namePattern = /[\u4e00-\u9fa5]{2,3}/g;
  let match;
  while ((match = namePattern.exec(content)) !== null) {
    const word = match[0];
    if (!STOP_WORDS.has(word) && !CULTIVATION_KEYWORDS.has(word)) {
      // 可能是人名或地名
      if (tags.length < 15) {
        tags.push(word);
      }
    }
  }

  return [...new Set(tags)].slice(0, 20); // 最多20个标签
}

/**
 * 推断记忆分类
 */
export function inferCategory(content: string, tags: string[]): VectorMemoryEntry['category'] {
  const combatKeywords = ['战斗', '交手', '斩杀', '击败', '重伤', '攻击', '防御'];
  const socialKeywords = ['师父', '徒弟', '道友', '拜师', '结交', '好感', '关系'];
  const cultivationKeywords = ['修炼', '闭关', '突破', '感悟', '境界', '功法'];
  const explorationKeywords = ['探索', '发现', '秘境', '历练', '寻找'];
  const eventKeywords = ['机缘', '劫难', '事件', '任务', '完成'];

  const check = (keywords: string[]) =>
    keywords.some(k => content.includes(k) || tags.includes(k));

  if (check(combatKeywords)) return 'combat';
  if (check(socialKeywords)) return 'social';
  if (check(cultivationKeywords)) return 'cultivation';
  if (check(explorationKeywords)) return 'exploration';
  if (check(eventKeywords)) return 'event';
  return 'other';
}

// ============ 向量记忆服务类 ============

const FACT_KIND = 'fact' as const;

function stableMemoryId(content: string): string {
  return `mem_${hashContent(content)}`;
}

function toEntry(record: MemoryRecord): VectorMemoryEntry {
  const extra = record.extra || {};
  return {
    id: record.id,
    content: record.content,
    tags: extra.tags || [],
    vectorType: 'embedding',
    embeddingModel: record.model,
    timestamp: record.timestamp,
    importance: extra.importance ?? 5,
    category: (extra.category as VectorMemoryEntry['category']) || 'other',
    metadata: extra.npcs ? { npcs: extra.npcs } : undefined,
  };
}

function buildFactInput(content: string, vector: number[], model: string, importance: number): MemoryRecordInput {
  const tags = extractTags(content);
  return {
    id: stableMemoryId(content),
    content,
    model,
    vector,
    extra: {
      tags,
      category: inferCategory(content, tags),
      importance,
      npcs: tags.filter(t => !CULTIVATION_KEYWORDS.has(t)).slice(0, 5),
    },
  };
}

/**
 * 长期记忆检索（LocalMemoryIndex 的 fact 分区）
 * 对外接口与旧版保持一致；存储已统一到 services/localMemoryIndex.ts。
 */
class VectorMemoryService {
  private config: VectorMemoryConfig;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loadConfig();
  }

  /**
   * 绑定到指定存档的本地索引
   * @param saveSlot `${角色ID}_${存档槽位}`，见 utils/saveIdentity.ts
   */
  async init(saveSlot: string): Promise<void> {
    await bindMemoryScope(saveSlot);
  }

  /**
   * 加载配置
   */
  private loadConfig(): void {
    try {
      const saved = localStorage.getItem('vectorMemoryConfig');
      if (saved) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[向量记忆] 加载配置失败，使用默认配置');
    }
  }

  /**
   * 保存配置
   */
  saveConfig(config: Partial<VectorMemoryConfig>): void {
    this.config = { ...this.config, ...config };
    localStorage.setItem('vectorMemoryConfig', JSON.stringify(this.config));
  }

  /**
   * 获取当前配置
   */
  getConfig(): VectorMemoryConfig {
    return { ...this.config };
  }

  /**
   * 是否启用向量检索：必须开启长期检索配置，并配置共享 Embedding API
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.getEmbeddingRequestConfig();
  }

  /**
   * 是否允许自动写入索引：长期检索和叙事检索共用 API 管理里的 Embedding 配置
   */
  canAutoIndex(): boolean {
    return !!getBoundMemoryScope() && !!this.getEmbeddingRequestConfig();
  }

  private getEmbeddingRequestConfig(): EmbeddingRequestConfig | null {
    return resolveEmbeddingConfig(this.config.embeddingApiId);
  }

  getEmbeddingStatus(): { available: boolean; provider?: APIProvider; model?: string; reason?: string } {
    if (!isEmbeddingFunctionEnabled()) {
      return { available: false, reason: '叙事检索未开启。到「API 管理 → 功能分配」打开开关，并指定独立的 Embedding API' };
    }
    const cfg = this.getEmbeddingRequestConfig();
    if (cfg) return { available: true, provider: cfg.provider, model: cfg.model };

    if (isTavernEnv()) {
      return { available: false, reason: '酒馆环境下需为 Embedding 分配独立API（非默认）并填写 Key/模型' };
    }
    return {
      available: false,
      reason:
        '请在 API管理 中为 Embedding 配置 API 地址/Key/模型；硅基流动推荐使用 BAAI/bge-m3 模型；阿里百炼请用 DashScope 原生域名',
    };
  }

  private async embedBatch(texts: string[]): Promise<{ vectors: number[][]; model: string } | null> {
    const cfg = this.getEmbeddingRequestConfig();
    if (!cfg) return null;
    try {
      const vecs = await createEmbeddings(cfg, texts);
      if (vecs.length !== texts.length) return null;
      return { vectors: vecs.map(v => normalizeToUnitVector(v)), model: cfg.model };
    } catch (e) {
      console.warn('[长期检索] Embedding 生成失败，跳过向量写入/检索:', e);
      return null;
    }
  }

  /**
   * 添加记忆到向量库
   */
  async addMemory(content: string, importance: number = 5): Promise<VectorMemoryEntry | null> {
    const scope = await resolveMemoryScope();
    if (!scope) {
      console.warn('[向量记忆] 没有激活存档，跳过写入');
      return null;
    }

    const trimmed = (content || '').trim();
    if (!trimmed) return null;

    const embedded = await this.embedBatch([trimmed]);
    if (!embedded) return null;

    const input = buildFactInput(trimmed, embedded.vectors[0], embedded.model, importance);
    await localMemoryIndex.put(scope, FACT_KIND, [input]);
    const record = localMemoryIndex.get(scope, FACT_KIND, input.id);
    return record ? toEntry(record) : null;
  }

  /**
   * 重建向量库：清空后将长期记忆全部向量化写入
   * - 必须使用 API 管理里分配给 Embedding 的独立 API，不做本地向量兜底
   */
  async rebuildFromLongTermMemories(
    memories: string[],
    options?: {
      importance?: number;
      batchSize?: number;
      onProgress?: (done: number, total: number) => void;
    },
  ): Promise<{ imported: number; vectorType: 'embedding'; embeddingModel?: string }> {
    const scope = await resolveMemoryScope();
    if (!scope) throw new Error('向量库未初始化');
    if (!this.getEmbeddingRequestConfig()) throw new Error('未配置独立 Embedding API，无法生成长期检索索引');

    return localMemoryIndex.withLock(scope, FACT_KIND, async () => {
      const list = [...new Set((memories || []).map(m => (m || '').trim()).filter(Boolean))];
      const total = list.length;
      const importance = options?.importance ?? 7;
      const batchSize = Math.max(1, Math.min(64, options?.batchSize ?? 24));

      await localMemoryIndex.clear(scope, FACT_KIND);

      let imported = 0;
      let usedEmbeddingModel: string | undefined;
      for (let i = 0; i < list.length; i += batchSize) {
        const chunk = list.slice(i, i + batchSize);
        const embedded = await this.embedBatch(chunk);
        if (!embedded) throw new Error('Embedding 生成失败，长期检索索引未写入完整');
        usedEmbeddingModel = embedded.model;
        imported += await localMemoryIndex.put(
          scope,
          FACT_KIND,
          chunk.map((content, j) => buildFactInput(content, embedded.vectors[j], embedded.model, importance)),
        );
        options?.onProgress?.(Math.min(i + chunk.length, total), total);
      }

      console.log(`[长期检索] 重建完成：${imported}/${total} 条，Embedding=${usedEmbeddingModel || 'unknown'}`);
      return { imported, vectorType: 'embedding' as const, embeddingModel: usedEmbeddingModel };
    });
  }

  /**
   * 批量导入长期记忆
   */
  async importLongTermMemories(memories: string[]): Promise<number> {
    const { added } = await this.syncFromLongTermMemories(memories, { removeMissing: false });
    console.log(`[向量记忆] 导入 ${added} 条长期记忆`);
    return added;
  }

  /**
   * 将当前存档的长期记忆增量同步成本地向量索引。
   * - 只为新增、或由其他 Embedding 模型生成的条目调用 Embedding
   * - 已从存档删除的长期记忆会从索引移除
   */
  async syncFromLongTermMemories(
    memories: string[],
    options?: {
      importance?: number;
      batchSize?: number;
      removeMissing?: boolean;
      onProgress?: (done: number, total: number) => void;
    },
  ): Promise<{ added: number; removed: number; total: number }> {
    const scope = await resolveMemoryScope();
    if (!scope) throw new Error('向量库未初始化');
    const cfg = this.getEmbeddingRequestConfig();
    if (!cfg) throw new Error('未配置独立 Embedding API，无法同步长期检索索引');

    return localMemoryIndex.withLock(scope, FACT_KIND, async () => {
      const list = [...new Set((memories || []).map(m => (m || '').trim()).filter(Boolean))];
      const expectedIds = new Set(list.map(content => stableMemoryId(content)));

      let removed = 0;
      if (options?.removeMissing !== false) {
        const stale = localMemoryIndex.list(scope, FACT_KIND).filter(r => !expectedIds.has(r.id)).map(r => r.id);
        removed = await localMemoryIndex.remove(scope, FACT_KIND, stale);
      }

      const pending = list.filter(content => {
        const existing = localMemoryIndex.get(scope, FACT_KIND, stableMemoryId(content));
        return !existing || existing.model !== cfg.model;
      });
      const batchSize = Math.max(1, Math.min(64, options?.batchSize ?? 24));
      const importance = options?.importance ?? 7;
      let added = 0;

      for (let i = 0; i < pending.length; i += batchSize) {
        const chunk = pending.slice(i, i + batchSize);
        const embedded = await this.embedBatch(chunk);
        if (!embedded) throw new Error('Embedding 生成失败，长期检索索引未写入完整');
        added += await localMemoryIndex.put(
          scope,
          FACT_KIND,
          chunk.map((content, j) => buildFactInput(content, embedded.vectors[j], embedded.model, importance)),
        );
        options?.onProgress?.(Math.min(i + chunk.length, pending.length), pending.length);
      }

      if (added || removed) {
        console.log(`[长期检索] 索引同步完成：新增 ${added} 条，移除 ${removed} 条，总数 ${list.length}`);
      }
      return { added, removed, total: list.length };
    });
  }

  /**
   * 检索相关记忆
   */
  async searchMemories(query: string, context?: {
    currentLocation?: string;
    involvedNpcs?: string[];
    recentEvents?: string[];
  }): Promise<MemorySearchResult[]> {
    if (!this.isEnabled()) return [];
    const scope = await resolveMemoryScope();
    if (!scope) return [];
    if (localMemoryIndex.list(scope, FACT_KIND).length === 0) return [];

    const queryTags = extractTags(query);
    if (context?.involvedNpcs) queryTags.push(...context.involvedNpcs);
    if (context?.currentLocation) queryTags.push(context.currentLocation);

    const queryTextForEmbedding = [
      query,
      context?.currentLocation ? `地点: ${context.currentLocation}` : '',
      ...(context?.recentEvents || []).slice(0, 3).map(e => `事件: ${e}`),
    ].filter(Boolean).join('\n');

    const embeddedQuery = await this.embedBatch([queryTextForEmbedding]);
    if (!embeddedQuery) return [];

    const hits = localMemoryIndex.search(scope, FACT_KIND, embeddedQuery.vectors[0], embeddedQuery.model);
    const scored = hits.map(hit => {
      const entry = toEntry(hit.record);
      const matchedTags = entry.tags.filter(t => queryTags.includes(t));
      const tagScore = matchedTags.length / Math.max(queryTags.length, 1);
      const score = tagScore * this.config.tagWeight + hit.score * this.config.vectorWeight;
      return { hit, result: { entry, score, matchedTags } as MemorySearchResult };
    });

    scored.sort((a, b) => b.result.score - a.result.score);
    // 长期记忆检索会替代全量长期记忆发送，因此没有条目过阈值时仍取最相近的 TopK
    const filtered = scored.filter(r => r.result.score >= this.config.minSimilarity);
    const picked = (filtered.length > 0 ? filtered : scored).slice(0, this.config.maxRetrieveCount);

    localMemoryIndex.recordRecall(
      scope,
      FACT_KIND,
      query,
      picked.map(p => ({ record: p.hit.record, score: p.result.score })),
    );
    return picked.map(p => p.result);
  }

  /**
   * 获取当前存档的全部长期检索条目
   */
  async getAllMemories(): Promise<VectorMemoryEntry[]> {
    const scope = await resolveMemoryScope();
    if (!scope) return [];
    return localMemoryIndex.list(scope, FACT_KIND).map(toEntry);
  }

  /**
   * 获取记忆统计
   */
  async getStats(): Promise<{
    total: number;
    byCategory: Record<string, number>;
    topTags: { tag: string; count: number }[];
    byVectorType: Record<string, number>;
    byEmbeddingModel: Record<string, number>;
    /** 与当前 Embedding 模型一致、可参与检索的条目数 */
    usable: number;
  }> {
    const scope = await resolveMemoryScope();
    if (!scope) {
      return { total: 0, byCategory: {}, topTags: [], byVectorType: {}, byEmbeddingModel: {}, usable: 0 };
    }

    const memories = localMemoryIndex.list(scope, FACT_KIND).map(toEntry);
    const byCategory: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    for (const mem of memories) {
      byCategory[mem.category] = (byCategory[mem.category] || 0) + 1;
      for (const tag of mem.tags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }

    const topTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const stats = localMemoryIndex.stats(scope, FACT_KIND, this.getEmbeddingRequestConfig()?.model);
    return {
      total: stats.total,
      byCategory,
      topTags,
      byVectorType: stats.total ? { embedding: stats.total } : {},
      byEmbeddingModel: stats.byModel,
      usable: stats.usable,
    };
  }

  /**
   * 清空当前存档的长期检索索引
   */
  async clear(): Promise<void> {
    const scope = await resolveMemoryScope();
    if (!scope) return;
    await localMemoryIndex.clear(scope, FACT_KIND);
    console.log('[向量记忆] 已清空向量库');
  }

  /** 最近一次长期记忆召回（供记忆中心展示） */
  getLastRecall(): RecallLog | null {
    return localMemoryIndex.getLastRecall(FACT_KIND, getBoundMemoryScope() ?? undefined);
  }

  /**
   * 格式化检索结果为发送给 AI 的文本
   */
  formatForAI(results: MemorySearchResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const lines = [
      '# 【长期记忆检索结果】',
      '以下内容来自本角色当前存档的“长期记忆”向量检索结果，是已经总结沉淀的事实、关系、承诺、重大事件或长期状态。',
      '使用要求：只在与当前输入相关时参考这些记忆来保持连续性；不要把它们当作本轮新发生的剧情；不要逐条复述；如果与当前情境冲突，以当前游戏状态和最新叙事为准。',
      '',
    ];
    let index = 1;
    for (const { entry, matchedTags, score } of results) {
      const tagStr = matchedTags.length > 0 ? `[${matchedTags.join(',')}]` : '';
      const scoreStr = Number.isFinite(score) ? `相似度 ${score.toFixed(3)}` : '相似度未知';
      lines.push(`${index}. ${tagStr ? `${tagStr} ` : ''}${entry.content}（${scoreStr}）`);
      index++;
    }
    return lines.join('\n');
  }
}

// 导出单例
export const vectorMemoryService = new VectorMemoryService();
