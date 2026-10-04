<!-- src/views/ModeSelection.vue -->
<template>
  <div class="mode-selection-container">
    <VideoBackground />

    <!-- 灵气微光 -->
    <div class="spirit-motes" aria-hidden="true">
      <span v-for="(m, i) in motes" :key="i" :style="m"></span>
    </div>

    <main class="selection-content">
      <span class="frame-corner tl" aria-hidden="true"></span>
      <span class="frame-corner tr" aria-hidden="true"></span>
      <span class="frame-corner bl" aria-hidden="true"></span>
      <span class="frame-corner br" aria-hidden="true"></span>

      <!-- 右上角信息 -->
      <div class="top-info">
        <div v-if="backendReady" class="status-indicator online">
          <span class="status-dot"></span>
          <span>{{ $t('已连接') }}</span>
        </div>
        <div v-if="displayVersion" class="version-tag">V{{ displayVersion }}</div>
        <button
          type="button"
          class="theme-switch"
          :title="isDark ? $t('切换亮色') : $t('切换暗色')"
          :aria-label="isDark ? $t('切换亮色') : $t('切换暗色')"
          @click="toggleTheme"
        >
          <component :is="isDark ? Sun : Moon" :size="15" />
        </button>
      </div>

      <!-- 标题区域 -->
      <header class="header-section">
        <div class="title-row">
          <h1 class="main-title">
            <span class="title-xian">{{ $t('仙') }}</span>
            <span class="title-tu">{{ $t('途') }}</span>
          </h1>
          <span class="title-seal" aria-hidden="true">
            <span>大</span><span>朝</span><span>道</span><span>天</span>
          </span>
        </div>
        <p class="sub-title">{{ $t('山河无主皆可渡，此心有路即朝天') }}</p>
      </header>

      <!-- 道途选择 -->
      <section class="paths-section">
        <div class="section-header">
          <span class="line"></span>
          <span class="gem" aria-hidden="true"></span>
          <span class="text">{{ $t('择一道途') }}</span>
          <span class="gem" aria-hidden="true"></span>
          <span class="line"></span>
        </div>

        <div class="gate-container" role="radiogroup" :aria-label="$t('择一道途')">
          <!-- 单机模式 -->
          <div
            class="gate-card"
            role="radio"
            tabindex="0"
            :aria-checked="selectedMode === 'single'"
            :class="{ selected: selectedMode === 'single' }"
            @click="selectPath('single')"
            @keydown.enter.prevent="selectPath('single')"
            @keydown.space.prevent="selectPath('single')"
          >
            <div class="gate-icon" aria-hidden="true">
              <img class="gate-icon-image" :src="singleModeIcon" alt="" draggable="false" />
            </div>
            <div class="gate-info">
              <h2 class="gate-title">{{ $t('独自修行') }}</h2>
              <p class="gate-desc">{{ $t('避世清修 · 心无旁骛') }}</p>
              <p class="gate-detail">{{ $t('独居洞府，专心修炼，所有进度本地存储') }}</p>
              <div class="gate-tags">
                <span class="tag tag-amber">{{ $t('本地存储') }}</span>
                <span class="tag tag-teal">{{ $t('离线可用') }}</span>
              </div>
            </div>
            <span class="check-mark" aria-hidden="true">
              <Check :size="14" :stroke-width="3" />
            </span>
          </div>

          <!-- 联机模式 -->
          <div
            class="gate-card"
            role="radio"
            :tabindex="backendReady ? 0 : -1"
            :aria-checked="selectedMode === 'cloud'"
            :aria-disabled="!backendReady"
            :class="{ selected: selectedMode === 'cloud', disabled: !backendReady }"
            @click="selectPath('cloud')"
            @keydown.enter.prevent="selectPath('cloud')"
            @keydown.space.prevent="selectPath('cloud')"
          >
            <div class="gate-icon" aria-hidden="true">
              <img class="gate-icon-image" :src="cloudModeIcon" alt="" draggable="false" />
            </div>
            <div class="gate-info">
              <h2 class="gate-title">{{ $t('云端修行') }}</h2>
              <p class="gate-desc">{{ backendReady ? $t('云端存档 · 多端同步') : $t('仙门未启 · 暂不可入') }}</p>
              <p class="gate-detail">{{ $t('云端存档，多端同步，换设备也能继续修行') }}</p>
              <div class="gate-tags">
                <span class="tag tag-blue">{{ $t('云端同步') }}</span>
                <span class="tag tag-green">{{ $t('数据安全') }}</span>
              </div>
            </div>
            <span v-if="backendReady" class="check-mark" aria-hidden="true">
              <Check :size="14" :stroke-width="3" />
            </span>
            <span v-else class="lock-chip">
              <Lock :size="12" />
              {{ $t('未启用') }}
            </span>
          </div>
        </div>
      </section>

      <!-- 操作按钮 -->
      <div class="actions-section">
        <div class="action-group">
          <button type="button" class="btn-primary" :disabled="!selectedMode" @click="startNewGame">
            <Sparkles :size="18" />
            <span>{{ $t('初入仙途') }}</span>
          </button>
          <button type="button" class="btn-secondary" @click="enterCharacterSelection">
            <History :size="18" />
            <span>{{ $t('续前世因缘') }}</span>
          </button>
        </div>
        <p class="action-hint" :class="{ hidden: !!selectedMode }">{{ $t('择定道途后，即可初入仙途') }}</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '@/i18n';
