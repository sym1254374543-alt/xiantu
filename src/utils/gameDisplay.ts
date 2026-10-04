/**
 * 局内展示用的公共工具（功能页、右状态栏共用）
 * 规格：docs/功能页重写规格.md 0.4
 */
import bloodIcon from '@/assets/status-icons/blood.png';
import spiritIcon from '@/assets/status-icons/spirit.png';
import senseIcon from '@/assets/status-icons/sense.png';
import lifespanIcon from '@/assets/status-icons/lifespan.png';
import { calculateAgeFromBirthdate } from '@/utils/lifespanCalculator';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** 字符串 / { 名称 } / { name } 取名字 */
export function nameOf(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (isObj(v)) return String(v.名称 ?? v.name ?? v.技能名称 ?? '').trim();
  return '';
}

/** { 描述 } / { description } 取描述 */
export function descOf(v: unknown): string {
  if (!isObj(v)) return '';
  return String(v.描述 ?? v.description ?? v.技能描述 ?? '').trim();
}

export const toNumber = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// ─── 品级 ────────────────────────────────────────────────

/** 品级文字：0 残缺 / 1–3 下品 / 4–6 中品 / 7–9 上品 / 10 极品；字符串原样返回 */
export function getGradeText(grade: unknown): string {
  if (grade === null || grade === undefined || grade === '') return '';
  if (typeof grade === 'string' && !/^\d+$/.test(grade.trim())) return grade.trim();
  const g = toNumber(grade, -1);
  if (g < 0) return '';
  if (g === 0) return '残缺';
  if (g <= 3) return '下品';
  if (g <= 6) return '中品';
  if (g <= 9) return '上品';
  return '极品';
}

/** 「天品 · 上品」这样的品质全称 */
export function qualityLabel(quality: unknown): string {
  if (!quality) return '';
  if (typeof quality === 'string') return quality;
  if (!isObj(quality)) return '';
  const q = String(quality.quality ?? quality.品质 ?? '').trim();
  const g = getGradeText(quality.grade ?? quality.品级);
  const qText = q ? (q.endsWith('品') || q.endsWith('阶') ? q : `${q}品`) : '';
  return [qText, g].filter(Boolean).join(' · ');
}

// ─── 声望 ────────────────────────────────────────────────

export type ReputationTone = 'neutral' | 'good' | 'fine' | 'great' | 'bad';

export function reputationInfo(value: unknown): { title: string; tone: ReputationTone; value: number | null } {
  if (value === null || value === undefined || value === '') return { title: '籍籍无名', tone: 'neutral', value: null };
  const v = Number(value);
  if (!Number.isFinite(v)) return { title: '籍籍无名', tone: 'neutral', value: null };
  if (v < 0) {
    const title = v <= -5000 ? '恶名昭彰' : v <= -1000 ? '臭名远扬' : v <= -500 ? '声名狼藉' : v <= -100 ? '恶名在外' : '小有恶名';
    return { title, tone: 'bad', value: v };
  }
  if (v >= 10000) return { title: '传说人物', tone: 'great', value: v };
  if (v >= 5000) return { title: '名满天下', tone: 'great', value: v };
  if (v >= 3000) return { title: '威震四方', tone: 'fine', value: v };
  if (v >= 1000) return { title: '名动一方', tone: 'fine', value: v };
  if (v >= 500) return { title: '声名远播', tone: 'good', value: v };
  if (v >= 100) return { title: '小有名气', tone: 'good', value: v };
  return { title: '籍籍无名', tone: 'neutral', value: v };
}

export const REPUTATION_COLOR: Record<ReputationTone, string> = {
  neutral: 'var(--cc-text-2)',
  good: 'var(--gm-life)',
  fine: 'var(--gm-mp)',
  great: 'var(--cc-gold)',
  bad: 'var(--cc-danger)',
};

// ─── 四维 ────────────────────────────────────────────────

export type VitalKey = '气血' | '灵气' | '神识' | '寿元';

export const VITAL_META: Record<VitalKey, { icon: string; tone: string }> = {
  气血: { icon: bloodIcon, tone: 'var(--gm-hp)' },
  灵气: { icon: spiritIcon, tone: 'var(--gm-mp)' },
  神识: { icon: senseIcon, tone: 'var(--gm-sense)' },
  寿元: { icon: lifespanIcon, tone: 'var(--gm-life)' },
};

