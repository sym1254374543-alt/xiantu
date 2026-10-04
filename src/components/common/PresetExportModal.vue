<template>
  <div v-if="visible" class="cc-modal-overlay sub-overlay" @click.self="closeModal">
    <div class="cc-modal solid" role="dialog" aria-modal="true" aria-labelledby="preset-export-title">
      <div class="cc-modal-head">
        <h2 id="preset-export-title" class="cc-modal-title">导出预设</h2>
        <button type="button" class="cc-modal-close" title="关闭" aria-label="关闭" :disabled="isExporting" @click="closeModal">
          <X :size="18" />
        </button>
      </div>

      <div class="cc-modal-body">
        <div v-if="isLoading" class="cc-state">
          <Loader2 :size="20" class="cc-spin" />
          <span>正在加载预设列表…</span>
        </div>

        <div v-else-if="presets.length === 0" class="cc-placeholder empty">
          <span>暂无可导出的预设<br /><small>请先在创角页保存预设</small></span>
        </div>

        <template v-else>
          <div class="cc-field">
            <span class="cc-field-label">导出范围</span>
            <div class="cc-segmented" role="radiogroup">
              <label>
                <input v-model="exportMode" type="radio" name="preset-export-mode" value="all" />
                <span>全部（{{ presets.length }}）</span>
              </label>
              <label>
                <input v-model="exportMode" type="radio" name="preset-export-mode" value="selected" />
                <span>手动选择</span>
              </label>
            </div>
          </div>

          <!-- 预设列表：仅手动选择时出现 -->
          <div v-if="exportMode === 'selected'" class="cc-panel pick-panel">
            <div class="pick-head">
              <button type="button" class="link-btn" @click="toggleSelectAll">
                {{ isAllSelected ? '取消全选' : '全选' }}
              </button>
              <span class="pick-count">已选 {{ selectedPresetIds.length }} / {{ presets.length }}</span>
            </div>
            <div class="cc-list">
              <label
                v-for="preset in presets"
                :key="preset.id"
                class="cc-item"
                :class="{ selected: selectedPresetIds.includes(preset.id) }"
              >
                <input v-model="selectedPresetIds" type="checkbox" :value="preset.id" class="pick-input" />
                <div class="preset-info">
                  <div class="preset-head">
                    <span class="cc-item-name">{{ preset.name || '未命名预设' }}</span>
                    <span class="cc-item-meta">{{ formatDate(preset.savedAt) }}</span>
                  </div>
                  <p v-if="preset.description" class="preset-desc">{{ preset.description }}</p>
                  <div v-if="preset.data" class="preset-tags">
                    <span v-if="preset.data.character_name" class="tag">{{ preset.data.character_name }}</span>
                    <span v-if="preset.data.current_age" class="tag">{{ preset.data.current_age }} 岁</span>
                    <span v-if="preset.data.world" class="tag">{{ preset.data.world.name }}</span>
                    <span v-if="preset.data.talentTier" class="tag">{{ preset.data.talentTier.name }}</span>
                  </div>
                </div>
                <span class="cc-item-check" aria-hidden="true"><Check :size="12" /></span>
              </label>
            </div>
          </div>

          <p class="cc-hint">将导出 <strong class="gold">{{ getExportCount() }}</strong> 个预设为 JSON 文件，可在其他设备通过「导入」恢复。</p>
        </template>
      </div>

      <div class="cc-modal-foot">
        <button type="button" class="cc-btn" :disabled="isExporting" @click="closeModal">取消</button>
        <button
          type="button"
          class="cc-btn primary"
          :disabled="!canExport || isExporting"
          @click="handleExport"
        >
          <Loader2 v-if="isExporting" :size="15" class="cc-spin" />
          <Upload v-else :size="15" />
          <span>{{ isExporting ? '导出中…' : '导出预设' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Check, Loader2, Upload, X } from 'lucide-vue-next';
import { loadPresets, exportPresets, type CharacterPreset } from '@/utils/presetManager';
import { toast } from '@/utils/toast';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  exported: [];
}>();

