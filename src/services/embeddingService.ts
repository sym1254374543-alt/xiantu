import axios from 'axios';
import type { APIProvider } from '@/services/aiService';

export interface EmbeddingRequestConfig {
  provider: APIProvider;
  url: string;
  apiKey: string;
  model: string;
}

/** Embedding 请求超时：RAG 只是增强，不能无限期阻塞主剧情请求 */
export const EMBEDDING_TIMEOUT_MS = 20_000;

export function normalizeBaseUrl(url: string): string {
  return (url || '').toString().trim().replace(/\/v1\/?$/, '').replace(/\/+$/, '');
}

function isDashScopeHost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'dashscope.aliyuncs.com' || u.hostname === 'dashscope-intl.aliyuncs.com';
  } catch {
    const lower = (url || '').toString().toLowerCase();
    return lower.includes('dashscope.aliyuncs.com') || lower.includes('dashscope-intl.aliyuncs.com');
  }
}

function isSiliconFlowHost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'api.siliconflow.cn' || u.hostname.endsWith('.siliconflow.cn');
  } catch {
    const lower = (url || '').toString().toLowerCase();
    return lower.includes('siliconflow.cn');
  }
}

/**
 * 硅基流动 Create Embeddings（/v1/embeddings）：
 * input 为字符串或字符串数组，数组最多 32 条；encoding_format 为 float 或 base64。
 * dimensions 只有 Qwen/Qwen3 的指定档位能用，BAAI 模型带上它会 400 / 20015。
 * 超限文本同样是 20015。实测 bge-large 中文 480 字可通过，512 字会被拒。
 * messages、temperature、max_tokens 打到这个接口也是 20015。
 */
const SILICONFLOW_BATCH = 32;

function siliconFlowMaxChars(model: string): number {
  const m = model.toLowerCase();
  if (m.includes('bge-large') || m.includes('bce-embedding')) return 480;
  if (m.includes('bge-m3')) return 6000;
  if (m.includes('qwen') && m.includes('embedding')) return 12000;
  return 2000;
}

function prepareSiliconFlowInputs(inputs: string[], model: string): string[] {
  const max = siliconFlowMaxChars(model);
  return inputs.map((raw) => {
    const text = (raw || '').replace(/\s+/g, ' ').trim().slice(0, max);
    return text || '空';
  });
}

function readOpenAIEmbeddings(data: unknown, expected: number): number[][] {
  if (!Array.isArray(data) || data.length !== expected) {
    throw new Error('Embedding 响应格式异常（SiliconFlow）');
  }
  const sorted = [...data].sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((d: any) => {
    const embedding = d?.embedding;
    if (!Array.isArray(embedding)) throw new Error('Embedding 响应缺少 embedding（SiliconFlow）');
    return embedding as number[];
  });
}

async function requestSiliconFlowEmbeddings(
  endpoint: string,
  apiKey: string,
  model: string,
  input: string | string[],
): Promise<number[][]> {
  const expected = Array.isArray(input) ? input.length : 1;
  const resp = await axios.post(
    endpoint,
    { model, input, encoding_format: 'float' },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: EMBEDDING_TIMEOUT_MS,
    },
  );
  return readOpenAIEmbeddings(resp.data?.data, expected);
}

function buildDashScopeEmbeddingsEndpoint(urlOrBase: string): string {
  const trimmed = (urlOrBase || '').trim().replace(/\/+$/, '');
  const fullPath = '/api/v1/services/embeddings/text-embedding/text-embedding';

  // 用户可能直接填了完整端点
  if (trimmed.includes(fullPath)) return trimmed;

  try {
    const u = new URL(trimmed);
    const path = (u.pathname || '').replace(/\/+$/, '');

    // normalizeBaseUrl 可能把 https://dashscope.aliyuncs.com/api/v1 变成 https://dashscope.aliyuncs.com/api
    if (path === '/api') return `${u.origin}${fullPath}`;

    // 用户可能误填了 OpenAI 兼容路径（/compatible-mode/v1），这里强制回到原生 /api/v1
    return `${u.origin}${fullPath}`;
  } catch {
    // 兜底：字符串拼接（尽量避免重复 /api）
    if (trimmed.endsWith('/api')) return `${trimmed}/v1/services/embeddings/text-embedding/text-embedding`;
    return `${trimmed}${fullPath}`;
  }
}

function getApiStore(): { isFunctionEnabled: (type: string) => boolean; apiConfigs: any[]; getAPIForType: (type: string) => any } | null {
  try {
    // 动态获取 store，避免 store ↔ service 循环依赖
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAPIManagementStore } = require('@/stores/apiManagementStore');
    return useAPIManagementStore();
  } catch {
    return null;
  }
}

/** 功能分配里的叙事检索开关。未开启时不调用 Embedding。 */
export function isEmbeddingFunctionEnabled(): boolean {
  return getApiStore()?.isFunctionEnabled('embedding') === true;
}

