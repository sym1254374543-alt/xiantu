<template>
  <Teleport to="body">
    <div class="cc-modal-overlay lbm-layer" @click.self="emit('close')">
      <div class="cc-modal solid lbm" role="dialog" aria-modal="true" aria-labelledby="lbm-title" @keydown.esc="emit('close')">
        <header class="cc-modal-head">
          <Trophy :size="18" class="lbm-icon" />
          <h3 id="lbm-title" class="cc-modal-title">额度排行</h3>
          <button type="button" class="cc-modal-close" aria-label="关闭" @click="emit('close')"><X :size="18" /></button>
        </header>
        <div class="cc-modal-body">
          <LeaderboardPanel />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Trophy, X } from 'lucide-vue-next';
import LeaderboardPanel from './LeaderboardPanel.vue';

const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<style scoped>
.lbm-layer {
  z-index: 2000;
}

.lbm {
  width: min(520px, 100%);
}

.lbm .cc-modal-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.lbm-icon {
  color: var(--cc-gold);
}

.lbm .cc-modal-title {
  flex: 1;
}
</style>