import VideoBackground from '@/components/common/VideoBackground.vue';
import { Sparkles, History, Check, Lock, Sun, Moon } from 'lucide-vue-next';
import { useTheme } from '@/composables/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { isBackendConfigured, fetchBackendVersion } from '@/services/backendConfig';
import { verifyStoredToken } from '@/services/request';
import singleModeIcon from '@/assets/mode-icons/single.png';
import cloudModeIcon from '@/assets/mode-icons/cloud.png';

// 单机模式是无需配置即可进入的默认道路，首页打开后按钮应当可用。
const selectedMode = ref<'single' | 'cloud' | null>('single');
const backendReady = ref(false);

const { t } = useI18n();
const { isDark, toggleTheme } = useTheme();

// 灵气微光：固定伪随机分布，避免每次渲染跳动
const motes = Array.from({ length: 16 }, (_, i) => {
  const r = (seed: number) => {
    const x = Math.sin((i + 1) * seed) * 10000;
    return x - Math.floor(x);
  };
  return {
    left: `${(r(12.9898) * 100).toFixed(2)}%`,
    '--size': `${(2 + r(78.233) * 3).toFixed(1)}px`,
    '--drift': `${((r(37.719) - 0.5) * 80).toFixed(0)}px`,
    animationDuration: `${(14 + r(4.1414) * 14).toFixed(1)}s`,
    animationDelay: `${(-r(93.989) * 28).toFixed(1)}s`,
  };
});

const displayVersion = '5.0';

onMounted(async () => {
  // 真正检测后端连接状态，而不是只检查配置
  if (isBackendConfigured()) {
    const version = await fetchBackendVersion();
    if (version) {
      backendReady.value = true;
    }
  }
});

const emit = defineEmits<{
  (e: 'start-creation', mode: 'single' | 'cloud'): void;
  (e: 'show-character-list'): void;
  (e: 'go-to-login'): void;
}>();

const uiStore = useUIStore();

// 检查是否已登录
const _isLoggedIn = () => {
  const token = localStorage.getItem('access_token');
  return !!token;
};

const selectPath = async (mode: 'single' | 'cloud') => {
  if (mode === 'cloud' && !backendReady.value) {
    uiStore.showRetryDialog({
      title: t('联机未启用'),
      message: t('未配置后端服务器，无法使用云端修行与登录功能。请先选择"单机闯关"。'),
      confirmText: t('知道了'),
      cancelText: t('取消'),
      onConfirm: () => {},
      onCancel: () => {}
    });
    return;
  }

  // 联机模式：验证 token 有效性
  if (mode === 'cloud') {
    const token = localStorage.getItem('access_token');
    if (token) {
      const isValid = await verifyStoredToken();
      if (!isValid) {
        // token 无效，清除并提示重新登录
        localStorage.removeItem('access_token');
        localStorage.removeItem('username');
        console.log('[ModeSelection] Token 无效，已清除');
      }
    }
  }

  if (selectedMode.value === mode) {
    selectedMode.value = null;
  } else {
    selectedMode.value = mode;
  }
};

