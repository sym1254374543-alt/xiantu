<template>
  <div class="hall">
    <div class="hall-top">
      <WalletCard :loginable="loginable" @login="emit('login')" />

      <section class="switch" aria-label="主流程 API">
        <label class="sw-label" for="hall-main-api">{{ p.inTavern ? '辅助功能使用' : '主流程使用' }}</label>
        <div class="sw-row">
          <span class="sw-dot" :class="{ pub: p.usingPublic.value }"></span>
          <select id="hall-main-api" class="cc-input sw-select" :value="p.activeId.value" @change="p.selectMain(($event.target as HTMLSelectElement).value)">
            <optgroup :label="p.inTavern ? '酒馆 / 我的 API' : '我的 API'">
              <option v-for="api in ownChoices" :key="api.id" :value="api.id">{{ p.inTavern && api.id === 'default' ? '酒馆 API' : api.name }}</option>
            </optgroup>
            <optgroup v-if="p.models.value.length" label="公益模型">
              <option v-for="api in p.models.value" :key="api.id" :value="api.id">{{ api.name }} · {{ formatCredit(api.cost ?? 1) }} 额度/次</option>
            </optgroup>
          </select>
        </div>
        <button type="button" class="cc-btn small sw-toggle" :disabled="!p.usingPublic.value && !p.models.value.length" @click="p.toggle()">
          <ArrowLeftRight :size="14" /><span>{{ p.usingPublic.value ? '一键切回我的 API' : '一键切到公益 API' }}</span>
        </button>
        <small class="sw-note">{{ switchNote }}</small>
      </section>
    </div>

    <nav class="hall-tabs" role="tablist" aria-label="公益 API">
      <button v-for="t in TABS" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key" :class="{ on: tab === t.key }" @click="tab = t.key">
        <component :is="t.icon" :size="15" />{{ t.label }}<em v-if="t.key === 'models' && p.models.value.length">{{ p.models.value.length }}</em>
      </button>
      <button type="button" class="hall-board" @click="showBoard = true"><Trophy :size="15" />排行榜</button>
      <button type="button" class="hall-refresh" title="刷新" aria-label="刷新" :disabled="p.loading.value" @click="reload">
        <RefreshCw :size="14" :class="{ 'cc-spin': p.loading.value }" />
      </button>
    </nav>

    <div v-if="tab === 'models'" class="hall-grid">
      <PublicModelCard
        v-for="api in p.models.value"
        :key="api.id"
        :api="api"
        :stats="p.statsOf(api)"
        :active="p.activeId.value === api.id"
        :description="api.description"
        :channels="api.poolChannels"
        @detail="detailId = api.id"
      />
      <p v-if="!p.models.value.length" class="hall-empty">{{ p.loading.value ? '读取中…' : '当前没有开放的公益模型' }}</p>
    </div>
    <ChannelSubmit v-else />

    <LeaderboardModal v-if="showBoard" @close="showBoard = false" />

    <PublicModelDetail
      v-if="detailApi"
      :api="detailApi"
      :stats="p.statsOf(detailApi)"
      :active="p.activeId.value === detailApi.id"
      :channels="detailApi.poolChannels"
      @close="detailId = ''"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ArrowLeftRight, LayoutGrid, RefreshCw, Send, Trophy } from 'lucide-vue-next';
import { usePublicApi } from '@/composables/usePublicApi';
import { formatCredit } from '@/services/builtinApi';
import { isEmbeddingProvider } from '@/data/apiProviders';
import WalletCard from './WalletCard.vue';
import PublicModelCard from './PublicModelCard.vue';
import PublicModelDetail from './PublicModelDetail.vue';
import ChannelSubmit from './ChannelSubmit.vue';
import LeaderboardModal from './LeaderboardModal.vue';

withDefaults(defineProps<{ loginable?: boolean }>(), { loginable: true });
const emit = defineEmits<{ (e: 'login'): void }>();

const TABS = [
  { key: 'models', label: '公益模型', icon: LayoutGrid },
  { key: 'submit', label: '提交渠道', icon: Send },
] as const;

const p = usePublicApi();
const tab = ref<'models' | 'submit'>('models');
const showBoard = ref(false);
const detailId = ref('');
const detailApi = computed(() => p.models.value.find((api) => api.id === detailId.value) || null);

const ownChoices = computed(() => p.ownChatApis.value.filter((api) => api.enabled && !isEmbeddingProvider(api.provider)));

const readSplit = () => {
  try {
    return JSON.parse(localStorage.getItem('dad_game_settings') || '{}').splitResponseGeneration === true;
  } catch {
    return false;
  }
};

const switchNote = computed(() => {
  const turn = p.turnCost(readSplit());
  if (turn.total > 0) {
    const left = turn.turnsLeft !== null ? `，余额约够 ${turn.turnsLeft} 回合` : '';
    return `沿用主流程的功能一起走公益模型，每回合约扣 ${formatCredit(turn.total)} 额度${left}`;
  }
  return p.inTavern ? '切到公益 API 后，记忆总结等辅助功能改走公益模型' : '一键切到公益 API 会选成功率最高的模型，切回时恢复你原来的 API';
});

const reload = () => void p.refresh().then(() => p.refreshStats(true));

let timer: number | undefined;
onMounted(() => {
  void p.refresh();
  timer = window.setInterval(() => void p.refreshStats(true), 60_000);
});
onBeforeUnmount(() => window.clearInterval(timer));
</script>

<style scoped>
.hall {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  container-type: inline-size;
}

.hall-top {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(250px, 1fr);
  gap: 0.9rem;
  align-items: stretch;
}

.switch {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface);
}

.sw-label {
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  color: var(--cc-text-3);
}

.sw-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cc-accent);
}

.sw-dot.pub {
  background: var(--cc-success);
  box-shadow: 0 0 0 3px rgba(110, 231, 183, 0.18);
}

.sw-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.sw-select {
  flex: 1;
  min-width: 0;
}

.sw-toggle {
  align-self: flex-start;
}

.sw-note {
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--cc-text-3);
}

.hall-tabs {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  border-bottom: 1px solid var(--cc-divider);
}

.hall-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: -1px;
  padding: 0.55rem 0.9rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--cc-text-2);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}

.hall-tabs button.on {
  border-bottom-color: var(--cc-gold);
  color: var(--cc-text);
}

.hall-tabs em {
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--cc-inset);
  font-size: 0.72rem;
  font-style: normal;
  color: var(--cc-text-3);
}

.hall-tabs .hall-board {
  margin-left: auto;
  color: var(--cc-gold);
}

.hall-tabs .hall-refresh {
  padding: 0.45rem;
  color: var(--cc-text-3);
}

.hall-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 0.9rem;
}

.hall-empty {
  grid-column: 1 / -1;
  margin: 0;
  padding: 2rem 0;
  text-align: center;
  font-size: 0.88rem;
  color: var(--cc-text-3);
}

@container (max-width: 720px) {
  .hall-top {
    grid-template-columns: 1fr;
  }
  .hall-grid {
    grid-template-columns: 1fr;
  }
}
</style>
