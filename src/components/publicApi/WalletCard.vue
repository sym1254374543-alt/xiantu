<template>
  <div class="wallet-wrap">
    <section class="wallet" :class="{ compact }" aria-label="公益额度">
      <template v-if="!p.loggedIn.value">
        <div class="w-main">
          <span class="w-seal" aria-hidden="true">签</span>
          <div class="w-copy">
            <strong class="w-title">公益额度</strong>
            <p class="w-sub">登录云端账号后每日签到领取额度{{ rules ? `，注册即送 ${formatCredit(rules.register_bonus)}` : '' }}</p>
          </div>
        </div>
        <button v-if="loginable" type="button" class="cc-btn primary" @click="emit('login')"><LogIn :size="15" /><span>去登录</span></button>
        <p v-else class="w-sub">请回到首页登录云端账号</p>
      </template>
  
      <template v-else>
        <div class="w-main">
          <span class="w-seal" aria-hidden="true">签</span>
          <div class="w-copy">
            <span class="w-label">公益额度</span>
            <strong class="w-balance">{{ formatCredit(p.balance.value) }}</strong>
            <p v-if="wallet" class="w-sub">
              连签 {{ wallet.streak }} 天
              <template v-if="wallet.next_bonus > 0"> · {{ wallet.checked_in_today ? '明日' : '今日' }}连签加成 +{{ formatCredit(wallet.next_bonus) }}</template>
              <template v-if="wallet.pity_left"> · 再签 {{ wallet.pity_left }} 次必出高签</template>
            </p>
            <p v-else-if="p.walletError.value" class="w-sub err">{{ p.walletError.value }}</p>
          </div>
        </div>
  
        <div class="w-side">
          <Transition name="lot" mode="out-in">
            <div v-if="shaking" key="shake" class="w-lot shaking" aria-live="polite"><span>摇签中…</span></div>
            <div v-else-if="todayResult" key="res" class="w-lot" :class="{ high: isHigh(todayResult) }" aria-live="polite">
              <span class="w-tier">{{ todayResult.tier || '签到' }}</span>
              <span class="w-gain">+{{ formatCredit(todayResult.amount) }}</span>
              <small v-if="todayResult.bonus > 0">含连签 +{{ formatCredit(todayResult.bonus) }}</small>
              <small v-if="todayResult.pity_hit">保底触发</small>
            </div>
          </Transition>
          <button
            type="button"
            class="cc-btn primary w-btn"
            :disabled="!wallet || wallet.checked_in_today || p.checkingIn.value || shaking"
            @click="doCheckIn"
          >
            <Loader2 v-if="p.checkingIn.value || shaking" :size="15" class="cc-spin" />
            <CheckCircle2 v-else-if="wallet?.checked_in_today" :size="15" />
            <Sparkles v-else :size="15" />
            <span>{{ wallet?.checked_in_today ? '今日已签到' : rules?.mode === 'lottery' ? '签到抽签' : '签到领取' }}</span>
          </button>
        </div>
      </template>
  
      <details v-if="rules && !compact" class="w-rules">
        <summary>{{ rules.mode === 'lottery' ? '签文与概率' : '签到规则' }}</summary>
        <div v-if="rules.mode === 'lottery'" class="w-tiers">
          <span v-for="tier in rules.tiers" :key="tier.name" class="w-chip" :class="{ high: tier.high }">
            <b>{{ tier.name }}</b>{{ formatCredit(tier.amount) }}<em>{{ (tier.chance * 100).toFixed(1) }}%</em>
          </span>
        </div>
        <p class="w-note">
          <template v-if="rules.mode === 'lottery'">每日一签，平均约 {{ formatCredit(rules.expected) }}。<template v-if="rules.pity_threshold">连续 {{ rules.pity_threshold - 1 }} 次没抽到高签，第 {{ rules.pity_threshold }} 次必出高签。</template></template>
          <template v-else>每日签到领取 {{ formatCredit(rules.fixed_amount) }}。</template>
          <template v-if="rules.streak_step > 0">连签第 2 天起每天多 {{ formatCredit(rules.streak_step) }}，最多多 {{ formatCredit(rules.streak_cap) }}，断签重算。</template>
        </p>
      </details>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { CheckCircle2, Loader2, LogIn, Sparkles } from 'lucide-vue-next';
import { usePublicApi } from '@/composables/usePublicApi';
import { formatCredit, type CheckinResult } from '@/services/builtinApi';
import { toast } from '@/utils/toast';