const startNewGame = async () => {
  if (!selectedMode.value) return;

  // 联机模式需要先登录并验证 token 有效性
  if (selectedMode.value === 'cloud') {
    const isValid = await verifyStoredToken();
    if (!isValid) {
      uiStore.showRetryDialog({
        title: t('请先登录'),
        message: t('云端修行需要先登录账号，是否前往登录？'),
        confirmText: t('前往登录'),
        cancelText: t('取消'),
        onConfirm: () => {
          emit('go-to-login');
        },
        onCancel: () => {}
      });
      return;
    }
  }

  emit('start-creation', selectedMode.value);
};

const enterCharacterSelection = async () => {
  emit('show-character-list');
};
</script>


<style scoped>
/* ============================================================
   首页 —— 双主题令牌
   暗色「夜山松烟」：玄青底 · 鎏金纹 · 靛紫灵光
   亮色「宣纸淡墨」：米黄纸 · 墨色字 · 朱砂印
   ============================================================ */
.mode-selection-container {
  --ms-calligraphy: 'Ma Shan Zheng', 'STXingkai', '华文行楷', 'KaiTi', 'STKaiti', '楷体', var(--font-family-serif);
  --ms-panel-bg:
    radial-gradient(ellipse 70% 45% at 50% 0%, rgba(120, 140, 255, 0.1) 0%, transparent 70%),
    linear-gradient(170deg, rgba(12, 18, 33, 0.8) 0%, rgba(20, 28, 46, 0.74) 100%);
  --ms-panel-border: rgba(212, 184, 120, 0.22);
  --ms-panel-shadow: 0 32px 64px -24px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  --ms-text: #eef0f5;
  --ms-text-2: #a9b2c3;
  --ms-text-3: #7b8699;
  --ms-accent: #9db8ff;
  --ms-accent-rgb: 157, 184, 255;
  --ms-gold: #d4b878;
  --ms-gold-rgb: 212, 184, 120;
  --ms-seal: #c0392b;
  --ms-seal-text: #fbe9dc;
  --ms-title-gradient: linear-gradient(170deg, #d0fff0 0%, #73d6c7 45%, #78a8ee 100%);
  --ms-title-tu: #eef0f5;
  --ms-line: rgba(212, 184, 120, 0.45);
  --ms-card-bg: linear-gradient(160deg, rgba(255, 255, 255, 0.045) 0%, rgba(255, 255, 255, 0.015) 100%);
  --ms-card-bg-hover: linear-gradient(160deg, rgba(255, 255, 255, 0.075) 0%, rgba(255, 255, 255, 0.03) 100%);
  --ms-card-border: rgba(212, 184, 120, 0.14);
  --ms-card-border-hover: rgba(212, 184, 120, 0.34);
  --ms-card-shadow: 0 8px 28px -10px rgba(0, 0, 0, 0.55);
  --ms-selected-bg:
    radial-gradient(ellipse at 20% 50%, rgba(120, 150, 255, 0.18) 0%, transparent 70%),
    linear-gradient(160deg, rgba(90, 120, 230, 0.12) 0%, rgba(255, 255, 255, 0.02) 100%);
  --ms-selected-border: rgba(212, 184, 120, 0.7);
  --ms-selected-glow: 0 0 28px -4px rgba(157, 184, 255, 0.35);
  --ms-glyph-bg: radial-gradient(circle at 35% 30%, rgba(157, 184, 255, 0.22) 0%, rgba(40, 52, 90, 0.35) 70%);
  --ms-glyph-ring: rgba(212, 184, 120, 0.45);
  --ms-glyph-color: #dfe7ff;
  --ms-btn-primary-bg: linear-gradient(135deg, #3d6be0 0%, #5a4fd0 100%);
  --ms-btn-primary-border: rgba(230, 206, 150, 0.55);
  --ms-btn-primary-shadow: 0 10px 24px -8px rgba(90, 100, 230, 0.7);
  --ms-btn-secondary-bg: rgba(255, 255, 255, 0.04);
  --ms-btn-secondary-bg-hover: rgba(255, 255, 255, 0.09);
  --ms-btn-secondary-border: rgba(212, 184, 120, 0.28);
  --ms-chip-bg: rgba(255, 255, 255, 0.05);
  --ms-chip-border: rgba(148, 163, 184, 0.22);
  --ms-focus: rgba(212, 184, 120, 0.6);
  --ms-mote: rgba(190, 210, 255, 0.9);
  --ms-mote-glow: rgba(140, 170, 255, 0.8);

  --tag-amber: #f2c46b;
  --tag-amber-bg: rgba(242, 196, 107, 0.1);
  --tag-teal: #5eead4;
  --tag-teal-bg: rgba(45, 212, 191, 0.09);
  --tag-blue: #93b8ff;
  --tag-blue-bg: rgba(96, 165, 250, 0.1);
  --tag-green: #86efac;
  --tag-green-bg: rgba(74, 222, 128, 0.09);
  --status-online: #4ade80;
  --status-offline: #fca5a5;
  --version: #7fe3f2;

  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: safe center;
  justify-content: safe center;
  padding: 2rem;
  padding-top: calc(2rem + env(safe-area-inset-top));
  padding-bottom: calc(2rem + env(safe-area-inset-bottom));
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  color: var(--ms-text);
}

/* 亮色直接取全局 --cc-* 令牌（styles/xian-tokens.css），与创角页、局内保持一致 */
[data-theme='light'] .mode-selection-container {
  --ms-panel-bg: var(--cc-shell-bg);
  --ms-panel-border: var(--cc-shell-border);
  --ms-panel-shadow: var(--cc-shell-shadow);
  --ms-text: var(--cc-text);
  --ms-text-2: var(--cc-text-2);
  --ms-text-3: var(--cc-text-3);
  --ms-accent: var(--cc-accent);
  --ms-accent-rgb: var(--cc-accent-rgb);
  --ms-gold: var(--cc-gold);
  --ms-gold-rgb: var(--cc-gold-rgb);
  --ms-seal: var(--cc-seal);
  --ms-seal-text: var(--cc-seal-text);
  --ms-title-gradient: linear-gradient(170deg, #1d696d 0%, #2f9d93 55%, #3f7f96 100%);
  --ms-title-tu: #1b2a2f;
  --ms-line: rgba(var(--cc-gold-rgb), 0.45);
  --ms-card-bg: var(--cc-surface);
  --ms-card-bg-hover: var(--cc-surface-hover);
  --ms-card-border: var(--cc-border);
  --ms-card-border-hover: var(--cc-border-strong);
  --ms-card-shadow: 0 8px 22px -12px rgba(34, 58, 62, 0.22);
  --ms-selected-bg: var(--cc-selected-bg);
  --ms-selected-border: rgba(var(--cc-gold-rgb), 0.6);
  --ms-selected-glow: var(--cc-glow);
  --ms-glyph-bg: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.96) 0%, rgba(223, 233, 229, 0.92) 75%);
  --ms-glyph-ring: rgba(var(--cc-gold-rgb), 0.45);
  --ms-glyph-color: var(--cc-accent);
  --ms-btn-primary-bg: var(--cc-primary-bg);
  --ms-btn-primary-border: var(--cc-primary-border);
  --ms-btn-primary-shadow: var(--cc-primary-shadow);
  --ms-btn-secondary-bg: var(--cc-surface-2);
  --ms-btn-secondary-bg-hover: var(--cc-surface-hover);
  --ms-btn-secondary-border: var(--cc-border-strong);
  --ms-chip-bg: var(--cc-surface-2);
  --ms-chip-border: var(--cc-border);
  --ms-focus: rgba(var(--cc-accent-rgb), 0.4);
  --ms-mote: rgba(240, 250, 246, 0.95);
  --ms-mote-glow: rgba(95, 157, 151, 0.6);

  --tag-amber: #92560a;
  --tag-amber-bg: rgba(217, 119, 6, 0.1);
  --tag-teal: #0f6f68;
  --tag-teal-bg: rgba(13, 148, 136, 0.09);
  --tag-blue: #1e429f;
  --tag-blue-bg: rgba(37, 99, 235, 0.08);
  --tag-green: #166534;
  --tag-green-bg: rgba(22, 163, 74, 0.09);
  --status-online: #15803d;
  --status-offline: #b91c1c;
  --version: #0e6a80;
}

/* ---------- 灵气微光 ---------- */
.spirit-motes {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.spirit-motes span {
  position: absolute;
  bottom: -12px;
  width: var(--size, 3px);
  height: var(--size, 3px);
  border-radius: 50%;
  background: var(--ms-mote);
  box-shadow: 0 0 8px 2px var(--ms-mote-glow);
  opacity: 0;
  animation-name: mote-rise;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes mote-rise {
  0% {
    transform: translate3d(0, 0, 0);
    opacity: 0;
  }
  12% {
    opacity: 0.85;
  }
  70% {
    opacity: 0.6;
  }
  100% {
    transform: translate3d(var(--drift, 0), -105vh, 0);
    opacity: 0;
  }
}

/* ---------- 主面板 ---------- */
.selection-content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 840px;
  max-height: none;
  overflow: visible;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2.25rem;
  padding: 3.25rem 3.5rem 2.5rem;
  box-sizing: border-box;
  background: var(--ms-panel-bg);
  border: 1px solid var(--ms-panel-border);
  border-radius: 6px;
  box-shadow: var(--ms-panel-shadow);
  backdrop-filter: blur(22px) saturate(1.1);
  -webkit-backdrop-filter: blur(22px) saturate(1.1);
  animation: panel-in 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  transition: background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease;
}

/* 古籍内框 */
.selection-content::before {
  content: '';
  position: absolute;
  inset: 10px;
  border: 1px solid rgba(var(--ms-gold-rgb), 0.18);
  border-radius: 3px;
  pointer-events: none;
}

/* 四角回纹 */
.frame-corner {
  position: absolute;
  width: 34px;
  height: 34px;
  pointer-events: none;
  border-color: var(--ms-gold);
  border-style: solid;
  border-width: 0;
  opacity: 0.85;
}

.frame-corner::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  border: inherit;
  border-color: var(--ms-gold);
  opacity: 0.7;
}

.frame-corner.tl { top: 6px; left: 6px; border-top-width: 2px; border-left-width: 2px; }
.frame-corner.tr { top: 6px; right: 6px; border-top-width: 2px; border-right-width: 2px; }
.frame-corner.bl { bottom: 6px; left: 6px; border-bottom-width: 2px; border-left-width: 2px; }
.frame-corner.br { bottom: 6px; right: 6px; border-bottom-width: 2px; border-right-width: 2px; }

.frame-corner.tl::after { top: 7px; left: 7px; border-width: 1px 0 0 1px; }
.frame-corner.tr::after { top: 7px; right: 7px; border-width: 1px 1px 0 0; }
.frame-corner.bl::after { bottom: 7px; left: 7px; border-width: 0 0 1px 1px; }
.frame-corner.br::after { bottom: 7px; right: 7px; border-width: 0 1px 1px 0; }

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(14px);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}

