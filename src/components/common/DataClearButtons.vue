<template>
  <div class="data-clear-container">
      <!-- 清除自定义数据（自定义+AI生成），保留本地基础+云端数据 -->
      <button 
        @click="clearCustomData" 
        class="cc-tool-btn danger"
        :disabled="!hasCustomData"
        title="清除自定义和AI生成的数据"
      >
        <Trash2 :size="14" />
        <span>{{ t('清除自定义') }}</span>
      </button>

      <!-- 清除云端数据，保留本地基础+自定义数据 -->
      <!-- 🔥 暂时隐藏：后端未上线 -->
      <button
        v-if="false"
        @click="clearCloudData"
        class="cc-tool-btn danger"
        :disabled="!hasCloudData"
        title="清除从云端获取的数据"
      >
        <CloudOff :size="14" />
        <span>{{ t('清除云端') }}</span>
      </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CloudOff, Trash2 } from 'lucide-vue-next';
import { useI18n } from '../../i18n';
import { useUIStore } from '@/stores/uiStore';
import { useCharacterCreationStore } from '../../stores/characterCreationStore';
import { toast } from '../../utils/toast';
import { getTavernHelper } from '../../utils/tavern';
import { LOCAL_WORLDS, LOCAL_TALENT_TIERS, LOCAL_ORIGINS, LOCAL_SPIRIT_ROOTS, LOCAL_TALENTS } from '../../data/creationData';

// Props
defineProps<{
  variant?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
}>();

// Emits
const emit = defineEmits<{
  dataCleared: [type: string, count: number];
}>();

// Store
const store = useCharacterCreationStore();
const uiStore = useUIStore();
const { t } = useI18n();

// 检查是否有自定义数据
const hasCustomData = computed(() => {
  // 检查是否有ID大于本地基础数据最大ID的项目（这些是自定义或AI生成的）
  const maxLocalWorldId = Math.max(...LOCAL_WORLDS.map(w => w.id));
  const maxLocalTalentTierId = Math.max(...LOCAL_TALENT_TIERS.map(t => t.id));
  const maxLocalOriginId = Math.max(...LOCAL_ORIGINS.map(o => o.id));
  const maxLocalSpiritRootId = Math.max(...LOCAL_SPIRIT_ROOTS.map(s => s.id));
  const maxLocalTalentId = Math.max(...LOCAL_TALENTS.map(t => t.id));
  
  return store.creationData.worlds.some(w => w.source === 'cloud' || w.id > maxLocalWorldId) ||
         store.creationData.talentTiers.some(t => t.source === 'cloud' || t.id > maxLocalTalentTierId) ||
         store.creationData.origins.some(o => o.source === 'cloud' || o.id > maxLocalOriginId) ||
         store.creationData.spiritRoots.some(s => s.source === 'cloud' || s.id > maxLocalSpiritRootId) ||
         store.creationData.talents.some(t => t.source === 'cloud' || t.id > maxLocalTalentId);
});

// 检查是否有云端数据
const hasCloudData = computed(() => {
  return store.creationData.worlds.some(w => w.source === 'cloud') ||
         store.creationData.talentTiers.some(t => t.source === 'cloud') ||
         store.creationData.origins.some(o => o.source === 'cloud') ||
         store.creationData.spiritRoots.some(s => s.source === 'cloud') ||
         store.creationData.talents.some(t => t.source === 'cloud');
});

// 清理酒馆全局变量中的自定义数据
async function clearTavernCustomData() {
  try {
    const helper = getTavernHelper();
    if (!helper) {
      console.warn('酒馆助手不可用，跳过清理酒馆自定义数据');
      return;
    }

    // 清理酒馆全局变量中的 DAD_creationData
    await helper.deleteVariable('DAD_creationData', { type: 'global' });
    console.log('已清理酒馆全局变量 DAD_creationData');

    // 也清理可能存在的其他自定义数据相关变量
    const globalVars = await helper.getVariables({ type: 'global' });
    const customDataKeys = Object.keys(globalVars).filter(key => 
      key.includes('DAD_') || key.includes('custom') || key.includes('自定义')
    );
    
    if (customDataKeys.length > 0) {
      await Promise.all(customDataKeys.map(key => 
        helper.deleteVariable(key, { type: 'global' })
      ));
      console.log(`已清理 ${customDataKeys.length} 个自定义数据相关的酒馆变量:`, customDataKeys);
    }
  } catch (error) {
    console.error('清理酒馆自定义数据时出错:', error);
    // 不抛出错误，让主流程继续
  }
}

