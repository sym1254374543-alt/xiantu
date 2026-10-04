/**
 * 本地记忆索引（LocalMemoryIndex）
 *
 * 长期记忆检索（fact）与叙事检索（narrative）共用的本地向量存储层：
 * - 单个 IndexedDB 库，按存档作用域（scope）隔离，scope 规则见 utils/saveIdentity.ts
 * - 每条向量是一条独立记录：新增、删除、回退只写受影响的记录，不整库重写
 * - 向量归一化后量化为 Int16 保存，体积约为 Float64 数组的 1/4
 * - 每条记录保存 embedding 模型和维度，检索时只使用与查询向量同模型同维度的条目
 * - 首次访问某个作用域时，自动迁移旧版 vector-memory-* / narrative-rag-* 库并删除旧库
 *
 * 本模块只负责存储与相似度计算，不调用 Embedding API，也不依赖任何 store。
 */
import { openDB, deleteDB, type IDBPDatabase } from 'idb';
import { normalizeScopeId } from '@/utils/saveIdentity';

export type MemoryKind = 'narrative' | 'fact' | 'npc' | 'location' | 'event';

export interface MemoryRecordExtra {
  tags?: string[];
  category?: string;
  importance?: number;
  time?: string;
  npcs?: string[];
}

export interface MemoryRecord {
  /** 主键：`${scope}|${kind}|${id}` */
  key: string;
  scope: string;
  kind: MemoryKind;
  id: string;
  content: string;
  /** 叙事条目为叙事下标；其他类型为 -1 */
  ordinal: number;
  model: string;
  dim: number;
  /** 归一化后量化的向量 */
  q: Int16Array;
  timestamp: number;
  extra?: MemoryRecordExtra;
}

export interface MemoryRecordInput {
  id: string;
  content: string;
  ordinal?: number;
  model: string;
  /** 单位向量（调用方负责归一化；这里仍会再归一化一次以防万一） */
  vector: number[];
  timestamp?: number;
  extra?: MemoryRecordExtra;
}

export interface MemoryHit {
  record: MemoryRecord;
  score: number;
}

export interface RecallLog {
  scope: string;
  kind: MemoryKind;
  query: string;
  at: number;
  hits: Array<{ id: string; score: number; preview: string }>;
}

const DB_NAME = 'xiantu-local-memory';
const DB_VERSION = 1;
const RECORDS = 'records';
const SCOPES = 'scopes';
const QUANT_SCALE = 32767;
/** 同时常驻内存的作用域数量（当前存档 + 刚切走的存档） */
const MAX_CACHED_SCOPES = 2;

interface ScopeMeta {
  scope: string;
  legacyMigrated: boolean;
  updatedAt: number;
}

function recordKey(scope: string, kind: MemoryKind, id: string): string {
  return `${scope}|${kind}|${id}`;
}

export function quantizeUnitVector(vector: number[]): Int16Array {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Int16Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    const v = Math.round((vector[i] / norm) * QUANT_SCALE);
    out[i] = Number.isFinite(v) ? Math.max(-QUANT_SCALE, Math.min(QUANT_SCALE, v)) : 0;
  }
  return out;
}

/** 查询向量（单位向量）与量化向量的余弦相似度 */
function dotQuantized(query: number[], q: Int16Array): number {
  let sum = 0;
  for (let i = 0; i < query.length; i++) sum += query[i] * q[i];
  return sum / QUANT_SCALE;
}