export interface VitalInfo {
  key: VitalKey;
  cur: number;
  max: number;
  showBar: boolean;
  percent: number;
  low: boolean;
}

/** 上限 ≤1 或缺失不画条；非寿元低于 30% 标红 */
export function vitalInfo(key: VitalKey, cur: unknown, max: unknown): VitalInfo {
  const c = toNumber(cur);
  const m = toNumber(max);
  const showBar = m > 1;
  const percent = showBar ? Math.max(0, Math.min(100, Math.round((c / m) * 100))) : 0;
  return { key, cur: c, max: m, showBar, percent, low: showBar && key !== '寿元' && percent < 30 };
}

/** 玩家四维：attributes = gameStateStore.attributes，age 由出生日期算 */
export function playerVitals(attributes: unknown, age: number): VitalInfo[] {
  const a = (isObj(attributes) ? attributes : {}) as Record<string, any>;
  return [
    vitalInfo('气血', a.气血?.当前, a.气血?.上限),
    vitalInfo('灵气', a.灵气?.当前, a.灵气?.上限),
    vitalInfo('神识', a.神识?.当前, a.神识?.上限),
    vitalInfo('寿元', age, a.寿命?.上限),
  ];
}

// ─── 年龄 / 时间 ─────────────────────────────────────────

export function ageFrom(birth: unknown, gameTime: unknown, fallback = 0): number {
  if (isObj(birth) && isObj(gameTime) && typeof birth.年 === 'number' && typeof gameTime.年 === 'number') {
    return calculateAgeFromBirthdate(birth as any, gameTime as any);
  }
  return fallback;
}

const pad = (n: unknown) => String(toNumber(n)).padStart(2, '0');

/** 仙道 X年X月X日 HH:mm；withTime=false 时只到日 */
export function formatGameTime(t: unknown, withTime = true, prefix = '仙道'): string {
  if (!isObj(t)) return typeof t === 'string' ? t : '';
  const date = `${prefix}${toNumber(t.年)}年${toNumber(t.月, 1)}月${toNumber(t.日, 1)}日`;
  if (!withTime || t.小时 === undefined) return date;
  return `${date} ${pad(t.小时)}:${pad(t.分钟 ?? 0)}`;
}

/** 游戏时间 → 可比较的分钟数 */
export function gameTimeValue(t: unknown): number {
  if (!isObj(t)) return 0;
  return ((toNumber(t.年) * 12 + toNumber(t.月)) * 30 + toNumber(t.日)) * 1440 + toNumber(t.小时) * 60 + toNumber(t.分钟);
}

/** 记忆字符串前缀「【仙道X年X月X日 HH:mm】」拆成 时间 + 正文 */
export function splitTimePrefix(text: string): { time: string; body: string } {
  const m = /^【([^】]{2,40})】\s*/.exec(text || '');
  if (!m) return { time: '', body: text || '' };
  return { time: m[1], body: text.slice(m[0].length) };
}

// ─── 灵根 ────────────────────────────────────────────────

export interface SpiritRootInfo {
  exists: boolean;
  name: string;
  grade: string;
  elements: string[];
  speed: string;
  desc: string;
}

export function formatSpiritRoot(root: unknown): SpiritRootInfo {
  if (!root) return { exists: false, name: '无灵根', grade: '', elements: [], speed: '', desc: '无灵根，难以引气入体' };
  if (typeof root === 'string') {
    const s = root.trim();
    return { exists: !!s && s !== '未知灵根', name: s || '未知灵根', grade: '', elements: [], speed: '', desc: '' };
  }
  if (!isObj(root)) return { exists: false, name: '未知灵根', grade: '', elements: [], speed: '', desc: '' };
  const name = nameOf(root) || '未知灵根';
  const grade = String(root.tier ?? root.品级 ?? root.品阶 ?? '').trim();
  const rawEls = root.属性 ?? root.五行 ?? root.elements;
  const elements = Array.isArray(rawEls) ? rawEls.map((x) => String(x)).filter(Boolean) : [];
  return { exists: true, name, grade, elements, speed: spiritRootSpeed(root), desc: descOf(root) };
}

