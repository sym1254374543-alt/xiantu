<template>
  <div v-if="visible" class="cc-modal-overlay sub-overlay" @click.self="closeModal">
    <div class="cc-modal solid" role="dialog" aria-modal="true" aria-labelledby="preset-import-title">
      <div class="cc-modal-head">
        <h2 id="preset-import-title" class="cc-modal-title">导入预设</h2>
        <button type="button" class="cc-modal-close" title="关闭" aria-label="关闭" :disabled="isImporting" @click="closeModal">
          <X :size="18" />
        </button>
      </div>

      <div class="cc-modal-body">
        <input
          ref="fileInputRef"
          type="file"
          accept=".json,application/json"
          class="file-input"
          @change="handleFileSelect"
        />

        <!-- 未选文件：拖放 / 点击区域 -->
        <div
          v-if="!selectedFile"
          class="drop-zone"
          :class="{ 'drag-over': isDragOver }"
          role="button"
          tabindex="0"
          @click="triggerFileInput"
          @keydown.enter.prevent="triggerFileInput"
          @keydown.space.prevent="triggerFileInput"
          @drop.prevent="handleDrop"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
        >
          <FileUp :size="30" class="drop-icon" />
          <p class="drop-text">拖放 JSON 文件到此处，或点击选择</p>
          <p class="drop-hint">仅支持本应用导出的预设文件，最大 10MB</p>
        </div>

        <!-- 已选文件 -->
        <div v-else class="file-card">
          <FileJson :size="20" class="file-icon" />
          <span class="file-name" :title="selectedFile.name">{{ selectedFile.name }}</span>
          <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
          <button
            type="button"
            class="cc-icon-btn danger"
            title="移除文件"
            aria-label="移除文件"
            :disabled="isImporting"
            @click="removeFile"
          >
            <X :size="14" />
          </button>
        </div>

        <!-- 导入方式 -->
        <div v-if="selectedFile && !importResult" class="cc-field">
          <span class="cc-field-label">导入方式</span>
          <div class="mode-list" role="radiogroup">
            <label class="mode-option" :class="{ selected: importMode === 'merge' }">
              <input v-model="importMode" type="radio" name="preset-import-mode" value="merge" />
              <span class="mode-check" aria-hidden="true"><Check :size="12" /></span>
              <span class="mode-text">
                <span class="mode-title">合并（推荐）</span>
                <span class="mode-desc">导入的预设追加到现有预设之后，原有预设保留</span>
              </span>
            </label>
            <label class="mode-option danger" :class="{ selected: importMode === 'replace' }">
              <input v-model="importMode" type="radio" name="preset-import-mode" value="replace" />
              <span class="mode-check" aria-hidden="true"><Check :size="12" /></span>
              <span class="mode-text">
                <span class="mode-title">替换</span>
                <span class="mode-desc">先删除全部现有预设，只保留导入的预设，不可撤销</span>
              </span>
            </label>
          </div>
        </div>

        <!-- 导入结果 -->
        <div v-if="importResult" class="result" :class="importResult.type" role="status">
          <CheckCircle v-if="importResult.type === 'success'" :size="18" />
          <AlertTriangle v-else-if="importResult.type === 'warning'" :size="18" />
          <XCircle v-else :size="18" />
          <div class="result-body">
            <p class="result-message">{{ importResult.message }}</p>
            <div v-if="importResult.details" class="cc-stat-row">
              <span v-if="importResult.details.success > 0" class="cc-stat">成功 <strong>{{ importResult.details.success }}</strong></span>
              <span v-if="importResult.details.failed > 0" class="cc-stat failed">失败 <strong>{{ importResult.details.failed }}</strong></span>
            </div>
          </div>
        </div>
      </div>

      <div class="cc-modal-foot">
        <button type="button" class="cc-btn" :disabled="isImporting" @click="closeModal">
          {{ importResult ? '关闭' : '取消' }}
        </button>
        <button
          v-if="!importResult"
          type="button"
          class="cc-btn primary"
          :disabled="!selectedFile || isImporting"
          @click="handleImport"
        >
          <Loader2 v-if="isImporting" :size="15" class="cc-spin" />
          <Download v-else :size="15" />
          <span>{{ isImporting ? '导入中…' : importMode === 'replace' ? '替换导入' : '开始导入' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { AlertTriangle, Check, CheckCircle, Download, FileJson, FileUp, Loader2, X, XCircle } from 'lucide-vue-next';
import { importPresets } from '@/utils/presetManager';
import { toast } from '@/utils/toast';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  imported: [result: { success: number; failed: number }];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const importMode = ref<'merge' | 'replace'>('merge');
const isImporting = ref(false);
const isDragOver = ref(false);
const importResult = ref<{
  type: 'success' | 'warning' | 'error';
  message: string;
  details?: { success: number; failed: number };
} | null>(null);

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      // 重置状态
      selectedFile.value = null;
      importMode.value = 'merge';
      importResult.value = null;
      isDragOver.value = false;
    }
  }
);

function triggerFileInput() {
  fileInputRef.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    validateAndSetFile(file);
  }
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false;
  const file = event.dataTransfer?.files[0];
  if (file) {
    validateAndSetFile(file);
  }
}

function validateAndSetFile(file: File) {
  // 验证文件类型
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    toast.error('请选择JSON格式的文件');
    return;
  }

  // 验证文件大小（限制为10MB）
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    toast.error('文件大小超过限制（最大10MB）');
    return;
  }

  selectedFile.value = file;
  importResult.value = null;
}

