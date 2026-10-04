/** 酒馆端「风华」仪容。网页端不生成、不展示。 */

export const QI_KEYS = ['清纯', '妖媚', '性感', '端庄', '冷艳', '灵动'] as const;
const FEATURE_KEYS = ['眉眼', '发型', '面部', '感官'] as const;
const MEASURE_KEYS = ['胸围', '腰围', '臀围'] as const;

export interface SplendorView {
  title: string;
  score: number | null;
  tone: '' | 'warm' | 'accent';
  summary: string;
  features: { label: string; text: string }[];
  colors: { label: string; text: string }[];
  measures: { label: string; value: number }[];
  cup: string;
  temperament: { label: string; value: number }[];
  clothes: string[];
  outfit: string;
  figure: string;
  /** 除兜底外貌原文外，是否已有结构化仪容 */
  structured: boolean;
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() && v !== '待AI生成' ? v.trim() : '');

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function clothesOf(v: unknown): string[] {
  if (typeof v === 'string') return text(v) ? [text(v)] : [];
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const name = text((item as any).名称 || (item as any).name);
        const desc = text((item as any).描述 || (item as any).desc);
        return [name, desc].filter(Boolean).join(' · ');
      }
      return '';
    })
    .filter(Boolean);
}

function titleOf(score: number): string {
  if (score >= 90) return '国色天香';
  if (score >= 80) return '倾城之姿';
  if (score >= 70) return '明艳照人';
  if (score >= 60) return '清丽可人';
  if (score >= 45) return '姿容中上';
  return '寻常姿容';
}

function toneOf(score: number): '' | 'warm' | 'accent' {
  if (score >= 80) return 'accent';
  if (score >= 60) return 'warm';
  return '';
}

function readBlock(raw: unknown): Record<string, any> {
  return raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
}

/** 把 NPC.仪容 或 角色.身体（含身体.仪容）收成同一份视图。fallback 一般是外貌描述。 */
export function readSplendor(
  source: Record<string, any> | null | undefined,
  fallback = '',
  nestedKey = '仪容',
): SplendorView {
  const root = source && typeof source === 'object' ? source : {};
  const nested = readBlock(root[nestedKey]);
  const profile = { ...root, ...nested };

  const scoreRaw = num(profile.评分);
  const score = scoreRaw === null ? null : Math.round(clamp(scoreRaw, 0, 100));
  const title = text(profile.品题) || (score !== null ? titleOf(score) : '');

  const features = FEATURE_KEYS.map((label) => ({ label, text: text(profile[label]) })).filter((f) => f.text);
  const colors = (['肤色', '发色', '瞳色'] as const)
    .map((label) => ({ label, text: text(profile[label]) }))
    .filter((c) => c.text);

  const three = readBlock(profile.三围);
  const measures: { label: string; value: number }[] = [];
  for (const key of MEASURE_KEYS) {
    const value = num(three[key]);
    if (value !== null) measures.push({ label: key, value: Math.round(value) });
  }

  const qz = readBlock(profile.气质);
  const temperament: { label: string; value: number }[] = [];
  for (const label of QI_KEYS) {
    const value = num(qz[label]);
    if (value !== null) temperament.push({ label, value: Math.round(clamp(value, 0, 100)) });
  }

  const clothes = clothesOf(profile.衣着);
  const outfit = text(profile.穿搭 || profile.衣着描述 || profile.衣着穿搭);
  const figure = text(profile.身材体态);
  const cup = text(profile.罩杯);
  const summary = text(profile.概述) || text(fallback);

  const structured = Boolean(
    title ||
      score !== null ||
      features.length ||
      colors.length ||
      measures.length ||
      temperament.length ||
      clothes.length ||
      outfit ||
      figure ||
      cup,
  );

  return {
    title,
    score,
    tone: score === null ? '' : toneOf(score),
    summary,
    features,
    colors,
    measures,
    cup,
    temperament,
    clothes,
    outfit,
    figure,
    structured,
  };
}

export function splendorFromNpc(
  npc: { 仪容?: unknown; 外貌描述?: string; 外貌?: string } | null | undefined,
): SplendorView {
  const appearance = text(npc?.外貌描述) || text(npc?.外貌);
  return readSplendor(readBlock(npc?.仪容), appearance, '仪容');
}

export function splendorFromBody(body: Record<string, any> | null | undefined): SplendorView {
  const root = body && typeof body === 'object' ? body : {};
  const nested = readBlock(root.仪容);
  return readSplendor(
    {
      ...nested,
      三围: nested.三围 || root.三围,
      罩杯: nested.罩杯 || root.罩杯,
      肤色: nested.肤色 || root.肤色,
      发色: nested.发色 || root.发色,
      瞳色: nested.瞳色 || root.瞳色,
    },
    '',
    '仪容',
  );
}
