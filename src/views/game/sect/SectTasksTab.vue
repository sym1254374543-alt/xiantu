<template>
  <div class="tasks">
    <div class="tasks-bar">
      <div class="gm-seg" role="radiogroup" aria-label="任务筛选">
        <button v-for="f in filters" :key="f.key" type="button" role="radio" :aria-checked="filter === f.key" :class="{ active: filter === f.key }" @click="filter = f.key">
          {{ f.label }}<em>{{ f.count }}</em>
        </button>
      </div>
      <span class="spacer"></span>
      <button type="button" class="cc-btn small" :disabled="busy === 'gen'" @click="generate">
        <Loader2 v-if="busy === 'gen'" :size="14" class="cc-spin" /><Sparkles v-else :size="14" />
        <span>{{ tasks.length ? '刷新任务' : 'AI 生成任务' }}</span>
      </button>
    </div>
    <p class="note">任务完成与否由 AI 按剧情判定；接取后会在对话中告知天道。</p>

    <EmptyState v-if="!tasks.length" glyph="务" title="任务堂暂无差事" desc="让 AI 结合宗门与地图生成可接取的任务" compact />
    <EmptyState v-else-if="!list.length" glyph="务" title="这一类没有任务" compact />

    <ol v-else class="task-list">
      <li v-for="t in list" :key="t.任务ID" class="task" :class="statusClass(t.状态)">
        <header class="task-head">
          <SealBadge :tone="diffTone(t.难度)">{{ t.难度 }}</SealBadge>
          <h4>{{ t.任务名称 }}</h4>
          <span class="task-type">{{ t.任务类型 }}</span>
          <span class="spacer"></span>
          <span class="task-status">{{ t.状态 }}</span>
        </header>
        <p class="task-desc">{{ t.任务描述 }}</p>
        <dl class="task-meta">
          <template v-if="t.要求"><dt>要求</dt><dd>{{ t.要求 }}</dd></template>
          <template v-if="t.期限"><dt>期限</dt><dd>{{ t.期限 }}</dd></template>
          <template v-if="t.发布人"><dt>发布人</dt><dd>{{ t.发布人 }}</dd></template>
          <dt>奖励</dt><dd><b>{{ t.贡献奖励 }}</b> 贡献<template v-if="t.额外奖励"> · {{ t.额外奖励 }}</template></dd>
        </dl>
        <footer class="task-foot">
          <button v-if="t.状态 === '可接取'" type="button" class="cc-btn small primary" :disabled="!!busy" @click="accept(t)"><Play :size="14" /><span>接取</span></button>
          <button v-else-if="t.状态 === '进行中'" type="button" class="cc-btn small" :disabled="!!busy" @click="abandon(t)"><X :size="14" /><span>放弃</span></button>
        </footer>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Loader2, Play, Sparkles, X } from 'lucide-vue-next';
import type { SectContext } from '@/composables/useSectContext';
import { generateTasks, normalizeTask, setTaskStatus, type SectTask } from '@/services/sectContentService';
import { SECT_CHAT_TEXTS } from '@/utils/prompts/tasks/sectPrompts';
import { chatBus, sendChat } from '@/utils/chatBus';
import { toast } from '@/utils/toast';
import { confirmDialog } from '@/composables/useDialog';
import EmptyState from '@/components/game/EmptyState.vue';
import SealBadge from '@/components/game/SealBadge.vue';

const props = defineProps<{ ctx: SectContext }>();
const ctx = props.ctx;
const router = useRouter();

const tasks = computed<SectTask[]>(() => {
  const raw = ctx.sectSystem.value?.宗门任务?.[ctx.sectName.value];
  return Array.isArray(raw) ? raw.map(normalizeTask) : [];
});

const filter = ref('all');
const filters = computed(() => [
  { key: 'all', label: '全部', count: tasks.value.length },
  ...['可接取', '进行中', '已完成'].map((k) => ({ key: k, label: k, count: tasks.value.filter((t) => t.状态 === k).length })),
]);
const list = computed(() => (filter.value === 'all' ? tasks.value : tasks.value.filter((t) => t.状态 === filter.value)));

const statusClass = (s: string) => (s === '进行中' ? 'doing' : s === '已完成' ? 'done' : 'open');
const diffTone = (d: string) => (d === '极' ? 'seal' : d === '高' ? 'bad' : d === '中' ? 'gold' : 'muted');

const busy = ref('');
const accept = async (t: SectTask) => {
  busy.value = t.任务ID;
  try {
    await setTaskStatus(ctx.sectName.value, t.任务ID, '可接取', '进行中');
    await sendChat(SECT_CHAT_TEXTS.acceptTask(t.任务名称));
    if (!chatBus.hasListeners('send')) {
      await router.push({ name: 'GameMain' });
    }
    toast.success('已接取任务');
  } finally {
    busy.value = '';
  }
};
const abandon = async (t: SectTask) => {
  const ok = await confirmDialog({ title: '放弃任务', message: `放弃「${t.任务名称}」？任务会回到可接取状态。`, confirmText: '放弃' });
  if (!ok) return;
  busy.value = t.任务ID;
  try {
    await setTaskStatus(ctx.sectName.value, t.任务ID, '进行中', '可接取');
    toast.info('已放弃任务');
  } finally {
    busy.value = '';
  }
};
const generate = async () => {
  if (tasks.value.some((t) => t.状态 === '进行中')) {
    const ok = await confirmDialog({ title: '刷新任务', message: '刷新会替换整张任务单，进行中的任务也会被替换。', confirmText: '刷新' });
    if (!ok) return;
  }
  busy.value = 'gen';
  try {
    await generateTasks(ctx);
    toast.success('宗门任务已更新');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '生成失败');
  } finally {
    busy.value = '';
  }
};
</script>

<style scoped>
.tasks {
  max-width: 900px;
  padding-bottom: 1.5rem;
}

.tasks-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.tasks-bar .spacer {
  flex: 1;
}

.note {
  margin: 0.5rem 0 1rem;
  font-size: 13px;
  color: var(--cc-text-3);
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.task {
  --tone: var(--cc-border-strong);

  padding: 0.85rem 1rem;
  border: 1px solid var(--cc-border);
  border-left: 3px solid var(--tone);
  border-radius: 6px;
  background: var(--gm-block);
}

.task.doing { --tone: var(--cc-gold); }
.task.done { --tone: var(--cc-success); opacity: 0.75; }

.task-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.task-head .spacer {
  flex: 1;
}

.task-head h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.task-type {
  font-size: 13px;
  color: var(--cc-text-2);
}

.task-status {
  font-size: 13px;
  letter-spacing: 0.15em;
  color: var(--tone);
}

.task-desc {
  margin: 0.5rem 0 0;
  font-size: 15px;
  line-height: 1.8;
}

.task-meta {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.2rem 0.9rem;
  margin: 0.55rem 0 0;
  font-size: 13px;
}

.task-meta dt {
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

.task-meta dd {
  margin: 0;
}

.task-meta b {
  font-weight: 500;
  color: var(--cc-gold);
}

.task-foot {
  display: flex;
  justify-content: flex-end;
}

.task-foot:empty {
  display: none;
}
</style>