/* ---------- 右上角信息 ---------- */
.top-info {
  position: absolute;
  top: 1.5rem;
  right: 1.75rem;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-indicator,
.version-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 26px;
  padding: 0 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: var(--ms-chip-bg);
  border: 1px solid var(--ms-chip-border);
  box-sizing: border-box;
}

.status-indicator.online { color: var(--status-online); }
.status-indicator.offline { color: var(--status-offline); }

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-indicator.online .status-dot {
  animation: dot-pulse 2.4s ease-in-out infinite;
}

@keyframes dot-pulse {
  50% { opacity: 0.4; }
}

.version-tag {
  color: var(--version);
  font-variant-numeric: tabular-nums;
}

.theme-switch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 999px;
  background: var(--ms-chip-bg);
  border: 1px solid var(--ms-chip-border);
  color: var(--ms-text-2);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, transform 0.4s ease;
}

.theme-switch:hover {
  color: var(--ms-gold);
  border-color: var(--ms-selected-border);
  transform: rotate(30deg);
}

/* ---------- 标题 ---------- */
.header-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  text-align: center;
}

.title-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.main-title {
  display: flex;
  align-items: center;
  gap: 0.45em;
  margin: 0;
  font-family: var(--ms-calligraphy);
  font-size: 4.75rem;
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0;
  text-shadow: none;
  color: var(--ms-title-tu);
}

