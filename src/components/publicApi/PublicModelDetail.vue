<template>
  <Teleport to="body">
    <div class="cc-modal-overlay pmd-layer" @click.self="emit('close')">
      <div class="cc-modal wide solid pmd" role="dialog" aria-modal="true" :aria-label="`${api.model} 详情`" @keydown.esc="emit('close')">
        <header class="cc-modal-head pmd-head">
          <span class="pmd-icon">
            <img v-if="icon" :src="icon" alt="" />
            <Server v-else :size="22" />
          </span>
          <div class="pmd-title">
            <h3 class="cc-modal-title">{{ api.model }}</h3>
            <small>{{ api.name }} · {{ formatCredit(api.cost ?? 1) }} 额度 / 次 · 池中 {{ channels }} 条渠道</small>
          </div>
          <button type="button" class="cc-modal-close" aria-label="关闭" @click="emit('close')"><X :size="18" /></button>
        </header>

        <div class="cc-modal-body pmd-body">
          <div class="pmd-tiles">
            <div class="pmd-tile">
              <span><Gauge :size="14" />TPS</span>
              <b>{{ fmtTps(stats?.tps) }}</b>
              <small>持续每秒 Token 数</small>
            </div>
            <div class="pmd-tile">
              <span><Timer :size="14" />平均延迟</span>
              <b>{{ fmtSeconds(stats?.avg_latency_ms) }}</b>
              <small>首字 {{ fmtSeconds(stats?.avg_ttft_ms) }}</small>
            </div>
            <div class="pmd-tile">
              <span><HeartPulse :size="14" />成功率</span>
              <b class="ok">{{ fmtRate(stats?.success_rate, 2) }}</b>
              <small>最近 24 小时 {{ stats?.requests ?? 0 }} 次请求 · {{ stats?.incidents ?? 0 }} 个异常时段</small>
            </div>
          </div>

          <section class="pmd-sec">
            <h4><Timer :size="15" />延迟趋势<small>最近 24 小时 · 平均首 Token 延迟</small></h4>
            <MiniLineChart :values="ttft" :labels="hourLabels" label="平均首 Token 延迟" :format="fmtMs" />
          </section>

          <section class="pmd-sec">
            <h4>
              <HeartPulse :size="15" />可用率<small>最近 24 小时 · 每小时请求成功率</small>
              <span v-if="stats?.incidents" class="pmd-incident"><AlertTriangle :size="13" />{{ stats.incidents }} 个异常时段</span>
            </h4>
            <MiniLineChart :values="rates" :labels="hourLabels" label="每小时成功率" color="var(--cc-success)" :min="rateMin" :max="100" :format="fmtPct" />
          </section>

          <p class="pmd-note">数据每 30 秒刷新一次。上游没返回用量时，Token 数按字数估算。</p>
        </div>

        <footer class="cc-modal-foot">
          <span v-if="active" class="pmd-using">主流程正在使用这个模型</span>
          <button type="button" class="cc-btn" @click="emit('close')">关闭</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle, Gauge, HeartPulse, Server, Timer, X } from 'lucide-vue-next';
import type { APIConfig } from '@/stores/apiManagementStore';
import { formatCredit, type BuiltinStats } from '@/services/builtinApi';
import MiniLineChart from './MiniLineChart.vue';
import { fmtRate, fmtSeconds, fmtTps, modelIcon } from './modelIcon';

const props = defineProps<{ api: APIConfig; stats: BuiltinStats | null; active: boolean; channels?: number }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const icon = computed(() => modelIcon(props.api.model, props.api.provider === 'gemini' ? 'gemini' : 'openai'));
const channels = computed(() => props.channels ?? 1);
const buckets = computed(() => props.stats?.buckets ?? []);
const hourLabels = computed(() => buckets.value.map((b) => `${String(new Date(b.hour).getHours()).padStart(2, '0')}:00`));
const ttft = computed(() => buckets.value.map((b) => b.avg_ttft_ms));
const rates = computed(() => buckets.value.map((b) => (b.success_rate === null ? null : b.success_rate * 100)));
/** 可用率纵轴下限：最低点再往下留一格，最少到 95% */
const rateMin = computed(() => {
  const nums = rates.value.filter((v): v is number => v !== null);
  const low = nums.length ? Math.min(...nums) : 100;
  return Math.max(0, Math.min(95, Math.floor(low - 1)));
});
const fmtMs = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);
const fmtPct = (v: number) => `${v.toFixed(v >= 99.95 ? 0 : 1)}%`;
</script>

<style scoped>
.pmd-layer {
  z-index: 2000;
}

.pmd {
  width: min(860px, 100%);
}

.pmd-head {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.pmd-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--cc-inset);
}

.pmd-icon img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.pmd-title {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.pmd-title .cc-modal-title {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  letter-spacing: 0;
}

.pmd-title small {
  font-size: 0.78rem;
  color: var(--cc-text-3);
}

.pmd-body {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.pmd-tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.pmd-tile {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface);
}

.pmd-tile span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--cc-text-3);
}

.pmd-tile b {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 1.35rem;
  color: var(--cc-text);
}

.pmd-tile b.ok {
  color: var(--cc-success);
}

.pmd-tile small {
  font-size: 0.72rem;
  color: var(--cc-text-3);
}

.pmd-sec h4 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.6rem;
  font-size: 0.95rem;
  color: var(--cc-text);
}

.pmd-sec h4 small {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--cc-text-3);
}

.pmd-incident {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--cc-warning);
}

.pmd-using {
  margin-right: auto;
  font-size: 0.8rem;
  color: var(--cc-gold);
}

.pmd-note {
  margin: 0;
  font-size: 0.75rem;
  color: var(--cc-text-3);
}

@media (max-width: 640px) {
  .pmd-tiles {
    grid-template-columns: 1fr;
  }
}
</style>