// 清除自定义数据，保留本地基础+云端数据
async function clearCustomData() {
  if (!hasCustomData.value) return;
  uiStore.showRetryDialog({
    title: '清除自定义数据',
    message: '确定要清除自定义数据吗？这将清除所有自定义和AI生成的数据，保留本地基础数据和云端数据。此操作不可撤销！',
    confirmText: '确认清除',
    cancelText: '取消',
    onConfirm: async () => {
      const originalCounts = {
        worlds: store.creationData.worlds.length,
        talentTiers: store.creationData.talentTiers.length,
        origins: store.creationData.origins.length,
        spiritRoots: store.creationData.spiritRoots.length,
        talents: store.creationData.talents.length
      };

      const maxLocalWorldId = Math.max(...LOCAL_WORLDS.map(w => w.id));
      const maxLocalTalentTierId = Math.max(...LOCAL_TALENT_TIERS.map(t => t.id));
      const maxLocalOriginId = Math.max(...LOCAL_ORIGINS.map(o => o.id));
      const maxLocalSpiritRootId = Math.max(...LOCAL_SPIRIT_ROOTS.map(s => s.id));
      const maxLocalTalentId = Math.max(...LOCAL_TALENTS.map(t => t.id));

      store.creationData.worlds = store.creationData.worlds.filter(w => w.source === 'local' || w.id <= maxLocalWorldId);
      store.creationData.talentTiers = store.creationData.talentTiers.filter(t => t.source === 'local' || t.id <= maxLocalTalentTierId);
      store.creationData.origins = store.creationData.origins.filter(o => o.source === 'local' || o.id <= maxLocalOriginId);
      store.creationData.spiritRoots = store.creationData.spiritRoots.filter(s => s.source === 'local' || s.id <= maxLocalSpiritRootId);
      store.creationData.talents = store.creationData.talents.filter(t => t.source === 'local' || t.id <= maxLocalTalentId);

      const removedCount = (originalCounts.worlds - store.creationData.worlds.length) +
                           (originalCounts.talentTiers - store.creationData.talentTiers.length) +
                           (originalCounts.origins - store.creationData.origins.length) +
                           (originalCounts.spiritRoots - store.creationData.spiritRoots.length) +
                           (originalCounts.talents - store.creationData.talents.length);

      store.resetCharacter();
      
      // 重要：同时清理酒馆全局变量中的自定义数据
      await clearTavernCustomData();
      
      await store.persistCustomData();
      toast.success(`已清除${removedCount} 项自定义数据，保留本地基础数据和云端数据`);
      emit('dataCleared', 'custom', removedCount);
    },
    onCancel: () => {}
  });
}

// 清除云端数据，保留本地基础+自定义数据
async function clearCloudData() {
  if (!hasCloudData.value) return;
  uiStore.showRetryDialog({
    title: '清除云端数据',
    message: '确定要清除云端数据吗？这将清除从云端获取的数据，保留本地基础数据和自定义数据。此操作不可撤销！',
    confirmText: '确认清除',
    cancelText: '取消',
    onConfirm: async () => {
      const originalCounts = {
        worlds: store.creationData.worlds.length,
        talentTiers: store.creationData.talentTiers.length,
        origins: store.creationData.origins.length,
        spiritRoots: store.creationData.spiritRoots.length,
        talents: store.creationData.talents.length
      };

      store.creationData.worlds = store.creationData.worlds.filter(w => w.source !== 'cloud');
      store.creationData.talentTiers = store.creationData.talentTiers.filter(t => t.source !== 'cloud');
      store.creationData.origins = store.creationData.origins.filter(o => o.source !== 'cloud');
      store.creationData.spiritRoots = store.creationData.spiritRoots.filter(s => s.source !== 'cloud');
      store.creationData.talents = store.creationData.talents.filter(t => t.source !== 'cloud');

      const removedCount = (originalCounts.worlds - store.creationData.worlds.length) +
                           (originalCounts.talentTiers - store.creationData.talentTiers.length) +
                           (originalCounts.origins - store.creationData.origins.length) +
                           (originalCounts.spiritRoots - store.creationData.spiritRoots.length) +
                           (originalCounts.talents - store.creationData.talents.length);

      store.resetCharacter();
      await store.persistCustomData();
      toast.success(`已清除${removedCount} 项云端数据，保留本地数据和自定义数据`);
      emit('dataCleared', 'cloud', removedCount);
    },
    onCancel: () => {}
  });
}
</script>

<style scoped>
.data-clear-container {
  display: flex;
  gap: 0.5rem;
}
</style>