.title-xian {
  background: var(--ms-title-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

[data-theme='dark'] .title-xian {
  animation: glow-pulse 4s ease-in-out infinite;
}

[data-theme='dark'] .title-tu {
  text-shadow: 0 0 24px rgba(180, 200, 255, 0.25);
}

@keyframes glow-pulse {
  0%, 100% {
    filter: drop-shadow(0 0 8px rgba(92, 218, 193, 0.52)) drop-shadow(0 0 18px rgba(78, 151, 224, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 14px rgba(92, 218, 193, 0.78)) drop-shadow(0 0 26px rgba(78, 151, 224, 0.46));
  }
}

/* 朱砂印：大道朝天 */
.title-seal {
  position: absolute;
  left: 100%;
  bottom: 0.35rem;
  margin-left: 0.9rem;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-flow: column;
  grid-template-rows: repeat(2, 1fr);
  width: 38px;
  height: 38px;
  padding: 3px;
  box-sizing: border-box;
  background: var(--ms-seal);
  color: var(--ms-seal-text);
  border-radius: 4px;
  font-family: var(--ms-calligraphy);
  font-size: 13px;
  line-height: 1;
  transform: rotate(-4deg);
  box-shadow: inset 0 0 0 1.5px rgba(255, 240, 230, 0.55), 0 2px 6px rgba(120, 20, 10, 0.3);
  opacity: 0.92;
}

.title-seal span {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 竖排从右往左：大道 在右列，朝天 在左列 */
.title-seal span:nth-child(1) { grid-column: 2; grid-row: 1; }
.title-seal span:nth-child(3) { grid-column: 2; grid-row: 2; }
.title-seal span:nth-child(2) { grid-column: 1; grid-row: 1; }
.title-seal span:nth-child(4) { grid-column: 1; grid-row: 2; }

.sub-title {
  margin: 0;
  font-family: var(--font-family-serif);
  font-size: 1.05rem;
  color: var(--ms-text-2);
  letter-spacing: 0.25em;
}

/* ---------- 道途选择 ---------- */
.paths-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.section-header .line {
  width: 80px;
  height: 1px;
}

.section-header .line:first-child {
  background: linear-gradient(90deg, transparent, var(--ms-line));
}

.section-header .line:last-child {
  background: linear-gradient(90deg, var(--ms-line), transparent);
}

.section-header .gem {
  width: 5px;
  height: 5px;
  background: var(--ms-gold);
  transform: rotate(45deg);
  opacity: 0.85;
}

.section-header .text {
  font-family: var(--font-family-serif);
  font-size: 0.95rem;
  color: var(--ms-text-2);
  letter-spacing: 0.4em;
  margin-right: -0.4em;
}

.gate-container {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}

.gate-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  min-height: 132px;
  padding: 1.5rem;
  background: var(--ms-card-bg);
  border: 1px solid var(--ms-card-border);
  border-radius: 10px;
  box-shadow: var(--ms-card-shadow);
  cursor: pointer;
  outline: none;
  overflow: hidden;
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease,
    transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* 云纹水印 */
.gate-card::after {
  content: '';
  position: absolute;
  right: -18px;
  bottom: -22px;
  width: 130px;
  height: 80px;
  opacity: 0.07;
  pointer-events: none;
  background-color: var(--ms-text);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 130 80' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M10 60c0-14 12-24 26-20 2-14 18-22 30-14 8-10 26-8 30 6 14-2 24 10 20 22'/%3E%3Cpath d='M36 58c0-8 8-12 14-8M66 44c6-4 14 0 14 6'/%3E%3Cpath d='M4 72h120'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 130 80' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M10 60c0-14 12-24 26-20 2-14 18-22 30-14 8-10 26-8 30 6 14-2 24 10 20 22'/%3E%3Cpath d='M36 58c0-8 8-12 14-8M66 44c6-4 14 0 14 6'/%3E%3Cpath d='M4 72h120'/%3E%3C/svg%3E") center / contain no-repeat;
  transition: opacity 0.3s ease, transform 0.5s ease;
}

.gate-card:hover {
  background: var(--ms-card-bg-hover);
  border-color: var(--ms-card-border-hover);
  transform: translateY(-3px);
}

.gate-card:hover::after {
  opacity: 0.12;
  transform: translateX(-6px);
}

.gate-card:focus-visible {
  box-shadow: var(--ms-card-shadow), 0 0 0 3px var(--ms-focus);
}

.gate-card.selected {
  background: var(--ms-selected-bg);
  border-color: var(--ms-selected-border);
  box-shadow: var(--ms-card-shadow), var(--ms-selected-glow), 0 0 0 1px var(--ms-selected-border) inset;
}

.gate-card.disabled {
  cursor: not-allowed;
}

.gate-card.disabled > .gate-icon,
.gate-card.disabled > .gate-info {
  opacity: 0.62;
  filter: grayscale(0.45);
}

.gate-card.disabled:hover {
  transform: none;
  background: var(--ms-card-bg);
  border-color: var(--ms-card-border);
}

/* 玉璧符印 */
.gate-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: var(--ms-glyph-bg);
  box-shadow: 0 0 0 1px var(--ms-glyph-ring), inset 0 1px 6px rgba(255, 255, 255, 0.12);
  transition: transform 0.4s ease, box-shadow 0.3s ease;
}

.gate-icon::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1px dashed rgba(var(--ms-gold-rgb), 0.4);
  transition: transform 0.8s ease;
}

.gate-icon-image {
  display: block;
  width: 60px;
  height: 60px;
  object-fit: contain;
  filter: drop-shadow(0 2px 3px rgba(8, 14, 28, 0.38));
  transition: transform 0.3s ease, filter 0.3s ease;
}

.gate-card:not(.disabled):hover .gate-icon-image,
.gate-card.selected .gate-icon-image {
  transform: scale(1.08);
  filter: drop-shadow(0 3px 5px rgba(var(--ms-accent-rgb), 0.46));
}

.gate-card:not(.disabled):hover .gate-icon::before,
.gate-card.selected .gate-icon::before {
  transform: rotate(90deg);
}

.gate-card.selected .gate-icon {
  box-shadow: 0 0 0 1px var(--ms-selected-border), 0 0 18px -2px rgba(var(--ms-accent-rgb), 0.45);
}

.gate-info {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
}

.gate-title {
  margin: 0 0 0.3rem;
  font-family: var(--font-family-serif);
  font-size: 1.3rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: var(--ms-text);
}

.gate-desc {
  margin: 0 0 0.35rem;
  font-size: 0.88rem;
  color: var(--ms-text-2);
  letter-spacing: 0.05em;
}

.gate-detail {
  margin: 0 0 0.75rem;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--ms-text-3);
}

.gate-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  font-size: 0.72rem;
  padding: 0.18rem 0.55rem;
  border-radius: 3px;
  border: 1px solid color-mix(in srgb, currentColor 32%, transparent);
  white-space: nowrap;
  letter-spacing: 0.05em;
}

