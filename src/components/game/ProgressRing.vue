<template>
  <svg class="ring" :class="tone" viewBox="0 0 64 64" :width="size" :height="size" role="img" :aria-label="`${percent}%`">
    <circle cx="32" cy="32" r="27" class="ring-track" />
    <circle cx="32" cy="32" r="27" class="ring-fill" :stroke-dasharray="`${(clamped / 100) * 169.6} 169.6`" />
    <text x="32" y="36.5" text-anchor="middle" class="ring-text">{{ label ?? `${clamped}%` }}</text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ percent: number; size?: number; label?: string; tone?: '' | 'warm' | 'hot' | 'accent' }>(),
  { size: 64, label: undefined, tone: '' },
);

const clamped = computed(() => Math.max(0, Math.min(100, Math.round(props.percent || 0))));
</script>

<style scoped>
.ring {
  --ring: var(--gm-cultivation);

  flex-shrink: 0;
  transform: rotate(-90deg);
}

.ring.warm { --ring: var(--cc-warning); }
.ring.hot { --ring: var(--cc-danger); }
.ring.accent { --ring: var(--cc-gold); }

.ring-track {
  fill: none;
  stroke: var(--cc-inset);
  stroke-width: 5;
}

.ring-fill {
  fill: none;
  stroke: var(--ring);
  stroke-width: 5;
  stroke-linecap: round;
  transition: stroke-dasharray 0.5s ease;
}

.ring-text {
  fill: var(--cc-text);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  transform: rotate(90deg);
  transform-origin: 32px 32px;
}
</style>
