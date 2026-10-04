import { defineStore } from 'pinia';
import { ref, shallowRef, computed, type Component } from 'vue';
import { sanitizeAITextForDisplay, extractTextFromJsonResponse } from '@/utils/textSanitizer';
import { isBackendConfigured, fetchBackendVersion } from '@/services/backendConfig';

interface RetryDialogConfig {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string; // 可选：自定义确认按钮文本
  cancelText?: string;  // 可选：自定义取消按钮文本
  neutralText?: string; // 可选：新增第三个中立按钮的文本
  onNeutral?: () => void; // 可选：新增第三个中立按钮的回调
}

interface DetailModalConfig {
  title: string;
  content?: string; // Keep for backward compatibility
  component?: Component;
  props?: Record<string, any>;
  className?: string;
}

// 分阶段加载（开局生成等长流程的可视化进度）
export type LoadingStageStatus = 'pending' | 'active' | 'done' | 'error';

export interface LoadingStageDef {
  key: string;
  label: string;
  /** 这一步在做什么（副标题） */
  hint?: string;
  /** 玉璧中显示的书法单字 */
  glyph?: string;
  /** 进行到这一步时是否还允许取消（默认允许；写入存档之后应设为 false） */
  cancelable?: boolean;
}

export interface LoadingStage extends LoadingStageDef {
  status: LoadingStageStatus;
  /** 实时细节：如「第 1 步 · 撰写正文」「第 2 次重试」 */
  detail?: string;
  startedAt?: number;
  endedAt?: number;
}

/** 实时预览的内容类型：world=世界 JSON（抽取地名），story=剧情正文，commands=剧情指令 JSON */
export type LoadingStreamKind = 'world' | 'story' | 'commands';

export interface WorldGenTargets {
  continents: number;
  factions: number;
  locations: number;
}

