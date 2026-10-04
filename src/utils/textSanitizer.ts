import type { TextReplaceRule } from '@/types/textRules';

const MAX_LINE_LENGTH = 500;
const MAX_REPLACE_RULES = 50;
const MAX_REPLACE_REPLACEMENT_LENGTH = 1500;

let cachedReplaceKey: string | null = null;
let cachedCompiledReplaceRules: Array<{ re: RegExp; replacement: string }> = [];

type SanitizerSettings = {
  replaceRules: TextReplaceRule[];
};

function safeGetSanitizerSettings(): SanitizerSettings {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return { replaceRules: [] };
    }
    const raw = localStorage.getItem('dad_game_settings');
    if (!raw) return { replaceRules: [] };
    const parsed = JSON.parse(raw);
    return {
      replaceRules: Array.isArray(parsed?.replaceRules) ? (parsed.replaceRules as TextReplaceRule[]) : [],
    };
  } catch {
    return { replaceRules: [] };
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildReplaceFlags(rule: TextReplaceRule): string {
  const globalFlag = rule.global === false ? '' : 'g';
  const i = rule.ignoreCase ? 'i' : '';
  const m = rule.mode === 'regex' && rule.multiline ? 'm' : '';
  const s = rule.mode === 'regex' && rule.dotAll ? 's' : '';
  return `${globalFlag}${i}${m}${s}`;
}

function escapeReplacementForText(replacement: string): string {
  return replacement.replace(/\$/g, '$$$$');
}

function compileReplaceRules(rules: TextReplaceRule[]): Array<{ re: RegExp; replacement: string }> {
  const compiled: Array<{ re: RegExp; replacement: string }> = [];
  for (const rule of rules) {
    if (compiled.length >= MAX_REPLACE_RULES) break;
    if (!rule || rule.enabled === false) continue;
    if (typeof rule.pattern !== 'string' || !rule.pattern.trim()) continue;

    const pattern = rule.pattern.length > MAX_LINE_LENGTH ? rule.pattern.slice(0, MAX_LINE_LENGTH) : rule.pattern;
    const replacementRaw = typeof rule.replacement === 'string' ? rule.replacement : '';
    const replacement =
      rule.mode === 'text'
        ? escapeReplacementForText(replacementRaw.slice(0, MAX_REPLACE_REPLACEMENT_LENGTH))
        : replacementRaw.slice(0, MAX_REPLACE_REPLACEMENT_LENGTH);

    try {
      if (rule.mode === 'text') {
        const flags = `${rule.global === false ? '' : 'g'}${rule.ignoreCase ? 'i' : ''}`;
        compiled.push({ re: new RegExp(escapeRegExp(pattern), flags), replacement });
      } else {
        const flags = buildReplaceFlags(rule);
        compiled.push({ re: new RegExp(pattern, flags), replacement });
      }
    } catch {
      // ignore invalid rule
    }
  }
  return compiled;
}

function getCompiledReplaceRules(): Array<{ re: RegExp; replacement: string }> {
  const settings = safeGetSanitizerSettings();
  const settingsKey = JSON.stringify(settings.replaceRules || []);
  if (settingsKey === cachedReplaceKey) return cachedCompiledReplaceRules;

  cachedReplaceKey = settingsKey;
  cachedCompiledReplaceRules = compileReplaceRules(settings.replaceRules || []);
  return cachedCompiledReplaceRules;
}

function sanitizeWithRules(
  text: string,
  replaceRules: Array<{ re: RegExp; replacement: string }>,
): string {
  if (!text) return '';

  let result = text;

  // Built-in: remove thinking/analysis blocks and leftover tags.
  // 支持多种变体：<thinking>, <Thinking>, <antThinking>, <ant-thinking> 等
  result = result
    .replace(/<(?:ant[-_]?)?thinking>[\s\S]*?<\/(?:ant[-_]?)?thinking>/gi, '')
    .replace(/<\/?(?:ant[-_]?)?thinking>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/<\/?analysis>/gi, '')
    // 移除可能的reasoning标签
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<\/?reasoning>/gi, '')
    // 移除可能的thought标签
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<\/?thought>/gi, '');

  for (const rule of replaceRules) {
    result = result.replace(rule.re, rule.replacement);
  }

  return result;
}

export function sanitizeAITextForDisplay(text: string): string {
  return sanitizeWithRules(text, getCompiledReplaceRules());
}

/**
 * 从完整的 JSON 响应中提取 text 字段
 * 用于最终显示时调用，不用于流式过程中
 */
