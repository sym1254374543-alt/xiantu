<template>
  <Teleport to="body">
    <transition name="detail-fade">
      <div v-if="uiStore.showDetailModalState" class="cc-modal-overlay detail-layer" @click.self="closeModal">
        <div
          class="cc-modal solid detail-modal"
          :class="uiStore.detailModalClass"
          role="dialog"
          aria-modal="true"
          @keydown.esc="closeModal"
        >
          <header class="cc-modal-head">
            <h3 class="cc-modal-title">{{ uiStore.detailModalTitle }}</h3>
            <button ref="closeEl" type="button" class="cc-modal-close" aria-label="关闭" title="关闭" @click="closeModal">
              <X :size="18" />
            </button>
          </header>
          <div class="cc-modal-body detail-body">
            <component
              :is="uiStore.detailModalComponent"
              v-if="uiStore.detailModalComponent"
              v-bind="uiStore.detailModalProps"
            />
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-else class="detail-text" v-html="uiStore.detailModalContent"></div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { useUIStore } from '@/stores/uiStore';

const uiStore = useUIStore();
const closeEl = ref<HTMLButtonElement | null>(null);

const closeModal = () => {
  uiStore.hideDetailModal();
};

watch(
  () => uiStore.showDetailModalState,
  async (open) => {
    if (!open) return;
    await nextTick();
    closeEl.value?.focus();
  },
);
</script>

<style scoped>
.detail-layer {
  z-index: 2500;
}

.detail-modal.modal-wide {
  width: min(960px, 100%);
}

.detail-text {
  font-size: 15px;
  line-height: 1.85;
  color: var(--cc-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-fade-enter-active,
.detail-fade-leave-active {
  transition: opacity 0.2s ease;
}

.detail-fade-enter-from,
.detail-fade-leave-to {
  opacity: 0;
}
</style>
