<template>
  <transition name="fade">
    <div v-if="uiStore.isLoading" class="loading-overlay">
      <!-- 分阶段加载：开局生成等长流程 -->
      <div v-if="uiStore.isStagedLoading" class="stage-card" role="dialog" aria-modal="true" :aria-label="uiStore.loadingTitle">
        <span class="frame-corner tl" aria-hidden="true"></span>
        <span class="frame-corner tr" aria-hidden="true"></span>
        <span class="frame-corner bl" aria-hidden="true"></span>
        <span class="frame-corner br" aria-hidden="true"></span>

        <header class="stage-header">
          <div class="emblem" aria-hidden="true">
            <span :key="currentStage?.glyph" class="emblem-glyph">{{ currentStage?.glyph || '道' }}</span>
          </div>
          <div class="title-block">
            <h2 class="stage-title">{{ uiStore.loadingTitle }}</h2>
            <p v-if="uiStore.loadingSubtitle" class="stage-subtitle">{{ uiStore.loadingSubtitle }}</p>
          </div>
          <div class="elapsed" :title="`已用时 ${formatClock(elapsedMs)}`">
            <Timer :size="14" />
            <span>{{ formatClock(elapsedMs) }}</span>
          </div>
        </header>

        <div
          class="progress"
          role="progressbar"
          :aria-valuemin="0"
          :aria-valuemax="stages.length"
          :aria-valuenow="doneCount"
          :aria-valuetext="currentStage ? `${currentStage.label}（${doneCount}/${stages.length}）` : undefined"
        >
          <span
            v-for="stage in stages"
            :key="stage.key"
            class="progress-seg"
            :class="stage.status"
          >
            <span
              v-if="stage.status === 'active'"
              class="progress-fill"
              :class="{ indeterminate: activeFill === null }"
              :style="activeFill !== null ? { width: `${Math.round(activeFill * 100)}%` } : undefined"
            ></span>
          </span>
        </div>

        <div class="stage-body">
          <ol class="stage-list">
            <li v-for="(stage, index) in stages" :key="stage.key" class="stage-item" :class="stage.status">
              <span class="stage-marker" aria-hidden="true">
                <Check v-if="stage.status === 'done'" :size="13" />
                <X v-else-if="stage.status === 'error'" :size="13" />
                <span v-else-if="stage.status === 'active'" class="marker-ring"></span>
                <span v-else class="marker-index">{{ index + 1 }}</span>
              </span>
              <div class="stage-text">
                <div class="stage-row">
                  <span class="stage-label">{{ stage.label }}</span>
                  <span v-if="stage.status === 'done' && stage.startedAt && stage.endedAt" class="stage-time">
                    {{ formatDuration(stage.endedAt - stage.startedAt) }}
                  </span>
                  <span v-else-if="stage.status === 'active' && stage.startedAt" class="stage-time live">
                    {{ formatDuration(now - stage.startedAt) }}
                  </span>
                </div>
                <p
                  v-if="stage.detail || (stage.status === 'active' && stage.hint)"
                  class="stage-detail"
                  :aria-live="stage.status === 'active' ? 'polite' : undefined"
                >
                  {{ stage.detail || stage.hint }}
                </p>
                <p v-else-if="stage.hint && stage.status === 'pending'" class="stage-hint">{{ stage.hint }}</p>
              </div>
            </li>
          </ol>

          <section class="preview" aria-label="实时预览">
            <div class="preview-head">
              <span class="preview-title">天机显化</span>
              <span v-if="previewMode === 'commands' && commands.length" class="preview-meta">{{ commands.length }} 条指令</span>
              <span v-else-if="streamLength > 0" class="preview-meta">已接收 {{ streamLength.toLocaleString() }} 字</span>
            </div>

            <!-- 世界：已成形的大陆 / 势力 / 地点 -->
            <div v-if="previewMode === 'world'" class="world-preview">
              <div v-for="group in worldGroups" :key="group.key" class="world-group">
                <div class="world-group-head">
                  <component :is="group.icon" :size="14" />
                  <span>{{ group.label }}</span>
                  <span class="world-count">
                    <strong>{{ group.names.length }}</strong><template v-if="group.target"> / {{ group.target }}</template>
                  </span>
                </div>
                <TransitionGroup v-if="group.names.length" name="chip" tag="div" class="chips">
                  <span v-for="name in group.names" :key="name" class="chip">{{ name }}</span>
                </TransitionGroup>
                <div v-else class="chips-empty">尚未显现…</div>
              </div>
            </div>

            <!-- 剧情指令：第 2 步流式输出 / 落定因果时的完整列表 -->
            <div v-else-if="previewMode === 'commands'" ref="scrollEl" class="command-preview" @scroll="onPreviewScroll">
              <TransitionGroup name="cmd" tag="ol" class="command-list">
                <li v-for="(cmd, index) in commands" :key="`${index}-${cmd.key}`" class="command-row">
                  <span class="cmd-action" :class="cmd.action">{{ actionLabel(cmd.action) }}</span>
                  <span class="cmd-key" :title="cmd.key">{{ cmd.key }}</span>
                  <span v-if="cmd.value" class="cmd-value" :title="cmd.value">{{ cmd.value }}</span>
                </li>
              </TransitionGroup>
              <!-- 第 2 步进行中：占位行 -->
              <div v-if="commandsPending" class="command-pending">
                <div v-for="n in 3" :key="n" class="command-row skeleton" aria-hidden="true">
                  <span class="cmd-action"></span>
                  <span class="skeleton-bar" :style="{ width: `${[46, 62, 38][n - 1]}%` }"></span>
                </div>
                <p class="pending-text">
                  {{ commands.length ? '指令仍在生成…' : streamLength > 0 ? '正在解析指令…' : `AI 正在生成剧情指令 · 已等待 ${waitedSeconds} 秒` }}
                </p>
                <p v-if="!commands.length && streamLength === 0" class="pending-text muted">
                  未开启「第2步流式传输」或模型仍在思考时，指令会在完成后一次性显示
                </p>
              </div>
            </div>

            <!-- 剧情：正文实时滚动 -->
            <div v-else-if="previewMode === 'story'" ref="scrollEl" class="story-preview" @scroll="onPreviewScroll">
              <p class="story-text">{{ storyPreview.text }}<span class="caret" aria-hidden="true"></span></p>
            </div>

            <!-- 无流式内容时 -->
            <div v-else class="cc-placeholder preview-placeholder">
              <div class="placeholder-inner">
                <span>{{ placeholderText }}</span>
                <small v-if="waitingNote" class="placeholder-note">{{ waitingNote }}</small>
              </div>
            </div>
          </section>
        </div>

        <footer class="stage-footer">
          <p class="footer-tip">
            <Info :size="13" />
            <span>AI 生成通常需要 1–3 分钟，请勿刷新或关闭页面</span>
          </p>
          <div v-if="uiStore.loadingCancelling" class="cancel-area">
            <span class="cancelling"><span class="marker-ring"></span>正在取消…</span>
          </div>
          <div v-else-if="uiStore.canCancelLoading" class="cancel-area">
            <template v-if="confirmingCancel">
              <span class="confirm-text">放弃本次生成？</span>
              <button type="button" class="cc-btn small" @click="confirmingCancel = false">继续等待</button>
              <button type="button" class="cc-btn small danger" @click="confirmCancel">确认取消</button>
            </template>
            <button v-else type="button" class="cc-btn small" @click="confirmingCancel = true">
              <CircleStop :size="14" />
              取消生成
            </button>
          </div>
        </footer>
      </div>

      <!-- 普通加载 -->
      <div v-else class="loading-content">
        <div class="spinner" aria-hidden="true"></div>
        <p class="loading-text" role="status" v-html="uiStore.loadingText"></p>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Castle, Check, CircleStop, Info, Map as MapIcon, MapPin, Timer, X } from 'lucide-vue-next';
