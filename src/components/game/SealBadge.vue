<template>
  <span class="seal-badge" :class="tone"><slot>{{ text }}</slot></span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ text?: string; tone?: 'seal' | 'gold' | 'good' | 'bad' | 'muted' | 'accent' }>(), {
  text: '',
  tone: 'gold',
});
</script>

<style scoped>
.seal-badge {
  --c: var(--cc-gold);

  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  padding: 0.05rem 0.45rem;
  border: 1px solid color-mix(in srgb, var(--c) 50%, transparent);
  border-radius: 3px;
  background: color-mix(in srgb, var(--c) 10%, transparent);
  color: var(--c);
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.seal-badge.seal {
  border-color: var(--cc-seal);
  background: var(--cc-seal);
  color: var(--cc-seal-text);
}

.seal-badge.good { --c: var(--cc-success); }
.seal-badge.bad { --c: var(--cc-danger); }
.seal-badge.muted { --c: var(--cc-text-2); }
.seal-badge.accent { --c: var(--cc-accent); }
</style>
