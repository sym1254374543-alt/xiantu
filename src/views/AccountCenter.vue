<template>
  <div class="account-container">
    <VideoBackground />

    <div class="account-panel">
      <span class="frame-corner tl" aria-hidden="true"></span>
      <span class="frame-corner tr" aria-hidden="true"></span>
      <span class="frame-corner bl" aria-hidden="true"></span>
      <span class="frame-corner br" aria-hidden="true"></span>

      <header class="header">
        <div class="emblem" aria-hidden="true"><span>籍</span></div>
        <div class="title-block">
          <div class="title-row">
            <h2 class="title">账号中心</h2>
            <span class="status" :class="loggedIn ? 'ok' : 'warn'">
              {{ loggedIn ? '已登录' : '未登录' }}
            </span>
          </div>
          <p class="subtitle">道籍在册，集中管理账号信息</p>
        </div>
      </header>

      <div v-if="!backendReady" class="cc-state locked">
        <Lock :size="18" />
        <span>未配置后端服务器，账号中心不可用。</span>
      </div>

      <template v-else>
        <div v-if="loading" class="cc-state">
          <Loader2 :size="20" class="cc-spin" />
          <span>加载中…</span>
        </div>
        <div v-else class="sections">
          <details v-for="section in sections" :key="section.title" class="section" :open="section.open">
            <summary class="section-title">
              <ChevronRight :size="15" class="chevron" />
              <span>{{ section.title }}</span>
            </summary>
            <div class="section-body">
              <dl v-if="section.items.length" class="info-list">
                <div v-for="item in section.items" :key="item.label" class="info-row">
                  <dt>{{ item.label }}</dt>
                  <dd>{{ item.value }}</dd>
                </div>
              </dl>
              <div v-else class="info-empty">{{ section.emptyText || '暂无信息' }}</div>
            </div>
          </details>

          <details class="section" open>
            <summary class="section-title">
              <ChevronRight :size="15" class="chevron" />
              <span>公益额度</span>
            </summary>
            <div class="section-body quota-body">
              <WalletCard :loginable="false" />
              <button type="button" class="cc-btn small board-btn" @click="showBoard = true"><Trophy :size="14" /><span>查看额度排行</span></button>
              <LeaderboardModal v-if="showBoard" @close="showBoard = false" />
            </div>
          </details>
        </div>
      </template>

      <footer class="actions">
        <button type="button" class="cc-btn" @click="goBack">
          <ArrowLeft :size="15" />
          <span>返回</span>
        </button>
        <button v-if="backendReady" type="button" class="cc-btn logout-btn" @click="logout">
          <LogOut :size="15" />
          <span>退出登录</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import VideoBackground from '@/components/common/VideoBackground.vue';
import { ArrowLeft, ChevronRight, Loader2, Lock, LogOut, Trophy } from 'lucide-vue-next';
import { request } from '@/services/request';
import { isBackendConfigured } from '@/services/backendConfig';
import { usePublicApi } from '@/composables/usePublicApi';
import WalletCard from '@/components/publicApi/WalletCard.vue';
import LeaderboardModal from '@/components/publicApi/LeaderboardModal.vue';
import { toast } from '@/utils/toast';

type UserProfile = {
  id: number;
  user_name: string;
  created_at: string;
};

const router = useRouter();
const backendReady = ref(isBackendConfigured());
const loading = ref(false);
const profile = ref<UserProfile | null>(null);
const publicApi = usePublicApi();
const showBoard = ref(false);

const loggedIn = computed(() => !!profile.value);

const formatDate = (isoText: string) => {
  if (!isoText) return '-';
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return isoText;
  return date.toLocaleString();
};

const sections = computed(() => {
  const infoItems = profile.value
    ? [
        { label: '道号', value: profile.value.user_name },
        { label: '账号ID', value: String(profile.value.id) },
        { label: '注册时间', value: formatDate(profile.value.created_at) },
      ]
    : [];
  return [
    {
      title: '账号信息',
      open: true,
      items: infoItems,
      emptyText: '未获取到账号信息',
    },
  ];
});

const goBack = () => {
  router.push('/');
};

const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('username');
  profile.value = null;
  toast.info('已退出登录');
  router.push('/login');
};