import { useUIStore } from '@/stores/uiStore';
import { extractCommandPreview, extractStoryPreview, extractWorldEntities } from '@/utils/loadingPreview';

const uiStore = useUIStore();

const stages = computed(() => uiStore.loadingStages);
const currentStage = computed(
  () => stages.value.find((stage) => stage.status === 'active') ?? [...stages.value].reverse().find((stage) => stage.status === 'done'),
);
const doneCount = computed(() => stages.value.filter((stage) => stage.status === 'done').length);

// ---------- 计时 ----------
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;

watch(
  () => uiStore.isStagedLoading,
  (active) => {
    if (active && !timer) {
      now.value = Date.now();
      timer = setInterval(() => {
        now.value = Date.now();
      }, 1000);
    } else if (!active && timer) {
      clearInterval(timer);
      timer = null;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

const elapsedMs = computed(() => (uiStore.loadingStartedAt ? Math.max(0, now.value - uiStore.loadingStartedAt) : 0));

const pad = (n: number) => String(n).padStart(2, '0');
const formatClock = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};
const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 1) return '<1 秒';
  if (total < 60) return `${total} 秒`;
  return `${Math.floor(total / 60)} 分 ${pad(total % 60)} 秒`;
};

// ---------- 实时预览 ----------
const streamLength = computed(() => uiStore.loadingStream.length);

