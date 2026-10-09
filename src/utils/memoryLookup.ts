/**
 * 按名字在存档的"记忆/事件/叙事"文本里做**字面**检索。
 *
 * 用途：世界地图「按名字追加势力」时，把提到过这个名字的片段找出来喂给 AI，
 * 让它写出的势力与已经发生过的剧情一致。
 *
 * 为什么不复用现有的两套检索：
 * - `narrativeRagService` / `vectorMemoryService` 都是**向量检索**，依赖 Embedding API，
 *   没配置时直接返回空。这里要的是"玩家打出一个名字就能查到"的确定行为，
 *   所以做的是不依赖任何服务端的子串匹配。
 */

export interface NameMention {
  /** 来源描述，如「长期记忆」「林清瑶·记忆」 */
  来源: string;
  /** 命中的原文片段 */
  文本: string;
}

const asText = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return asText(o.文本 ?? o.text ?? o.内容 ?? o.摘要 ?? o.描述 ?? o.事件) || JSON.stringify(v);
  }
  return String(v);
};

/** 单条文本里命中的话，截取名字附近的一段，避免整段灌给 AI */
function excerpt(text: string, name: string, radius = 60): string {
  const i = text.indexOf(name);
  if (i < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, i - radius);
  const end = Math.min(text.length, i + name.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

/** 从任意层级的数组/字符串里收集命中的片段 */
function collect(source: unknown, name: string, label: string, out: NameMention[], limit: number) {
  if (out.length >= limit || source == null) return;
  const items = Array.isArray(source) ? source : [source];
  for (const raw of items) {
    if (out.length >= limit) return;
    const text = asText(raw).trim();
    if (!text || !text.includes(name)) continue;
    out.push({ 来源: label, 文本: excerpt(text, name) });
  }
}

/**
 * 在存档里查找某个名字出现过的位置。
 * 扫描范围：社交.记忆（短/中/长期、隐式中期）、社交.关系.{NPC}.记忆与记忆总结、
 * 社交.事件.事件记录、系统.历史.叙事。
 */
export function findNameMentions(name: string, saveData: any, limit = 12): NameMention[] {
  const target = String(name || '').trim();
  const out: NameMention[] = [];
  if (!target || !saveData || typeof saveData !== 'object') return out;

  const 社交 = saveData.社交 ?? {};
  const 记忆 = 社交.记忆 ?? {};
  for (const [key, label] of [
    ['短期记忆', '短期记忆'],
    ['中期记忆', '中期记忆'],
    ['长期记忆', '长期记忆'],
    ['隐式中期记忆', '隐式中期记忆'],
  ] as const) {
    collect(记忆[key], target, label, out, limit);
  }

  const 关系 = 社交.关系;
  if (关系 && typeof 关系 === 'object') {
    for (const [npcName, npc] of Object.entries(关系 as Record<string, any>)) {
      if (out.length >= limit) break;
      collect(npc?.记忆, target, `${npcName}·记忆`, out, limit);
      collect(npc?.记忆总结, target, `${npcName}·记忆总结`, out, limit);
    }
  }

  const 事件 = 社交.事件;
  collect(事件?.事件记录 ?? 事件, target, '事件记录', out, limit);

  collect(saveData.系统?.历史?.叙事, target, '历史叙事', out, limit);

  return out;
}
