<template>
  <transition name="dialog-fade">
    <div v-if="show" class="cc-modal-overlay confirm-overlay" @click="handleCancel">
      <div
        class="cc-modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        :aria-label="config?.title || $t('AI生成失败')"
        @click.stop
      >
        <div class="confirm-body">
          <div class="confirm-emblem" aria-hidden="true">
            <AlertTriangle :size="26" />
          </div>
          <h3 class="cc-modal-title confirm-title">{{ config?.title || $t('AI生成失败') }}</h3>
          <p class="confirm-message">{{ config?.message || $t('生成过程遇到问题') }}</p>
        </div>

        <div class="cc-modal-foot confirm-actions">
          <button type="button" class="cc-btn" @click="handleCancel">
            {{ config?.cancelText || $t('取消') }}
          </button>
          <button type="button" class="cc-btn primary" @click="handleConfirm">
            {{ config?.confirmText || $t('重试') }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle } from 'lucide-vue-next';
import { useUIStore } from '@/stores/uiStore';

const uiStore = useUIStore();

const show = computed(() => uiStore.showRetryDialogState);
const config = computed(() => uiStore.retryDialogConfig);

const handleConfirm = () => {
  uiStore.confirmRetry();
};

const handleCancel = () => {
  uiStore.cancelRetry();
};
</script>

<style scoped>
/* 外观见 styles/creation-theme.css 的 cc-modal，令牌见 styles/xian-tokens.css */
.confirm-overlay {
  z-index: 15000;
}

.confirm-dialog {
  width: min(420px, 100%);
}

.confirm-body {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1.75rem 1.5rem 1.25rem;
  text-align: center;
  overflow-y: auto;
}

/* 玉璧徽记 */
.confirm-emblem {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: 0.25rem;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(var(--cc-warning-rgb), 0.28) 0%, rgba(var(--cc-warning-rgb), 0.06) 75%);
  box-shadow: 0 0 0 1px rgba(var(--cc-gold-rgb), 0.55);
  color: var(--cc-warning);
}

.confirm-emblem::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.4);
  animation: ring-spin 18s linear infinite;
}

@keyframes ring-spin {
  to {
    transform: rotate(360deg);
  }
}

.confirm-title {
  font-size: 1.45rem;
}

.confirm-message {
  margin: 0;
  max-height: 40vh;
  overflow-y: auto;
  font-size: 0.9rem;
  line-height: 1.75;
  color: var(--cc-text-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.confirm-actions {
  justify-content: center;
}

.confirm-actions .cc-btn {
  min-width: 112px;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .confirm-emblem::before {
    animation: none;
  }
}
</style>
