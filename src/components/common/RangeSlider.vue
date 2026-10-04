<template>
  <div
    :id="id"
    ref="root"
    class="range-slider"
    role="slider"
    tabindex="0"
    :aria-label="ariaLabel"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="modelValue"
    :aria-orientation="'horizontal'"
    :style="{ '--fill': fill }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @keydown="onKeydown"
  >
    <span class="range-slider-thumb"></span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

/**
 * 自绘滑块。原生 range 在祖先有 CSS zoom 时，指针坐标和滑轨对不齐，
 * 拖动越远拇指越偏离鼠标。这里用视口坐标（getBoundingClientRect 与 clientX 同一空间）计算。
 * 界面缩放滑块在拖动中不要改 zoom，否则滑轨会从指针底下挪走。
 */
const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    id?: string;
    ariaLabel?: string;
  }>(),
  { min: 0, max: 100, step: 1 },
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
  dragstart: [];
  commit: [];
}>();

const root = ref<HTMLElement | null>(null);
let dragging = false;

const fill = computed(() => {
  const span = props.max - props.min || 1;
  return `${((props.modelValue - props.min) / span) * 100}%`;
});

const snap = (raw: number) => {
  const steps = Math.round((raw - props.min) / props.step);
  const value = Math.min(props.max, Math.max(props.min, props.min + steps * props.step));
  const decimals = (String(props.step).split('.')[1] || '').length;
  return Number(value.toFixed(decimals));
};

const valueFromClientX = (clientX: number) => {
  const el = root.value;
  if (!el) return props.modelValue;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return props.modelValue;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return snap(props.min + ratio * (props.max - props.min));
};

const onPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return;
  const el = event.currentTarget as HTMLElement;
  dragging = true;
  try { el.setPointerCapture(event.pointerId); } catch { /* 非真实指针时忽略 */ }
  el.focus({ preventScroll: true });
  emit('dragstart');
  emit('update:modelValue', valueFromClientX(event.clientX));
};

const onPointerMove = (event: PointerEvent) => {
  if (!dragging) return;
  emit('update:modelValue', valueFromClientX(event.clientX));
};

const onPointerUp = (event: PointerEvent) => {
  if (!dragging) return;
  dragging = false;
  const el = event.currentTarget as HTMLElement;
  try { if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId); } catch { /* 非真实指针时忽略 */ }
  emit('commit');
};

onBeforeUnmount(() => {
  if (dragging) emit('commit');
});

const onKeydown = (event: KeyboardEvent) => {
  const dir = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
  if (!dir && event.key !== 'Home' && event.key !== 'End') return;
  event.preventDefault();
  const next = event.key === 'Home' ? props.min : event.key === 'End' ? props.max : snap(props.modelValue + dir * props.step);
  emit('update:modelValue', next);
  emit('commit');
};
</script>

<style scoped>
.range-slider {
  position: relative;
  flex: 1 1 auto;
  align-self: center;
  width: 100%;
  min-width: 0;
  height: 20px;
  touch-action: none;
  cursor: pointer;
  outline: none;
  user-select: none;
}

.range-slider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--cc-gold) var(--fill), color-mix(in srgb, var(--cc-text) 14%, transparent) var(--fill));
  transform: translateY(-50%);
}

.range-slider-thumb {
  position: absolute;
  top: 50%;
  left: var(--fill);
  width: 16px;
  height: 16px;
  border: 2px solid var(--cc-gold);
  border-radius: 50%;
  background: var(--cc-solid-bg);
  box-shadow: 0 0 0 3px rgba(var(--cc-gold-rgb), 0.15);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.range-slider:focus-visible .range-slider-thumb {
  box-shadow: 0 0 0 3px rgba(var(--cc-gold-rgb), 0.4);
}
</style>
