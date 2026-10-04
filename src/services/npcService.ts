/**
 * 人物名录的写操作：实时关注、记忆编辑 / 总结、交易类行动、导出。
 * 组件只调这里的函数（docs/功能页重写规格.md 第 9 章）。
 */
import { cloneDeep } from 'lodash';
import type { Item, NpcProfile } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useActionQueueStore } from '@/stores/actionQueueStore';
import { generateWithRawPrompt } from '@/utils/tavernCore';
import { parseJsonFromText } from '@/utils/jsonExtract';
import { buildNpcMemorySummaryPrompts } from '@/utils/prompts/tasks/npcMemoryPrompts';
import { downloadText, localDateStamp, nameOf, descOf } from '@/utils/gameDisplay';
import { formatRealmWithStage } from '@/utils/realmUtils';
import { getTavernHelper } from '@/utils/tavern';
import { toast } from '@/utils/toast';

export type NpcMemory = NpcProfile['记忆'][number];

/** 记忆条目兼容 { 时间, 事件 } / 字符串 */
export function memoryParts(m: unknown): { time: string; text: string } {
  if (typeof m === 'string') {
    const hit = /^【([^】]{2,40})】\s*/.exec(m);
    return hit ? { time: hit[1], text: m.slice(hit[0].length) } : { time: '', text: m };
  }
  if (m && typeof m === 'object') {
    const o = m as Record<string, unknown>;
    return { time: String(o.时间 ?? ''), text: String(o.事件 ?? o.内容 ?? '') };
  }
  return { time: '', text: '' };
}

const memoryToText = (m: unknown) => {
  const p = memoryParts(m);
  return p.time ? `【${p.time}】${p.text}` : p.text;
};

function findKey(name: string): string | null {
  const rel = useGameStateStore().relationships || {};
  if (rel[name]) return name;
  return Object.keys(rel).find((k) => rel[k]?.名字 === name) ?? null;
}

/** 改一个 NPC：整体替换 relationships，保证响应式 + 落盘 */
async function patchNpc(name: string, mutate: (npc: NpcProfile) => void) {
  const gs = useGameStateStore();
  const key = findKey(name);
  if (!key || !gs.relationships) throw new Error(`找不到人物「${name}」`);
  const next = cloneDeep(gs.relationships);
  mutate(next[key]);
  gs.updateState('relationships', next);
  await useCharacterStore().saveCurrentGame();
}

export async function setFollow(name: string, on: boolean) {
  await patchNpc(name, (npc) => {
    npc.实时关注 = on;
  });
  toast.success(on ? `已实时关注 ${name}` : `已取消关注 ${name}`);
}

export async function updateMemory(name: string, index: number, text: string) {
  await patchNpc(name, (npc) => {
    const list = Array.isArray(npc.记忆) ? npc.记忆 : [];
    const old = list[index];
    if (old && typeof old === 'object') list[index] = { ...(old as object), 事件: text } as NpcMemory;
    else {
      const p = memoryParts(old);
      list[index] = p.time ? `【${p.time}】${text}` : text;
    }
    npc.记忆 = list;
  });
}

export async function deleteMemory(name: string, index: number) {
  await patchNpc(name, (npc) => {
    npc.记忆 = (npc.记忆 || []).filter((_, i) => i !== index);
  });
}

export async function deleteSummary(name: string, index: number) {
  await patchNpc(name, (npc) => {
    npc.记忆总结 = (npc.记忆总结 || []).filter((_, i) => i !== index);
  });
}

/** 总结最旧的 count 条记忆（至少 3 条），写入记忆总结并删掉被总结的条目 */
export async function summarizeMemories(name: string, count: number): Promise<number> {
  const gs = useGameStateStore();
  const key = findKey(name);
  const npc = key ? gs.relationships?.[key] : null;
  const memories = Array.isArray(npc?.记忆) ? npc!.记忆 : [];
  if (memories.length < 3) throw new Error('至少需要 3 条记忆才能总结');
  const n = Math.min(Math.max(3, count), memories.length);

  const memoriesText = memories.slice(0, n).map((m, i) => `${i + 1}. ${memoryToText(m)}`).join('\n');

  // 与正式对话一致：去掉叙事历史、短期 / 隐式中期记忆，缩小上下文
  const save = cloneDeep(gs.toSaveData() || {}) as any;
  if (save.系统?.历史) delete save.系统.历史.叙事;
  if (save.社交?.记忆) {
    delete save.社交.记忆.短期记忆;
    delete save.社交.记忆.隐式中期记忆;
  }

  const { system, user } = buildNpcMemorySummaryPrompts(name, memoriesText, JSON.stringify(save, null, 2));
  let streaming = false;
  try {
    streaming = JSON.parse(localStorage.getItem('memory-settings') || '{}').useStreaming === true;
  } catch {
    /* 默认非流式 */
  }
  const raw = await generateWithRawPrompt(user, system, streaming, 'memory_summary');

  let summary = '';
  const cleaned = String(raw || '').replace(/<\/input>/g, '').trim();
  try {
    summary = String(parseJsonFromText<{ text?: string }>(cleaned)?.text || '').trim();
  } catch {
    summary = cleaned;
  }
  if (!summary) throw new Error('AI 返回了空的总结');

  await patchNpc(name, (p) => {
    p.记忆总结 = [...(Array.isArray(p.记忆总结) ? p.记忆总结 : []), summary];
    p.记忆 = (p.记忆 || []).slice(n);
  });
  return n;
}

export async function deleteNpc(name: string) {
  await useCharacterStore().deleteNpc(name);
}