.tag-amber { color: var(--tag-amber); background: var(--tag-amber-bg); }
.tag-teal { color: var(--tag-teal); background: var(--tag-teal-bg); }
.tag-blue { color: var(--tag-blue); background: var(--tag-blue-bg); }
.tag-green { color: var(--tag-green); background: var(--tag-green-bg); }

.check-mark {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: var(--ms-seal-text);
  background: var(--ms-seal);
  opacity: 0;
  transform: scale(0.5) rotate(-30deg);
  transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.3, 1.6, 0.5, 1);
}

.gate-card.selected .check-mark {
  opacity: 1;
  transform: scale(1) rotate(0);
}

.lock-chip {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  color: var(--ms-text-2);
  background: var(--ms-chip-bg);
  border: 1px solid var(--ms-chip-border);
}

/* ---------- 操作按钮 ---------- */
.actions-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.action-group {
  display: flex;
  gap: 1rem;
}

.action-group button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  min-width: 176px;
  padding: 0.85rem 1.75rem;
  border-radius: 6px;
  font-family: var(--font-family-serif);
  font-size: 1.02rem;
  letter-spacing: 0.18em;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.25s ease;
}

.btn-primary {
  color: #fff;
  background: var(--ms-btn-primary-bg);
  border: 1px solid var(--ms-btn-primary-border);
  box-shadow: var(--ms-btn-primary-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* 流光 */
.btn-primary::after {
  content: '';
  position: absolute;
  top: 0;
  left: -60%;
  width: 40%;
  height: 100%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.28), transparent);
  transform: skewX(-20deg);
  animation: sheen 4.5s ease-in-out infinite;
}

