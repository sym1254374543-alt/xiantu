<template>
  <div class="list-detail" :style="{ '--detail-w': detailWidth + 'px' }">
    <div class="ld-list">
      <slot name="list" />
    </div>

    <!-- 桌面：固定详情栏；窄屏：选中后全屏浮层 -->
    <aside class="ld-detail" :class="{ open }" :aria-label="detailLabel">
      <div v-if="open" class="ld-mobile-head">
        <button type="button" class="ld-back" @click="emit('close')">
          <ArrowLeft :size="16" />
          <span>{{ backText }}</span>
        </button>
      </div>
      <div class="ld-detail-inner">
        <slot name="detail" />
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    /** 是否有选中项（窄屏下决定是否弹出详情） */
    open?: boolean;
    detailWidth?: number;
    detailLabel?: string;
    backText?: string;
  }>(),
  { open: false, detailWidth: 360, detailLabel: '详情', backText: '返回列表' },
);

const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<style scoped>
.list-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--detail-w);
  gap: 1.25rem;
  flex: 1;
  min-height: 0;
}

.ld-list {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.ld-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--gm-block);
  overflow: hidden;
}

.ld-detail-inner {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.ld-mobile-head {
  display: none;
}

@media (max-width: 1100px) {
  .list-detail {
    grid-template-columns: minmax(0, 1fr) min(var(--detail-w), 320px);
    gap: 1rem;
  }
}

@media (max-width: 768px) {
  .list-detail {
    grid-template-columns: minmax(0, 1fr);
  }

  .ld-detail {
    display: none;
  }

  .ld-detail.open {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    border: none;
    border-radius: 0;
    background: var(--gm-page-bg);
  }

  .ld-mobile-head {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    min-height: 52px;
    padding: 0 0.75rem;
    border-bottom: 1px solid var(--gm-rail-line);
  }

  .ld-back {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    height: 36px;
    padding: 0 0.6rem;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--cc-text-2);
    font-size: 14px;
    letter-spacing: 0.12em;
    cursor: pointer;
  }
}
</style>