export function extractTextFromJsonResponse(text: string): string {
  if (!text) return '';

  // 先移除 thinking 类标签
  const cleaned = text
    .replace(/<think[^>]*>[\s\S]*?<\/think[^>]*>/gi, '')
    .replace(/<\/?think[^>]*>/gi, '')
    .trim();

  // 查找 JSON 对象
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    // 被截断、没有闭合的 JSON：同样只取 text 字段
    return jsonStart === -1 ? cleaned : extractStreamingNarrative(cleaned) || cleaned;
  }

  const jsonStr = cleaned.slice(jsonStart, jsonEnd + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.text === 'string') {
      return parsed.text;
    }
  } catch {
    // JSON 不完整或不合法：按流式规则取出 text 字段，避免把 {"text":" 和 \" 当正文显示
    const partial = extractStreamingNarrative(cleaned);
    if (partial) return partial;
  }

  return cleaned;
}

// ─── 流式 JSON 正文解析（做法与织界 WebGame 的 extractPartialReply 一致） ───

const isJsonSpace = (ch: string) => ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';

/** 从 start 开始读一段 JSON 字符串（可以是不完整的），还原转义，遇到未转义的引号结束 */
function parsePartialJsonString(raw: string, start: number): string {
  let out = '';
  let escaping = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (escaping) {
      if (ch === '"' || ch === '\\' || ch === '/') out += ch;
      else if (ch === 'n') out += '\n';
      else if (ch === 'r') out += '\r';
      else if (ch === 't') out += '\t';
      else if (ch === 'b') out += '\b';
      else if (ch === 'f') out += '\f';
      else if (ch === 'u') {
        const hex = raw.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) break; // \u 被切在 chunk 末尾，等下一段
        out += String.fromCharCode(Number.parseInt(hex, 16));
        i += 4;
      } else out += ch;
      escaping = false;
      continue;
    }
    if (ch === '\\') {
      escaping = true;
      continue;
    }
    if (ch === '"') break;
    out += ch;
  }
  return out;
}

/** 找 "key" : <expected> 的值起点（跳过空白）；找不到返回 -1 */
function findJsonValueStart(raw: string, key: string, expected: '"' | '['): number {
  const target = `"${key}"`;
  let pos = raw.indexOf(target);
  while (pos >= 0) {
    let i = pos + target.length;
    while (i < raw.length && isJsonSpace(raw[i])) i += 1;
    if (raw[i] === ':') {
      i += 1;
      while (i < raw.length && isJsonSpace(raw[i])) i += 1;
      if (raw[i] === expected) return i + 1;
    }
    pos = raw.indexOf(target, pos + target.length);
  }
  return -1;
}

/** "text": ["段落一", "段落二", …]：逐项读出已完整或正在输出的字符串 */
function extractPartialStringArray(raw: string, key: string): string[] {
  const items: string[] = [];
  let i = findJsonValueStart(raw, key, '[');
  if (i < 0) return items;
  while (i < raw.length) {
    const ch = raw[i];
    if (isJsonSpace(ch) || ch === ',') {
      i += 1;
      continue;
    }
    if (ch !== '"') break;
    const text = parsePartialJsonString(raw, i + 1).trim();
    if (text) items.push(text);
    let escaping = false;
    let end = -1;
    for (let j = i + 1; j < raw.length; j += 1) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (raw[j] === '\\') {
        escaping = true;
        continue;
      }
      if (raw[j] === '"') {
        end = j + 1;
        break;
      }
    }
    if (end < 0) break;
    i = end;
  }
  return items;
}

const NARRATIVE_KEYS = ['text', '正文'];

/**
 * 流式正文：AI 按 {"text":"……", …} 输出时，边收边取出 text 字段并还原转义（\n、\"、\uXXXX）。
 * - 找到 text 键：只显示它的值，值结束后的指令 / 选项等字段不显示
 * - 还没出现 text 键但开头已是 { / [ / ```：先不显示（不露半截 JSON）
 * - 其余情况按纯文本原样显示
 */
export function extractStreamingNarrative(raw: string): string {
  if (!raw) return '';
  const cleaned = raw
    .replace(/<think[^>]*>[\s\S]*?<\/think[^>]*>/gi, '')
    .replace(/<\/?think[^>]*>/gi, '');

  for (const key of NARRATIVE_KEYS) {
    const arr = extractPartialStringArray(cleaned, key);
    if (arr.length) return arr.join('\n\n');
    const start = findJsonValueStart(cleaned, key, '"');
    if (start >= 0) return parsePartialJsonString(cleaned, start);
  }

  const trimmed = cleaned.trim();
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('```')) return '';
  return raw;
}