@keyframes sheen {
  0%, 60% { left: -60%; }
  100% { left: 130%; }
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.1);
}

.btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.4;
  box-shadow: none;
  filter: grayscale(0.5);
}

.btn-primary:disabled::after {
  display: none;
}

.btn-secondary {
  color: var(--ms-text);
  background: var(--ms-btn-secondary-bg);
  border: 1px solid var(--ms-btn-secondary-border);
}

.btn-secondary:hover {
  background: var(--ms-btn-secondary-bg-hover);
  border-color: var(--ms-card-border-hover);
}

.action-group button:focus-visible,
.theme-switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--ms-focus);
}

.action-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--ms-text-3);
  letter-spacing: 0.12em;
  transition: opacity 0.25s ease;
}

.action-hint.hidden {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .selection-content,
  .title-xian,
  .status-dot,
  .btn-primary::after {
    animation: none !important;
  }

  .spirit-motes {
    display: none;
  }
}

/* ---------- 响应式 ---------- */
@media (max-width: 768px) {
  .mode-selection-container {
    align-items: flex-start;
    padding: 0.75rem;
    padding-top: calc(0.75rem + env(safe-area-inset-top));
    padding-left: calc(0.75rem + env(safe-area-inset-left));
    padding-right: calc(0.75rem + env(safe-area-inset-right));
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
  }

  .selection-content {
    gap: 1.5rem;
    padding: 1.5rem 1.1rem 1.4rem;
  }

  .frame-corner {
    width: 22px;
    height: 22px;
  }

  .frame-corner::after {
    display: none;
  }

  .top-info {
    position: static;
    justify-content: center;
  }

  .main-title {
    font-size: 3.25rem;
  }

  .title-seal {
    width: 30px;
    height: 30px;
    font-size: 10px;
    margin-left: 0.6rem;
  }

  .sub-title {
    font-size: 0.85rem;
    letter-spacing: 0.1em;
  }

  .gate-container {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .gate-card {
    min-height: 0;
    padding: 1rem;
    gap: 1rem;
  }

  .gate-icon {
    width: 50px;
    height: 50px;
  }

  .gate-icon-image {
    width: 44px;
    height: 44px;
  }

  .gate-title {
    font-size: 1.1rem;
  }

  .gate-desc {
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
  }

  .gate-detail {
    display: none;
  }

  .lock-chip {
    top: 0.5rem;
    right: 0.5rem;
  }

  .section-header .line {
    width: 36px;
  }

  .action-group {
    flex-direction: column;
    width: 100%;
    gap: 0.6rem;
  }

  .action-group button {
    width: 100%;
    min-width: 0;
    padding: 0.75rem 1rem;
    font-size: 0.95rem;
  }
}

@media (max-width: 480px) {
  .main-title {
    font-size: 2.9rem;
  }

  .gate-tags .tag {
    font-size: 0.66rem;
  }
}
</style>