function removeFile() {
  selectedFile.value = null;
  importResult.value = null;
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

function closeModal() {
  if (!isImporting.value) {
    emit('close');
  }
}

async function handleImport() {
  if (!selectedFile.value || isImporting.value) {
    return;
  }

  // 如果是替换模式，需要确认
  if (importMode.value === 'replace') {
    const confirmed = window.confirm(
      '替换模式将删除所有现有预设！\n\n此操作不可撤销，确定要继续吗？'
    );
    if (!confirmed) {
      return;
    }
  }

  isImporting.value = true;
  const toastId = 'import-preset-toast';
  toast.loading('正在导入预设...', { id: toastId });

  try {
    const result = await importPresets(selectedFile.value, importMode.value);
    
    console.log('[预设导入对话框] 导入完成:', result);

    // 设置导入结果
    if (result.success > 0 && result.failed === 0) {
      importResult.value = {
        type: 'success',
        message: `成功导入 ${result.success} 个预设！`,
        details: result
      };
      toast.success(`成功导入 ${result.success} 个预设！`, { id: toastId });
    } else if (result.success > 0 && result.failed > 0) {
      importResult.value = {
        type: 'warning',
        message: '部分预设导入成功',
        details: result
      };
      toast.warning(`成功: ${result.success} 个，失败: ${result.failed} 个`, { id: toastId });
    } else {
      importResult.value = {
        type: 'error',
        message: '预设导入失败',
        details: result
      };
      toast.error('预设导入失败', { id: toastId });
    }

    emit('imported', result);
  } catch (error) {
    console.error('[预设导入对话框] 导入失败:', error);
    const message = error instanceof Error ? error.message : '导入失败';
    
    importResult.value = {
      type: 'error',
      message: `导入失败: ${message}`
    };
    
    toast.error(`导入失败: ${message}`, { id: toastId });
  } finally {
    isImporting.value = false;
  }
}
</script>

<style scoped>
/* 导入预设 —— 外壳用 creation-theme.css 的 cc-modal */
.sub-overlay {
  z-index: 1010;
}

.file-input {
  display: none;
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  padding: 2rem 1.25rem;
  border: 1px dashed var(--cc-border-strong);
  border-radius: 8px;
  background: var(--cc-inset);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.drop-zone:hover,
.drop-zone.drag-over {
  border-color: rgba(var(--cc-gold-rgb), 0.75);
  background: var(--cc-surface-hover);
}

.drop-zone.drag-over {
  box-shadow: var(--cc-glow);
}

.drop-zone:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

.drop-icon {
  color: var(--cc-gold);
}

.drop-text {
  margin: 0;
  font-size: 0.92rem;
  letter-spacing: 0.08em;
  color: var(--cc-text);
}

.drop-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--cc-text-3);
}

.file-card {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--cc-border);
  border-left: 3px solid var(--cc-gold);
  border-radius: 6px;
  background: var(--cc-surface);
}

.file-icon {
  flex-shrink: 0;
  color: var(--cc-gold);
}

.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
  color: var(--cc-text);
}

.file-size {
  flex-shrink: 0;
  font-size: 0.78rem;
  color: var(--cc-text-3);
  font-variant-numeric: tabular-nums;
}

/* 导入方式：单选卡片 */
.mode-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mode-option {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.25s ease;
}

.mode-option:hover {
  background: var(--cc-surface-hover);
}

.mode-option.selected {
  background: var(--cc-selected-bg);
  border-color: rgba(var(--cc-gold-rgb), 0.5);
  box-shadow: var(--cc-glow);
}

.mode-option.danger.selected {
  border-color: rgba(var(--cc-danger-rgb), 0.55);
}

.mode-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.mode-option:has(input:focus-visible) {
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

.mode-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-top: 0.1rem;
  border: 1px solid var(--cc-border-strong);
  border-radius: 50%;
  color: transparent;
}

.mode-option.selected .mode-check {
  border-color: var(--cc-seal);
  background: var(--cc-seal);
  color: var(--cc-seal-text);
}

.mode-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.mode-title {
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  color: var(--cc-text);
}

.mode-option.selected .mode-title {
  color: var(--cc-accent);
}

.mode-option.danger.selected .mode-title,
.mode-option.danger .mode-desc {
  color: var(--cc-danger);
}

.mode-desc {
  font-size: 0.78rem;
  line-height: 1.55;
  color: var(--cc-text-3);
}

/* 结果 */
.result {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
}

.result > svg {
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.result.success {
  border-color: color-mix(in srgb, var(--cc-success) 45%, transparent);
  background: color-mix(in srgb, var(--cc-success) 8%, transparent);
  color: var(--cc-success);
}

.result.warning {
  border-color: rgba(var(--cc-warning-rgb), 0.45);
  background: rgba(var(--cc-warning-rgb), 0.08);
  color: var(--cc-warning);
}

.result.error {
  border-color: rgba(var(--cc-danger-rgb), 0.45);
  background: rgba(var(--cc-danger-rgb), 0.08);
  color: var(--cc-danger);
}

.result-body {
  flex: 1;
  min-width: 0;
}

.result-message {
  margin: 0;
  font-size: 0.9rem;
  letter-spacing: 0.06em;
  color: var(--cc-text);
}

.result .cc-stat-row {
  margin-top: 0.6rem;
}

.cc-stat.failed {
  border-color: rgba(var(--cc-danger-rgb), 0.45);
  background: rgba(var(--cc-danger-rgb), 0.08);
}

.cc-stat.failed strong {
  color: var(--cc-danger);
}

.cc-modal :is(.cc-btn, .cc-icon-btn, .cc-modal-close):focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}
</style>
