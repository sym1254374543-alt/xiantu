/**
 * 加载遮罩的实时预览：从「尚未完整」的流式文本中抽取可展示的内容。
 * 输入是半截 JSON / 半截正文，所以只用宽松的正则，不做 JSON.parse。
 */

export type WorldEntityGroup = 'continents' | 'factions' | 'locations';

export interface WorldEntityPreview {
  continents: string[];
  factions: string[];
  locations: string[];
}

const SECTION_PATTERN = /"(continents|factions|locations|大陆信息|势力信息|地点信息)"\s*:/g;
const NAME_PATTERN = /"(?:name|名称)"\s*:\s*"((?:[^"\\]|\\.){1,40})"/g;

const SECTION_ALIAS: Record<string, WorldEntityGroup> = {
  continents: 'continents',
  factions: 'factions',
  locations: 'locations',
  大陆信息: 'continents',
  势力信息: 'factions',
  地点信息: 'locations',
};

/** 按出现顺序抽取世界 JSON 中各分区的名称（去重） */
export function extractWorldEntities(stream: string): WorldEntityPreview {
  const result: WorldEntityPreview = { continents: [], factions: [], locations: [] };
  if (!stream) return result;

  const sections: Array<{ index: number; group: WorldEntityGroup }> = [];
  for (const match of stream.matchAll(SECTION_PATTERN)) {
    sections.push({ index: match.index ?? 0, group: SECTION_ALIAS[match[1]] });
  }
  if (sections.length === 0) return result;

  const seen = new Set<string>();
  let sectionCursor = -1;
  for (const match of stream.matchAll(NAME_PATTERN)) {
    const index = match.index ?? 0;
    while (sectionCursor + 1 < sections.length && sections[sectionCursor + 1].index < index) {
      sectionCursor++;
    }
    if (sectionCursor < 0) continue;
    const group = sections[sectionCursor].group;
    const name = match[1].replace(/\\"/g, '"').trim();
    const dedupeKey = `${group}:${name}`;
    if (!name || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result[group].push(name);
  }
  return result;
}

export interface CommandPreview {
  action: string;
  key: string;
  /** 简短的值预览；对象 / 数组显示为 {…} / […] */
  value: string;
}

const ACTION_PATTERN = /"action"\s*:\s*"(\w+)"/g;
const KEY_PATTERN = /"key"\s*:\s*"((?:[^"\\]|\\.){1,80})"/;
const VALUE_PATTERN = /"value"\s*:\s*("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|true|false|null|\{|\[)/;

const formatCommandValue = (raw: string | undefined): string => {
  if (!raw) return '';
  if (raw === '{') return '{…}';
  if (raw === '[') return '[…]';
  if (raw.startsWith('"')) {
    const text = raw.slice(1, -1).replace(/\\n/g, ' ').replace(/\\"/g, '"');
    return text.length > 24 ? `${text.slice(0, 24)}…` : text;
  }
  return raw;
};

/**
 * 从（可能不完整的）指令 JSON 中抽取 tavern_commands：
 * 以每个 "action" 为锚点，在它与下一个 action 之间找 key / value；
 * key 写在 action 之前的情况，退回到上一个 action 之后的片段里找。
 * 只返回 key 已完整输出的指令。
 */
export function extractCommandPreview(stream: string): CommandPreview[] {
  if (!stream) return [];
  const anchors = [...stream.matchAll(ACTION_PATTERN)];
  const result: CommandPreview[] = [];
  anchors.forEach((match, i) => {
    const start = match.index ?? 0;
    const end = i + 1 < anchors.length ? anchors[i + 1].index ?? stream.length : stream.length;
    const prevEnd = i > 0 ? (anchors[i - 1].index ?? 0) + anchors[i - 1][0].length : 0;
    const after = stream.slice(start, end);
    const before = stream.slice(Math.max(prevEnd, start - 300), start);
    const lastBrace = before.lastIndexOf('{');
    const ownBefore = lastBrace >= 0 ? before.slice(lastBrace) : '';

    const keyMatch = after.match(KEY_PATTERN) ?? ownBefore.match(KEY_PATTERN);
    if (!keyMatch) return;
    const valueMatch = after.match(VALUE_PATTERN) ?? ownBefore.match(VALUE_PATTERN);
    result.push({
      action: match[1],
      key: keyMatch[1].replace(/\\"/g, '"'),
      value: formatCommandValue(valueMatch?.[1]),
    });
  });
  return result;
}

const THINK_BLOCK =/<(think|thinking|思考|思维链)[^>]*>[\s\S]*?<\/\1\s*>/gi;
const UNCLOSED_THINK = /<(think|thinking|思考|思维链)[^>]*>[\s\S]*$/i;

/**
 * 剧情正文预览：去掉思维链与标签；若是 JSON 响应则取 "text" 字段；返回末尾一段。
 * thinking 为 true 表示模型仍在输出思维链、正文尚未开始。
 */
export function extractStoryPreview(stream: string, maxLength = 360): { text: string; thinking: boolean } {
  if (!stream) return { text: '', thinking: false };

  let text = stream.replace(THINK_BLOCK, '');
  const thinking = UNCLOSED_THINK.test(text);
  if (thinking) text = text.replace(UNCLOSED_THINK, '');

  const jsonText = text.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (jsonText) {
    text = jsonText[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  } else if (/^\s*[{[]/.test(text)) {
    // JSON 已开始但还没到正文字段
    return { text: '', thinking };
  }

  text = text
    .replace(/<\/?[^<>\n]{1,40}>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length > maxLength) {
    const tail = text.slice(-maxLength);
    const breakAt = tail.search(/[。！？\n]/);
    text = breakAt >= 0 && breakAt < 80 ? tail.slice(breakAt + 1).trimStart() : tail;
  }
  return { text, thinking };
}
