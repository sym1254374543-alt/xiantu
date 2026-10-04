/**
 * 阅读偏好：字体、叙事配色、界面缩放、正文字号与行距。
 * 存在 localStorage 的 dad_game_settings 里（与设置面板同一份），启动时由 main.ts 应用一次。
 * 网络字体走 jsdelivr（fontsource 按字符分片，按需加载），加载失败时自动落到系统字体。
 */

export type FontKey = 'noto-serif' | 'songti' | 'wenkai' | 'kaiti' | 'noto-sans' | 'yahei';
export type NarrativeTone = 'vivid' | 'plain';

export interface FontOption {
  key: FontKey;
  label: string;
  desc: string;
  stack: string;
  /** 需要注入的网络字体样式表 */
  css?: string[];
}

const SERIF_FALLBACK = "'SimSun', 'NSimSun', 'STSong', 'Songti SC', serif";
const SANS_FALLBACK = "'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', -apple-system, 'Segoe UI', sans-serif";

export const FONT_OPTIONS: FontOption[] = [
  {
    key: 'noto-serif',
    label: '思源宋体',
    desc: '书卷感，清晰耐读',
    stack: `'Noto Serif SC', 'Source Han Serif SC', ${SERIF_FALLBACK}`,
    css: [
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5/400.css',
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5/600.css',
    ],
  },
  {
    key: 'wenkai',
    label: '霞鹜文楷',
    desc: '楷书手写气质',
    stack: `'LXGW WenKai Screen', 'LXGW WenKai', 'KaiTi', 'STKaiti', ${SERIF_FALLBACK}`,
    css: ['https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/style.css'],
  },
  {
    key: 'songti',
    label: '宋体',
    desc: '系统自带，无需加载',
    stack: `${SERIF_FALLBACK}`,
  },
  {
    key: 'kaiti',
    label: '楷体',
    desc: '系统自带，笔画较细',
    stack: `'KaiTi', 'STKaiti', 'Kaiti SC', ${SERIF_FALLBACK}`,
  },
  {
    key: 'noto-sans',
    label: '思源黑体',
    desc: '现代，最易读',
    stack: `'Noto Sans SC', 'Source Han Sans SC', ${SANS_FALLBACK}`,
    css: [
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5/400.css',
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5/500.css',
    ],
  },
  {
    key: 'yahei',
    label: '微软雅黑',
    desc: '系统自带，现代',
    stack: SANS_FALLBACK,
  },
];

export const DEFAULT_FONT: FontKey = 'noto-serif';
export const DEFAULT_TONE: NarrativeTone = 'vivid';
export const DEFAULT_UI_SCALE = 100;
export const DEFAULT_NARRATIVE_SIZE = 17;
export type NarrativeLeading = 'tight' | 'normal' | 'loose';
export const DEFAULT_LEADING: NarrativeLeading = 'normal';
const LEADING_VALUE: Record<NarrativeLeading, string> = { tight: '1.8', normal: '2', loose: '2.25' };

const SETTINGS_KEY = 'dad_game_settings';

export const getFontOption = (key: unknown): FontOption =>
  FONT_OPTIONS.find((f) => f.key === key) ?? FONT_OPTIONS.find((f) => f.key === DEFAULT_FONT)!;

/** 注入某个字体的样式表（幂等） */
export const ensureFontLoaded = (key: FontKey) => {
  const opt = getFontOption(key);
  opt.css?.forEach((href, i) => {
    const id = `font-${opt.key}-${i}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
};

export const applyFont = (key: FontKey) => {
  const opt = getFontOption(key);
  ensureFontLoaded(opt.key);
  const root = document.documentElement.style;
  root.setProperty('--font-family-serif', opt.stack);
  root.setProperty('--font-family-sans-serif', opt.stack);
  document.documentElement.dataset.font = opt.key;
};

export const applyNarrativeTone = (tone: NarrativeTone) => {
  document.documentElement.dataset.narrative = tone === 'plain' ? 'plain' : 'vivid';
};

/**
 * 界面缩放：用 #app 的 zoom 整体放大（字号用 rem 还是 px 都能生效）。
 * #app 的宽高会按比例收回，视觉上仍铺满窗口，避免缩放把页面顶出视口。
 * 拖动滑块期间先挂起，松手再应用，否则滑块和页面会在指针底下挪走。
 */
let uiScaleGesture = false;

export const beginUIScaleGesture = () => {
  uiScaleGesture = true;
};

export const endUIScaleGesture = (scale: unknown) => {
  uiScaleGesture = false;
  applyUIScale(scale);
};

export const applyUIScale = (scale: unknown) => {
  const pct = Number(scale);
  const clamped = Number.isFinite(pct) ? Math.max(80, Math.min(130, pct)) : DEFAULT_UI_SCALE;
  if (uiScaleGesture) return;
  document.documentElement.style.setProperty('--ui-scale', String(clamped / 100));
  // 清掉旧版遗留的文字大小，避免它只放大少数继承字号的地方
  document.documentElement.style.removeProperty('--base-font-size');
};

/** 正文（叙事）字号，只影响中栏正文，不影响界面 */
export const applyNarrativeSize = (size: unknown) => {
  const px = Number(size);
  const clamped = Number.isFinite(px) ? Math.max(14, Math.min(22, px)) : DEFAULT_NARRATIVE_SIZE;
  document.documentElement.style.setProperty('--narrative-size', `${clamped}px`);
};

export const applyNarrativeLeading = (leading: unknown) => {
  const key = (leading as NarrativeLeading) in LEADING_VALUE ? (leading as NarrativeLeading) : DEFAULT_LEADING;
  document.documentElement.style.setProperty('--narrative-leading', LEADING_VALUE[key]);
};

/** 启动时从 localStorage 读取并应用 */
export const applyStoredReadingPrefs = () => {
  let saved: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') saved = parsed;
  } catch {
    // 读不到就用默认值
  }
  applyFont((saved.fontFamily as FontKey) ?? DEFAULT_FONT);
  applyNarrativeTone((saved.narrativeTone as NarrativeTone) ?? DEFAULT_TONE);
  applyUIScale(saved.uiScale ?? DEFAULT_UI_SCALE);
  applyNarrativeSize(saved.narrativeSize ?? DEFAULT_NARRATIVE_SIZE);
  applyNarrativeLeading(saved.narrativeLeading ?? DEFAULT_LEADING);
};
