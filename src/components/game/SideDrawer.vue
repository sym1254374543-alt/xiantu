<template>
  <Teleport to="body">
    <transition name="drawer">
      <div v-if="open" class="drawer-layer" @click.self="emit('close')">
        <aside class="drawer" :style="{ '--w': width + 'px' }" role="dialog" aria-modal="true" :aria-label="title" @keydown.esc="emit('close')">
          <header class="drawer-head">
            <h3 class="drawer-title">{{ title }}</h3>
            <slot name="head" />
            <button ref="closeEl" type="button" class="cc-modal-close" aria-label="关闭" title="关闭" @click="emit('close')">
              <X :size="18" />
            </button>
          </header>
          <div class="drawer-body"><slot /></div>
          <footer v-if="$slots.foot" class="drawer-foot"><slot name="foot" /></footer>
        </aside>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';

const props = withDefaults(defineProps<{ open: boolean; title: string; width?: number }>(), { width: 460 });
const emit = defineEmits<{ (e: 'close'): void }>();
const closeEl = ref<HTMLButtonElement | null>(null);

watch(
  () => props.open,
  async (o) => {
    if (!o) return;
    await nextTick();
    closeEl.value?.focus();
  },
);
</script>

<style scoped>
.drawer-layer {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  justify-content: flex-end;
  background: rgba(4, 8, 16, 0.35);
}

.drawer {
  display: flex;
  flex-direction: column;
  width: min(var(--w), 100%);
  height: 100%;
  border-left: 1px solid var(--cc-border-strong);
  background: var(--cc-solid-bg);
  box-shadow: -18px 0 40px rgba(0, 0, 0, 0.3);
  color: var(--cc-text);
  font-family: var(--font-family-serif);
}

.drawer-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
  min-height: 60px;
  padding: 0 0.9rem 0 1.3rem;
  border-bottom: 1px solid var(--gm-line);
}

.drawer-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 24px;
  font-weight: 400;
  letter-spacing: 0.15em;
}

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.5rem 1.3rem 1.5rem;
}

.drawer-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
  padding: 0.8rem 1.3rem;
  border-top: 1px solid var(--gm-line);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: background 0.22s ease;
}

.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform 0.22s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  background: transparent;
}

.drawer-enter-from .drawer,
.drawer-leave-to .drawer {
  transform: translateX(100%);
}
</style>
