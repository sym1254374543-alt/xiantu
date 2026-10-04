import { ref } from 'vue';
import { FUNCTION_NAMES } from '@/data/apiProviders';
import type { APIUsageType } from '@/stores/apiManagementStore';

const KEY = 'dad_builtin_usage_log';
const MAX = 80;

export interface BuiltinUsageEntry {
  id: string;
  at: number;
  name: string;
  model: string;
  cost: number;
  balance: number | null;
  usage: APIUsageType | '';
}

function isEntry(value: unknown): value is BuiltinUsageEntry {
  if (!value || typeof value !== 'object') return false;
  const item = value as BuiltinUsageEntry;
  return typeof item.at === 'number' && typeof item.cost === 'number' && typeof item.name === 'string';
}

function load(): BuiltinUsageEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(isEntry).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function persist(items: BuiltinUsageEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* 存储满了就只留在内存里 */
  }
}

/** 本机公益调用记录。服务器只给累计消耗，没有逐次流水。 */
export const builtinUsageLog = ref<BuiltinUsageEntry[]>(load());

export function recordBuiltinUsage(entry: Omit<BuiltinUsageEntry, 'id' | 'at'>) {
  const item: BuiltinUsageEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    ...entry,
  };
  builtinUsageLog.value = [item, ...builtinUsageLog.value].slice(0, MAX);
  persist(builtinUsageLog.value);
}

export function clearBuiltinUsageLog() {
  builtinUsageLog.value = [];
  persist([]);
}

export function usageLabel(usage: APIUsageType | ''): string {
  return usage && usage in FUNCTION_NAMES ? FUNCTION_NAMES[usage] : '调用';
}

export function formatUsageTime(at: number): string {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return new Date().toDateString() === date.toDateString() ? clock : `${date.getMonth() + 1}/${date.getDate()} ${clock}`;
}
