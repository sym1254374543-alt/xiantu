<template>
  <div class="toast-container" role="region" aria-label="通知">
    <transition-group name="toast-fade" tag="div" class="toast-stack">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast-${toast.type}`]"
        :role="toast.type === 'error' ? 'alert' : 'status'"
        @click="toast.type !== 'loading' && dismiss(toast.id)"
      >
        <span class="toast-icon" aria-hidden="true">
          <Loader2 v-if="toast.type === 'loading'" :size="18" class="spin" />
          <CheckCircle2 v-else-if="toast.type === 'success'" :size="18" />
          <XCircle v-else-if="toast.type === 'error'" :size="18" />
          <TriangleAlert v-else-if="toast.type === 'warning'" :size="18" />
          <Info v-else :size="18" />
        </span>
        <div class="toast-message" v-html="toast.message"></div>
        <span
          v-if="toast.duration"
          class="toast-timer"
          :style="{ animationDuration: `${toast.duration}ms` }"
          aria-hidden="true"
        ></span>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { CheckCircle2, Info, Loader2, TriangleAlert, XCircle } from 'lucide-vue-next';
import { toast as toastApi, toastsReadonly as toasts } from '@/utils/toast';

const dismiss = (id: string | number) => toastApi.hide(id);
</script>

<style scoped>
/* 颜色令牌见 styles/xian-tokens.css */
.toast-container {
  position: fixed;
  top: 18px;
  left: 50%;
  z-index: 20000; /* 高于加载遮罩(10000) */
  transform: translateX(-50%);
  pointer-events: none;
}

.toast-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.toast {
  --tone: var(--cc-accent);
  --tone-rgb: var(--cc-accent-rgb);
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 260px;
  max-width: min(460px, calc(100vw - 32px));
  padding: 0.75rem 1.1rem 0.75rem 0.95rem;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--cc-shell-border);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(var(--tone-rgb), 0.14) 0%, transparent 45%),
    var(--cc-shell-bg);
  color: var(--cc-text);
  box-shadow: 0 16px 36px -14px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  pointer-events: auto;
  cursor: pointer;
}

.toast::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--tone);
}

.toast-loading {
  cursor: default;
}

.toast-success { --tone: var(--cc-success); --tone-rgb: 110, 231, 183; }
.toast-error { --tone: var(--cc-danger); --tone-rgb: var(--cc-danger-rgb); }
.toast-warning { --tone: var(--cc-warning); --tone-rgb: var(--cc-warning-rgb); }
.toast-info,
.toast-loading { --tone: var(--cc-accent); --tone-rgb: var(--cc-accent-rgb); }

[data-theme='light'] .toast-success { --tone-rgb: 21, 128, 61; }

[data-theme='light'] .toast {
  box-shadow: 0 16px 32px -16px rgba(60, 40, 10, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.6) inset;
}

.toast-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--tone);
}

.spin {
  animation: spin 1s linear infinite;
}

.toast-message {
  font-size: 0.92rem;
  line-height: 1.5;
  letter-spacing: 0.04em;
  word-break: break-word;
}

/* 倒计时细线 */
.toast-timer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: linear-gradient(90deg, rgba(var(--tone-rgb), 0.7), rgba(var(--cc-gold-rgb), 0.5));
  transform-origin: left;
  animation-name: countdown;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes countdown {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 过渡 */
.toast-fade-enter-active {
  transition: opacity 0.3s ease, transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}

.toast-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.toast-fade-enter-from {
  opacity: 0;
  transform: translateY(-14px) scale(0.96);
}

.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.toast-fade-move {
  transition: transform 0.3s ease;
}

@media (prefers-reduced-motion: reduce) {
  .spin,
  .toast-timer {
    animation: none;
  }
}

@media (max-width: 480px) {
  .toast-container {
    top: max(10px, env(safe-area-inset-top));
    width: calc(100vw - 20px);
  }

  .toast {
    min-width: 0;
    width: 100%;
    max-width: none;
  }
}
</style>
