<template>
  <section class="lb">
    <header class="lb-head">
      <div class="lb-seg" role="tablist" aria-label="排行榜">
        <button type="button" role="tab" :aria-selected="kind === 'contribution'" :class="{ on: kind === 'contribution' }" @click="kind = 'contribution'">公益贡献榜</button>
        <button type="button" role="tab" :aria-selected="kind === 'balance'" :class="{ on: kind === 'balance' }" @click="kind = 'balance'">额度榜</button>
      </div>
      <small>{{ kind === 'contribution' ? '按提交渠道获得的累计返还排名' : '按当前额度余额排名' }}</small>
    </header>

    <p v-if="!board" class="lb-empty">读取中…</p>
    <p v-else-if="!board.items.length" class="lb-empty">{{ kind === 'contribution' ? '还没有人贡献渠道，来做第一个吧' : '暂无数据' }}</p>
    <ol v-else class="lb-list">
      <li v-for="row in board.items" :key="row.rank" :class="{ me: row.me, top: row.rank <= 3 }">
        <span class="lb-rank" :data-rank="row.rank">{{ row.rank }}</span>
        <span class="lb-name">{{ row.user_name }}<em v-if="row.me">我</em></span>
        <b class="lb-val">{{ formatCredit(row.value, kind === 'contribution' ? 4 : 2) }}</b>
      </li>
    </ol>

    <footer v-if="board?.mine" class="lb-mine">
      我的{{ kind === 'contribution' ? '贡献' : '额度' }} <b>{{ formatCredit(board.mine.value, kind === 'contribution' ? 4 : 2) }}</b>
      <span>{{ board.mine.rank ? `排第 ${board.mine.rank} 名` : '暂未上榜' }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { usePublicApi } from '@/composables/usePublicApi';
import { formatCredit } from '@/services/builtinApi';

const p = usePublicApi();
const kind = ref<'contribution' | 'balance'>('contribution');
const board = computed(() => p.boards.value[kind.value] ?? null);

watch(kind, (k) => void p.loadBoard(k));
onMounted(() => void p.loadBoard(kind.value));
</script>

<style scoped>
.lb {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.lb-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.9rem;
}

.lb-head small {
  font-size: 0.78rem;
  color: var(--cc-text-3);
}

.lb-seg {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--cc-inset);
}

.lb-seg button {
  padding: 0.35rem 0.9rem;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--cc-text-2);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.lb-seg button.on {
  background: var(--cc-surface);
  color: var(--cc-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15), inset 0 -2px 0 var(--cc-gold);
}

.lb-empty {
  margin: 0;
  padding: 1.5rem 0;
  text-align: center;
  font-size: 0.85rem;
  color: var(--cc-text-3);
}

.lb-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--cc-surface);
}

.lb-list li {
  display: grid;
  grid-template-columns: 2.4rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.9rem;
  border-top: 1px solid var(--cc-divider);
}

.lb-list li:first-child {
  border-top: 0;
}

.lb-list li.me {
  background: rgba(var(--cc-gold-rgb), 0.1);
}

.lb-rank {
  display: grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 50%;
  font-size: 0.8rem;
  color: var(--cc-text-3);
  font-variant-numeric: tabular-nums;
}

.top .lb-rank {
  font-family: var(--cc-calligraphy);
  font-size: 1rem;
  color: #fff;
}

.lb-rank[data-rank='1'] { background: #c9a14a; }
.lb-rank[data-rank='2'] { background: #8e9aa6; }
.lb-rank[data-rank='3'] { background: #a8704a; }

.lb-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--cc-text);
}

.lb-name em {
  margin-left: 0.4rem;
  padding: 0 0.3rem;
  border: 1px solid var(--cc-gold);
  border-radius: 3px;
  font-size: 0.68rem;
  font-style: normal;
  color: var(--cc-gold);
}

.lb-val {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 0.9rem;
  color: var(--cc-gold);
}

.lb-mine {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--cc-text-2);
}

.lb-mine b {
  color: var(--cc-gold);
}

.lb-mine span {
  color: var(--cc-text-3);
}
</style>
