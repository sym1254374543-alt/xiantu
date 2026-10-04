<template>
  <div class="gm-meter vital-row" :style="{ '--meter': meta.tone }">
    <div class="gm-meter-row">
      <span>
        <img class="status-icon-image" :src="meta.icon" alt="" aria-hidden="true" draggable="false" />
        {{ info.key }}
      </span>
      <b :class="{ low: info.low }">{{ info.cur }}<i v-if="info.max"> / {{ info.max }}</i></b>
    </div>
    <div v-if="info.showBar" class="gm-meter-track"><span :style="{ width: info.percent + '%' }"></span></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { VITAL_META, type VitalInfo } from '@/utils/gameDisplay';

const props = defineProps<{ info: VitalInfo }>();
const meta = computed(() => VITAL_META[props.info.key]);
</script>
