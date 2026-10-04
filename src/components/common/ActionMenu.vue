<template>
  <div class="action-menu" :class="positionClass" :style="offsetStyle">
    <transition name="menu-fade">
      <div v-if="open" class="overlay" @click="close"></div>
    </transition>

    <transition name="menu-pop">
      <div v-if="open" class="menu" role="menu" @click.stop>
        <div class="menu-title">{{ openTitle }}</div>
        <slot name="menu" :close="close" />
      </div>
    </transition>

    <button
      class="fab"
      :title="open ? closeTitle : openTitle"
      :aria-label="open ? closeTitle : openTitle"
      :aria-expanded="open"
      @click="toggle"
    >
      <component :is="open ? X : Menu" :size="22" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Menu, X } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    position?: 'top-right' | 'bottom-right';
    offsetPx?: number;
    openTitle?: string;
    closeTitle?: string;
  }>(),
  {
    position: 'bottom-right',
    offsetPx: 24,
    openTitle: '菜单',
    closeTitle: '关闭',
  },
);

const open = ref(false);

const close = () => {
  open.value = false;
};

const toggle = () => {
  open.value = !open.value;
};

const positionClass = computed(() => {
  return props.position === 'top-right' ? 'pos-top-right' : 'pos-bottom-right';
});

const offsetStyle = computed(() => {
  const px = `${props.offsetPx}px`;
  if (props.position === 'top-right') return { top: px, right: px };
  return { bottom: px, right: px };
});
</script>

<style scoped>
/* 令牌见 styles/xian-tokens.css */
.action-menu {
  position: fixed;
  z-index: 120;
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: rgba(4, 8, 16, 0.25);
  backdrop-filter: blur(2px);
}

.fab {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  padding: 0;
  border: 1px solid var(--cc-shell-border);
  border-radius: 10px;
  background: var(--cc-shell-bg);
  color: var(--cc-gold);
  box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  cursor: pointer;
  transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
}

.fab::before {
  content: '';
  position: absolute;
  inset: 3px;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.18);
  border-radius: 7px;
  pointer-events: none;
}

.fab:hover {
  border-color: rgba(var(--cc-gold-rgb), 0.7);
  box-shadow: 0 10px 24px -8px rgba(0, 0, 0, 0.6), 0 0 16px -4px rgba(var(--cc-gold-rgb), 0.5);
  transform: translateY(-1px);
}

.fab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.35);
}

.menu {
  position: absolute;
  right: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 196px;
  padding: 0.55rem;
  white-space: nowrap;
  border: 1px solid var(--cc-shell-border);
  border-radius: 8px;
  background: var(--cc-shell-bg);
  box-shadow: var(--cc-shell-shadow);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.menu::before {
  content: '';
  position: absolute;
  inset: 4px;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.14);
  border-radius: 5px;
  pointer-events: none;
}

.menu-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.6rem 0.5rem;
  font-family: var(--cc-calligraphy);
  font-size: 1.15rem;
  letter-spacing: 0.2em;
  color: var(--cc-text);
}

.menu-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(var(--cc-gold-rgb), 0.5), transparent);
}

:deep(.action-menu-item) {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.55rem 0.7rem;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--cc-text);
  font-family: inherit;
  font-size: 0.92rem;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

:deep(.action-menu-item svg) {
  flex-shrink: 0;
  color: var(--cc-gold);
  transition: transform 0.2s ease;
}

:deep(a.action-menu-item) {
  display: flex;
}

:deep(.action-menu-item:hover) {
  background: var(--cc-surface-hover);
  border-color: var(--cc-border);
  color: var(--cc-accent);
}

:deep(.action-menu-item:hover svg) {
  transform: scale(1.1);
}

:deep(.action-menu-item:focus-visible) {
  outline: none;
  box-shadow: 0 0 0 2px rgba(var(--cc-accent-rgb), 0.4);
}

:deep(.action-menu-item.is-disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}

:deep(.action-menu-item.is-disabled:hover) {
  background: transparent;
  border-color: transparent;
  color: var(--cc-text);
}

:deep(.action-menu-item span) {
  font-size: 0.92rem;
  letter-spacing: 0.1em;
}

:deep(.action-menu-item.is-danger),
:deep(.action-menu-item.is-danger svg) {
  color: var(--cc-danger);
}

:deep(.action-menu-item.sponsor-item svg) {
  color: var(--cc-seal);
}

:deep(.action-menu-divider) {
  height: 1px;
  margin: 0.3rem 0.5rem;
  background: var(--cc-divider);
}

.pos-bottom-right .menu {
  bottom: 58px;
}

.pos-top-right .menu {
  top: 58px;
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.18s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
}

.menu-pop-enter-active,
.menu-pop-leave-active {
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s ease;
  transform-origin: top right;
}

.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}

@media (max-width: 600px) {
  .action-menu {
    bottom: 12px;
    right: 12px;
    top: auto;
  }

  .pos-top-right {
    top: 12px;
    bottom: auto;
  }

  .fab {
    width: 40px;
    height: 40px;
  }

  .pos-bottom-right .menu {
    bottom: 50px;
  }

  .pos-top-right .menu {
    top: 50px;
  }
}
</style>