const worldEntities = computed(() =>
  uiStore.loadingStreamKind === 'world' ? extractWorldEntities(uiStore.loadingStream) : null,
);

const worldGroups = computed(() => {
  const entities = worldEntities.value;
  const targets = uiStore.worldGenTargets;
  if (!entities) return [];
  const groups = [
    { key: 'continents', label: '大陆', icon: MapIcon, names: entities.continents, target: targets?.continents ?? 0 },
    { key: 'factions', label: '势力', icon: Castle, names: entities.factions, target: targets?.factions ?? 0 },
    { key: 'locations', label: '地点', icon: MapPin, names: entities.locations, target: targets?.locations ?? 0 },
  ];
  // 「仅生成大陆」时不显示势力 / 地点
  return groups.filter((group) => group.key === 'continents' || group.target > 0 || group.names.length > 0);
});

const storyPreview = computed(() =>
  uiStore.loadingStreamKind === 'story' ? extractStoryPreview(uiStore.loadingStream, 8000) : { text: '', thinking: false },
);

const commands = computed(() => {
  if (uiStore.loadingStreamKind === 'commands') return extractCommandPreview(uiStore.loadingStream);
  // 一次性生成：同一段 JSON 里正文之后就是指令
  if (uiStore.loadingStreamKind === 'story' && uiStore.loadingStream.includes('"tavern_commands"')) {
    return extractCommandPreview(uiStore.loadingStream);
  }
  return [];
});

/** 第 2 步仍在生成：指令列表下方显示占位行 */
const commandsPending = computed(
  () => uiStore.loadingStreamKind === 'commands' && currentStage.value?.key === 'commands' && currentStage.value.status === 'active',
);

const ACTION_LABELS: Record<string, string> = { set: '设置', add: '增减', push: '加入', pull: '移出', delete: '删除' };
const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;

// 预览区跟随最新内容；用户向上翻看时暂停跟随，翻回底部后恢复
const scrollEl = ref<HTMLElement | null>(null);
const followBottom = ref(true);
const onPreviewScroll = () => {
  const el = scrollEl.value;
  if (!el) return;
  followBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
};
const scrollToBottom = async () => {
  await nextTick();
  const el = scrollEl.value;
  if (el && followBottom.value) el.scrollTop = el.scrollHeight;
};
watch(() => storyPreview.value.text.length, scrollToBottom);
watch(() => commands.value.length, (length, previous) => {
  if (commandsPending.value) {
    void scrollToBottom();
  } else if (uiStore.loadingStreamKind === 'story' && previous === 0 && length > 0) {
    // 一次性生成从正文切到指令：从头开始跟随
    followBottom.value = true;
    void scrollToBottom();
  } else if (uiStore.loadingStreamKind === 'story') {
    void scrollToBottom();
  }
});
// 切换预览类型（正文 → 指令）时恢复跟随
watch(
  () => uiStore.loadingStreamKind,
  () => {
    followBottom.value = true;
    void scrollToBottom();
  },
);
// 第 2 步结束、完整指令列表就位后回到顶部，从第一条看起
watch(commandsPending, async (pending, wasPending) => {
  if (pending || !wasPending) return;
  await nextTick();
  if (scrollEl.value) scrollEl.value.scrollTop = 0;
});