/** 交易 / 索要 / 偷窃：只记入行动队列，下回合随输入告诉 AI */
export function queueItemAction(npc: NpcProfile, item: Item, kind: 'trade' | 'request' | 'steal') {
  const meta = {
    trade: { type: 'npc_trade', label: 'NPC交易', text: `尝试与 ${npc.名字} 交易 ${item.名称}`, toast: '交易请求' },
    request: { type: 'npc_request', label: 'NPC索要', text: `向 ${npc.名字} 索要 ${item.名称}`, toast: '索要请求' },
    steal: { type: 'npc_steal', label: 'NPC偷窃', text: `尝试从 ${npc.名字} 身上偷取 ${item.名称}`, toast: '偷窃计划' },
  }[kind];
  useActionQueueStore().addAction({
    type: meta.type as any,
    itemName: item.名称,
    itemType: meta.label,
    description: meta.text,
    npcName: npc.名字,
    itemId: item.物品ID || item.名称,
    tradeType: kind,
  });
  toast.success(`已把${meta.toast}加入行动队列，下回合生效`);
}

export function exportNpc(npc: NpcProfile) {
  const data = { 导出信息: { 人物名称: npc.名字, 导出时间: new Date().toLocaleString('zh-CN'), 数据版本: '1.0' }, 人物数据: npc };
  downloadText(`${npc.名字}_人物数据_${localDateStamp()}.json`, JSON.stringify(data, null, 2));
}

export function exportNpcMemories(npc: NpcProfile) {
  const data = {
    人物名称: npc.名字,
    导出时间: new Date().toLocaleString('zh-CN'),
    详细记忆: npc.记忆 || [],
    记忆总结: npc.记忆总结 || [],
  };
  downloadText(`${npc.名字}_记忆_${localDateStamp()}.json`, JSON.stringify(data, null, 2));
}

/** 酒馆：写入世界书「仙途_人物」（不含记忆） */
export async function exportNpcToWorldbook(npc: NpcProfile) {
  const helper = getTavernHelper() as any;
  if (!helper) throw new Error('酒馆助手未初始化');
  const book = '仙途_人物';
  const books: string[] = await helper.getLorebooks();
  if (!books.includes(book)) await helper.createLorebook(book);

  const lines: string[] = [`# ${npc.名字}`, '', '**基础档案**'];
  lines.push(`- 性别：${npc.性别 || '未知'}`, `- 种族：${npc.种族 || '未知'}`);
  if (npc.出生日期) lines.push(`- 出生日期：${npc.出生日期.年}年${npc.出生日期.月}月${npc.出生日期.日}日`);
  lines.push(`- 境界：${formatRealmWithStage(npc.境界)}`, `- 灵根：${nameOf(npc.灵根) || '未知'}`);
  if (npc.势力归属) lines.push(`- 势力：${npc.势力归属}`);
  if (npc.出生) lines.push(`- 出生：${nameOf(npc.出生)}`);
  if (npc.当前位置?.描述) lines.push(`- 当前位置：${npc.当前位置.描述}`);
  lines.push('', '**外貌与性格**', npc.外貌描述 || npc.外貌 || '未描述');
  if (Array.isArray(npc.性格特征) && npc.性格特征.length) lines.push('', '**性格特征**', ...npc.性格特征.map((t) => `- ${t}`));
  if (Array.isArray(npc.天赋) && npc.天赋.length) {
    lines.push('', '**天赋能力**', ...npc.天赋.map((t) => `- ${nameOf(t)}${descOf(t) ? `：${descOf(t)}` : ''}`));
  }
  if (npc.先天六司) lines.push('', '**先天六司**', ...Object.entries(npc.先天六司).map(([k, v]) => `- ${k}：${v || 0}`));
  const bottom = Array.isArray(npc.人格底线) ? npc.人格底线 : npc.人格底线 ? [npc.人格底线] : [];
  if (bottom.length) lines.push('', '**人格底线**', ...bottom.map((b) => `- ${b}`));
  lines.push('', '**当前状态（实时）**');
  if (npc.当前外貌状态) lines.push(`- 外貌状态：${npc.当前外貌状态}`);
  if (npc.当前内心想法) lines.push(`- 内心想法：${npc.当前内心想法}`);
  const items = Object.values(npc.背包?.物品 || {});
  if (items.length) lines.push('', '**背包物品**', ...items.map((it) => `- ${it.名称}${it.数量 > 1 ? ` x${it.数量}` : ''}${it.描述 ? `：${it.描述}` : ''}`));
  lines.push('', '**与玩家关系**', `- 关系：${npc.与玩家关系 || '相识'}`, `- 好感度：${npc.好感度 || 0}`);
  if (npc.实时关注) lines.push('- 实时关注：已启用（AI会主动更新此人物状态）');

  await helper.createLorebookEntries(book, [{
    name: npc.名字,
    enabled: true,
    strategy: {
      type: 'selective',
      keys: [npc.名字, npc.种族 || '', npc.势力归属 || ''].filter(Boolean),
      keys_secondary: { logic: 'and_any', keys: [] },
      scan_depth: 'same_as_global',
    },
    position: { type: 'after_character_definition', role: 'system', depth: 4, order: 100 },
    content: lines.join('\n') + '\n',
    probability: 100,
    recursion: { prevent_incoming: false, prevent_outgoing: false, delay_until: null },
    effect: { sticky: null, cooldown: null, delay: null },
    extra: { 来源: '仙途', 导出时间: new Date().toLocaleString('zh-CN'), 人物ID: npc.名字 },
  }]);
  return book;
}
