<template>
  <div v-if="visible" class="cc-modal-overlay" @click.self="closeModal">
    <div class="cc-modal" role="dialog" aria-modal="true" aria-label="保存预设">
      <div class="cc-modal-head">
        <h2 class="cc-modal-title">保存预设</h2>
        <button type="button" class="cc-modal-close" aria-label="关闭" @click="closeModal">
          <X :size="18" />
        </button>
      </div>

      <div class="cc-modal-body">
        <div class="cc-field">
          <label for="preset-name">预设名称 <span class="required">*</span></label>
          <input
            id="preset-name"
            v-model="presetName"
            type="text"
            class="cc-input"
            placeholder="请输入预设名称（如：剑修预设、治愈系预设等）"
            maxlength="50"
            autofocus
            @keyup.enter="handleSubmit"
          />
          <div class="char-count">{{ presetName.length }}/50</div>
        </div>

        <div class="cc-field">
          <label for="preset-desc">预设描述 <span class="optional">（可选）</span></label>
          <textarea
            id="preset-desc"
            v-model="presetDescription"
            class="cc-input"
            placeholder="输入此预设的描述信息..."
            maxlength="200"
            rows="4"
          ></textarea>
          <div class="char-count">{{ presetDescription.length }}/200</div>
        </div>

        <div v-if="characterData" class="preset-preview">
          <h4 class="cc-section-title">预设内容</h4>
          <div class="tag-row">
            <span v-if="characterData.world" class="info-tag">{{ characterData.world.name }}</span>
            <span v-if="characterData.talentTier" class="info-tag">{{ characterData.talentTier.name }}</span>
            <span v-if="characterData.origin" class="info-tag">{{ characterData.origin.name }}</span>
            <span v-if="characterData.spiritRoot" class="info-tag">{{ characterData.spiritRoot.name }}</span>
            <span v-if="characterData.talents && characterData.talents.length > 0" class="info-tag accent">
              {{ characterData.talents.length }} 个天赋
            </span>
          </div>
        </div>

        <p class="saved-at">
          <CalendarClock :size="13" />
          <span>保存时间：{{ currentTime }}</span>
        </p>
      </div>

      <div class="cc-modal-foot">
        <button type="button" class="cc-btn" @click="closeModal">取消</button>
        <button
          type="button"
          class="cc-btn primary"
          :disabled="!presetName.trim() || isSubmitting"
          @click="handleSubmit"
        >
          <Loader2 v-if="isSubmitting" :size="15" class="cc-spin" />
          <Save v-else :size="15" />
          <span>{{ isSubmitting ? '保存中...' : '保存预设' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { CalendarClock, Loader2, Save, X } from 'lucide-vue-next';
import type { World, TalentTier, Origin, SpiritRoot, Talent } from '@/types';

// 接收来自父组件的角色创建数据
const props = defineProps<{
  visible: boolean;
  characterData?: {
    character_name?: string;
    gender?: '男' | '女' | '其他';
    race?: string;
    current_age?: number;
    world: World | null;
    talentTier: TalentTier | null;
    origin: Origin | null;
    spiritRoot: SpiritRoot | null;
    talents: Talent[];
    baseAttributes: {
      root_bone: number;
      spirituality: number;
      comprehension: number;
      fortune: number;
      charm: number;
      temperament: number;
    };
  };
}>();

const emit = defineEmits<{
  close: [];
  submit: [data: {
    presetName: string;
    presetDescription: string;
    characterData: typeof props.characterData;
  }];
}>();

const presetName = ref('');
const presetDescription = ref('');
const currentTime = ref('');
const isSubmitting = ref(false);
let timeInterval: number | null = null;

onMounted(() => {
  updateCurrentTime();
  timeInterval = window.setInterval(updateCurrentTime, 1000);
});

onUnmounted(() => {
  if (timeInterval !== null) {
    clearInterval(timeInterval);
  }
});

function updateCurrentTime() {
  const now = new Date();
  currentTime.value = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      presetName.value = '';
      presetDescription.value = '';
      updateCurrentTime();
      // 自动聚焦
      setTimeout(() => {
        const input = document.querySelector('.form-input') as HTMLInputElement;
        input?.focus();
      }, 100);
    }
  }
);

function closeModal() {
  if (!isSubmitting.value) {
    emit('close');
  }
}

function handleSubmit() {
  if (!presetName.value.trim() || isSubmitting.value) {
    return;
  }

  isSubmitting.value = true;

  // 模拟提交延迟
  setTimeout(() => {
    emit('submit', {
      presetName: presetName.value.trim(),
      presetDescription: presetDescription.value.trim(),
      characterData: props.characterData
    });
    isSubmitting.value = false;
  }, 300);
}
</script>

<style scoped>
/* 外观见 styles/creation-theme.css 的 cc-modal */
.required {
  color: var(--cc-danger);
}

.optional {
  color: var(--cc-text-3);
}

.char-count {
  font-size: 0.72rem;
  text-align: right;
  color: var(--cc-text-3);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.info-tag {
  padding: 0.12rem 0.55rem;
  border: 1px solid var(--cc-border);
  border-radius: 999px;
  background: var(--cc-surface-2);
  font-size: 0.74rem;
  letter-spacing: 0.05em;
  color: var(--cc-text-2);
}

.info-tag.accent {
  color: var(--cc-gold);
  border-color: rgba(var(--cc-gold-rgb), 0.45);
}

.saved-at {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.78rem;
  color: var(--cc-text-3);
}
</style>