// 取消：先确认，避免误触丢掉已等待的进度
const confirmingCancel = ref(false);
const confirmCancel = () => {
  confirmingCancel.value = false;
  uiStore.cancelStagedLoading();
};
watch(() => uiStore.isStagedLoading, (active) => {
  if (!active) confirmingCancel.value = false;
});

const previewMode = computed<'world' | 'story' | 'commands' | null>(() => {
  if (uiStore.loadingStreamKind === 'world' && worldEntities.value) {
    const { continents, factions, locations } = worldEntities.value;
    if (continents.length + factions.length + locations.length > 0) return 'world';
  }
  if (uiStore.loadingStreamKind === 'story' && commands.value.length > 0) return 'commands';
  if (uiStore.loadingStreamKind === 'story' && storyPreview.value.text) return 'story';
  if (uiStore.loadingStreamKind === 'commands' && (commands.value.length > 0 || commandsPending.value)) return 'commands';
  return null;
});

const AI_STAGES = ['world', 'story', 'commands'];
/** 当前是否在等 AI（该步骤还没收到任何可显示的内容） */
const waitingForAI = computed(() => {
  const stage = currentStage.value;
  return stage?.status === 'active' && AI_STAGES.includes(stage.key) && streamLength.value === 0;
});
const waitedSeconds = computed(() => {
  const startedAt = currentStage.value?.startedAt;
  return startedAt ? Math.max(0, Math.floor((now.value - startedAt) / 1000)) : 0;
});

const placeholderText = computed(() => {
  const stage = currentStage.value;
  if (waitingForAI.value) {
    return waitedSeconds.value >= 8 ? `AI 仍在思考 · 已等待 ${waitedSeconds.value} 秒` : '等待 AI 开始输出…';
  }
  if (stage?.status === 'active' && stage.key === 'commands') {
    return '正在生成剧情指令…';
  }
  if (streamLength.value > 0) {
    return storyPreview.value.thinking ? '正在构思剧情…' : '正在推演设定…';
  }
  return stage?.hint ?? '';
});

/** 长时间没有输出时，说明原因，避免误以为卡死 */
const waitingNote = computed(() => {
  if (!waitingForAI.value || waitedSeconds.value < 8) return '';
  return '推理模型会先思考再输出，思考过程不在此显示；若关闭了流式传输，内容会在完成后一次性出现';
});

/** 当前步骤的确定进度（仅世界生成可估算），null 表示不确定 */
const activeFill = computed<number | null>(() => {
  if (currentStage.value?.key !== 'world' || !worldEntities.value || !uiStore.worldGenTargets) return null;
  const { continents, factions, locations } = uiStore.worldGenTargets;
  const total = continents + factions + locations;
  if (total <= 0) return null;
  const found = worldEntities.value.continents.length + worldEntities.value.factions.length + worldEntities.value.locations.length;
  if (found === 0) return null;
  return Math.min(0.95, Math.max(0.08, found / total));
});
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  box-sizing: border-box;
  background: rgba(4, 8, 16, 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: var(--cc-text);
}

:root[data-theme='light'] .loading-overlay {
  background: rgba(50, 38, 18, 0.42);
}

/* ============ 普通加载 ============ */
.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  max-width: min(640px, 100%);
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(var(--cc-gold-rgb), 0.2);
  border-top-color: var(--cc-gold);
  border-radius: 50%;
  animation: spin 1.2s linear infinite;
}

.loading-text {
  margin: 0;
  text-align: center;
  font-size: 1.05rem;
  letter-spacing: 0.1em;
  line-height: 1.7;
  color: #f1e6cc;
  text-shadow: 0 0 12px rgba(var(--cc-gold-rgb), 0.35);
}

/* ============ 分阶段加载 ============ */
.stage-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  width: min(880px, 100%);
  max-height: calc(var(--app-dvh) - 2.5rem);
  padding: 1.6rem 1.9rem 1.2rem;
  box-sizing: border-box;
  background: var(--cc-shell-bg), var(--cc-solid-bg);
  border: 1px solid var(--cc-shell-border);
  border-radius: 6px;
  box-shadow: var(--cc-shell-shadow);
  animation: card-in 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.stage-card::before {
  content: '';
  position: absolute;
  inset: 9px;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.16);
  border-radius: 3px;
  pointer-events: none;
}

