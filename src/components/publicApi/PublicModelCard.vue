<template>
  <article class="pm-card" :class="{ active }">
    <header class="pm-head">
      <span class="pm-icon">
        <img v-if="icon" :src="icon" alt="" />
        <Server v-else :size="20" />
      </span>
      <div class="pm-title">
        <strong class="pm-model">{{ api.model }}</strong>
        <span class="pm-vendor">{{ api.name }} · {{ vendor }}</span>
      </div>
      <span v-if="active" class="pm-using"><Check :size="13" />使用中</span>
    </header>

    <p class="pm-desc">{{ description || '暂无描述。' }}</p>

    <div class="pm-price">
      <span class="pm-bill">按次计费</span>
      <span><b>{{ formatCredit(api.cost ?? 1) }}</b> 额度 / 次</span>
      <span class="pm-pool">池中 {{ channels }} 条渠道</span>
    </div>

    <footer class="pm-foot">
      <div class="pm-status">
        <span class="pm-k">状态 <em>{{ fmtRate(stats?.success_rate) }}</em></span>
        <span class="pm-bars" :aria-label="`最近 24 小时成功率 ${fmtRate(stats?.success_rate)}`">
          <i v-for="(b, i) in bars" :key="i" :class="b.cls" :title="b.title"></i>
        </span>
      </div>
      <div class="pm-metric"><span class="pm-k">延迟</span><b>{{ fmtSeconds(stats?.avg_latency_ms) }}</b></div>
      <div class="pm-metric"><span class="pm-k">吞吐</span><b>{{ fmtTps(stats?.tps) }}</b></div>
      <button type="button" class="pm-link" @click="emit('detail')">详情<ChevronRight :size="14" /></button>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Check, ChevronRight, Server } from 'lucide-vue-next';
import type { APIConfig } from '@/stores/apiManagementStore';
import { formatCredit, type BuiltinStats } from '@/services/builtinApi';
import { fmtRate, fmtSeconds, fmtTps, modelIcon, modelVendor } from './modelIcon';

const props = defineProps<{ api: APIConfig; stats: BuiltinStats | null; active: boolean; description?: string; channels?: number }>();
const emit = defineEmits<{ (e: 'detail'): void }>();

const icon = computed(() => modelIcon(props.api.model, props.api.provider === 'gemini' ? 'gemini' : 'openai'));
const vendor = computed(() => modelVendor(props.api.model, props.api.provider === 'gemini' ? 'gemini' : 'openai'));
const channels = computed(() => props.channels ?? 1);

const bars = computed(() => {
  const buckets = props.stats?.buckets ?? [];
  const list = buckets.length ? buckets : Array.from({ length: 24 }, () => null);
  return list.map((b) => {
    if (!b || b.success_rate === null) return { cls: 'none', title: b ? `${new Date(b.hour).getHours()} 时 · 无请求` : '暂无数据' };
    const rate = b.success_rate;
    const cls = rate >= 0.99 ? 'ok' : rate >= 0.9 ? 'warn' : 'bad';
    return { cls, title: `${new Date(b.hour).getHours()} 时 · ${b.requests} 次 · 成功率 ${fmtRate(rate)}` };
  });
});
</script>

<style scoped>
.pm-card {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  min-width: 0;
  padding: 1rem 1.1rem 0.85rem;
  border: 1px solid var(--cc-border);
  border-radius: 10px;
  background: var(--cc-surface);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.pm-card:hover {
  border-color: rgba(var(--cc-gold-rgb), 0.45);
}

.pm-card.active {
  border-color: rgba(var(--cc-gold-rgb), 0.7);
  box-shadow: inset 3px 0 0 var(--cc-gold);
}

.pm-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.pm-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--cc-inset);
  color: var(--cc-text-3);
}

.pm-icon img {
  width: 26px;
  height: 26px;
  object-fit: contain;
}

.pm-title {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.pm-model {
  overflow: hidden;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--cc-text);
}

.pm-vendor {
  overflow: hidden;
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--cc-text-3);
}

.pm-using {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--cc-gold);
  border-radius: 999px;
  font-size: 0.72rem;
  color: var(--cc-gold);
}

.pm-desc {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--cc-text-2);
}

.pm-price {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.9rem;
  font-size: 0.82rem;
  color: var(--cc-text-2);
}

.pm-bill {
  color: var(--cc-accent);
}

.pm-price b {
  font-size: 0.95rem;
  color: var(--cc-text);
  font-variant-numeric: tabular-nums;
}

.pm-pool {
  margin-left: auto;
  color: var(--cc-text-3);
}

.pm-foot {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: end;
  gap: 0.9rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--cc-divider);
}

.pm-k {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--cc-text-3);
}

.pm-k em {
  font-style: normal;
  font-variant-numeric: tabular-nums;
}

.pm-status {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.pm-bars {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  gap: 2px;
  height: 16px;
}

.pm-bars i {
  border-radius: 2px;
  background: var(--cc-success);
}

.pm-bars i.none {
  background: rgba(var(--cc-gold-rgb), 0.16);
}

.pm-bars i.warn {
  background: var(--cc-warning);
}

.pm-bars i.bad {
  background: var(--cc-danger);
}

.pm-metric {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.pm-metric b {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--cc-text);
}

.pm-link {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  padding: 0.3rem 0.2rem;
  border: 0;
  background: none;
  color: var(--cc-text);
  font: inherit;
  font-size: 0.85rem;
  white-space: nowrap;
  cursor: pointer;
}

.pm-link:hover {
  color: var(--cc-gold);
}

.pm-card {
  container-type: inline-size;
}

@container (max-width: 380px) {
  .pm-foot {
    grid-template-columns: 1fr 1fr auto;
  }
  .pm-status {
    grid-column: 1 / -1;
  }
}
</style>
