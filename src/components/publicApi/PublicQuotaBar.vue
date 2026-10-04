<template>
  <div v-if="show" class="pq" :class="{ low }" role="status">
    <HandHeart :size="14" />
    <span class="pq-name">公益 · {{ mainApi?.name }}</span>
    <span class="pq-sep" aria-hidden="true">·</span>
    <span>余额 <b>{{ formatCredit(p.balance.value) }}</b></span>
    <span v-if="turn.total > 0" class="pq-sub">每回合约 {{ formatCredit(turn.total) }}<template v-if="turn.turnsLeft !== null">，约够 {{ turn.turnsLeft }} 回合</template></span>
    <button v-if="p.wallet.value && !p.wallet.value.checked_in_today" type="button" class="pq-btn" :disabled="p.checkingIn.value" @click="checkIn">
      今日未签到，去签到
    </button>
    <button v-else-if="low" type="button" class="pq-btn" @click="p.useOwn()">额度不足，切回我的 API</button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { HandHeart } from 'lucide-vue-next';
import { usePublicApi } from '@/composables/usePublicApi';
import { formatCredit } from '@/services/builtinApi';
import { toast } from '@/utils/toast';

const p = usePublicApi();

const readSplit = () => {
  try {
    return JSON.parse(localStorage.getItem('dad_game_settings') || '{}').splitResponseGeneration === true;
  } catch {
    return false;
  }
};

const mainApi = computed(() => p.resolveApi('main'));
const show = computed(() => !p.inTavern && !!mainApi.value?.builtin);
const turn = computed(() => p.turnCost(readSplit()));
const low = computed(() => {
  const bal = p.balance.value;
  return typeof bal === 'number' && bal < (turn.value.total || mainApi.value?.cost || 1);
});

const checkIn = async () => {
  const res = await p.checkIn();
  if (res) toast.success(`${res.tier ? `抽中「${res.tier}」，` : ''}获得 ${formatCredit(res.amount)} 额度`);
};

onMounted(() => {
  if (show.value && !p.wallet.value) void p.refreshWallet();
});
</script>

<style scoped>
.pq {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
  padding: 0.3rem 0.1rem 0;
  font-size: 12px;
  color: var(--cc-text-3);
}

.pq svg {
  color: var(--cc-gold);
}

.pq-name {
  color: var(--cc-text-2);
}

.pq b {
  color: var(--cc-gold);
  font-variant-numeric: tabular-nums;
}

.pq.low b {
  color: var(--cc-danger);
}

.pq-btn {
  margin-left: auto;
  padding: 0.15rem 0.6rem;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.5);
  border-radius: 999px;
  background: transparent;
  color: var(--cc-gold);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.pq-btn:hover:not(:disabled) {
  background: rgba(var(--cc-gold-rgb), 0.12);
}
</style>
