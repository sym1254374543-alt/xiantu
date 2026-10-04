<template>
  <div class="lc" @mouseleave="hover = -1">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" :aria-label="label" @mousemove="onMove">
      <g class="lc-grid">
        <template v-for="t in ticks" :key="t.v">
          <line :x1="PL" :x2="W - PR" :y1="t.y" :y2="t.y" />
        </template>
      </g>
      <path v-for="(seg, i) in segments" :key="i" class="lc-line" :d="seg" :style="{ stroke: color }" />
      <circle v-for="pt in dots" :key="pt.i" class="lc-dot" :cx="pt.x" :cy="pt.y" r="2.6" :style="{ fill: color }" />
      <line v-if="hoverPoint" class="lc-cursor" :x1="hoverPoint.x" :x2="hoverPoint.x" :y1="PT" :y2="H - PB" />
      <circle v-if="hoverPoint && hoverPoint.value !== null" class="lc-dot hot" :cx="hoverPoint.x" :cy="hoverPoint.y" r="4.5" :style="{ fill: color }" />
    </svg>
    <div class="lc-y">
      <span v-for="t in ticks" :key="t.v" :style="{ top: `${(t.y / H) * 100}%` }">{{ format(t.v) }}</span>
    </div>
    <div class="lc-x">
      <span v-for="(l, i) in xLabels" :key="i" :style="{ left: `${(l.x / W) * 100}%` }">{{ l.text }}</span>
    </div>
    <div v-if="hoverPoint" class="lc-tip" :style="{ left: `calc(3.4rem + (100% - 3.4rem) * ${hoverPoint.x / W})` }">
      <b>{{ hoverPoint.value === null ? '无请求' : format(hoverPoint.value) }}</b>
      <span>{{ labels[hoverPoint.i] }}</span>
    </div>
    <p v-if="!dots.length" class="lc-empty">最近 24 小时还没有请求</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    values: (number | null)[];
    labels: string[];
    label: string;
    color?: string;
    min?: number;
    max?: number;
    format?: (v: number) => string;
  }>(),
  { color: 'var(--cc-accent)', min: undefined, max: undefined, format: (v: number) => String(Math.round(v)) },
);

const W = 640;
const H = 200;
const PL = 8;
const PR = 8;
const PT = 12;
const PB = 22;

const range = computed(() => {
  const nums = props.values.filter((v): v is number => v !== null);
  const lo = props.min ?? Math.min(0, ...nums);
  let hi = props.max ?? (nums.length ? Math.max(...nums) : 1);
  if (props.max === undefined) hi = hi <= 0 ? 1 : hi * 1.15;
  if (hi - lo < 1e-9) hi = lo + 1;
  return { lo, hi };
});

const xAt = (i: number) => PL + ((W - PL - PR) * i) / Math.max(1, props.values.length - 1);
const yAt = (v: number) => PT + (H - PT - PB) * (1 - (v - range.value.lo) / (range.value.hi - range.value.lo));

const dots = computed(() =>
  props.values.flatMap((v, i) => (v === null ? [] : [{ i, x: xAt(i), y: yAt(v) }])),
);

/** 没有请求的小时断开，不把线硬连过去 */
const segments = computed(() => {
  const out: string[] = [];
  let cur = '';
  props.values.forEach((v, i) => {
    if (v === null) {
      if (cur) out.push(cur);
      cur = '';
      return;
    }
    cur += `${cur ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`;
  });
  if (cur) out.push(cur);
  return out;
});

const ticks = computed(() => {
  const { lo, hi } = range.value;
  return Array.from({ length: 5 }, (_, k) => {
    const v = lo + ((hi - lo) * k) / 4;
    return { v, y: yAt(v) };
  });
});

const xLabels = computed(() => {
  const n = props.labels.length;
  const step = n > 12 ? 3 : 1;
  return props.labels.flatMap((text, i) => (i % step === 0 || i === n - 1 ? [{ x: xAt(i), text }] : []));
});

const hover = ref(-1);
const onMove = (e: MouseEvent) => {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * W;
  const n = props.values.length;
  hover.value = Math.max(0, Math.min(n - 1, Math.round(((x - PL) / (W - PL - PR)) * (n - 1))));
};
const hoverPoint = computed(() => {
  if (hover.value < 0 || hover.value >= props.values.length) return null;
  const value = props.values[hover.value];
  return { i: hover.value, x: xAt(hover.value), y: value === null ? 0 : yAt(value), value };
});
</script>

<style scoped>
.lc {
  position: relative;
  padding: 0 0 1.3rem 3.4rem;
}

svg {
  display: block;
  width: 100%;
  height: 180px;
  overflow: visible;
}

.lc-grid line {
  stroke: var(--cc-divider);
  stroke-dasharray: 3 4;
  vector-effect: non-scaling-stroke;
}

.lc-line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.lc-dot {
  stroke: var(--cc-surface);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.lc-cursor {
  stroke: var(--cc-text-3);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.lc-y {
  position: absolute;
  top: 0;
  left: 0;
  width: 3rem;
  height: 180px;
}

.lc-y span,
.lc-x span {
  position: absolute;
  font-size: 0.68rem;
  color: var(--cc-text-3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.lc-y span {
  right: 0.4rem;
  transform: translateY(-50%);
}

.lc-x {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 3.4rem;
  height: 1.1rem;
}

.lc-x span {
  transform: translateX(-50%);
}

.lc-tip {
  position: absolute;
  top: -0.4rem;
  display: flex;
  flex-direction: column;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--cc-border);
  border-radius: 4px;
  background: var(--cc-solid-bg);
  font-size: 0.72rem;
  color: var(--cc-text-2);
  pointer-events: none;
  transform: translateX(-50%);
  white-space: nowrap;
}

.lc-tip b {
  font-size: 0.82rem;
  color: var(--cc-text);
}

.lc-empty {
  position: absolute;
  inset: 40% 0 auto 3.4rem;
  margin: 0;
  text-align: center;
  font-size: 0.8rem;
  color: var(--cc-text-3);
}
</style>
