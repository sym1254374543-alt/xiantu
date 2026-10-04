import openaiIcon from '@/assets/provider-icons/openai-green.png';
import anthropicIcon from '@/assets/provider-icons/anthropic.png';
import geminiIcon from '@/assets/provider-icons/gemini.png';
import deepseekIcon from '@/assets/provider-icons/deepseek.png';
import zhipuIcon from '@/assets/provider-icons/zhipu.png';
import doubaoIcon from '@/assets/provider-icons/doubao.png';

/** 按模型名猜厂商图标，公益模型只知道模型名 */
export function modelIcon(model: string, format?: string): string | undefined {
  const m = (model || '').toLowerCase();
  if (m.includes('gemini') || m.includes('gemma')) return geminiIcon;
  if (m.includes('claude')) return anthropicIcon;
  if (m.includes('deepseek')) return deepseekIcon;
  if (m.includes('glm')) return zhipuIcon;
  if (m.includes('doubao') || m.includes('seed')) return doubaoIcon;
  if (m.includes('gpt') || /^o\d/.test(m)) return openaiIcon;
  return format === 'gemini' ? geminiIcon : undefined;
}

export function modelVendor(model: string, format?: string): string {
  const m = (model || '').toLowerCase();
  if (m.includes('gemini') || m.includes('gemma')) return 'Google';
  if (m.includes('claude')) return 'Anthropic';
  if (m.includes('deepseek')) return 'DeepSeek';
  if (m.includes('glm')) return '智谱';
  if (m.includes('doubao') || m.includes('seed')) return '字节跳动';
  if (m.includes('gpt') || /^o\d/.test(m)) return 'OpenAI';
  return format === 'gemini' ? 'Gemini 格式' : 'OpenAI 兼容';
}

export const fmtSeconds = (ms: number | null | undefined) => (ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(2)}s`);
export const fmtRate = (rate: number | null | undefined, digits = 1) => (rate === null || rate === undefined ? '—' : `${(rate * 100).toFixed(digits)}%`);
export const fmtTps = (tps: number | null | undefined) => (tps === null || tps === undefined ? '—' : `${tps.toFixed(1)}t/s`);
