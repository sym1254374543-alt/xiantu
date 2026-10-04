/**
 * 公益 API：钱包与签到、模型状态、一键切换、渠道提交、排行榜。
 * 局外 API 管理、局内 API 页和局内账户页共用一份状态。
 */
import { computed, ref } from 'vue';
import { useAPIManagementStore, type APIConfig, type APIUsageType } from '@/stores/apiManagementStore';
import {
  builtinCheckIn,
  fetchBuiltinStats,
  fetchBuiltinWallet,
  fetchLeaderboard,
  fetchMyChannels,
  submitBuiltinChannel,
  withdrawMyChannel,
  BuiltinApiError,
  type BuiltinStats,
  type BuiltinWallet,
  type ChannelDraft,
  type CheckinResult,
  type Leaderboard,
  type MyChannel,
} from '@/services/builtinApi';
import { isTavernEnv } from '@/utils/tavern';
import { AUX_FUNCTIONS } from '@/data/apiProviders';
import { toast } from '@/utils/toast';

const wallet = ref<BuiltinWallet | null>(null);
const walletError = ref('');
const stats = ref<Record<string, BuiltinStats>>({});
const statsLoadedAt = ref(0);
const loading = ref(false);
const checkingIn = ref(false);
const lastCheckin = ref<CheckinResult | null>(null);
const boards = ref<Partial<Record<'contribution' | 'balance', Leaderboard>>>({});
const myChannels = ref<MyChannel[]>([]);
const loggedIn = ref(!!localStorage.getItem('access_token'));

const errorText = (e: unknown) => (e instanceof Error ? e.message : '未知错误');

export interface TurnCostPart {
  key: string;
  label: string;
  api: APIConfig | null;
  cost: number;
}