onMounted(async () => {
  if (!backendReady.value) return;
  const token = localStorage.getItem('access_token');
  if (!token) {
    router.push('/login');
    return;
  }
  loading.value = true;
  try {
    profile.value = await request.get<UserProfile>('/api/v1/auth/me');
    await publicApi.refresh();
  } catch (_e) {
    profile.value = null;
    router.push('/login');
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* 账号中心 —— 令牌见 styles/xian-tokens.css */
.account-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100%;
  padding: 1.5rem;
  box-sizing: border-box;
  color: var(--cc-text);
}

.account-panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  width: min(620px, 100%);
  max-height: calc(var(--app-vh) * 0.88);
  padding: 1.75rem 1.75rem 1.4rem;
  box-sizing: border-box;
  background: var(--cc-shell-bg);
  border: 1px solid var(--cc-shell-border);
  border-radius: 6px;
  box-shadow: var(--cc-shell-shadow);
  backdrop-filter: blur(22px) saturate(1.1);
  -webkit-backdrop-filter: blur(22px) saturate(1.1);
}

.account-panel::before {
  content: '';
  position: absolute;
  inset: 9px;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.16);
  border-radius: 3px;
  pointer-events: none;
}

.frame-corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 0 solid var(--cc-gold);
  opacity: 0.85;
  pointer-events: none;
}

.frame-corner.tl { top: 5px; left: 5px; border-top-width: 2px; border-left-width: 2px; }
.frame-corner.tr { top: 5px; right: 5px; border-top-width: 2px; border-right-width: 2px; }
.frame-corner.bl { bottom: 5px; left: 5px; border-bottom-width: 2px; border-left-width: 2px; }
.frame-corner.br { bottom: 5px; right: 5px; border-bottom-width: 2px; border-right-width: 2px; }

.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--cc-divider);
}

.emblem {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(var(--cc-accent-rgb), 0.25) 0%, rgba(var(--cc-accent-rgb), 0.05) 75%);
  box-shadow: 0 0 0 1px rgba(var(--cc-gold-rgb), 0.5);
  font-family: var(--cc-calligraphy);
  font-size: 1.6rem;
  color: var(--cc-accent);
}

.emblem::before {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.4);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.title {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 1.8rem;
  font-weight: 400;
  letter-spacing: 0.15em;
}

.status {
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
}

.status.ok {
  background: rgba(110, 231, 183, 0.14);
  color: var(--cc-success);
}

.status.warn {
  background: rgba(var(--cc-warning-rgb), 0.15);
  color: var(--cc-warning);
}

.subtitle {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  color: var(--cc-text-3);
}

.cc-state {
  gap: 0.6rem;
  min-height: 160px;
}

.cc-state.locked {
  color: var(--cc-warning);
}

.sections {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.section {
  flex-shrink: 0;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface);
  overflow: hidden;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.48rem 0.9rem;
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  cursor: pointer;
  list-style: none;
}

.section-title::-webkit-details-marker {
  display: none;
}

.section-title:hover {
  background: var(--cc-surface-hover);
}

.chevron {
  color: var(--cc-gold);
  transition: transform 0.2s ease;
}

.section[open] .chevron {
  transform: rotate(90deg);
}

.section-body {
  padding: 0.1rem 0.9rem 0.35rem;
  border-top: 1px solid var(--cc-divider);
}

.info-list {
  margin: 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.32rem 0;
  border-bottom: 1px dashed var(--cc-divider);
  font-size: 0.85rem;
}

.info-row dt {
  color: var(--cc-text-3);
  letter-spacing: 0.08em;
}

.info-row dd {
  margin: 0;
  text-align: right;
  word-break: break-all;
  color: var(--cc-text);
}

.info-empty {
  padding: 0.6rem 0;
  font-size: 0.82rem;
  color: var(--cc-text-3);
}

.board-btn {
  align-self: flex-start;
}

.quota-body {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding-top: 0.5rem;
}

.actions {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--cc-divider);
}

.logout-btn:hover {
  color: var(--cc-danger);
  border-color: rgba(var(--cc-danger-rgb), 0.55) !important;
}

@media (max-width: 480px) {
  .account-container {
    padding: 0;
  }

  .account-panel {
    max-height: none;
    min-height: var(--app-vh);
    border-radius: 0;
  }

  .frame-corner {
    display: none;
  }
}
</style>
