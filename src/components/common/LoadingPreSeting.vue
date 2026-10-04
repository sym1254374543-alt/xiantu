<template>
  <div>
    <button
      @click="handleLoadPreset"
      class="cc-tool-btn"
      :class="{ done: hasLoaded }"
      :disabled="isLoading"
      :title="getButtonTooltip()"
    >
      <Loader2 v-if="isLoading" :size="14" class="cc-spin" />
      <Check v-else-if="hasLoaded" :size="14" />
      <FolderOpen v-else :size="14" />
      <span>{{ getButtonText() }}</span>
    </button>

    <!-- 预设加载对话框 -->
    <PresetLoadModal
      :visible="showLoadModal"
      @close="showLoadModal = false"
      @select="handlePresetSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Check, FolderOpen, Loader2 } from 'lucide-vue-next';
import { toast } from '../../utils/toast';
import PresetLoadModal from './PresetLoadModal.vue';
import type { CharacterPreset } from '@/utils/presetManager';

// Props
defineProps<{
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'compact';
}>();

// Emits
const emit = defineEmits<{
  loadCompleted: [result: { success: boolean; message: string; presetData?: CharacterPreset }];
  loadStarted: [];
}>();

// State
const isLoading = ref(false);
const hasLoaded = ref(false);
const showLoadModal = ref(false);

// 获取按钮文本
function getButtonText() {
  if (isLoading.value) return '加载中';
  if (hasLoaded.value) return '已加载';
  return '加载预设';
}

// 获取按钮提示文本
function getButtonTooltip() {
  if (isLoading.value) return '正在加载预设...';
  if (hasLoaded.value) return '预设已加载';
  return '加载预设';
}

// 处理点击加载预设按钮
function handleLoadPreset() {
  if (isLoading.value || hasLoaded.value) {
    if (hasLoaded.value) {
      toast.info('预设已加载，无需重复操作');
    }
    return;
  }

  // 显示预设选择对话框
  showLoadModal.value = true;
  emit('loadStarted');
}

// 处理预设选择
async function handlePresetSelect(preset: CharacterPreset) {
  isLoading.value = true;
  showLoadModal.value = false;
  const toastId = 'load-preset-toast';
  toast.loading('正在加载预设...', { id: toastId });
  
  try {
    if (!preset?.id || !preset.data || typeof preset.name !== 'string') {
      throw new Error('预设数据不完整');
    }
    console.log('[加载预设组件] 选中的预设:', preset.id);
    
    toast.success(`预设「${preset.name}」加载成功！`, { id: toastId });
    hasLoaded.value = true;

    emit('loadCompleted', {
      success: true,
      message: '加载成功',
      presetData: preset
    });

  } catch (error) {
    console.error('[加载预设组件] 加载失败:', error);
    const message = error instanceof Error ? error.message : '加载失败';
    toast.error(`加载失败: ${message}`, { id: toastId });
    emit('loadCompleted', {
      success: false,
      message: message
    });
  } finally {
    isLoading.value = false;
  }
}
</script>
