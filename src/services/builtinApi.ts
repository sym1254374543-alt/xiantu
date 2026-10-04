/**
 * 公益 API。密钥不下发，玩家用登录令牌走后端转发。
 * 后端开放多个公益模型，所有模型共用一份额度（可为小数），按模型单价扣。
 * 玩家可以提交自己的渠道，审核通过后进入公益池，被使用时返还额度给提交者。
 */
import { buildBackendUrl, isBackendConfigured } from '@/services/backendConfig';

export const BUILTIN_API_ID = 'builtin';
export const BUILTIN_API_KEY = '__builtin__';

export type BuiltinApiFormat = 'openai' | 'gemini';

export interface BuiltinApiStatus {
  id: string;
  available: boolean;
  name: string;
  format: BuiltinApiFormat;
  model: string;
  description: string;
  cost: number;
  max_tokens: number;
  channels: number;
}

export interface BuiltinBucket {
  hour: string;
  requests: number;
  successes: number;
  success_rate: number | null;
  avg_latency_ms: number | null;
  avg_ttft_ms: number | null;
  tps: number | null;
}

export interface BuiltinStats {
  id: string;
  window_hours: number;
  requests: number;
  success_rate: number | null;
  avg_latency_ms: number | null;
  avg_ttft_ms: number | null;
  tps: number | null;
  incidents: number;
  buckets: BuiltinBucket[];
}

export interface CheckinTier {
  name: string;
  amount: number;
  chance: number;
  high: boolean;
}

export interface CheckinRules {
  mode: 'fixed' | 'lottery';
  register_bonus: number;
  fixed_amount: number;
  tiers: CheckinTier[];
  expected: number;
  pity_threshold: number;
  streak_step: number;
  streak_cap: number;
  contributor_ratio: number;
  submission_enabled: boolean;
}

export interface CheckinResult {
  amount: number;
  base_amount: number;
  bonus: number;
  tier: string;
  streak: number;
  pity_hit: boolean;
  balance: number;
}

export interface BuiltinWallet {
  balance: number;
  total_earned: number;
  total_spent: number;
  contributed: number;
  checked_in_today: boolean;
  streak: number;
  next_bonus: number;
  pity_left: number | null;
  today: CheckinResult | null;
  rules: CheckinRules;
}

export interface LeaderboardEntry {
  rank: number;
  user_name: string;
  value: number;
  me: boolean;
}

export interface Leaderboard {
  kind: 'contribution' | 'balance';
  items: LeaderboardEntry[];
  mine: { value: number; rank: number | null } | null;
}

export type ChannelStatus = 'pending' | 'approved' | 'rejected' | 'disabled';

export interface MyChannel {
  id: number;
  name: string;
  format: BuiltinApiFormat;
  model: string;
  note: string;
  status: ChannelStatus;
  review_note: string;
  item_id: string | null;
  item_name: string;
  served: number;
  rewarded: number;
  created_at: string | null;
  host: string;
}

export interface ChannelDraft {
  name: string;
  format: BuiltinApiFormat;
  base_url: string;
  api_key: string;
  model: string;
  note: string;
}

export function builtinClientId(serverId: string): string {
  const id = (serverId || BUILTIN_API_ID).trim();
  return id === BUILTIN_API_ID ? BUILTIN_API_ID : `builtin:${id}`;
}

export function builtinServerIdFromClient(clientId: string, explicit?: string): string {
  const given = explicit?.trim();
  if (given) return given;
  if (clientId.startsWith('builtin:')) return clientId.slice('builtin:'.length);
  return BUILTIN_API_ID;
}

export function isBuiltinClientId(id: string | undefined): boolean {
  return id === BUILTIN_API_ID || !!id?.startsWith('builtin:');
}

export function builtinProxyBaseUrl(): string {
  return buildBackendUrl('/api/v1/ai');
}

/** 额度显示：最多两位小数，去掉多余的 0 */
export function formatCredit(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Number(value.toFixed(digits)).toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

export class BuiltinApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** 公益 API 的请求不走通用 request：那边 401 会跳登录页，局内不能被打断。 */
async function call<T>(path: string, init: RequestInit = {}, auth: 'required' | 'optional' = 'optional'): Promise<T> {
  if (!isBackendConfigured()) throw new BuiltinApiError('未配置后端服务器', 0);
  const token = localStorage.getItem('access_token');
  if (auth === 'required' && !token) throw new BuiltinApiError('请先登录云端账号', 401);
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body) headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(buildBackendUrl(`/api/v1/ai${path}`), { ...init, headers });
  } catch {
    throw new BuiltinApiError('无法连接服务器', 0);
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* 非 JSON */
  }
  if (!response.ok) {
    const detail = data && typeof data === 'object' ? (data as { detail?: unknown }).detail : null;
    const message = typeof detail === 'string' ? detail : response.status === 401 ? '登录已失效，请重新登录' : `服务器错误 ${response.status}`;
    throw new BuiltinApiError(message, response.status);
  }
  return data as T;
}

function normalizeBuiltinItem(data: Record<string, unknown>): BuiltinApiStatus | null {
  if (data.available !== true) return null;
  const id = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : BUILTIN_API_ID;
  const cost = Number(data.cost);
  return {
    id,
    available: true,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '公益 API',
    format: data.format === 'gemini' ? 'gemini' : 'openai',
    model: typeof data.model === 'string' ? data.model : '',
    description: typeof data.description === 'string' ? data.description : '',
    cost: Number.isFinite(cost) && cost >= 0 ? cost : 1,
    max_tokens: Number.isFinite(data.max_tokens) ? Number(data.max_tokens) : 16000,
    channels: Number.isFinite(data.channels) ? Number(data.channels) : 1,
  };
}

export interface BuiltinList {
  items: BuiltinApiStatus[];
  /** 未登录时为 null */
  balance: number | null;
}

/** 拉取当前开放的公益模型。失败返回 null，调用方保留上次结果。 */
export async function fetchBuiltinApiList(): Promise<BuiltinList | null> {
  try {
    const data = await call<{ items?: unknown[]; balance?: number }>('/builtin');
    const items = (data?.items || [])
      .map((item) => (item && typeof item === 'object' ? normalizeBuiltinItem(item as Record<string, unknown>) : null))
      .filter((item): item is BuiltinApiStatus => !!item);
    return { items, balance: typeof data?.balance === 'number' ? data.balance : null };
  } catch {
    return null;
  }
}

export const fetchBuiltinStats = async (): Promise<BuiltinStats[]> =>
  (await call<{ items: BuiltinStats[] }>('/builtin/stats')).items || [];

export const fetchBuiltinWallet = () => call<BuiltinWallet>('/builtin/wallet', {}, 'required');

export const builtinCheckIn = () =>
  call<{ result: CheckinResult; wallet: BuiltinWallet }>('/builtin/checkin', { method: 'POST' }, 'required');

export const fetchLeaderboard = (kind: 'contribution' | 'balance') =>
  call<Leaderboard>(`/builtin/leaderboard?kind=${kind}`);

export const submitBuiltinChannel = (draft: ChannelDraft) =>
  call<{ message: string; channel: MyChannel }>('/builtin/channels', { method: 'POST', body: JSON.stringify(draft) }, 'required');

export const fetchMyChannels = async (): Promise<MyChannel[]> =>
  (await call<{ items: MyChannel[] }>('/builtin/channels/mine', {}, 'required')).items || [];

export const withdrawMyChannel = (id: number) =>
  call<{ message: string }>(`/builtin/channels/mine/${id}`, { method: 'DELETE' }, 'required');