withDefaults(defineProps<{ compact?: boolean; loginable?: boolean }>(), { compact: false, loginable: true });
const emit = defineEmits<{ (e: 'login'): void }>();

const p = usePublicApi();
const wallet = computed(() => p.wallet.value);
const rules = computed(() => wallet.value?.rules ?? null);
const todayResult = computed(() => p.lastCheckin.value ?? wallet.value?.today ?? null);
const isHigh = (r: CheckinResult) => !!rules.value?.tiers.find((t) => t.name === r.tier)?.high;

const shaking = ref(false);
const doCheckIn = async () => {
  shaking.value = rules.value?.mode === 'lottery';
  const started = Date.now();
  const res = await p.checkIn();
  // 抽签给一点摇签的停顿，结果出来得太快反而没感觉
  const wait = shaking.value ? Math.max(0, 900 - (Date.now() - started)) : 0;
  setTimeout(() => {
    shaking.value = false;
    if (res) toast.success(`${res.tier ? `抽中「${res.tier}」，` : ''}获得 ${formatCredit(res.amount)} 额度`);
  }, wait);
};
</script>

<style scoped>
.wallet {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem 1.25rem;
  padding: 1rem 1.15rem;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.32);
  border-radius: 8px;
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(var(--cc-gold-rgb), 0.12), transparent 60%),
    var(--cc-surface);
}

.w-main {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
}

.w-seal {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 1px solid var(--cc-seal);
  border-radius: 50%;
  color: var(--cc-seal);
  font-family: var(--cc-calligraphy);
  font-size: 1.35rem;
  box-shadow: 0 0 0 4px rgba(192, 57, 43, 0.08);
}

.w-copy {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.w-label,
.w-title {
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  color: var(--cc-text-3);
}

.w-title {
  font-size: 1rem;
  color: var(--cc-text);
}

.w-balance {
  font-family: var(--cc-calligraphy);
  font-size: 2.1rem;
  font-weight: 400;
  line-height: 1.1;
  color: var(--cc-gold);
  font-variant-numeric: tabular-nums;
}

.w-sub {
  margin: 0;
  font-size: 0.8rem;
  color: var(--cc-text-2);
}

.w-sub.err {
  color: var(--cc-danger);
}

.w-side {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.w-btn {
  white-space: nowrap;
}

.w-lot {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 84px;
  padding: 0.35rem 0.7rem;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.4);
  border-radius: 4px;
  background: var(--cc-inset);
  line-height: 1.25;
}

.w-lot.high {
  border-color: var(--cc-seal);
  box-shadow: 0 0 14px rgba(192, 57, 43, 0.25);
}

.w-lot.shaking {
  animation: lot-shake 0.18s ease-in-out infinite alternate;
  color: var(--cc-text-3);
  font-size: 0.8rem;
}

.w-tier {
  font-family: var(--cc-calligraphy);
  font-size: 1.2rem;
  color: var(--cc-seal);
}

.w-gain {
  font-weight: 650;
  color: var(--cc-gold);
  font-variant-numeric: tabular-nums;
}

.w-lot small {
  font-size: 0.68rem;
  color: var(--cc-text-3);
}

.w-rules {
  grid-column: 1 / -1;
  font-size: 0.8rem;
  color: var(--cc-text-2);
}

.w-rules summary {
  cursor: pointer;
  width: fit-content;
  color: var(--cc-text-3);
}

.w-tiers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.55rem 0 0.4rem;
}

.w-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--cc-border);
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
}

.w-chip.high {
  border-color: rgba(192, 57, 43, 0.5);
}

.w-chip b {
  font-weight: 600;
  color: var(--cc-text);
}

.w-chip em {
  font-style: normal;
  color: var(--cc-text-3);
}

.w-note {
  margin: 0.4rem 0 0;
  line-height: 1.65;
}

.compact {
  padding: 0.75rem 0.9rem;
}

.compact .w-balance {
  font-size: 1.7rem;
}

.lot-enter-active,
.lot-leave-active {
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.lot-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.92);
}

.lot-leave-to {
  opacity: 0;
}

@keyframes lot-shake {
  from { transform: rotate(-4deg); }
  to { transform: rotate(4deg); }
}

@media (prefers-reduced-motion: reduce) {
  .w-lot.shaking { animation: none; }
}

.wallet-wrap {
  container-type: inline-size;
}

@container (max-width: 540px) {
  .wallet {
    grid-template-columns: 1fr;
  }
  .w-side {
    justify-content: space-between;
  }
}
</style>
