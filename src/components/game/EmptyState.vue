<template>
  <div class="gm-empty empty-state" :class="{ compact }" :data-glyph="glyph">
    <p>{{ title }}</p>
    <small v-if="desc">{{ desc }}</small>
    <div v-if="$slots.default" class="empty-actions"><slot /></div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ glyph?: string; title: string; desc?: string; compact?: boolean }>(), {
  glyph: '空',
  desc: '',
  compact: false,
});
</script>

<style scoped>
.empty-state {
  flex: 1;
}

.empty-state.compact {
  min-height: 160px;
  padding: 1.25rem 1rem;
}

.empty-state.compact::before {
  font-size: 60px;
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
}
</style>
