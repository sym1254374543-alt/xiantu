/**
 * 品阶 → 局内品阶色令牌（见 styles/game-theme.css 的 --q-*）
 * 用法：:style="{ '--quality': qualityTone(item.品质) }"，样式里用 var(--quality)
 *
 * 本文件有两套体系，别混用：
 * - 物品/功法品质：凡、黄、玄、地、天、仙、神（单字）
 * - 灵根品阶：凡品、下品、中品、上品、极品、神品、特殊（带「品」字，值域见 data/creationData.ts）
 * 两者都含「凡/神」，但中间档位不同（黄玄地天仙 vs 下中上极），必须分别映射。
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

/**
 * 灵根品阶 → 色令牌。
 *
 * 灵根品阶有 7 个等级：凡品 < 下品 < 中品 < 上品 < 极品 < 仙品 < 神品
 * （依据 data/creationData.ts 的 base_multiplier：1.0/1.1/1.3/1.6/2.0/(2.5)/(2.8~3.2)）
 * 「特殊」不是等级，而是异变标记（倍率跨 0.5~1.8），故单列中性色，不占色阶高位。
 *
 * 与物品品质(凡黄玄地天仙神)按位置对应上色，保证同档次观感一致：
 * 凡品↔凡 下品↔黄 中品↔玄 上品↔地 极品↔天 仙品↔仙 神品↔神
 */
const ROOT_TIER_TOKEN: Record<string, string> = {
  凡品: '--q-fan',
  下品: '--q-huang',
  中品: '--q-xuan',
  上品: '--q-di',
  极品: '--q-tian',
  仙品: '--q-xian',
  神品: '--q-shen',
  特殊: '--q-special',
};

/** 从品质字段（字符串 / { quality } / { 品质 } / { 品阶 }）取出单字品阶，取不到返回「凡」 */
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

/**
 * 灵根品阶的统一入口：接受 品阶字符串 / {tier} / {品级} / {名称,品级}。
 * 先用规范表精确匹配；未命中再按历史上 AI 误用的物品品质单字兜底
 * （如「地品」「天品」「黄品」），避免旧存档灵根显示成灰色。
 */
export function spiritRootTone(rootOrTier: unknown): string {
  const tier = extractRootTier(rootOrTier)
  if (tier && tier in ROOT_TIER_TOKEN) return `var(${ROOT_TIER_TOKEN[tier]})`
  return `var(${ROOT_TIER_FALLBACK_TOKENS.find(t => tier.includes(t.key))?.token || '--q-fan'})`
}

/** 旧存档/AI 误用物品品质时的单字兜底表（按包含关系匹配，长词优先） */
const ROOT_TIER_FALLBACK_TOKENS: { key: string; token: string }[] = [
  { key: '凡', token: '--q-fan' },
  { key: '黄', token: '--q-huang' },
  { key: '玄', token: '--q-xuan' },
  { key: '地', token: '--q-di' },
  { key: '天', token: '--q-tian' },
  { key: '仙', token: '--q-xian' },
  { key: '神', token: '--q-shen' },
  { key: '上', token: '--q-di' },
  { key: '极', token: '--q-tian' },
  { key: '中', token: '--q-xuan' },
  { key: '下', token: '--q-huang' },
  { key: '特', token: '--q-special' },
]

/** 取出灵根品阶原文，兼容字符串与对象两种存法 */
export function extractRootTier(rootOrTier: unknown): string {
  if (typeof rootOrTier === 'string') return rootOrTier.trim()
  if (rootOrTier && typeof rootOrTier === 'object') {
    const o = rootOrTier as Record<string, unknown>
    return String(o.tier ?? o.品级 ?? o.品阶 ?? '').trim()
  }
  return ''
}
