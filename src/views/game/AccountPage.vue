<template>
  <div class="account-page">
    <section class="ac-profile">
      <span class="ac-avatar" aria-hidden="true">{{ initial }}</span>
      <div class="ac-info">
        <template v-if="profile">
          <h2 class="ac-name">{{ profile.user_name }}</h2>
          <p class="ac-sub">道籍编号 {{ profile.id }} · {{ joined }} 入道</p>
        </template>
        <template v-else-if="profileLoading">
          <h2 class="ac-name">读取中…</h2>
        </template>
        <template v-else>
          <h2 class="ac-name">未登录云端账号</h2>
          <p class="ac-sub">回到首页登录后，可签到领取公益额度、提交公益渠道、同步云存档。</p>
        </template>
      </div>
      <button type="button" class="cc-btn" @click="showBoard = true">
        <Trophy :size="15" /><span>额度排行</span>
      </button>
      <button type="button" class="cc-btn" @click="router.push('/game/api-management')">
        <Plug :size="15" /><span>API 管理</span>
      </button>
    </section>

    <WalletCard :loginable="false" />

    <div v-if="wallet" class="ac-stats">
      <div><span>累计获得</span><b>{{ formatCredit(wallet.total_earned) }}</b></div>
      <div><span>累计消耗</span><b>{{ formatCredit(wallet.total_spent) }}</b></div>
      <div><span>公益贡献返还</span><b>{{ formatCredit(wallet.contributed, 4) }}</b></div>
      <div><span>连续签到</span><b>{{ wallet.streak }} 天</b></div>
    </div>

    <UsageLog />

    <div class="ac-cols">
      <section class="ac-card">
        <ChannelSubmit list-only />
        <button type="button" class="cc-btn small ac-more" @click="router.push('/game/api-management')">
          <Send :size="14" /><span>去提交公益渠道</span>
        </button>
      </section>
    </div>

    <LeaderboardModal v-if="showBoard" @close="showBoard = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Plug, Send, Trophy } from 'lucide-vue-next';
import { buildBackendUrl, isBackendConfigured } from '@/services/backendConfig';
import { formatCredit } from '@/services/builtinApi';
import { usePublicApi } from '@/composables/usePublicApi';
import WalletCard from '@/components/publicApi/WalletCard.vue';
import UsageLog from '@/components/publicApi/UsageLog.vue';
import ChannelSubmit from '@/components/publicApi/ChannelSubmit.vue';
import LeaderboardModal from '@/components/publicApi/LeaderboardModal.vue';

defineOptions({ name: 'AccountPage' });

type Profile = { id: number; user_name: string; created_at: string };

const router = useRouter();
const p = usePublicApi();
const wallet = computed(() => p.wallet.value);
const profile = ref<Profile | null>(null);
const profileLoading = ref(false);
const showBoard = ref(false);

const initial = computed(() => (profile.value?.user_name || '道').slice(0, 1));
const joined = computed(() => {
  if (!profile.value?.created_at) return '';
  const d = new Date(profile.value.created_at);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
});

/** 不走通用 request：那边 401 会跳登录页，把玩家踢出游戏 */
const loadProfile = async () => {
  const token = localStorage.getItem('access_token');
  if (!token || !isBackendConfigured()) return;
  profileLoading.value = true;
  try {
    const res = await fetch(buildBackendUrl('/api/v1/auth/me'), { headers: { Authorization: `Bearer ${token}` } });
    profile.value = res.ok ? await res.json() : null;
  } catch {
    profile.value = null;
  } finally {
    profileLoading.value = false;
  }
};

onMounted(() => {
  void loadProfile();
  void p.refresh();
});
</script>

<style scoped>
.account-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 0.5rem 0.25rem 1rem 0;
  color: var(--cc-text);
}

.ac-profile {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface);
}

.ac-avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 54px;
  height: 54px;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.5);
  border-radius: 50%;
  background: var(--cc-inset);
  font-family: var(--cc-calligraphy);
  font-size: 1.6rem;
  color: var(--cc-gold);
}

.ac-info {
  flex: 1;
  min-width: 0;
}

.ac-name {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: 0.08em;
}

.ac-sub {
  margin: 0.2rem 0 0;
  font-size: 0.82rem;
  color: var(--cc-text-3);
}

.ac-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.ac-stats div {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface);
}

.ac-stats span {
  font-size: 0.75rem;
  color: var(--cc-text-3);
}

.ac-stats b {
  font-size: 1.1rem;
  color: var(--cc-text);
  font-variant-numeric: tabular-nums;
}

.ac-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.ac-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.ac-more {
  align-self: flex-start;
}

@media (max-width: 900px) {
  .ac-cols {
    grid-template-columns: 1fr;
  }
  .ac-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
