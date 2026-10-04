<template>
  <div v-if="visible" class="cc-modal-overlay" @click.self="closeModal">
    <div class="cc-modal wide" role="dialog" aria-modal="true" aria-label="加载预设">
      <div class="cc-modal-head">
        <div class="title-section">
          <h2 class="cc-modal-title">加载预设</h2>
          <span v-if="!isLoading && presets.length > 0" class="preset-count">{{ presets.length }} 个</span>
        </div>
        <div class="header-actions">
          <button type="button" class="cc-btn small" @click="showImportModal = true">
            <Download :size="14" />
            <span>导入</span>
          </button>
          <button type="button" class="cc-btn small" @click="showExportModal = true">
            <Upload :size="14" />
            <span>导出</span>
          </button>
          <button type="button" class="cc-modal-close" aria-label="关闭" @click="closeModal">
            <X :size="18" />
          </button>
        </div>
      </div>

      <div class="cc-modal-body">
        <div v-if="isLoading" class="state">
          <Loader2 :size="26" class="cc-spin" />
          <p>正在加载预设列表...</p>
        </div>

        <div v-else-if="presets.length === 0" class="state">
          <Inbox :size="34" :stroke-width="1.25" class="state-icon" />
          <p>暂无保存的预设</p>
          <p class="state-hint">完成角色创建后，可以保存为预设以便快速开始新游戏</p>
        </div>

        <div v-else class="presets-list">
          <div
            v-for="preset in presets"
            :key="preset.id"
            class="cc-item preset-item"
            role="button"
            tabindex="0"
            :class="{ selected: selectedPreset?.id === preset.id }"
            @click="selectedPreset = preset"
            @keydown.enter.prevent="selectedPreset = preset"
          >
            <div class="preset-body">
              <div class="preset-header">
                <h3 class="preset-name">{{ preset.name || '未命名预设' }}</h3>
                <span class="preset-date">{{ formatDate(preset.savedAt) }}</span>
              </div>
              <p v-if="preset.description" class="preset-description">{{ preset.description }}</p>
              <div v-if="preset.data" class="tag-row">
                <span v-if="preset.data.character_name" class="info-tag accent">{{ preset.data.character_name }}</span>
                <span v-if="preset.data.current_age" class="info-tag">{{ preset.data.current_age }}岁</span>
                <span v-if="preset.data.world" class="info-tag">{{ preset.data.world.name }}</span>
                <span v-if="preset.data.talentTier" class="info-tag">{{ preset.data.talentTier.name }}</span>
                <span v-if="preset.data.origin" class="info-tag">{{ preset.data.origin.name }}</span>
                <span v-if="preset.data.spiritRoot" class="info-tag">{{ preset.data.spiritRoot.name }}</span>
              </div>
            </div>
            <div class="cc-item-tools">
              <button type="button" class="cc-icon-btn danger" title="删除预设" @click.stop="handleDeletePreset(preset.id)">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="cc-modal-foot">
        <button type="button" class="cc-btn" @click="closeModal">取消</button>
        <button
          type="button"
          class="cc-btn primary"
          :disabled="!selectedPreset || isSubmitting"
          @click="handleLoadPreset"
        >
          <Loader2 v-if="isSubmitting" :size="15" class="cc-spin" />
          <FolderOpen v-else :size="15" />
          <span>{{ isSubmitting ? '加载中...' : '加载预设' }}</span>
        </button>
      </div>
    </div>

    <!-- 导出预设对话框 -->
    <PresetExportModal
      :visible="showExportModal"
      @close="showExportModal = false"
      @exported="handleExported"
    />

    <!-- 导入预设对话框 -->
    <PresetImportModal
      :visible="showImportModal"
      @close="showImportModal = false"
      @imported="handleImported"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Download, FolderOpen, Inbox, Loader2, Trash2, Upload, X } from 'lucide-vue-next';
import { loadPresets, deletePreset, type CharacterPreset } from '@/utils/presetManager';
import { toast } from '@/utils/toast';
import PresetExportModal from './PresetExportModal.vue';
import PresetImportModal from './PresetImportModal.vue';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [preset: CharacterPreset];
}>();

const presets = ref<CharacterPreset[]>([]);
const selectedPreset = ref<CharacterPreset | null>(null);
const isLoading = ref(false);
const isSubmitting = ref(false);
const showExportModal = ref(false);
const showImportModal = ref(false);

watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      selectedPreset.value = null;
      await loadPresetsList();
    }
  }
);

async function loadPresetsList() {
  isLoading.value = true;
  try {
    console.log('[预设加载对话框] 开始加载预设列表');
    const loadedPresets = await loadPresets();
    presets.value = loadedPresets;
    console.log('[预设加载对话框] 成功加载', presets.value.length, '个预设',presets.value);
  } catch (error) {
    console.error('[预设加载对话框] 加载预设列表失败:', error);
    toast.error('加载预设列表失败');
    presets.value = [];
  } finally {
    isLoading.value = false;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return '今天';
  } else if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }
}

function closeModal() {
  if (!isSubmitting.value) {
    emit('close');
  }
}

function handleLoadPreset() {
  if (!selectedPreset.value || isSubmitting.value) {
    return;
  }

  isSubmitting.value = true;

  setTimeout(() => {
    if (selectedPreset.value) {
      emit('select', selectedPreset.value);
    }
    isSubmitting.value = false;
  }, 300);
}

async function handleDeletePreset(presetId: string) {
  if (window.confirm('确定要删除这个预设吗？此操作不可撤销。')) {
    try {
      await deletePreset(presetId);
      toast.success('预设已删除');
      await loadPresetsList(); // Refresh the list
      if (selectedPreset.value?.id === presetId) {
        selectedPreset.value = null;
      }
    } catch (error) {
      console.error('[预设加载对话框] 删除预设失败:', error);
      toast.error('删除预设失败');
    }
  }
}

function handleExported() {
  console.log('[预设加载对话框] 预设已导出');
  // 导出完成后可以刷新列表
  loadPresetsList();
}

async function handleImported(result: { success: number; failed: number }) {
  console.log('[预设加载对话框] 预设导入完成:', result);
  // 导入完成后刷新列表
  await loadPresetsList();
}
</script>

<style scoped>
/* 外观见 styles/creation-theme.css 的 cc-modal / cc-item */
.title-section {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.preset-count {
  font-size: 0.75rem;
  color: var(--cc-text-3);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 220px;
  text-align: center;
  color: var(--cc-text-2);
}

.state p {
  margin: 0;
}

.state-icon {
  color: var(--cc-gold);
  opacity: 0.7;
}

.state-hint {
  font-size: 0.8rem;
  color: var(--cc-text-3);
}

.presets-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.preset-item {
  align-items: flex-start;
  border-color: var(--cc-border);
  background: var(--cc-surface);
}

.preset-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.preset-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.preset-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--cc-text);
}

.preset-item.selected .preset-name {
  color: var(--cc-accent);
}

.preset-date {
  flex-shrink: 0;
  font-size: 0.72rem;
  color: var(--cc-text-3);
  font-variant-numeric: tabular-nums;
}

.preset-description {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.55;
  color: var(--cc-text-2);
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

@media (max-width: 480px) {
  .header-actions .cc-btn span {
    display: none;
  }
}
</style>
