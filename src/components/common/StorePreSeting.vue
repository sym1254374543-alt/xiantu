<template>
  <div>
    <button
      @click="handleStorePreset"
      class="cc-tool-btn"
      :class="{ done: hasStored }"
      :disabled="isStoring || !isEnabled"
      :title="getButtonTooltip()"
    >
      <Loader2 v-if="isStoring" :size="14" class="cc-spin" />
      <Check v-else-if="hasStored" :size="14" />
      <Save v-else :size="14" />
      <span>{{ getButtonText() }}</span>
    </button>

    <!-- 预设保存对话框 -->
    <PresetSaveModal
      :visible="showSaveModal"
      :character-data="props.characterData"
      @close="showSaveModal = false"
      @submit="handleSavePreset"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Check, Loader2, Save } from 'lucide-vue-next';
import { toast } from '../../utils/toast';
import PresetSaveModal from './PresetSaveModal.vue';
import { useI18n } from '../../i18n';

// Props
const props = defineProps<{
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'compact';
  currentStep?: number; // 当前步骤
  totalSteps?: number; // 总步骤数
  characterData?: any; // 角色创建数据
}>();

// Emits
const emit = defineEmits<{
  storeCompleted: [result: { success: boolean; message: string; presetData?: any }];
  storeStarted: [];
}>();

// State
const isStoring = ref(false);
const hasStored = ref(false);
const showSaveModal = ref(false);
const { t } = useI18n();

// 是否启用按钮（仅在最后一步启用）
const isEnabled = computed(() => {
  if (props.currentStep === undefined || props.totalSteps === undefined) {
    return true; // 如果没有传入步骤信息，默认启用
  }
  return props.currentStep === props.totalSteps;
});

// 获取按钮文本
function getButtonText() {
  if (isStoring.value) return t('存储中');
  if (hasStored.value) return t('已存储');
  return t('存储预设');
}

// 获取按钮提示文本
function getButtonTooltip() {
  if (!isEnabled.value) {
    return t('请完成所有步骤后再保存预设');
  }
  if (isStoring.value) return t('正在存储预设...');
  if (hasStored.value) return t('预设已存储');
  return t('保存当前选择为预设');
}

// 处理点击存储预设按钮
function handleStorePreset() {
  if (isStoring.value || hasStored.value || !isEnabled.value) {
    if (hasStored.value) {
      toast.info(t('预设已存储，无需重复操作'));
    } else if (!isEnabled.value) {
      toast.warning(t('请完成所有步骤后再保存预设'));
    }
    return;
  }

  // 显示保存对话框
  showSaveModal.value = true;
  emit('storeStarted');
}

// 处理保存预设
async function handleSavePreset(data: { presetName: string; presetDescription: string; characterData?: any }) {
  isStoring.value = true;
  showSaveModal.value = false;

  const presetData = {
    name: data.presetName,
    description: data.presetDescription,
    savedAt: new Date().toISOString()
  };

  hasStored.value = true;

  emit('storeCompleted', {
    success: true,
    message: t('预设保存成功'),
    presetData
  });

  isStoring.value = false;
}
</script>