.frame-corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 0 solid var(--cc-gold);
  opacity: 0.85;
  pointer-events: none;
}

.frame-corner.tl { top: 5px; left: 5px; border-top-width: 2px; border-left-width: 2px; }
.frame-corner.tr { top: 5px; right: 5px; border-top-width: 2px; border-right-width: 2px; }
.frame-corner.bl { bottom: 5px; left: 5px; border-bottom-width: 2px; border-left-width: 2px; }
.frame-corner.br { bottom: 5px; right: 5px; border-bottom-width: 2px; border-right-width: 2px; }

/* ---------- 头部 ---------- */
.stage-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.emblem {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(var(--cc-accent-rgb), 0.28) 0%, rgba(var(--cc-accent-rgb), 0.05) 75%);
  box-shadow: 0 0 0 1px rgba(var(--cc-gold-rgb), 0.55), 0 0 26px -6px rgba(var(--cc-accent-rgb), 0.65);
  font-family: var(--cc-calligraphy);
  font-size: 1.75rem;
  color: var(--cc-accent);
}

.emblem::before,
.emblem::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.emblem::before {
  inset: -6px;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.5);
  animation: spin 18s linear infinite;
}

.emblem::after {
  inset: -3px;
  border: 2px solid transparent;
  border-top-color: var(--cc-gold);
  animation: spin 2.4s linear infinite;
}

.emblem-glyph {
  animation: glyph-in 0.45s ease;
}

.title-block {
  flex: 1;
  min-width: 0;
}

.stage-title {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 1.85rem;
  font-weight: 400;
  letter-spacing: 0.18em;
  color: var(--cc-text);
}

.stage-subtitle {
  margin: 0.15rem 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  letter-spacing: 0.1em;
  color: var(--cc-gold);
}

.elapsed {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--cc-border);
  border-radius: 999px;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.06em;
  color: var(--cc-text-2);
}

.elapsed svg {
  color: var(--cc-gold);
}

/* ---------- 进度条 ---------- */
.progress {
  display: flex;
  gap: 4px;
}

.progress-seg {
  position: relative;
  flex: 1;
  height: 5px;
  overflow: hidden;
  border-radius: 3px;
  background: rgba(var(--cc-gold-rgb), 0.14);
}

.progress-seg.done {
  background: linear-gradient(90deg, rgba(var(--cc-gold-rgb), 0.75), var(--cc-gold));
}

.progress-seg.error {
  background: var(--cc-danger);
}

.progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(var(--cc-accent-rgb), 0.6), var(--cc-accent));
  box-shadow: 0 0 8px rgba(var(--cc-accent-rgb), 0.6);
  transition: width 0.5s ease;
}

.progress-fill.indeterminate {
  width: 40%;
  animation: sweep 1.6s ease-in-out infinite;
}

/* ---------- 主体 ---------- */
.stage-body {
  display: grid;
  grid-template-columns: minmax(230px, 0.85fr) 1.5fr;
  gap: 1.25rem;
  height: clamp(260px, calc(var(--app-dvh) - 17rem), 420px);
  min-height: 0;
  flex-shrink: 0;
}

.stage-list {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

.stage-item {
  position: relative;
  display: flex;
  gap: 0.75rem;
  padding: 0.45rem 0.5rem 0.75rem 0;
}

/* 步骤之间的竖线 */
.stage-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 30px;
  bottom: -2px;
  width: 1px;
  background: var(--cc-border);
}

.stage-item.done:not(:last-child)::before {
  background: rgba(var(--cc-gold-rgb), 0.55);
}

.stage-marker {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 23px;
  height: 23px;
  flex-shrink: 0;
  border: 1px solid var(--cc-border-strong);
  border-radius: 50%;
  background: var(--cc-solid-bg);
  font-size: 0.72rem;
  color: var(--cc-text-3);
  transition: background 0.3s ease, border-color 0.3s ease, color 0.3s ease;
}