const presets = ref<CharacterPreset[]>([]);
const exportMode = ref<'all' | 'selected'>('all');
const selectedPresetIds = ref<string[]>([]);
const isLoading = ref(false);
const isExporting = ref(false);

const isAllSelected = computed(() => {
  return presets.value.length > 0 && selectedPresetIds.value.length === presets.value.length;
});

const canExport = computed(() => {
  if (presets.value.length === 0) return false;
  if (exportMode.value === 'all') return true;
  return selectedPresetIds.value.length > 0;
});

watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      exportMode.value = 'all';
      selectedPresetIds.value = [];
      await loadPresetsList();
    }
  }
);

async function loadPresetsList() {
  isLoading.value = true;
  try {
    console.log('[预设导出对话框] 开始加载预设列表');
    const loadedPresets = await loadPresets();
    presets.value = loadedPresets;
    console.log('[预设导出对话框] 成功加载', presets.value.length, '个预设');
  } catch (error) {
    console.error('[预设导出对话框] 加载预设列表失败:', error);
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

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedPresetIds.value = [];
  } else {
    selectedPresetIds.value = presets.value.map(p => p.id);
  }
}

function getExportCount(): number {
  if (exportMode.value === 'all') {
    return presets.value.length;
  }
  return selectedPresetIds.value.length;
}

function closeModal() {
  if (!isExporting.value) {
    emit('close');
  }
}

async function handleExport() {
  if (!canExport.value || isExporting.value) {
    return;
  }

  isExporting.value = true;
  const toastId = 'export-preset-toast';
  toast.loading('正在导出预设...', { id: toastId });

  try {
    // 根据导出模式选择要导出的预设ID
    const presetIds = exportMode.value === 'all' 
      ? undefined 
      : selectedPresetIds.value;

    await exportPresets(presetIds);

    const count = getExportCount();
    toast.success(`成功导出 ${count} 个预设！`, { id: toastId });
    
    emit('exported');
    emit('close');
  } catch (error) {
    console.error('[预设导出对话框] 导出失败:', error);
    const message = error instanceof Error ? error.message : '导出失败';
    toast.error(`导出失败: ${message}`, { id: toastId });
  } finally {
    isExporting.value = false;
  }
}
</script>

<style scoped>
/* 导出预设 —— 外壳用 creation-theme.css 的 cc-modal */
.sub-overlay {
  z-index: 1010;
}

.cc-state {
  gap: 0.6rem;
  min-height: 140px;
}

.cc-placeholder.empty {
  min-height: 180px;
  line-height: 1.9;
}

.cc-placeholder small {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
}

.pick-panel {
  max-height: 300px;
}

.pick-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.8rem;
  border-bottom: 1px solid var(--cc-divider);
  flex-shrink: 0;
}

.link-btn {
  padding: 0.15rem 0.3rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--cc-accent);
  font-family: inherit;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.link-btn:hover {
  background: rgba(var(--cc-accent-rgb), 0.12);
}

.pick-count {
  font-size: 0.78rem;
  color: var(--cc-text-3);
  font-variant-numeric: tabular-nums;
}

.cc-item {
  align-items: flex-start;
}

.pick-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.cc-item:has(.pick-input:focus-visible) {
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

.cc-item .cc-item-check {
  margin-top: 0.15rem;
}

.preset-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 0.3rem;
}

.preset-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  min-width: 0;
}

.preset-desc {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 0.78rem;
  line-height: 1.55;
  color: var(--cc-text-2);
}

.preset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.tag {
  padding: 0.02rem 0.4rem;
  border: 1px solid var(--cc-border);
  border-radius: 4px;
  font-size: 0.7rem;
  color: var(--cc-text-2);
}

.gold {
  margin: 0 0.15em;
  color: var(--cc-gold);
  font-variant-numeric: tabular-nums;
}

.cc-modal :is(.cc-btn, .cc-modal-close, .link-btn):focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}
</style>
