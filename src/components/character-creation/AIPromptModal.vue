<template>
  <div v-if="visible" class="cc-modal-overlay" @click.self="handleClose">
    <div class="cc-modal" role="dialog" aria-modal="true" :aria-label="$t('AI推演')">
      <div class="cc-modal-head">
        <h3 class="cc-modal-title">
          <Sparkles :size="18" class="title-icon" />
          {{ $t('AI推演') }}
        </h3>
        <button type="button" class="cc-modal-close" :aria-label="$t('关闭')" @click="handleClose">
          <X :size="18" />
        </button>
      </div>
      <div class="cc-modal-body">
        <p class="cc-hint">{{ $t('请描述你想生成什么内容：') }}</p>
        <textarea
          v-model="userPrompt"
          class="cc-input"
          :placeholder="$t('例如：生成一个火属性的天赋，适合剑修...')"
          rows="6"
          @keydown.ctrl.enter="handleSubmit"
        ></textarea>
        <p class="kbd-hint">Ctrl + Enter {{ $t('开始推演') }}</p>
      </div>
      <div class="cc-modal-foot">
        <button type="button" class="cc-btn" @click="handleClose">{{ $t('取消') }}</button>
        <button type="button" class="cc-btn primary" :disabled="!userPrompt.trim()" @click="handleSubmit">
          <Sparkles :size="15" />
          <span>{{ $t('开始推演') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Sparkles, X } from 'lucide-vue-next';
import { ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [prompt: string];
}>();

const userPrompt = ref('');

watch(() => props.visible, (newVal) => {
  if (newVal) {
    userPrompt.value = '';
  }
});

function handleClose() {
  emit('close');
}

function handleSubmit() {
  const trimmed = userPrompt.value.trim();
  if (!trimmed) return;
  emit('submit', trimmed);
  handleClose();
}
</script>

<style scoped>
/* 外观见 styles/creation-theme.css 的 cc-modal */
.cc-modal-title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.title-icon {
  color: var(--cc-gold);
}

.kbd-hint {
  margin: -0.4rem 0 0;
  font-size: 0.72rem;
  text-align: right;
  color: var(--cc-text-3);
}
</style>