.stage-item.done .stage-marker {
  border-color: var(--cc-seal);
  background: var(--cc-seal);
  color: var(--cc-seal-text);
  animation: seal-in 0.35s ease;
}

.stage-item.error .stage-marker {
  border-color: var(--cc-danger);
  background: var(--cc-danger);
  color: #fff;
}

.stage-item.active .stage-marker {
  border-color: var(--cc-accent);
  box-shadow: 0 0 0 4px rgba(var(--cc-accent-rgb), 0.14), 0 0 14px rgba(var(--cc-accent-rgb), 0.45);
}

.marker-ring {
  width: 11px;
  height: 11px;
  border: 2px solid rgba(var(--cc-accent-rgb), 0.3);
  border-top-color: var(--cc-accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

.stage-text {
  flex: 1;
  min-width: 0;
  padding-top: 0.1rem;
}

.stage-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.stage-label {
  font-size: 0.95rem;
  letter-spacing: 0.14em;
  color: var(--cc-text-3);
  transition: color 0.3s ease;
}

.stage-item.done .stage-label {
  color: var(--cc-text-2);
}

.stage-item.active .stage-label {
  color: var(--cc-text);
  font-weight: 600;
}

.stage-time {
  flex-shrink: 0;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--cc-text-3);
}

.stage-time.live {
  color: var(--cc-accent);
}

.stage-detail,
.stage-hint {
  margin: 0.2rem 0 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--cc-text-3);
}

.stage-item.active .stage-detail {
  color: var(--cc-accent);
}

.stage-item.done .stage-detail {
  color: var(--cc-gold);
}

.stage-item.error .stage-detail {
  color: var(--cc-danger);
}

.stage-hint {
  opacity: 0.7;
}

/* ---------- 预览 ---------- */
.preview {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-inset);
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--cc-divider);
  flex-shrink: 0;
}

.preview-title {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--cc-gold);
}

.preview-meta {
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--cc-text-3);
}

.world-preview {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.85rem 0.9rem;
}

.world-group-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.45rem;
  font-size: 0.8rem;
  letter-spacing: 0.14em;
  color: var(--cc-text-2);
}

.world-group-head svg {
  color: var(--cc-gold);
}

.world-count {
  margin-left: auto;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--cc-text-3);
}

.world-count strong {
  font-weight: 600;
  color: var(--cc-gold);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  padding: 0.18rem 0.6rem;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.35);
  border-radius: 4px;
  background: rgba(var(--cc-gold-rgb), 0.07);
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  color: var(--cc-text);
}

.chips-empty {
  font-size: 0.76rem;
  color: var(--cc-text-3);
  opacity: 0.7;
}

.chip-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease, box-shadow 0.8s ease;
}

.chip-enter-from {
  opacity: 0;
  transform: translateY(4px) scale(0.92);
  box-shadow: 0 0 14px rgba(var(--cc-gold-rgb), 0.6);
}

.story-preview,
.command-preview {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--cc-gold-rgb), 0.35) transparent;
}

.story-preview {
  padding: 0.9rem 1.1rem 1rem;
}

.story-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.92rem;
  line-height: 1.95;
  letter-spacing: 0.03em;
  color: var(--cc-text-2);
}

.caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.12em;
  background: var(--cc-accent);
  animation: blink 1s steps(1) infinite;
}

.command-preview {
  padding: 0.55rem 0.5rem 0.7rem;
}

.command-row.skeleton .cmd-action {
  height: 1.1em;
  border-style: dashed;
}

