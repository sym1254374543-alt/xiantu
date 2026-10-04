/**
 * 品阶 → 局内品阶色令牌（见 styles/game-theme.css 的 --q-*）
 * 用法：:style="{ '--quality': qualityTone(item.品质) }"，样式里用 var(--quality)
 */
const QUALITY_TOKEN: Record<string, string> = {
  凡: '--q-fan',
  黄: '--q-huang',
  玄: '--q-xuan',
  地: '--q-di',
  天: '--q-tian',
  仙: '--q-xian',
  神: '--q-shen',
  圣: '--q-sheng',
  道: '--q-sheng',
};

/** 从品质字段（字符串 / { quality } / { 品质 }）取出单字品阶，取不到返回「凡」 */
export function qualityKey(quality: unknown): string {
  let raw: unknown = quality;
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    raw = o.quality ?? o.品质 ?? o.品阶 ?? '';
  }
  const text = String(raw ?? '').trim();
  for (const ch of text) {
    if (ch in QUALITY_TOKEN) return ch;
  }
  return '凡';
}

export function qualityTone(quality: unknown): string {
  return `var(${QUALITY_TOKEN[qualityKey(quality)]})`;
}