export function usePublicApi() {
  const store = useAPIManagementStore();
  const inTavern = isTavernEnv();

  const models = computed(() => store.apiConfigs.filter((api) => api.builtin));
  const ownChatApis = computed(() => store.apiConfigs.filter((api) => !api.builtin));
  const balance = computed(() => wallet.value?.balance ?? store.builtinBalance);

  /** 主流程当前用的 API。酒馆里主流程固定走酒馆，一键切换改的是辅助功能。 */
  const activeId = computed(() => {
    if (!inTavern) return store.mainApiId;
    return store.apiAssignments.find((a) => a.type === 'memory_summary')?.apiId ?? 'default';
  });
  const usingPublic = computed(() => models.value.some((api) => api.id === activeId.value));
  const activeApi = computed(() => store.apiConfigs.find((api) => api.id === activeId.value) || null);

  const refreshWallet = async () => {
    loggedIn.value = !!localStorage.getItem('access_token');
    if (!loggedIn.value) {
      wallet.value = null;
      store.setBuiltinBalance(null);
      return;
    }
    try {
      wallet.value = await fetchBuiltinWallet();
      walletError.value = '';
      store.setBuiltinBalance(wallet.value.balance);
    } catch (e) {
      walletError.value = errorText(e);
      if (e instanceof BuiltinApiError && e.status === 401) loggedIn.value = false;
    }
  };

  const refreshStats = async (force = false) => {
    if (!force && Date.now() - statsLoadedAt.value < 30_000) return;
    try {
      const list = await fetchBuiltinStats();
      stats.value = Object.fromEntries(list.map((item) => [item.id, item]));
      statsLoadedAt.value = Date.now();
    } catch {
      /* 统计拉不到时卡片显示「暂无数据」 */
    }
  };

  const refresh = async () => {
    loading.value = true;
    try {
      await Promise.all([store.syncBuiltinApi(), refreshWallet(), refreshStats()]);
    } finally {
      loading.value = false;
    }
  };

  const checkIn = async () => {
    if (checkingIn.value) return null;
    checkingIn.value = true;
    try {
      const res = await builtinCheckIn();
      wallet.value = res.wallet;
      lastCheckin.value = res.result;
      store.setBuiltinBalance(res.wallet.balance);
      return res.result;
    } catch (e) {
      toast.error(errorText(e));
      if (e instanceof BuiltinApiError && e.status === 409) await refreshWallet();
      return null;
    } finally {
      checkingIn.value = false;
    }
  };

  /** 功能实际走哪个 API：选了「沿用主流程」或所选 API 停用时跟随主流程，和 aiService 的路由一致 */
  const resolveApi = (type: APIUsageType): APIConfig | null => {
    const id = store.apiAssignments.find((a) => a.type === type)?.apiId ?? 'default';
    const api = store.apiConfigs.find((a) => a.id === id && a.enabled) || null;
    if (type !== 'main' && (!api || api.id === 'default')) return resolveApi('main');
    return api || store.apiConfigs.find((a) => a.id === 'default') || null;
  };
  const costOf = (api: APIConfig | null) => (api?.builtin ? api.cost ?? 1 : 0);

  /** 每回合固定会发生的调用及其公益额度。记忆总结按需触发，不算在内。 */
  const turnCost = (split: boolean) => {
    const parts: TurnCostPart[] = [];
    const push = (key: string, label: string, type: APIUsageType) => {
      const api = resolveApi(type);
      parts.push({ key, label, api, cost: costOf(api) });
    };
    push('main', split ? '正文与选项' : '正文、选项与指令', 'main');
    if (split) push('instruction_generation', '游戏指令', 'instruction_generation');
    if (store.isFunctionEnabled('text_optimization')) push('text_optimization', '文本润色', 'text_optimization');
    const total = Math.round(parts.reduce((sum, part) => sum + part.cost, 0) * 10000) / 10000;
    const bal = balance.value;
    const turnsLeft = total > 0 && typeof bal === 'number' ? Math.floor(bal / total) : null;
    return { parts, total, turnsLeft, memoryCost: costOf(resolveApi('memory_summary')) };
  };

  /** 下拉框直接切换主流程：公益模型走 switchMainToBuiltin，会记住切换前自己的 API */
  const selectMain = (apiId: string) => {
    const api = store.apiConfigs.find((a) => a.id === apiId);
    if (!api) return;
    if (api.builtin) return useModel(api);
    if (inTavern) {
      for (const type of AUX_FUNCTIONS) store.assignAPI(type, api.id);
      toast.success(`辅助功能已切到「${api.name}」`);
      return;
    }
    store.assignAPI('main', api.id);
    toast.success(`主流程已切到「${api.name}」`);
  };

  const statsOf = (api: APIConfig) => stats.value[api.builtinServerId || ''] || null;

  const useModel = (api: APIConfig) => {
    try {
      if (inTavern) {
        for (const type of AUX_FUNCTIONS) store.assignAPI(type, api.id);
        toast.success(`辅助功能已切到「${api.name}」，主流程仍走酒馆`);
      } else {
        store.switchMainToBuiltin(api.id);
        toast.success(`主流程已切到「${api.name}」${loggedIn.value ? '' : '，调用前需要先登录云端账号'}`);
      }
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const useOwn = () => {
    if (inTavern) {
      for (const type of AUX_FUNCTIONS) store.assignAPI(type, 'default');
      toast.success('辅助功能已切回酒馆');
      return;
    }
    const id = store.switchMainToOwn();
    const api = store.apiConfigs.find((a) => a.id === id);
    toast.success(`主流程已切回「${api?.name || '默认 API'}」`);
  };

  /** 一键切换：自己的 API 与公益 API 之间来回切。公益那头优先选成功率高的模型。 */
  const toggle = () => {
    if (usingPublic.value) return useOwn();
    const ranked = [...models.value].sort((a, b) => {
      const ra = statsOf(a)?.success_rate ?? 0.5;
      const rb = statsOf(b)?.success_rate ?? 0.5;
      return rb - ra;
    });
    if (!ranked.length) {
      toast.warning('当前没有开放的公益模型');
      return;
    }
    useModel(ranked[0]);
  };

  const loadBoard = async (kind: 'contribution' | 'balance') => {
    try {
      boards.value = { ...boards.value, [kind]: await fetchLeaderboard(kind) };
    } catch (e) {
      toast.error(`排行榜读取失败：${errorText(e)}`);
    }
  };

  const loadMyChannels = async () => {
    if (!localStorage.getItem('access_token')) {
      myChannels.value = [];
      return;
    }
    try {
      myChannels.value = await fetchMyChannels();
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const submitChannel = async (draft: ChannelDraft) => {
    const res = await submitBuiltinChannel(draft);
    toast.success(res.message);
    await loadMyChannels();
  };

  const withdrawChannel = async (id: number) => {
    try {
      await withdrawMyChannel(id);
      toast.success('已撤回');
      await loadMyChannels();
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return {
    store, inTavern, wallet, walletError, stats, loading, checkingIn, lastCheckin, boards, myChannels, loggedIn,
    models, ownChatApis, balance, activeId, activeApi, usingPublic,
    refresh, refreshWallet, refreshStats, checkIn, statsOf, useModel, useOwn, toggle, resolveApi, costOf, turnCost, selectMain, loadBoard, loadMyChannels, submitChannel, withdrawChannel,
  };
}
