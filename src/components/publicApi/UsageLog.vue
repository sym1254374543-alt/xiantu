<template>
  <section class="usage-log" :class="{ dense }" aria-label="使用消耗记录">
    <header class="ul-head">
      <h4>使用消耗记录</h4>
      <button v-if="entries.length" type="button" class="ul-clear" @click="clearBuiltinUsageLog">清空</button>
    </header>
    <p v-if="!entries.length" class="ul-empty">还没有本机记录。之后每次公益模型调用成功，都会记在这里。</p>
    <ol v-else class="ul-list">
      <li v-for="entry in shown" :key="entry.id">
        <span class="ul-when">{{ formatUsageTime(entry.at) }}</span>
        <span class="ul-what">
          <b>{{ usageLabel(entry.usage) }}</b>
          <small>{{ entry.name }}<template v-if="entry.model && !entry.name.includes(entry.model)"> · {{ entry.model }}</template></small>
        </span>
        <span class="ul-cost">−{{ formatCredit(entry.cost) }}</span>
      </li>
    </ol>
    <p class="ul-note">只记这台设备上成功的公益调用，和服务器上的累计消耗可能不完全一致。</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatCredit } from '@/services/builtinApi';
import { builtinUsageLog, clearBuiltinUsageLog, formatUsageTime, usageLabel } from '@/services/builtinUsageLog';

const props = withDefaults(defineProps<{ limit?: number; dense?: boolean }>(), { dense: false });

const entries = computed(() => builtinUsageLog.value);
const shown = computed(() => (props.limit ? entries.value.slice(0, props.limit) : entries.value));
</script>

<style scoped>
.usage-log {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.85rem 1rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface);
}

.usage-log.dense {
  gap: 0.4rem;
  margin-top: 0.9rem;
  padding: 0.7rem 0;
  border: 0;
  border-top: 1px solid var(--gm-line, var(--cc-border));
  border-radius: 0;
  background: transparent;
}

.ul-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.ul-head h4 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--cc-text-2);
}

.ul-clear {
  padding: 0;
  border: 0;
  background: none;
  color: var(--cc-text-3);
  font-size: 12px;
  cursor: pointer;
}

.ul-clear:hover {
  color: var(--cc-text);
}

.ul-empty,
.ul-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--cc-text-3);
}

.ul-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 280px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.dense .ul-list {
  max-height: 180px;
}

.ul-list li {
  display: grid;
  grid-template-columns: 4.6rem minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: baseline;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--cc-border);
}

.ul-list li:last-child {
  border-bottom: 0;
}

.ul-when {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--cc-text-3);
}

.ul-what {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.1rem;
}

.ul-what b {
  font-size: 13px;
  font-weight: 600;
  color: var(--cc-text);
}

.ul-what small {
  overflow: hidden;
  font-size: 12px;
  color: var(--cc-text-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ul-cost {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--cc-gold);
}
</style>