.skeleton-bar {
  height: 0.7em;
  border-radius: 3px;
  background: linear-gradient(90deg, rgba(var(--cc-gold-rgb), 0.08), rgba(var(--cc-gold-rgb), 0.22), rgba(var(--cc-gold-rgb), 0.08));
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.pending-text.muted {
  margin-top: 0.15rem;
  opacity: 0.75;
}

.pending-text {
  margin: 0.4rem 0.45rem 0;
  font-size: 0.76rem;
  line-height: 1.6;
  color: var(--cc-text-3);
}

.command-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.command-row {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.3rem 0.45rem;
  border-radius: 4px;
  font-size: 0.8rem;
  line-height: 1.5;
}

.command-row:nth-child(odd) {
  background: var(--cc-surface);
}

.cmd-action {
  flex-shrink: 0;
  min-width: 2.6em;
  padding: 0 0.35rem;
  border: 1px solid var(--cc-border-strong);
  border-radius: 3px;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-align: center;
  color: var(--cc-text-2);
}

.cmd-action.set {
  border-color: rgba(var(--cc-accent-rgb), 0.5);
  color: var(--cc-accent);
}

.cmd-action.add,
.cmd-action.push {
  border-color: rgba(var(--cc-gold-rgb), 0.55);
  color: var(--cc-gold);
}

.cmd-action.delete,
.cmd-action.pull {
  border-color: rgba(var(--cc-danger-rgb), 0.5);
  color: var(--cc-danger);
}

.cmd-key {
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.76rem;
  color: var(--cc-text);
}

.cmd-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  color: var(--cc-text-3);
}

.cmd-enter-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.cmd-enter-from {
  opacity: 0;
  transform: translateX(-6px);
}

.placeholder-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  max-width: 340px;
}

.placeholder-note {
  font-size: 0.74rem;
  line-height: 1.7;
  letter-spacing: 0.04em;
  color: var(--cc-text-3);
  opacity: 0.85;
}

.preview-placeholder {
  flex: 1;
  min-height: 0;
  font-size: 0.9rem;
}

/* ---------- 底部 ---------- */
.stage-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
  min-height: 34px;
}

.footer-tip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  color: var(--cc-text-3);
}

.footer-tip svg {
  flex-shrink: 0;
  color: var(--cc-gold);
}

.cancel-area {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.cancel-area svg {
  color: var(--cc-text-3);
}

.confirm-text {
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  color: var(--cc-warning);
}

.cancelling {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  color: var(--cc-text-2);
}

.cc-btn.danger {
  border-color: rgba(var(--cc-danger-rgb), 0.55);
  color: var(--cc-danger);
}

.cc-btn.danger:hover:not(:disabled) {
  background: rgba(var(--cc-danger-rgb), 0.1);
  border-color: var(--cc-danger);
}

.stage-card .cc-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

/* ---------- 动画 ---------- */
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}

@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

@keyframes blink {
  50% { opacity: 0; }
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: none; }
}

@keyframes glyph-in {
  from { opacity: 0; transform: scale(0.6); filter: blur(4px); }
  to { opacity: 1; transform: none; filter: none; }
}

@keyframes seal-in {
  0% { transform: scale(1.5); opacity: 0; }
  60% { transform: scale(0.92); opacity: 1; }
  100% { transform: scale(1); }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .stage-body {
    grid-template-columns: 1fr;
    align-content: start;
    gap: 0.9rem;
    height: auto;
  }

  .stage-list {
    overflow: visible;
  }

  .stage-item {
    padding-bottom: 0.45rem;
  }

  /* 小屏只给当前步骤显示说明 */
  .stage-hint {
    display: none;
  }

  .preview {
    height: clamp(180px, calc(var(--app-dvh) * 0.34), 300px);
  }

  .stage-footer {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .cancel-area {
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .loading-overlay {
    padding: 0;
    align-items: stretch;
  }

  .stage-card {
    width: 100%;
    max-height: none;
    min-height: var(--app-dvh);
    overflow-y: auto;
    padding: 1.2rem 1rem 1rem;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .stage-card::before,
  .frame-corner {
    display: none;
  }

  .emblem {
    width: 44px;
    height: 44px;
    font-size: 1.35rem;
  }

  .stage-title {
    font-size: 1.45rem;
  }

  .stage-header {
    gap: 0.7rem;
  }

  .elapsed {
    padding: 0.15rem 0.5rem;
    font-size: 0.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .emblem::before,
  .emblem::after,
  .marker-ring,
  .spinner,
  .caret,
  .progress-fill.indeterminate,
  .skeleton-bar {
    animation: none;
  }

  .progress-fill.indeterminate {
    width: 100%;
    opacity: 0.6;
  }

  .stage-card,
  .emblem-glyph,
  .stage-item.done .stage-marker {
    animation: none;
  }

  .chip-enter-active,
  .cmd-enter-active {
    transition: none;
  }
}
</style>