function spiritRootSpeed(r: Obj): string {
  if (typeof r.cultivation_speed === 'string' && r.cultivation_speed.trim()) return r.cultivation_speed.trim();
  const raw = r.修炼加成;
  if (raw !== undefined && raw !== null && raw !== '') {
    const str = String(raw).trim();
    const isPct = str.endsWith('%');
    const n = Number(isPct ? str.slice(0, -1) : str);
    if (Number.isFinite(n)) {
      const pct = isPct ? n : Math.abs(n) >= 10 ? n : n * 100;
      return `修炼 ${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
    }
  }
  const mul = r.修炼速度 ?? r.base_multiplier;
  if (mul !== undefined && mul !== null && mul !== '') return `修炼 ×${mul}`;
  return '';
}

// ─── 好感 ────────────────────────────────────────────────

export function favorInfo(favor: unknown): { label: string; tone: string; percent: number } {
  const f = Math.max(-100, Math.min(100, toNumber(favor)));
  let label = '平淡';
  let tone = 'var(--cc-text-2)';
  if (f >= 80) { label = '生死之交'; tone = 'var(--cc-gold)'; }
  else if (f >= 50) { label = '亲近'; tone = 'var(--gm-life)'; }
  else if (f >= 20) { label = '友善'; tone = 'var(--gm-mp)'; }
  else if (f > -20) { label = '平淡'; tone = 'var(--cc-text-2)'; }
  else if (f > -50) { label = '冷淡'; tone = 'var(--cc-warning)'; }
  else if (f > -80) { label = '敌视'; tone = 'var(--cc-danger)'; }
  else { label = '死敌'; tone = 'var(--cc-danger)'; }
  return { label, tone, percent: (f + 100) / 2 };
}

// ─── 其他 ────────────────────────────────────────────────

export const SIX_SI_KEYS = ['根骨', '灵性', '悟性', '气运', '魅力', '心性'] as const;
export type SixSiKey = (typeof SIX_SI_KEYS)[number];

/** 缺字段按 0 补齐 */
export function normalizeSixSi(v: unknown): Record<SixSiKey, number> {
  const o = isObj(v) ? v : {};
  return Object.fromEntries(SIX_SI_KEYS.map((k) => [k, toNumber(o[k])])) as Record<SixSiKey, number>;
}

/** 把对象（增幅、效果）拍平成「键 值」文字行 */
export function flattenEffect(v: unknown, prefix = ''): string[] {
  if (v === null || v === undefined || v === '') return [];
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    // 「修炼速度加成 0.25」这类小数倍率按百分比写
    const asPct = typeof v === 'number' && /加成|速度|倍率/.test(prefix) && !Number.isInteger(v) && Math.abs(v) <= 1;
    const val = asPct ? `${(v as number) > 0 ? '+' : ''}${Math.round((v as number) * 100)}%` : formatSigned(v);
    return [prefix ? `${prefix} ${val}` : String(v)];
  }
  if (Array.isArray(v)) return v.flatMap((x) => flattenEffect(x, prefix));
  if (isObj(v)) {
    return Object.entries(v).flatMap(([k, val]) => flattenEffect(val, prefix ? `${prefix}·${k}` : k));
  }
  return [];
}

function formatSigned(v: unknown): string {
  if (typeof v === 'number') return v > 0 ? `+${v}` : String(v);
  return String(v);
}

/** 下载 JSON / 文本（文件名用本地日期） */
export function downloadText(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function localDateStamp(d = new Date()): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** 状态效果剩余时间：纯数字按分钟换算 */
export function formatEffectTime(time: unknown): string {
  if (time === null || time === undefined) return '';
  const s = String(time).trim();
  if (!s || s === '未指定') return '';
  if (/^\d+$/.test(s)) {
    const minutes = parseInt(s, 10);
    if (minutes >= 1440) {
      const d = Math.floor(minutes / 1440);
      const h = Math.floor((minutes % 1440) / 60);
      return h ? `${d}天${h}时` : `${d}天`;
    }
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m ? `${h}时${m}分` : `${h}时`;
    }
    return `${minutes}分钟`;
  }
  return s;
}

export const isBuffEffect = (effect: unknown): boolean =>
  isObj(effect) && String(effect.类型 ?? '').toLowerCase() === 'buff';
