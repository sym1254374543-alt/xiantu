export function extractFirstJsonSnippet(text: string): string | null {
  if (!text) return null;

  // 1) Prefer fenced code blocks (```json ... ```)
  const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  for (const match of text.matchAll(fenceRe)) {
    const candidate = (match[1] || '').trim();
    if (!candidate) continue;
    if (candidate.includes('{') || candidate.includes('[')) return candidate;
  }

  // 2) Fallback: find first balanced {...} or [...]
  const starts: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '[') starts.push(i);
  }

  for (const startIndex of starts) {
    const snippet = extractBalancedJson(text, startIndex);
    if (snippet) return snippet;
  }

  return null;
}

function extractBalancedJson(
  text: string,
  startIndex: number
): string | null {
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.length === 0 || stack[stack.length - 1] !== ch) return null;
      stack.pop();
      if (stack.length === 0) {
        return text.slice(startIndex, i + 1).trim();
      }
    }
  }

  return null;
}

export function parseJsonFromText<T = unknown>(text: string): T {
  const snippet = extractFirstJsonSnippet(text);
  if (!snippet) {
    throw new Error('未找到可解析的 JSON 片段');
  }
  return JSON.parse(snippet) as T;
}

/**
 * 收集文本中**所有**平衡的 JSON 片段（代码块优先，其余按出现顺序）。
 * `extractFirstJsonSnippet` 只给第一个，若它恰好不是合法 JSON（例如正文里先出现了
 * 一个花括号词组 `他说{甲}`），旧实现就直接抛错、不会看后面的真片段。
 */
export function extractAllJsonSnippets(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];

  const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  for (const match of text.matchAll(fenceRe)) {
    const candidate = (match[1] || '').trim();
    if (candidate && (candidate.includes('{') || candidate.includes('['))) out.push(candidate);
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '{' && ch !== '[') continue;
    const snippet = extractBalancedJson(text, i);
    if (snippet) out.push(snippet);
  }

  return out;
}

/**
 * 宽松修复常见的手写 JSON 毛病（模型输出高频踩坑）：
 * 1. **字符串内的裸换行/制表符**——模型把正文直接换行写进 `"text": "…"`，
 *    这是 JSON.parse 失败最常见的原因（Gemini 系尤甚）。
 * 2. 对象/数组末尾的**多余逗号**。
 * 只在"字符串内/字符串外"分别处理，不改结构符号，也不动已转义的字符。
 */
export function repairLooseJson(input: string): string {
  if (!input) return input;

  // 第 1 遍：转义字符串内的裸控制字符
  let escaped = '';
  let inString = false;
  let escapedByBackslash = false;
  for (const ch of input) {
    if (inString) {
      if (escapedByBackslash) { escaped += ch; escapedByBackslash = false; continue; }
      if (ch === '\\') { escaped += ch; escapedByBackslash = true; continue; }
      if (ch === '"') { escaped += ch; inString = false; continue; }
      if (ch === '\n') { escaped += '\\n'; continue; }
      if (ch === '\r') { escaped += '\\r'; continue; }
      if (ch === '\t') { escaped += '\\t'; continue; }
      escaped += ch;
      continue;
    }
    if (ch === '"') inString = true;
    escaped += ch;
  }

  // 第 2 遍：丢掉字符串外的尾逗号（, 之后只有空白再到 } 或 ]）
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < escaped.length; i++) {
    const ch = escaped[i];
    if (inStr) {
      if (esc) { esc = false; out += ch; continue; }
      if (ch === '\\') { esc = true; out += ch; continue; }
      if (ch === '"') inStr = false;
      out += ch;
      continue;
    }
    if (ch === '"') { inStr = true; out += ch; continue; }
    if (ch === ',') {
      let j = i + 1;
      while (j < escaped.length && /\s/.test(escaped[j])) j++;
      if (escaped[j] === '}' || escaped[j] === ']') continue;
    }
    out += ch;
  }

  return out;
}

/** 依次尝试：严格解析 → 宽松修复后解析；都失败返回 null */
function tryParseLoose(candidate: string | undefined | null): unknown | null {
  if (!candidate) return null;
  const t = candidate.trim();
  if (!t) return null;
  try { return JSON.parse(t); } catch { /* 再试修复 */ }
  try { return JSON.parse(repairLooseJson(t)); } catch { return null; }
}

/**
 * 智能JSON解析 - 自动适配强JSON模式和普通文本模式
 *
 * 候选顺序：整段文本 → 所有平衡片段（代码块优先，按出现顺序）。
 * 每个候选都先严格解析、失败再宽松修复（裸控制字符/尾逗号）。
 *
 * @param text - AI返回的文本内容
 * @param forceJsonMode - 是否启用了强JSON模式（=DeepSeek 等强 JSON 模式）
 * @param preferKeys - 出现**多个**可解析对象时，优先返回含这些键的那个。
 *   GM 响应应传 ['text','tavern_commands',...]，避免正文里先冒出的小对象被当成结果。
 */
export function parseJsonSmart<T = unknown>(text: string, forceJsonMode: boolean = false, preferKeys?: string[]): T {
  if (!text || !text.trim()) {
    throw new Error('AI返回内容为空');
  }

  const candidates: string[] = [text, ...extractAllJsonSnippets(text)];
  const parsedList: unknown[] = [];
  for (const candidate of candidates) {
    const parsed = tryParseLoose(candidate);
    // 只接受**对象**：片段扫描会把内层的 [] / {} 也当候选，
    // 若外层 JSON 已损坏，绝不能把内层数组/对象当成结果返回——那会静默产出空数据。
    // 现有调用方（GM 响应、世界生成、宗门内容…）要的都是对象，没有要顶层数组的。
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) parsedList.push(parsed);
  }

  if (!parsedList.length) {
    if (forceJsonMode) console.warn('[JSON解析] 强JSON模式下整段解析失败，尝试提取 JSON 片段');
    throw new Error(forceJsonMode ? '强JSON模式下解析失败,且未找到可提取的JSON片段' : '未找到可解析的 JSON 片段');
  }

  if (preferKeys?.length && parsedList.length > 1) {
    const preferred = parsedList.find(
      (o) => o && typeof o === 'object' && !Array.isArray(o) && preferKeys.some((k) => k in (o as Record<string, unknown>))
    );
    if (preferred) return preferred as T;
  }

  return parsedList[0] as T;
}

