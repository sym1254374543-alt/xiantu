/**
 * 三千大道的展示规则（阶段下标兼容、关系、分类）。只读，页面与右栏共用。
 */
import type { DaoData } from '@/types/game';

export const DAO_STAGE_NAMES = ['入门', '感悟', '小成', '大成', '圆满', '极境'];

export const DAO_CATEGORIES = [
  { key: 'nature', label: '自然' },
  { key: 'concept', label: '法则' },
  { key: 'combat', label: '战斗' },
  { key: 'cultivation', label: '修行' },
  { key: 'other', label: '其他' },
];

const KEYWORD_CATEGORY: Record<string, string> = {
  剑: 'combat', 刀: 'combat', 拳: 'combat', 枪: 'combat', 戟: 'combat',
  金: 'nature', 木: 'nature', 水: 'nature', 火: 'nature', 土: 'nature', 风: 'nature', 雷: 'nature', 冰: 'nature', 雪: 'nature',
  因果: 'concept', 轮回: 'concept', 时间: 'concept', 空间: 'concept', 命运: 'concept',
  丹: 'cultivation', 炼器: 'cultivation', 阵: 'cultivation', 符: 'cultivation',
};

export function daoCategory(name: string, dao?: Partial<DaoData> | null): string {
  const declared = dao?.分类;
  if (declared) {
    const hit = DAO_CATEGORIES.find((c) => c.key === declared || c.label === declared);
    if (hit) return hit.key;
  }
  for (const [kw, cat] of Object.entries(KEYWORD_CATEGORY)) if (name.includes(kw)) return cat;
  return 'other';
}

export const daoCategoryLabel = (key: string) => DAO_CATEGORIES.find((c) => c.key === key)?.label || '其他';

/**
 * 获取大道当前阶段索引（用于访问阶段列表数组）
 * 当前阶段字段从0开始，直接对应数组索引：0=阶段列表[0](入门), 1=阶段列表[1](初窥)...
 */
export function daoStageIndex(dao: Partial<DaoData> | null | undefined): number {
  const len = dao?.阶段列表?.length || 0;
  const raw = Number(dao?.当前阶段 ?? 0);
  if (!Number.isFinite(raw) || raw < 0) return 0;

  // 直接使用当前阶段值作为索引，不做转换
  if (!len) return Math.min(raw, DAO_STAGE_NAMES.length - 1);
  return Math.min(raw, len - 1);
}

export function daoStageName(dao: Partial<DaoData> | null | undefined): string {
  const i = daoStageIndex(dao);
  const s = dao?.阶段列表?.[i] as { 名称?: string; 阶段名?: string } | undefined;
  return s?.名称 || s?.阶段名 || DAO_STAGE_NAMES[i] || `第${i + 1}重`;
}

export function asTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return '';
        const r = item as Record<string, unknown>;
        return String(r.名称 || r.描述 || '');
      })
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function daoEffects(dao: Partial<DaoData> | null | undefined): string[] {
  if (!dao) return [];
  return asTextList(dao.当前效果 ?? dao.阶段列表?.[daoStageIndex(dao)]?.描述);
}

export function daoConditions(dao: Partial<DaoData> | null | undefined): string[] {
  if (!dao) return [];
  return asTextList(dao.突破条件 ?? dao.阶段列表?.[daoStageIndex(dao)]?.突破条件);
}

export type DaoRelationKind = '相生' | '相克' | '互补' | '冲突' | '融合条件';
export const DAO_RELATION_KINDS: DaoRelationKind[] = ['相生', '相克', '互补', '冲突', '融合条件'];

export function daoRelations(dao: Partial<DaoData> | null | undefined): { kind: DaoRelationKind; values: string[] }[] {
  const rel = (dao?.关联 ?? dao?.关联大道 ?? {}) as Record<string, unknown>;
  return DAO_RELATION_KINDS.map((kind) => ({ kind, values: asTextList(rel[kind] ?? (dao as any)?.[kind]) }));
}

/** 下一阶段所需经验：阶段列表里写了就用，否则 (下标+1)×100 */
export function daoNextRequirement(dao: Partial<DaoData> | null | undefined): number {
  if (!dao) return 100;
  const i = daoStageIndex(dao);
  return Number(dao.阶段列表?.[i]?.突破经验) || (i + 1) * 100;
}

export function daoProgress(dao: Partial<DaoData> | null | undefined) {
  const need = Math.max(1, daoNextRequirement(dao));
  const cur = Number(dao?.当前经验) || 0;
  return { cur, need, percent: Math.min(100, Math.round((cur / need) * 100)), canBreak: cur >= need };
}
