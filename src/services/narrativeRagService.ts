/**
 * 叙事 RAG 检索服务
 *
 * 来自“织界”的 RAG 方案适配版：
 * - 只索引系统历史中的 assistant/GM 叙事文本，不索引玩家输入
 * - 存储统一在 LocalMemoryIndex（services/localMemoryIndex.ts）的 narrative 分区，每个存档独立作用域
 * - 必须使用 API 管理里分配给 Embedding 的独立 API；未配置或失败时不建索引、不检索
 * - 发送前检索相关叙事片段，作为轻量上下文注入主提示词；失败时返回空串，不阻塞主流程
 */
import type { APIProvider } from '@/services/aiService';
import {
  createEmbeddings,
  isEmbeddingFunctionEnabled,
  normalizeToUnitVector,
  resolveEmbeddingConfig,
  type EmbeddingRequestConfig,
} from '@/services/embeddingService';
import { hashContent, localMemoryIndex, type MemoryRecord, type RecallLog } from '@/services/localMemoryIndex';
import { bindMemoryScope, getBoundMemoryScope, resolveMemoryScope } from '@/services/memoryIndexContext';

export interface NarrativeRagEntry {
  id: string;
  content: string;
  /** 向量已量化存储在本地索引中，条目不再携带原始向量 */
  vector?: number[];
  vectorType: 'hash' | 'embedding';
  embeddingModel?: string;
  narrativeIndex: number;
  timestamp: number;
  time?: string;
}

export interface NarrativeRagSearchResult {
  entry: NarrativeRagEntry;
  score: number;
}

export interface NarrativeRagConfig {
  enabled: boolean;
  topK: number;
  minSimilarity: number;
  maxContextChars: number;
  autoIndex: boolean;
}

const DEFAULT_CONFIG: NarrativeRagConfig = {
  enabled: false,
  topK: 4,
  minSimilarity: 0.6,
  maxContextChars: 1500,
  autoIndex: true,
};

const NARRATIVE_KIND = 'narrative' as const;
/** 发送前自动补齐最多处理的批次数；其余缺口留给后续轮次或手动同步，避免首轮请求被长时间阻塞 */
const PRE_SEND_MAX_BATCHES = 2;

function stableNarrativeId(index: number, content: string): string {
  return `nar_${index}_${hashContent(content)}`;
}

function toEntry(record: MemoryRecord): NarrativeRagEntry {
  return {
    id: record.id,
    content: record.content,
    vectorType: 'embedding',
    embeddingModel: record.model,
    narrativeIndex: record.ordinal,
    timestamp: record.timestamp,
    time: record.extra?.time,
  };
}

function getNarrativeItems(saveData: any): Array<{ index: number; content: string; time?: string }> {
  const list = saveData?.系统?.历史?.叙事;
  if (!Array.isArray(list)) return [];

  const result: Array<{ index: number; content: string; time?: string }> = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== 'object') continue;
    const role = String(item.role || '');
    const type = String(item.type || '');
    if (role && role !== 'assistant') continue;
    if (type && type !== 'gm' && type !== 'assistant') continue;

    const content = String(item.content || '').trim();
    if (!content) continue;
    result.push({ index: i, content, time: typeof item.time === 'string' ? item.time : undefined });
  }
  return result;
}

class NarrativeRagService {
  private config: NarrativeRagConfig = { ...DEFAULT_CONFIG };

  constructor() {
    this.loadConfig();
  }

  /**
   * 绑定到指定存档的本地索引
   * @param saveSlot `${角色ID}_${存档槽位}`，见 utils/saveIdentity.ts
   */
  async init(saveSlot: string): Promise<void> {
    await bindMemoryScope(saveSlot || 'default');
  }

