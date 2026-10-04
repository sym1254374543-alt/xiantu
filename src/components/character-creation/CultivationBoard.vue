<template>
  <aside v-if="visible" class="board" aria-label="修为榜">
    <span class="frame-corner tl" aria-hidden="true"></span>
    <span class="frame-corner tr" aria-hidden="true"></span>
    <span class="frame-corner bl" aria-hidden="true"></span>
    <span class="frame-corner br" aria-hidden="true"></span>
    <header class="board-head">
      <h2>修为榜</h2>
      <p>云端修行</p>
    </header>
    <p v-if="loading" class="board-empty">正在读取修为榜…</p>
    <p v-else-if="failed" class="board-empty">榜单暂未开启</p>
    <p v-else-if="!items.length" class="board-empty">尚无云端修士登榜</p>
    <ol v-else class="board-list">
      <li v-for="row in items" :key="row.rank" :class="{ mine: row.mine, top: row.rank <= 3 }">
        <span class="rank" :data-rank="row.rank">{{ row.rank }}</span>
        <span class="who">
          <span class="name">{{ row.name }}<em v-if="row.mine">我</em></span>
          <span class="realm">{{ row.label }}</span>
        </span>
        <span v-if="row.progress_max > 0" class="prog">{{ row.progress }}/{{ row.progress_max }}</span>
      </li>
    </ol>
  </aside>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchRealmLeaderboard, type RealmLeaderboardItem } from '@/services/api/characters';
import { isBackendConfigured } from '@/services/backendConfig';

const visible = ref(true);
const loading = ref(true);
const failed = ref(false);
const items = ref<RealmLeaderboardItem[]>([]);

onMounted(async () => {
  if (!isBackendConfigured()) {
    loading.value = false;
    failed.value = true;
    return;
  }
  try {
    items.value = await fetchRealmLeaderboard(20);
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.board {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 272px;
  flex-shrink: 0;
  min-height: 0;
  padding: 1.15rem 1rem 1rem;
  box-sizing: border-box;
  overflow: hidden;
  color: var(--cc-text);
  background: var(--cc-shell-bg);
  border: 1px solid var(--cc-shell-border);
  border-radius: 6px;
  box-shadow: var(--cc-shell-shadow);
  backdrop-filter: blur(22px) saturate(1.1);
}

.board::before {
  content: '';
  position: absolute;
  inset: 8px;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.16);
  border-radius: 3px;
  pointer-events: none;
}

.frame-corner {
  position: absolute;
  width: 22px;
  height: 22px;
  border: 0 solid var(--cc-gold);
  opacity: 0.85;
  pointer-events: none;
}

.frame-corner.tl { top: 4px; left: 4px; border-top-width: 2px; border-left-width: 2px; }
.frame-corner.tr { top: 4px; right: 4px; border-top-width: 2px; border-right-width: 2px; }
.frame-corner.bl { bottom: 4px; left: 4px; border-bottom-width: 2px; border-left-width: 2px; }
.frame-corner.br { bottom: 4px; right: 4px; border-bottom-width: 2px; border-right-width: 2px; }

.board-head {
  flex-shrink: 0;
  padding: 0.35rem 0.45rem 0.75rem;
  text-align: center;
}

.board-head h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: 0.35em;
}

.board-head p {
  margin: 0.25rem 0 0;
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  color: var(--cc-text-3);
}

.board-empty {
  margin: 1.5rem 0.6rem;
  text-align: center;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--cc-text-3);
}

.board-list {
  list-style: none;
  margin: 0;
  padding: 0 0.2rem;
  overflow: auto;
  min-height: 0;
}

.board-list li {
  display: grid;
  grid-template-columns: 1.6rem minmax(0, 1fr) auto;
  gap: 0.45rem;
  align-items: center;
  padding: 0.45rem 0.35rem;
  border-top: 1px solid var(--cc-divider);
}

.board-list li.mine {
  background: rgba(var(--cc-accent-rgb), 0.08);
}

.rank {
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--cc-text-3);
}

.top .rank {
  color: var(--cc-gold);
  font-weight: 700;
}

.who {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.88rem;
}

.name em {
  margin-left: 0.35rem;
  font-style: normal;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: var(--cc-gold);
}

.realm {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  color: var(--cc-text-3);
}

.prog {
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
  color: var(--cc-text-3);
}

@media (max-width: 760px) {
  .board {
    display: none;
  }
}
</style>