export function hashContent(content: string): string {
  const normalized = (content || '').trim().replace(/\s+/g, ' ');
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * 删除旧库但不等待：其他标签页若仍打开旧库，deleteDB 会一直阻塞，不能因此卡住检索或存档删除。
 */
function deleteLegacyDbInBackground(name: string): void {
  deleteDB(name, {
    blocked() {
      console.warn(`[本地记忆索引] 旧库 ${name} 被其他页面占用，关闭其他页面后会自动删除`);
    },
  }).catch(() => undefined);
}

/**
 * 只在旧库确实存在时打开它；不存在时中止升级事务，避免凭空创建空库。
 */
function openLegacyDbIfExists(name: string): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(name);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = event => {
      if (event.oldVersion === 0) request.transaction?.abort();
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function readAllFromLegacy(db: IDBDatabase, storeName: string): Promise<any[]> {
  return new Promise(resolve => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve([]);
      return;
    }
    try {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

class LocalMemoryIndex {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  /** scope -> key -> record；Map 的插入顺序即 LRU 顺序 */
  private cache = new Map<string, Map<string, MemoryRecord>>();
  private scopeReady = new Map<string, Promise<void>>();
  private locks = new Map<string, Promise<unknown>>();
  private recalls = new Map<MemoryKind, RecallLog>();

  private db(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(RECORDS)) {
            const store = db.createObjectStore(RECORDS, { keyPath: 'key' });
            store.createIndex('scope', 'scope');
          }
          if (!db.objectStoreNames.contains(SCOPES)) {
            db.createObjectStore(SCOPES, { keyPath: 'scope' });
          }
        },
      }).catch(error => {
        this.dbPromise = null;
        throw error;
      });
    }
    return this.dbPromise;
  }

  normalizeScope(raw: string): string {
    return normalizeScopeId(raw);
  }

  /**
   * 确保作用域可用：首次访问时迁移旧库并把记录载入内存。
   * @param legacyRawScope 旧版向量库使用的未归一化 scope（`${角色ID}_${槽位}`）
   */
  async ensureScope(scope: string, legacyRawScope?: string): Promise<void> {
    // 等待期间该作用域可能被 LRU 淘汰，最多重载一次
    for (let attempt = 0; attempt < 2; attempt++) {
      let ready = this.scopeReady.get(scope);
      if (!ready) {
        ready = this.loadScope(scope, legacyRawScope).catch(error => {
          this.scopeReady.delete(scope);
          throw error;
        });
        this.scopeReady.set(scope, ready);
      }
      await ready;
      if (this.cache.has(scope)) {
        this.touch(scope);
        return;
      }
      this.scopeReady.delete(scope);
    }
    throw new Error(`[本地记忆索引] 作用域加载失败: ${scope}`);
  }

  private touch(scope: string): void {
    const map = this.cache.get(scope);
    if (!map) return;
    this.cache.delete(scope);
    this.cache.set(scope, map);
    while (this.cache.size > MAX_CACHED_SCOPES) {
      const oldest = this.cache.keys().next().value as string;
      this.cache.delete(oldest);
      this.scopeReady.delete(oldest);
    }
  }

  private async loadScope(scope: string, legacyRawScope?: string): Promise<void> {
    const db = await this.db();
    const meta = (await db.get(SCOPES, scope)) as ScopeMeta | undefined;
    if (!meta?.legacyMigrated) {
      await this.migrateLegacy(scope, legacyRawScope);
      await db.put(SCOPES, { scope, legacyMigrated: true, updatedAt: Date.now() } satisfies ScopeMeta);
    }
    const rows = (await db.getAllFromIndex(RECORDS, 'scope', scope)) as MemoryRecord[];
    const map = new Map<string, MemoryRecord>();
    for (const row of rows) {
      if (row && row.q instanceof Int16Array && row.q.length === row.dim) map.set(row.key, row);
    }
    this.cache.set(scope, map);
  }

  private async migrateLegacy(scope: string, legacyRawScope?: string): Promise<void> {
    const migrated: MemoryRecord[] = [];
    const legacyDbs: string[] = [];

    const vectorDbNames = new Set([`vector-memory-${legacyRawScope || scope}`, `vector-memory-${scope}`]);
    for (const name of vectorDbNames) {
      const legacy = await openLegacyDbIfExists(name);
      if (!legacy) continue;
      legacyDbs.push(name);
      const rows = await readAllFromLegacy(legacy, 'memories');
      legacy.close();
      for (const row of rows) {
        if (row?.vectorType !== 'embedding' || !Array.isArray(row.vector) || !row.embeddingModel) continue;
        migrated.push(this.toRecord(scope, 'fact', {
          id: String(row.id),
          content: String(row.content || ''),
          model: String(row.embeddingModel),
          vector: row.vector,
          timestamp: Number(row.timestamp) || Date.now(),
          extra: {
            tags: Array.isArray(row.tags) ? row.tags : [],
            category: row.category,
            importance: row.importance,
            npcs: row.metadata?.npcs,
          },
        }));
      }
    }

    const narrativeName = `narrative-rag-${scope}`;
    const legacyNarrative = await openLegacyDbIfExists(narrativeName);
    if (legacyNarrative) {
      legacyDbs.push(narrativeName);
      const rows = await readAllFromLegacy(legacyNarrative, 'entries');
      legacyNarrative.close();
      for (const row of rows) {
        if (row?.vectorType !== 'embedding' || !Array.isArray(row.vector) || !row.embeddingModel) continue;
        migrated.push(this.toRecord(scope, 'narrative', {
          id: String(row.id),
          content: String(row.content || ''),
          ordinal: Number(row.narrativeIndex),
          model: String(row.embeddingModel),
          vector: row.vector,
          timestamp: Number(row.timestamp) || Date.now(),
          extra: { time: row.time },
        }));
      }
    }

    if (migrated.length > 0) {
      const db = await this.db();
      const tx = db.transaction(RECORDS, 'readwrite');
      for (const record of migrated) void tx.store.put(record);
      await tx.done;
      console.log(`[本地记忆索引] 已迁移旧版索引 ${migrated.length} 条 → ${scope}`);
    }
    for (const name of legacyDbs) deleteLegacyDbInBackground(name);
  }

  private toRecord(scope: string, kind: MemoryKind, input: MemoryRecordInput): MemoryRecord {
    const q = quantizeUnitVector(input.vector);
    return {
      key: recordKey(scope, kind, input.id),
      scope,
      kind,
      id: input.id,
      content: input.content,
      ordinal: Number.isFinite(input.ordinal) ? Number(input.ordinal) : -1,
      model: input.model,
      dim: q.length,
      q,
      timestamp: input.timestamp ?? Date.now(),
      extra: input.extra,
    };
  }

  private scopeMap(scope: string): Map<string, MemoryRecord> {
    const map = this.cache.get(scope);
    if (!map) throw new Error(`[本地记忆索引] 作用域未初始化: ${scope}`);
    return map;
  }

  /**
   * 同一作用域 + 类型的写操作串行执行，避免“发送前补齐”和“手动同步”重复调用 Embedding。
   */
  async withLock<T>(scope: string, kind: MemoryKind, task: () => Promise<T>): Promise<T> {
    const lockKey = `${scope}|${kind}`;
    const previous = this.locks.get(lockKey) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    this.locks.set(lockKey, run);
    try {
      return await run;
    } finally {
      if (this.locks.get(lockKey) === run) this.locks.delete(lockKey);
    }
  }

  list(scope: string, kind: MemoryKind): MemoryRecord[] {
    const result: MemoryRecord[] = [];
    for (const record of this.scopeMap(scope).values()) {
      if (record.kind === kind) result.push(record);
    }
    return result;
  }

  get(scope: string, kind: MemoryKind, id: string): MemoryRecord | undefined {
    return this.scopeMap(scope).get(recordKey(scope, kind, id));
  }

  async put(scope: string, kind: MemoryKind, inputs: MemoryRecordInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    const map = this.scopeMap(scope);
    const records = inputs.map(input => this.toRecord(scope, kind, input));
    const db = await this.db();
    const tx = db.transaction(RECORDS, 'readwrite');
    for (const record of records) void tx.store.put(record);
    await tx.done;
    for (const record of records) map.set(record.key, record);
    return records.length;
  }

  async remove(scope: string, kind: MemoryKind, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const map = this.scopeMap(scope);
    const keys = ids.map(id => recordKey(scope, kind, id));
    const db = await this.db();
    const tx = db.transaction(RECORDS, 'readwrite');
    for (const key of keys) void tx.store.delete(key);
    await tx.done;
    for (const key of keys) map.delete(key);
    return keys.length;
  }

  async clear(scope: string, kind?: MemoryKind): Promise<number> {
    const map = this.scopeMap(scope);
    const keys = [...map.values()].filter(r => !kind || r.kind === kind).map(r => r.key);
    if (keys.length === 0) return 0;
    const db = await this.db();
    const tx = db.transaction(RECORDS, 'readwrite');
    for (const key of keys) void tx.store.delete(key);
    await tx.done;
    for (const key of keys) map.delete(key);
    return keys.length;
  }

  /** 删除整个作用域（删除存档/角色时调用），不要求作用域已载入 */
  async deleteScope(scope: string, legacyRawScope?: string): Promise<void> {
    const db = await this.db();
    const keys = await db.getAllKeysFromIndex(RECORDS, 'scope', scope);
    const tx = db.transaction([RECORDS, SCOPES], 'readwrite');
    for (const key of keys) void tx.objectStore(RECORDS).delete(key);
    void tx.objectStore(SCOPES).delete(scope);
    await tx.done;
    this.cache.delete(scope);
    this.scopeReady.delete(scope);
    for (const name of new Set([`vector-memory-${legacyRawScope || scope}`, `vector-memory-${scope}`, `narrative-rag-${scope}`])) {
      deleteLegacyDbInBackground(name);
    }
  }

  /** 存档重命名时把索引迁到新作用域，避免重新调用 Embedding */
  async moveScope(from: string, to: string, legacyRawFrom?: string): Promise<number> {
    if (from === to) return 0;
    await this.ensureScope(from, legacyRawFrom);
    const records = [...this.scopeMap(from).values()];
    const db = await this.db();
    const tx = db.transaction([RECORDS, SCOPES], 'readwrite');
    const recordsStore = tx.objectStore(RECORDS);
    for (const record of records) {
      void recordsStore.delete(record.key);
      void recordsStore.put({ ...record, scope: to, key: recordKey(to, record.kind, record.id) });
    }
    void tx.objectStore(SCOPES).delete(from);
    void tx.objectStore(SCOPES).put({ scope: to, legacyMigrated: true, updatedAt: Date.now() } satisfies ScopeMeta);
    await tx.done;
    this.cache.delete(from);
    this.scopeReady.delete(from);
    this.cache.delete(to);
    this.scopeReady.delete(to);
    return records.length;
  }

  /**
   * 相似度检索。只比较与查询向量同模型、同维度的条目，旧模型向量不会混入结果。
   */
  search(
    scope: string,
    kind: MemoryKind,
    queryVector: number[],
    model: string,
    options?: { filter?: (record: MemoryRecord) => boolean },
  ): MemoryHit[] {
    let norm = 0;
    for (const v of queryVector) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    const query = queryVector.map(v => v / norm);

    const hits: MemoryHit[] = [];
    for (const record of this.scopeMap(scope).values()) {
      if (record.kind !== kind) continue;
      if (record.model !== model || record.dim !== query.length) continue;
      if (options?.filter && !options.filter(record)) continue;
      hits.push({ record, score: dotQuantized(query, record.q) });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits;
  }

  stats(scope: string, kind: MemoryKind, currentModel?: string): { total: number; usable: number; byModel: Record<string, number> } {
    const byModel: Record<string, number> = {};
    let total = 0;
    let usable = 0;
    for (const record of this.scopeMap(scope).values()) {
      if (record.kind !== kind) continue;
      total++;
      byModel[record.model] = (byModel[record.model] || 0) + 1;
      if (!currentModel || record.model === currentModel) usable++;
    }
    return { total, usable, byModel };
  }

  recordRecall(scope: string, kind: MemoryKind, query: string, hits: MemoryHit[]): void {
    this.recalls.set(kind, {
      scope,
      kind,
      query: query.slice(0, 200),
      at: Date.now(),
      hits: hits.map(hit => ({ id: hit.record.id, score: hit.score, preview: hit.record.content.slice(0, 80) })),
    });
  }

  /** 最近一次召回结果（供记忆中心展示） */
  getLastRecall(kind: MemoryKind, scope?: string): RecallLog | null {
    const log = this.recalls.get(kind) ?? null;
    if (log && scope && log.scope !== scope) return null;
    return log;
  }
}

export const localMemoryIndex = new LocalMemoryIndex();