  private loadConfig(): void {
    try {
      const raw = localStorage.getItem('narrativeRagConfig');
      if (raw) this.config = this.normalizeConfig(JSON.parse(raw));
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  private normalizeConfig(input: Partial<NarrativeRagConfig>): NarrativeRagConfig {
    return {
      enabled: input.enabled === true,
      topK: Math.max(1, Math.min(20, Math.floor(Number(input.topK) || DEFAULT_CONFIG.topK))),
      minSimilarity: Math.max(0.05, Math.min(1, Number(input.minSimilarity) || DEFAULT_CONFIG.minSimilarity)),
      maxContextChars: Math.max(200, Math.min(10000, Math.floor(Number(input.maxContextChars) || DEFAULT_CONFIG.maxContextChars))),
      autoIndex: input.autoIndex !== false,
    };
  }

  saveConfig(config: Partial<NarrativeRagConfig>): void {
    this.config = this.normalizeConfig({ ...this.config, ...config });
    localStorage.setItem('narrativeRagConfig', JSON.stringify(this.config));
  }

  getConfig(): NarrativeRagConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled && !!this.getEmbeddingRequestConfig();
  }

  private getEmbeddingRequestConfig(): EmbeddingRequestConfig | null {
    return resolveEmbeddingConfig();
  }

  getEmbeddingStatus(): { available: boolean; provider?: APIProvider; model?: string; reason?: string } {
    if (!isEmbeddingFunctionEnabled()) {
      return { available: false, reason: '叙事检索未开启。到「API 管理 → 功能分配」打开开关，并指定独立的 Embedding API' };
    }
    const cfg = this.getEmbeddingRequestConfig();
    if (cfg) return { available: true, provider: cfg.provider, model: cfg.model };
    return { available: false, reason: '未配置独立 Embedding API，叙事检索不会启用或注入' };
  }

  private async embedBatch(texts: string[]): Promise<{ vectors: number[][]; model: string } | null> {
    const cfg = this.getEmbeddingRequestConfig();
    if (!cfg) return null;
    try {
      const vectors = await createEmbeddings(cfg, texts);
      if (vectors.length !== texts.length) return null;
      return { vectors: vectors.map(v => normalizeToUnitVector(v)), model: cfg.model };
    } catch (error) {
      console.warn('[叙事检索] Embedding 生成失败，跳过叙事检索:', error);
      return null;
    }
  }

  /**
   * 删除与当前存档叙事不一致的条目（回退、编辑、删除叙事后），只删除受影响的记录
   */
  async reconcile(saveData: any): Promise<number> {
    const scope = await resolveMemoryScope();
    if (!scope) return 0;
    const expected = new Set(getNarrativeItems(saveData).map(item => stableNarrativeId(item.index, item.content)));
    const stale = localMemoryIndex.list(scope, NARRATIVE_KIND).filter(r => !expected.has(r.id)).map(r => r.id);
    const removed = await localMemoryIndex.remove(scope, NARRATIVE_KIND, stale);
    if (removed > 0) console.log(`[叙事RAG] 清理失效条目 ${removed} 条`);
    return removed;
  }

  private pendingItems(scope: string, saveData: any, model: string) {
    return getNarrativeItems(saveData).filter(item => {
      const existing = localMemoryIndex.get(scope, NARRATIVE_KIND, stableNarrativeId(item.index, item.content));
      return !existing || existing.model !== model;
    });
  }

  /**
   * 增量补齐叙事向量
   * @param options.maxBatches 最多处理的批次数（不传则全部补齐）
   */
  async ensureIndexed(
    saveData: any,
    options?: { batchSize?: number; maxBatches?: number; onProgress?: (done: number, total: number) => void },
  ): Promise<number> {
    const scope = await resolveMemoryScope();
    if (!scope) return 0;
    const cfg = this.getEmbeddingRequestConfig();
    if (!cfg) {
      throw new Error('未配置独立 Embedding API，无法同步叙事检索索引');
    }

    return localMemoryIndex.withLock(scope, NARRATIVE_KIND, async () => {
      await this.reconcile(saveData);

      const pending = this.pendingItems(scope, saveData, cfg.model);
      if (pending.length === 0) return 0;

      const batchSize = Math.max(1, Math.min(64, options?.batchSize ?? 32));
      const maxItems = options?.maxBatches ? options.maxBatches * batchSize : pending.length;
      const work = pending.slice(0, maxItems);
      let added = 0;

      for (let i = 0; i < work.length; i += batchSize) {
        const batch = work.slice(i, i + batchSize);
        const embedded = await this.embedBatch(batch.map(item => item.content));
        if (!embedded) {
          throw new Error('Embedding 生成失败，叙事检索索引未写入');
        }
        added += await localMemoryIndex.put(
          scope,
          NARRATIVE_KIND,
          batch.map((item, j) => ({
            id: stableNarrativeId(item.index, item.content),
            content: item.content,
            ordinal: item.index,
            model: embedded.model,
            vector: embedded.vectors[j],
            extra: { time: item.time },
          })),
        );
        options?.onProgress?.(Math.min(i + batch.length, work.length), work.length);
      }

      console.log(`[叙事RAG] 已补齐 ${added} 条叙事向量${work.length < pending.length ? `（剩余 ${pending.length - work.length} 条稍后补齐）` : ''}`);
      return added;
    });
  }

  async search(query: string): Promise<NarrativeRagSearchResult[]> {
    if (!this.isEnabled()) return [];
    const scope = await resolveMemoryScope();
    if (!scope) return [];
    if (localMemoryIndex.list(scope, NARRATIVE_KIND).length === 0) return [];

    const embeddedQuery = await this.embedBatch([query]);
    if (!embeddedQuery) return [];

    const hits = localMemoryIndex.search(scope, NARRATIVE_KIND, embeddedQuery.vectors[0], embeddedQuery.model);
    const filtered = hits.filter(hit => hit.score >= this.config.minSimilarity);
    const picked = (filtered.length > 0 ? filtered : hits.filter(hit => hit.score > 0)).slice(0, this.config.topK);
    localMemoryIndex.recordRecall(scope, NARRATIVE_KIND, query, picked);

    return picked
      .map(hit => ({ entry: toEntry(hit.record), score: hit.score }))
      .sort((a, b) => a.entry.narrativeIndex - b.entry.narrativeIndex);
  }

  async buildSectionForPrompt(query: string, saveData: any): Promise<string> {
    if (!this.isEnabled()) return '';
    const scope = await resolveMemoryScope();
    if (!scope) return '';

    // 回退或编辑后的旧叙事不能再被召回：无论是否自动索引都先对齐
    await this.reconcile(saveData);
    if (this.config.autoIndex) {
      try {
        await this.ensureIndexed(saveData, { maxBatches: PRE_SEND_MAX_BATCHES });
      } catch (error) {
        console.warn('[叙事RAG] 发送前补齐失败，仅使用已有索引:', error);
      }
    }

    const results = await this.search(query);
    if (results.length === 0) return '';

    const lines = [
      '# 【历史叙事检索结果】',
      '以下内容来自本角色当前存档的“历史叙事正文”向量检索结果，是此前已经发生过的具体剧情片段。',
      '使用要求：只在与当前输入相关时参考这些片段，用于保持前后因果、地点细节、人物承诺、战斗经过和事件连续性；不要把它们当作本轮新发生的剧情；不要机械复述；如果与当前游戏状态冲突，以当前游戏状态和最新叙事为准。',
      '',
    ];
    let chars = 0;
    let idx = 1;
    for (const result of results) {
      const text = result.entry.content.trim();
      if (!text) continue;
      if (chars + text.length > this.config.maxContextChars) break;
      const scoreText = Number.isFinite(result.score) ? `（相似度 ${result.score.toFixed(3)}）` : '';
      lines.push(`${idx}. ${text}${scoreText}`);
      chars += text.length;
      idx++;
    }

    return idx > 1 ? lines.join('\n') : '';
  }

  async getAllEntries(): Promise<NarrativeRagEntry[]> {
    const scope = await resolveMemoryScope();
    if (!scope) return [];
    return localMemoryIndex.list(scope, NARRATIVE_KIND).map(toEntry);
  }

  async getStats(): Promise<{
    total: number;
    byVectorType: Record<string, number>;
    byEmbeddingModel: Record<string, number>;
    /** 与当前 Embedding 模型一致、可参与检索的条目数 */
    usable: number;
    pending?: number;
  }> {
    const scope = await resolveMemoryScope();
    if (!scope) return { total: 0, byVectorType: {}, byEmbeddingModel: {}, usable: 0 };
    const stats = localMemoryIndex.stats(scope, NARRATIVE_KIND, this.getEmbeddingRequestConfig()?.model);
    return {
      total: stats.total,
      byVectorType: stats.total ? { embedding: stats.total } : {},
      byEmbeddingModel: stats.byModel,
      usable: stats.usable,
    };
  }

  countVectorizableNarratives(saveData: any): number {
    return getNarrativeItems(saveData).length;
  }

  async countPending(saveData: any): Promise<number> {
    const scope = await resolveMemoryScope();
    const cfg = this.getEmbeddingRequestConfig();
    if (!scope || !cfg) return 0;
    return this.pendingItems(scope, saveData, cfg.model).length;
  }

  async clear(): Promise<void> {
    const scope = await resolveMemoryScope();
    if (!scope) return;
    await localMemoryIndex.clear(scope, NARRATIVE_KIND);
    console.log('[叙事检索] 已清空检索索引');
  }

  /** 最近一次叙事召回（供记忆中心展示） */
  getLastRecall(): RecallLog | null {
    return localMemoryIndex.getLastRecall(NARRATIVE_KIND, getBoundMemoryScope() ?? undefined);
  }
}

export const narrativeRagService = new NarrativeRagService();