// Toast 类型定义
interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export const useUIStore = defineStore('ui', () => {
  // --- Toast (消息提示) ---
  const showToastState = ref(false);
  const toastMessage = ref('');
  const toastOptions = ref<ToastOptions>({});

  const isLoading = ref(false);
  const loadingText = ref('');

  // --- 分阶段加载 ---
  const loadingTitle = ref('');
  const loadingSubtitle = ref('');
  const loadingStages = ref<LoadingStage[]>([]);
  const loadingStartedAt = ref(0);
  const loadingStream = shallowRef('');
  const loadingStreamKind = ref<LoadingStreamKind | null>(null);
  const worldGenTargets = ref<WorldGenTargets | null>(null);
  const loadingCancelHandler = shallowRef<(() => void) | null>(null);
  const loadingCancelling = ref(false);
  const isStagedLoading = computed(() => isLoading.value && loadingStages.value.length > 0);
  /** 流式预览只保留最近这么多字，避免超长响应拖慢界面 */
  const LOADING_STREAM_LIMIT = 60000;
  const isAIProcessing = ref(false); // AI处理状态（持久化，切换面板时不丢失）

  // 🔥 流式响应状态（全局持久化，切换页面不丢失）
  const streamingContent = ref('');
  const rawStreamingContent = ref('');
  const currentGenerationId = ref<string | null>(null);
  const streamingTimestamp = ref<number | null>(null);

  // 🔥 思维链状态（DeepSeek Reasoner 等模型的推理过程）
  const thinkingContent = ref('');  // 思维链内容
  const isThinkingPhase = ref(false);  // 是否在思维链阶段
  const thinkingExpanded = ref(false);  // 思维链是否展开显示

  const showRetryDialogState = ref(false);
  const retryDialogConfig = ref<RetryDialogConfig | null>(null);
  const wasLoadingBeforeDialog = ref(false); // 记录显示弹窗前的loading状态
  const showCharacterManagement = ref(false);

  // --- 新增：通用详情弹窗状态 ---
  const showDetailModalState = ref(false);
  const detailModalTitle = ref('');
  const detailModalContent = ref('');
  const detailModalComponent = shallowRef<Component | null>(null);
  const detailModalProps = ref<Record<string, any> | null>(null);
  const detailModalClass = ref('');

  // --- 新增：数据验证错误弹窗状态 ---
  const showDataValidationError = ref(false);
  const dataValidationErrorMessages = ref<string[]>([]);
  const onDataValidationConfirm = ref<(() => void) | null>(null);
  const dataValidationContext = ref<'creation' | 'loading'>('creation'); // 'creation' 或 'loading'

  // --- 新增：状态变更日志查看器状态 ---
  const showStateChangeViewer = ref(false);
  const stateChangeLogToShow = ref<any | null>(null); // 存储要显示的日志

  // 当前消息的状态变更日志（仅内存存储，不持久化到本地）
  // 每次新消息来时会被清空覆盖
  const currentMessageStateChanges = ref<any | null>(null);

  // 用户输入框内容持久化
  const userInputText = ref('');

  // 最近一次“实际发送给AI”的用户输入（仅用于UI展示/排查“我说的话不生效”类反馈；不写入存档/记忆）
  const lastSentUserIntentText = ref('');
  const lastSentUserIntentSource = ref<'manual' | 'action_option' | 'mixed' | 'unknown'>('unknown');

  // 🔥 [NPC自动生成设置] 控制AI是否在人物数量不足时自动生成NPC
  const autoGenerateNpc = ref(true); // 默认开启
  const minNpcCount = ref(3); // 最少NPC数量

  // 🔥 [行动选项设置] 控制AI是否生成行动选项
  const enableActionOptions = ref(localStorage.getItem('enableActionOptions') !== 'false'); // 默认开启
  const actionOptionsPrompt = ref(localStorage.getItem('actionOptionsPrompt') || ''); // 自定义行动选项提示词

  // 🛡️ [指令/存档保护强度] 控制 AI 指令校验与保护力度
  // - strict: 严格校验 + 保护（更安全）
  // - skeleton: 仅保护存档骨干结构/记忆/系统自动字段（更自由，但更容易生成脏数据）
  const commandProtectionMode = ref<'strict' | 'skeleton'>(
    (localStorage.getItem('commandProtectionMode') as 'strict' | 'skeleton') || 'strict'
  );

  // 🔥 [流式传输设置] 控制是否启用流式传输（全局持久化）
  const useStreaming = ref(localStorage.getItem('useStreaming') !== 'false'); // 默认开启

  // 🔥 [后端状态管理] 统一管理后端连接状态
  const backendStatus = ref({
    configured: isBackendConfigured(),
    connected: false,
    lastChecked: 0
  });

  // 检查后端连接状态
  const checkBackendConnection = async (): Promise<boolean> => {
    if (!backendStatus.value.configured) {
      backendStatus.value.connected = false;
      return false;
    }

    try {
      const version = await fetchBackendVersion();
      backendStatus.value.connected = !!version;
      backendStatus.value.lastChecked = Date.now();
      return backendStatus.value.connected;
    } catch {
      backendStatus.value.connected = false;
      return false;
    }
  };

  // 计算属性：后端是否可用（已配置且已连接）
  const isBackendAvailable = computed(() =>
    backendStatus.value.configured && backendStatus.value.connected
  );

  // 计算属性：后端是否已配置（不检查连接状态）
  const isBackendConfiguredComputed = computed(() => backendStatus.value.configured);

  function openCharacterManagement() {
    showCharacterManagement.value = true;
  }

  function closeCharacterManagement() {
    showCharacterManagement.value = false;
  }

  function resetStagedLoading() {
    loadingTitle.value = '';
    loadingSubtitle.value = '';
    loadingStages.value = [];
    loadingStartedAt.value = 0;
    loadingStream.value = '';
    loadingStreamKind.value = null;
    worldGenTargets.value = null;
    loadingCancelHandler.value = null;
    loadingCancelling.value = false;
  }

  function startLoading(text = '正在加载...') {
    resetStagedLoading();
    isLoading.value = true;
    loadingText.value = text;
  }

  function stopLoading() {
    isLoading.value = false;
    loadingText.value = '';
    resetStagedLoading();
  }

  /** 开启分阶段加载：遮罩显示步骤列表、进度条与实时预览 */
  function startStagedLoading(options: { title: string; subtitle?: string; stages: LoadingStageDef[]; onCancel?: () => void }) {
    resetStagedLoading();
    loadingCancelHandler.value = options.onCancel ?? null;
    loadingTitle.value = options.title;
    loadingSubtitle.value = options.subtitle ?? '';
    loadingStages.value = options.stages.map((stage) => ({ ...stage, status: 'pending' as const }));
    loadingStartedAt.value = Date.now();
    loadingText.value = options.title;
    isLoading.value = true;
  }

  /** 把所有步骤重置为未开始（整体重试时用），计时重新开始 */
  function restartLoadingStages() {
    loadingStages.value = loadingStages.value.map(({ key, label, hint, glyph, cancelable }) => ({ key, label, hint, glyph, cancelable, status: 'pending' as const }));
    loadingCancelling.value = false;
    loadingStartedAt.value = Date.now();
    loadingStream.value = '';
    loadingStreamKind.value = null;
  }

  /**
   * 进入某一步：之前进行中的步骤记为完成，之前未开始的跳过步骤也记为完成。
   * 非分阶段加载时退化为更新文字。
   */
  function enterLoadingStage(key: string, detail?: string) {
    const index = loadingStages.value.findIndex((stage) => stage.key === key);
    if (index === -1) {
      const text = detail ? `${key}：${detail}` : key;
      updateLoadingText(text);
      return;
    }
    const now = Date.now();
    loadingStages.value = loadingStages.value.map((stage, i) => {
      if (i < index && stage.status !== 'done') {
        return { ...stage, status: 'done', endedAt: now, startedAt: stage.startedAt ?? now };
      }
      if (i === index) {
        return { ...stage, status: 'active', detail, startedAt: now, endedAt: undefined };
      }
      // 回退（如整体重试）时，后面已开始的步骤恢复为未开始
      if (i > index && stage.status !== 'pending') {
        return { ...stage, status: 'pending', detail: undefined, startedAt: undefined, endedAt: undefined };
      }
      return stage;
    });
    loadingText.value = loadingStages.value[index].label;
  }

  /** 更新当前（或指定）步骤的实时细节 */
  function setLoadingStageDetail(detail: string, key?: string) {
    const target = key ?? loadingStages.value.find((stage) => stage.status === 'active')?.key;
    if (!target) {
      updateLoadingText(detail);
      return;
    }
    loadingStages.value = loadingStages.value.map((stage) => (stage.key === target ? { ...stage, detail } : stage));
  }

  /** 所有步骤完成 */
  function completeLoadingStages() {
    const now = Date.now();
    loadingStages.value = loadingStages.value.map((stage) =>
      stage.status === 'done' ? stage : { ...stage, status: 'done', startedAt: stage.startedAt ?? now, endedAt: now },
    );
  }

  /** 追加流式内容，供遮罩实时预览 */
  function appendLoadingStream(chunk: string, kind: LoadingStreamKind) {
    if (!isLoading.value || !chunk) return;
    if (loadingStreamKind.value !== kind) {
      loadingStreamKind.value = kind;
      loadingStream.value = '';
    }
    const next = loadingStream.value + chunk;
    loadingStream.value = next.length > LOADING_STREAM_LIMIT ? next.slice(-LOADING_STREAM_LIMIT) : next;
  }

  function resetLoadingStream() {
    loadingStream.value = '';
  }

  /** 切换预览类型并清空内容（内容尚未到达时，遮罩先显示该类型的等待态） */
  function setLoadingStreamKind(kind: LoadingStreamKind) {
    loadingStreamKind.value = kind;
    loadingStream.value = '';
  }

  /** 当前是否可以取消（有取消回调，且当前步骤允许） */
  const canCancelLoading = computed(() => {
    if (!isStagedLoading.value || !loadingCancelHandler.value) return false;
    const active = loadingStages.value.find((stage) => stage.status === 'active');
    return active ? active.cancelable !== false : true;
  });

  function cancelStagedLoading() {
    if (!canCancelLoading.value || loadingCancelling.value) return;
    loadingCancelling.value = true;
    setLoadingStageDetail('正在取消…');
    loadingCancelHandler.value?.();
  }

  function setWorldGenTargets(targets: WorldGenTargets | null) {
    worldGenTargets.value = targets;
  }

  function setAIProcessing(value: boolean) {
    isAIProcessing.value = value;
    // 同步持久化到sessionStorage
    if (value) {
      sessionStorage.setItem('ai-processing-state', 'true');
      sessionStorage.setItem('ai-processing-timestamp', Date.now().toString());
    } else {
      sessionStorage.removeItem('ai-processing-state');
      sessionStorage.removeItem('ai-processing-timestamp');
    }
  }

  // 🔥 流式响应状态管理
  function setStreamingContent(content: string) {
    rawStreamingContent.value = content;
    // 🔥 流式过程中也尝试解析 JSON 提取 text 字段
    const extracted = extractTextFromJsonResponse(content);
    streamingContent.value = extracted || sanitizeAITextForDisplay(content);
  }

  function appendStreamingContent(chunk: string) {
    rawStreamingContent.value += chunk;
    // 🔥 流式过程中也尝试解析 JSON 提取 text 字段
    const extracted = extractTextFromJsonResponse(rawStreamingContent.value);
    streamingContent.value = extracted || sanitizeAITextForDisplay(rawStreamingContent.value);
  }

  function clearStreamingContent() {
    streamingContent.value = '';
    rawStreamingContent.value = '';
  }

  function setCurrentGenerationId(id: string | null) {
    currentGenerationId.value = id;
  }

  function startStreaming(generationId: string) {
    currentGenerationId.value = generationId;
    streamingContent.value = '';
    rawStreamingContent.value = '';
    streamingTimestamp.value = Date.now();
    isAIProcessing.value = true;
  }

  function stopStreaming() {
    // 🔥 流式结束时，从 JSON 中提取 text 字段用于最终显示
    if (rawStreamingContent.value) {
      streamingContent.value = extractTextFromJsonResponse(rawStreamingContent.value);
    }
    currentGenerationId.value = null;
    streamingTimestamp.value = null;
    isAIProcessing.value = false;
  }

  function resetStreamingState() {
    streamingContent.value = '';
    rawStreamingContent.value = '';
    currentGenerationId.value = null;
    streamingTimestamp.value = null;
    isAIProcessing.value = false;
    // 重置思维链状态
    thinkingContent.value = '';
    isThinkingPhase.value = false;
    sessionStorage.removeItem('ai-processing-state');
    sessionStorage.removeItem('ai-processing-timestamp');
  }

  // 🔥 思维链状态管理
  function appendThinkingContent(chunk: string) {
    thinkingContent.value += chunk;
    isThinkingPhase.value = true;
    // 有内容时自动展开，方便用户实时查看
    if (chunk && !thinkingExpanded.value) {
      thinkingExpanded.value = true;
    }
  }

  function endThinkingPhase() {
    isThinkingPhase.value = false;
    // 思维链结束后保持展开状态，让用户可以继续查看
    // 不再自动收起
  }

  function clearThinkingContent() {
    thinkingContent.value = '';
    isThinkingPhase.value = false;
  }

  function toggleThinkingExpanded() {
    thinkingExpanded.value = !thinkingExpanded.value;
  }

  function updateLoadingText(text: string) {
    if (isLoading.value) {
      loadingText.value = text;
    }
  }

  function showRetryDialog(config: RetryDialogConfig) {
    // 记录当前的loading状态并暂停loading，确保弹窗显示在最上层
    wasLoadingBeforeDialog.value = isLoading.value;
    if (isLoading.value) {
      isLoading.value = false;
    }
    
    retryDialogConfig.value = config;
    showRetryDialogState.value = true;
  }

  function hideRetryDialog() {
    showRetryDialogState.value = false;
    retryDialogConfig.value = null;
    
    // 恢复之前的loading状态
    if (wasLoadingBeforeDialog.value) {
      isLoading.value = true;
      wasLoadingBeforeDialog.value = false;
    }
  }

  function confirmRetry() {
    if (retryDialogConfig.value) {
      retryDialogConfig.value.onConfirm();
      hideRetryDialog();
    }
  }

  function cancelRetry() {
    if (retryDialogConfig.value) {
      retryDialogConfig.value.onCancel();
      hideRetryDialog();
    }
  }

  function neutralAction() {
    if (retryDialogConfig.value && retryDialogConfig.value.onNeutral) {
      retryDialogConfig.value.onNeutral();
      hideRetryDialog();
    }
  }

  // --- 新增：数据验证错误弹窗方法 ---
  function showDataValidationErrorDialog(messages: string[], onConfirm: () => void, context: 'creation' | 'loading' = 'creation') {
    dataValidationErrorMessages.value = messages;
    onDataValidationConfirm.value = onConfirm;
    dataValidationContext.value = context; // 设置上下文
    showDataValidationError.value = true;
  }

  function hideDataValidationErrorDialog() {
    showDataValidationError.value = false;
    dataValidationErrorMessages.value = [];
    onDataValidationConfirm.value = null;
  }

  function confirmDataValidationError() {
    if (onDataValidationConfirm.value) {
      onDataValidationConfirm.value();
    }
    hideDataValidationErrorDialog();
  }

  // --- 新增：状态变更日志查看器方法 ---
  function openStateChangeViewer(log: any) {
    stateChangeLogToShow.value = log;
    showStateChangeViewer.value = true;
  }

  function closeStateChangeViewer() {
    showStateChangeViewer.value = false;
    stateChangeLogToShow.value = null;
  }

  // 设置当前消息的状态变更（会覆盖之前的）
  function setCurrentMessageStateChanges(log: any) {
    currentMessageStateChanges.value = log ? { ...log, _ts: Date.now() } : null;
  }

  // 清空当前消息的状态变更
  function clearCurrentMessageStateChanges() {
    currentMessageStateChanges.value = null;
  }

  // --- 新增：通用详情弹窗方法 ---
  function showDetailModal(config: DetailModalConfig) {
    detailModalTitle.value = config.title;
    detailModalContent.value = config.content || '';
    detailModalComponent.value = config.component || null;
    detailModalProps.value = config.props || null;
    detailModalClass.value = config.className || '';
    showDetailModalState.value = true;
  }

  function hideDetailModal() {
    showDetailModalState.value = false;
    // Optional: Reset content after hiding to prevent flash of old content
    setTimeout(() => {
      detailModalTitle.value = '';
      detailModalContent.value = '';
      detailModalComponent.value = null;
      detailModalProps.value = null;
      detailModalClass.value = '';
    }, 300); // Match transition duration
  }

  // --- 新增：Toast (消息提示) 方法 ---
  function showToast(message: string, options: ToastOptions = {}) {
    toastMessage.value = message;
    toastOptions.value = {
      type: options.type || 'info',
      duration: options.duration || 3000,
    };
    showToastState.value = true;
  }

  function hideToast() {
    showToastState.value = false;
  }

	  return {
    // Toast
    showToastState,
    toastMessage,
    toastOptions,
    showToast,
    hideToast,

    isLoading,
    loadingText,
    isAIProcessing, // 暴露AI处理状态

    // 🔥 流式响应状态
    streamingContent,
    currentGenerationId,
    streamingTimestamp,
    setStreamingContent,
    appendStreamingContent,
    clearStreamingContent,
    setCurrentGenerationId,
    startStreaming,
    stopStreaming,
    resetStreamingState,

    // 🔥 思维链状态
    thinkingContent,
    isThinkingPhase,
    thinkingExpanded,
    appendThinkingContent,
    endThinkingPhase,
    clearThinkingContent,
    toggleThinkingExpanded,

    showRetryDialogState,
    retryDialogConfig,
    startLoading,
    stopLoading,
    loadingTitle,
    loadingSubtitle,
    loadingStages,
    loadingStartedAt,
    loadingStream,
    loadingStreamKind,
    worldGenTargets,
    isStagedLoading,
    startStagedLoading,
    restartLoadingStages,
    enterLoadingStage,
    setLoadingStageDetail,
    completeLoadingStages,
    appendLoadingStream,
    resetLoadingStream,
    setLoadingStreamKind,
    loadingCancelling,
    canCancelLoading,
    cancelStagedLoading,
    setWorldGenTargets,
    setAIProcessing, // 暴露设置AI处理状态的方法
    updateLoadingText,
    showRetryDialog,
    hideRetryDialog,
    confirmRetry,
    cancelRetry,
    neutralAction, // 暴露中立按钮动作
    showCharacterManagement,
    openCharacterManagement,
    closeCharacterManagement,

    // 暴露数据验证相关状态和方法
    showDataValidationError,
    dataValidationErrorMessages,
    dataValidationContext, // 暴露上下文
    showDataValidationErrorDialog,
    hideDataValidationErrorDialog,
    confirmDataValidationError,

    // 暴露状态变更日志查看器相关状态和方法
    showStateChangeViewer,
    stateChangeLogToShow,
    currentMessageStateChanges, // 当前消息的状态变更（内存）
    openStateChangeViewer,
    closeStateChangeViewer,
    setCurrentMessageStateChanges, // 设置当前消息的状态变更
    clearCurrentMessageStateChanges, // 清空当前消息的状态变更

    // 🔥 [NPC自动生成设置] 暴露NPC自动生成相关状态
    autoGenerateNpc,
    minNpcCount,

    // 🔥 [行动选项设置] 暴露行动选项开关
    enableActionOptions: computed({
      get: () => enableActionOptions.value,
      set: (val) => {
        enableActionOptions.value = val;
        localStorage.setItem('enableActionOptions', String(val));
      }
    }),
    actionOptionsPrompt: computed({
      get: () => actionOptionsPrompt.value,
      set: (val) => {
        actionOptionsPrompt.value = val;
        localStorage.setItem('actionOptionsPrompt', val);
      }
    }),

    commandProtectionMode: computed({
      get: () => commandProtectionMode.value,
      set: (val) => {
        const normalized = val === 'skeleton' ? 'skeleton' : 'strict';
        commandProtectionMode.value = normalized;
        localStorage.setItem('commandProtectionMode', normalized);
      }
    }),

    // 🔥 [流式传输设置] 暴露流式传输开关（全局持久化）
    useStreaming: computed({
      get: () => useStreaming.value,
      set: (val) => {
        useStreaming.value = val;
        localStorage.setItem('useStreaming', String(val));
      }
    }),

	    // 暴露用户输入框内容
	    userInputText,
	    lastSentUserIntentText,
	    lastSentUserIntentSource,

    // 🔥 [后端状态管理] 暴露后端状态相关
    backendStatus,
    checkBackendConnection,
    isBackendAvailable,
    isBackendConfiguredComputed,

    // 暴露通用详情弹窗相关
    showDetailModalState,
    detailModalTitle,
    detailModalContent,
    detailModalComponent,
    detailModalProps,
    detailModalClass,
    showDetailModal,
    hideDetailModal,
  };
});
