<template>
  <button
    @click="handleSyncCloudData"
    class="cc-tool-btn"
    :class="{ done: hasSynced }"
    :disabled="isDisabled || isSyncing"
    :title="getSyncButtonTooltip()"
  >
    <Loader2 v-if="isSyncing" :size="14" class="cc-spin" />
    <Check v-else-if="hasSynced" :size="14" />
    <CloudDownload v-else :size="14" />
    <span>{{ getSyncButtonText() }}</span>
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Check, CloudDownload, Loader2 } from 'lucide-vue-next';
import { toast } from '../../utils/toast';
import { useCharacterCreationStore } from '../../stores/characterCreationStore';
import { useUIStore } from '../../stores/uiStore';
import { useI18n } from '../../i18n';

// Props
defineProps<{
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'compact';
}>();

// Emits
const emit = defineEmits<{
  syncCompleted: [result: { success: boolean; newItemsCount: number; message: string }];
  syncStarted: [];
}>();

// Store
const store = useCharacterCreationStore();
const uiStore = useUIStore();
const { t } = useI18n();

// State
const isSyncing = ref(false);
const hasSynced = ref(false);

// 根据后端配置状态决定是否禁用云端功能（使用统一状态）
const isDisabled = computed(() => !uiStore.isBackendConfiguredComputed);

// 获取同步按钮文本
function getSyncButtonText() {
  if (isDisabled.value) return t('暂不可用');
  if (isSyncing.value) return t('同步中');
  if (hasSynced.value) return t('已获取');
  return t('获取云端');
}

// 获取按钮提示文本
function getSyncButtonTooltip() {
  if (isDisabled.value) return t('云端功能暂未开放');
  if (isSyncing.value) return t('正在同步云端数据...');
  if (hasSynced.value) return t('云端数据已获取');
  return t('获取云端数据');
}

// 处理云端数据同步
async function handleSyncCloudData() {
  if (isSyncing.value || hasSynced.value) {
    if (hasSynced.value) {
      toast.info(t('云端数据已获取，无需重复操作'));
    }
    return;
  }

  isSyncing.value = true;
  emit('syncStarted');
  const toastId = 'cloud-sync-toast';
  toast.loading(t('正在获取云端数据...'), { id: toastId });

  try {
    const newItemsCount = await store.fetchAllCloudData();

    if (newItemsCount > 0) {
      toast.success(t('同步成功！新增 {0} 项云端数据').replace('{0}', String(newItemsCount)), { id: toastId });
      hasSynced.value = true;
    } else {
      toast.info(t('所有云端数据已是最新'), { id: toastId });
      hasSynced.value = true;
    }

    emit('syncCompleted', {
      success: true,
      newItemsCount: newItemsCount,
      message: t('同步成功')
    });

  } catch (error) {
    console.error('[云端同步组件] 同步云端数据失败:', error);
    const message = error instanceof Error ? error.message : t('同步失败');
    toast.error(t('同步失败: {0}').replace('{0}', message), { id: toastId });
    emit('syncCompleted', {
      success: false,
      newItemsCount: 0,
      message: message
    });
  } finally {
    isSyncing.value = false;
  }
}
</script>