/**
 * 读取 API 管理中分配给 Embedding 的独立 API。
 * 开关关闭、未分配（回落到 default）或缺少地址/Key/模型时返回 null。
 * @param apiIdOverride 指定使用某个 API 配置（可选）
 */
export function resolveEmbeddingConfig(apiIdOverride?: string): EmbeddingRequestConfig | null {
  try {
    const apiStore = getApiStore();
    if (!apiStore || !apiStore.isFunctionEnabled('embedding')) return null;
    const cfg = apiIdOverride
      ? apiStore.apiConfigs.find((api: any) => api.id === apiIdOverride && api.enabled)
      : apiStore.getAPIForType('embedding');
    if (!cfg || cfg.enabled === false || cfg.id === 'default') return null;

    const url = normalizeBaseUrl(cfg.url);
    const apiKey = (cfg.apiKey || '').trim();
    const model = (cfg.model || '').trim();
    if (!url || !apiKey || !model) return null;

    return { provider: cfg.provider as APIProvider, url, apiKey, model };
  } catch {
    return null;
  }
}

export function normalizeToUnitVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (!norm) return vec;
  return vec.map(v => v / norm);
}

export async function createEmbeddings(
  config: EmbeddingRequestConfig,
  inputs: string[],
): Promise<number[][]> {
  const provider = config.provider;
  const baseUrl = normalizeBaseUrl(config.url);
  const apiKey = (config.apiKey || '').trim();
  const model = (config.model || '').trim();

  if (!baseUrl) throw new Error('Embedding API 地址未配置');
  if (!apiKey) throw new Error('Embedding API Key 未配置');
  if (!model) throw new Error('Embedding 模型未配置');

  // 阿里云百炼（DashScope）Embedding：不支持 OpenAI 兼容 /v1/embeddings，需要走原生端点
  if (isDashScopeHost(baseUrl)) {
    const endpoint = buildDashScopeEmbeddingsEndpoint(baseUrl);
    const resp = await axios.post(
      endpoint,
      {
        model,
        input: { texts: inputs },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: EMBEDDING_TIMEOUT_MS,
      },
    );

    // DashScope: { output: { embeddings: [{ text_index, embedding: number[] }] } }
    const embeddings = resp.data?.output?.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length !== inputs.length) {
      throw new Error('Embedding 响应格式异常（DashScope）');
    }

    const ordered = embeddings
      .map((e: any) => ({ index: Number(e?.text_index), embedding: e?.embedding }))
      .sort((a, b) => a.index - b.index);

    return ordered.map((e: any) => {
      if (!Array.isArray(e?.embedding)) throw new Error('Embedding 响应缺少 embedding（DashScope）');
      return e.embedding as number[];
    });
  }

  if (isSiliconFlowHost(baseUrl) || provider === 'siliconflow-embedding') {
    const texts = prepareSiliconFlowInputs(inputs, model);
    const endpoint = `${baseUrl}/v1/embeddings`;
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += SILICONFLOW_BATCH) {
      const chunk = texts.slice(i, i + SILICONFLOW_BATCH);
      const input = chunk.length === 1 ? chunk[0] : chunk;
      vectors.push(...await requestSiliconFlowEmbeddings(endpoint, apiKey, model, input));
    }
    return vectors;
  }

  if (provider === 'openai' || provider === 'deepseek' || provider === 'custom') {
    const resp = await axios.post(
      `${baseUrl}/v1/embeddings`,
      {
        model,
        input: inputs,
        encoding_format: 'float',
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: EMBEDDING_TIMEOUT_MS,
      },
    );

    const data = resp.data?.data;
    if (!Array.isArray(data) || data.length !== inputs.length) {
      throw new Error('Embedding 响应格式异常');
    }

    return data.map((d: any) => {
      const embedding = d?.embedding;
      if (!Array.isArray(embedding)) throw new Error('Embedding 响应缺少 embedding');
      return embedding as number[];
    });
  }

  throw new Error(`当前 provider 不支持 Embedding：${provider}`);
}

/** 用一条短文本打 Embedding 接口，成功时返回向量维度。 */
export async function testEmbeddingConnection(config: EmbeddingRequestConfig): Promise<number> {
  try {
    const [vec] = await createEmbeddings(config, ['连通测试']);
    if (!Array.isArray(vec) || vec.length === 0) throw new Error('Embedding 响应为空');
    return vec.length;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        const data = error.response.data;
        const body = typeof data === 'string' ? data : JSON.stringify(data);
        const code = typeof data === 'object' && data ? (data as { code?: number | string }).code : undefined;
        const hint = String(code ?? '') === '20015'
          ? '。硅基流动把超长文本、BAAI 模型上的 dimensions，以及对话字段都报成这个错误'
          : '';
        throw new Error(`API错误 ${error.response.status}: ${body}${hint}`);
      }
      if (error.code === 'ECONNABORTED') throw new Error('请求超时');
      throw new Error('网络错误：无法连接到 API 服务器');
    }
    throw error;
  }
}
