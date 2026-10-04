<template>
  <div class="manage">
    <div class="manage-bar">
      <p>宗门经营只影响宗门数值与月报，<b>不推进游戏时间</b>；结算由 AI 按一次 d20 掷骰推演。</p>
      <button type="button" class="cc-btn small" :disabled="!!busy" @click="init">
        <Loader2 v-if="busy === 'init'" :size="14" class="cc-spin" /><Sparkles v-else :size="14" />
        <span>{{ m ? '重新初始化' : 'AI 初始化经营' }}</span>
      </button>
      <button v-if="m" type="button" class="cc-btn small primary" :disabled="!!busy" @click="settle">
        <Loader2 v-if="busy === 'settle'" :size="14" class="cc-spin" /><CalendarClock v-else :size="14" />
        <span>结算一旬</span>
      </button>
    </div>

    <EmptyState v-if="!m" glyph="营" title="尚未开始经营" desc="作为宗门高层，可初始化府库、设施与战力，之后按旬结算" compact />

    <template v-else>
      <section class="dials">
        <div v-for="d in dials" :key="d.key" class="dial">
          <ProgressRing :percent="d.value" :size="76" :label="String(d.value)" tone="accent" />
          <span>{{ d.key }}</span>
        </div>
        <div class="dial last">
          <b>{{ m.最近结算 ? fmtTime(m.最近结算) : '未结算' }}</b>
          <span>最近结算</span>
        </div>
      </section>

      <div class="cols">
        <section class="block">
          <h4 class="gm-label">府库</h4>
          <dl class="gm-kv">
            <template v-for="(v, k) in treasury" :key="k"><dt>{{ k }}</dt><dd>{{ v.toLocaleString('zh-CN') }}</dd></template>
          </dl>
        </section>
        <section class="block">
          <h4 class="gm-label">设施</h4>
          <ul class="facilities">
            <li v-for="(v, k) in facilities" :key="k">
              <span>{{ k }}</span>
              <span class="pips" :aria-label="`${v} 级`"><i v-for="n in 5" :key="n" :class="{ on: n <= v }"></i></span>
              <b>{{ v }} 级</b>
            </li>
          </ul>
        </section>
      </div>

      <section class="reports">
        <h4 class="gm-label">月报</h4>
        <ol v-if="reports.length" class="report-list">
          <li v-for="(r, i) in reports" :key="i">
            <span class="r-time">{{ fmtTime(r.时间) }}</span>
            <div>
              <p>{{ r.摘要 }}</p>
              <small v-if="r.变化">{{ deltas(r.变化) }}</small>
            </div>
          </li>
        </ol>
        <p v-else class="gm-muted">还没有结算记录。</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarClock, Loader2, Sparkles } from 'lucide-vue-next';
import type { SectContext } from '@/composables/useSectContext';
import { initManagement, settleTenDays } from '@/services/sectContentService';
import { toast } from '@/utils/toast';
import { confirmDialog } from '@/composables/useDialog';
import EmptyState from '@/components/game/EmptyState.vue';
import ProgressRing from '@/components/game/ProgressRing.vue';

const props = defineProps<{ ctx: SectContext }>();
const ctx = props.ctx;

const m = computed<any>(() => ctx.sectSystem.value?.宗门经营?.[ctx.sectName.value] ?? null);
const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0;
};

const dials = computed(() => [
  { key: '战力', value: n(m.value?.战力) },
  { key: '安定', value: n(m.value?.安定) },
  { key: '外门训练度', value: n(m.value?.外门训练度) },
]);
const treasury = computed(() => {
  const f = m.value?.府库 || {};
  return { 灵石: n(f.灵石), 灵材: n(f.灵材), 丹药: n(f.丹药), 阵材: n(f.阵材) };
});
const facilities = computed(() => {
  const f = m.value?.设施 || {};
  return { 练功房: n(f.练功房), 藏经阁: n(f.藏经阁), 炼丹房: n(f.炼丹房), 护山大阵: n(f.护山大阵) };
});
const reports = computed(() => (Array.isArray(m.value?.月报) ? [...m.value.月报].reverse() : []));

const fmtTime = (t: unknown) => {
  const d = new Date(String(t));
  return Number.isNaN(d.getTime()) ? String(t || '') : d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const deltas = (d: Record<string, number>) =>
  Object.entries(d)
    .slice(0, 6)
    .map(([k, v]) => `${k} ${Number(v) >= 0 ? '+' : ''}${v}`)
    .join('　');

const busy = ref('');
const init = async () => {
  if (m.value) {
    const ok = await confirmDialog({ title: '重新初始化', message: '重新生成经营数据会覆盖现有府库、设施与月报。', confirmText: '重新初始化', danger: true });
    if (!ok) return;
  }
  busy.value = 'init';
  try {
    await initManagement(ctx);
    toast.success('宗门经营数据已更新');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '初始化失败');
  } finally {
    busy.value = '';
  }
};
const settle = async () => {
  busy.value = 'settle';
  try {
    await settleTenDays(ctx, m.value);
    toast.success('已结算一旬');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '结算失败');
  } finally {
    busy.value = '';
  }
};
</script>

<style scoped>
.manage {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 1000px;
  padding-bottom: 1.5rem;
}

.manage-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.manage-bar p {
  flex: 1;
  margin: 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.manage-bar b {
  font-weight: 500;
  color: var(--cc-gold);
}

.dials {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--gm-block);
}

.dial {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  font-size: 13px;
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

.dial.last {
  margin-left: auto;
  align-items: flex-end;
}

.dial.last b {
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--cc-text);
}

.cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.block {
  padding: 0.9rem 1.1rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--gm-block);
}

.block .gm-label {
  margin-bottom: 0.7rem;
}

.facilities {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}

.facilities li {
  display: grid;
  grid-template-columns: 5em minmax(0, 1fr) 3em;
  align-items: center;
  gap: 0.6rem;
}

.facilities b {
  font-weight: 500;
  text-align: right;
}

.pips {
  display: flex;
  gap: 4px;
}

.pips i {
  flex: 1;
  height: 6px;
  border-radius: 2px;
  background: var(--cc-inset);
}

.pips i.on {
  background: var(--cc-gold);
}

.report-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0.6rem 0 0;
  padding: 0;
  list-style: none;
}

.report-list li {
  display: grid;
  grid-template-columns: 8em minmax(0, 1fr);
  gap: 0.8rem;
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  background: var(--gm-block);
}

.r-time {
  font-size: 12px;
  color: var(--cc-gold);
}

.report-list p {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
}

.report-list small {
  font-size: 12px;
  color: var(--cc-text-2);
}

@media (max-width: 768px) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
  }

  .dial.last {
    margin-left: 0;
    align-items: flex-start;
  }
}
</style>
