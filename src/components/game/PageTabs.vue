<template>
  <nav class="gm-tabs page-tabs" role="tablist" :aria-label="label">
    <button
      v-for="tab in visibleTabs"
      :key="tab.key"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab.key"
      :class="{ active: modelValue === tab.key }"
      @click="emit('update:modelValue', tab.key)"
    >
      <component :is="tab.icon" v-if="tab.icon" :size="15" />
      <span>{{ tab.label }}</span>
      <em v-if="tab.count !== undefined && tab.count !== null && tab.count !== ''">{{ tab.count }}</em>
    </button>
    <div v-if="$slots.default" class="page-tabs-end"><slot /></div>
  </nav>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';

export interface PageTab {
  key: string;
  label: string;
  count?: number | string | null;
  icon?: Component;
  hidden?: boolean;
}

const props = defineProps<{ tabs: PageTab[]; modelValue: string; label?: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const visibleTabs = computed(() => props.tabs.filter((t) => !t.hidden));
</script>

<style scoped>
.page-tabs {
  flex-shrink: 0;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}

.page-tabs::-webkit-scrollbar {
  display: none;
}

.page-tabs-end {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  padding-bottom: 0.4rem;
}

@media (max-width: 768px) {
  .page-tabs {
    flex-wrap: wrap;
  }

  .page-tabs-end {
    flex-basis: 100%;
    flex-wrap: wrap;
    margin-left: 0;
    padding: 0.5rem 0;
  }

  .page-tabs-end > * {
    flex: 1 1 auto;
  }
}
</style>
