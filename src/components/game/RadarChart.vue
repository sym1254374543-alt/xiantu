<template>
  <svg class="radar" :viewBox="`0 0 ${size} ${size}`" :width="size" :height="size" role="img" :aria-label="ariaLabel">
    <g :transform="`translate(${c} ${c})`">
      <polygon v-for="lv in levels" :key="lv" class="radar-grid" :points="ring(lv / levels.length)" />
      <line v-for="(p, i) in axisEnds" :key="'a' + i" class="radar-axis" x1="0" y1="0" :x2="p.x" :y2="p.y" />
      <polygon class="radar-area" :points="valuePoints" />
      <circle v-for="(p, i) in valueDots" :key="'d' + i" class="radar-dot" :cx="p.x" :cy="p.y" r="3" />
      <text
        v-for="(p, i) in labelPoints"
        :key="'l' + i"
        class="radar-label"
        :x="p.x"
        :y="p.y"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        {{ items[i].label }}
      </text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ items: { label: string; value: number }[]; size?: number; max?: number }>(),
  { size: 220, max: 0 },
);

const c = computed(() => props.size / 2);
const r = computed(() => props.size / 2 - 30);
const levels = [1, 2, 3, 4];

/** 上限：默认取 max(10, 最大值向上取整到 5 的倍数) */
const maxValue = computed(() => {
  if (props.max > 0) return props.max;
  const top = Math.max(10, ...props.items.map((i) => i.value || 0));
  return Math.ceil(top / 5) * 5;
});

const angle = (i: number) => -Math.PI / 2 + (Math.PI * 2 * i) / props.items.length;
const at = (i: number, k: number) => ({ x: Math.cos(angle(i)) * r.value * k, y: Math.sin(angle(i)) * r.value * k });

const ring = (k: number) => props.items.map((_, i) => at(i, k)).map((p) => `${p.x},${p.y}`).join(' ');
const axisEnds = computed(() => props.items.map((_, i) => at(i, 1)));
const valueDots = computed(() =>
  props.items.map((it, i) => at(i, Math.max(0.03, Math.min(1, (it.value || 0) / maxValue.value)))),
);
const valuePoints = computed(() => valueDots.value.map((p) => `${p.x},${p.y}`).join(' '));
const labelPoints = computed(() => props.items.map((_, i) => at(i, 1 + 18 / r.value)));
const ariaLabel = computed(() => props.items.map((i) => `${i.label} ${i.value}`).join('，'));
</script>

<style scoped>
.radar {
  display: block;
  max-width: 100%;
  height: auto;
  overflow: visible;
}

.radar-grid {
  fill: none;
  stroke: var(--gm-line);
  stroke-width: 1;
}

.radar-grid:last-of-type {
  stroke: rgba(var(--cc-gold-rgb), 0.3);
}

.radar-axis {
  stroke: var(--gm-line);
  stroke-width: 1;
}

.radar-area {
  fill: rgba(var(--cc-gold-rgb), 0.18);
  stroke: var(--cc-gold);
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.radar-dot {
  fill: var(--cc-gold);
}

.radar-label {
  fill: var(--cc-text-2);
  font-size: 13px;
  letter-spacing: 0.1em;
}
</style>
