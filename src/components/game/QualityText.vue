<template>
  <component :is="tag" class="quality-text" :style="{ '--quality': qualityTone(quality) }"><slot /></component>
</template>

<script setup lang="ts">
import { qualityTone } from '@/utils/qualityTone';

withDefaults(defineProps<{ quality?: any; tag?: string }>(), { tag: 'span' });
</script>

<style scoped>
.quality-text {
  color: var(--quality, var(--cc-text));
}
</style>
