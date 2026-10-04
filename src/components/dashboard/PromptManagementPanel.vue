<template>
  <div class="prompt-panel">
    <!-- 头部 -->
    <header class="pm-header">
      <div class="pm-title">
        <div class="header-emblem" aria-hidden="true"><span class="emblem-glyph">诀</span></div>
        <div class="pm-title-text">
          <h3>{{ t('提示词管理') }}</h3>
          <span>{{ t('调整发给 AI 的各段指令，改动需保存后生效') }}</span>
        </div>
      </div>
      <div class="pm-header-actions">
        <button type="button" class="cc-btn small" :disabled="isOnlineMode" :title="t('导入')" @click="importPrompts">
          <Upload :size="14" />
          <span>{{ t('导入') }}</span>
        </button>
        <button type="button" class="cc-btn small" :title="t('导出全部')" @click="exportPrompts">
          <Download :size="14" />
          <span>{{ t('导出') }}</span>
        </button>
        <button type="button" class="cc-btn small danger-btn" :disabled="isOnlineMode" :title="t('重置全部')" @click="resetAllPrompts">
          <RotateCcw :size="14" />
          <span>{{ t('重置') }}</span>
        </button>
        <button type="button" class="cc-btn small primary" :disabled="isOnlineMode" :title="t('保存全部')" @click="saveAll">
          <Save :size="14" />
          <span>{{ t('保存全部') }}</span>
        </button>
        <button
          v-if="closable"
          type="button"
          class="cc-modal-close"
          :aria-label="t('关闭')"
          :title="t('关闭')"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>
    </header>

    <!-- 搜索 + 展开折叠 -->
    <div class="pm-toolbar">
      <div class="search-box">
        <Search :size="15" class="search-icon" />
        <input
          v-model="searchQuery"
          class="cc-input search-input"
          type="text"
          :placeholder="t('搜索提示词（名称 / 键名 / 描述）')"
          :disabled="Object.keys(promptsByCategory).length === 0"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="clear-search"
          :aria-label="t('清空搜索')"
          @click="searchQuery = ''"
        >
          <X :size="14" />
        </button>
      </div>
      <div class="cc-segmented fold-switch">
        <button type="button" @click="expandAllCategories">
          <ChevronsUpDown :size="14" />
          <span>{{ t('全部展开') }}</span>
        </button>
        <button type="button" @click="collapseAllCategories">
          <ChevronsDownUp :size="14" />
          <span>{{ t('全部折叠') }}</span>
        </button>
      </div>
    </div>

    <!-- 联机只读提示 -->
    <div v-if="isOnlineMode" class="readonly-banner">
      <Lock :size="14" />
      <span>{{ t('联机模式下提示词仅供查看，无法编辑') }}</span>
    </div>

    <div class="prompt-list">
      <div v-if="Object.keys(displayPromptsByCategory).length === 0" class="cc-placeholder small">
        {{ t('未找到匹配的提示词') }}
      </div>

      <section v-for="(categoryData, categoryKey) in displayPromptsByCategory" :key="categoryKey" class="category-section">
        <button
          type="button"
          class="category-header"
          :aria-expanded="!!expandedCategories[categoryKey]"
          @click="toggleCategory(String(categoryKey))"
        >
          <ChevronRight :size="16" class="expand-icon" :class="{ expanded: expandedCategories[categoryKey] }" />
          <span class="category-name">{{ categoryData.info.name }}</span>
          <span class="category-count">{{ categoryData.prompts.length }}</span>
          <span class="category-desc">{{ categoryData.info.description }}</span>
        </button>

        <div v-if="expandedCategories[categoryKey]" class="category-content">
          <div
            v-for="prompt in categoryData.prompts"
            :key="prompt.key"
            class="prompt-item"
            :class="{ open: expandedPrompts[prompt.key], off: !prompt.enabled }"
          >
            <div class="prompt-header" role="button" tabindex="0" @click="togglePrompt(prompt.key)" @keydown.enter.prevent="togglePrompt(prompt.key)">
              <label class="toggle-switch" :title="prompt.enabled ? t('已启用') : t('已停用')" @click.stop>
                <input
                  type="checkbox"
                  :checked="prompt.enabled"
                  @change="toggleEnabled(prompt.key, ($event.target as HTMLInputElement).checked)"
                />
                <span class="toggle-slider"></span>
              </label>
              <div class="prompt-main">
                <span class="prompt-title">{{ prompt.name }}</span>
                <span v-if="prompt.description" class="prompt-desc" :title="prompt.description">{{ prompt.description }}</span>
              </div>
              <div class="prompt-meta">
                <label v-if="prompt.weight !== undefined" class="weight-editor" :title="t('权重越高，越靠前发送')" @click.stop>
                  <span>{{ t('权重') }}</span>
                  <input
                    type="number"
                    class="weight-input"
                    :class="getWeightClass(prompt.weight)"
                    :value="prompt.weight"
                    min="1"
                    max="10"
                    :disabled="isOnlineMode || !prompt.enabled"
                    @change="updateWeight(prompt.key, Number(($event.target as HTMLInputElement).value))"
                    @click.stop
                  />
                </label>
                <span class="prompt-status" :class="{ modified: prompt.modified }">
                  {{ prompt.modified ? t('已修改') : t('默认') }}
                </span>
                <ChevronDown :size="15" class="item-chevron" />
              </div>
            </div>

            <div v-if="expandedPrompts[prompt.key]" class="prompt-content">
              <div class="prompt-key-row">
                <span class="key-label">{{ t('键名') }}</span>
                <code class="prompt-key">{{ prompt.key }}</code>
              </div>
              <textarea
                v-model="prompt.content"
                rows="18"
                class="cc-input prompt-textarea"
                :disabled="isOnlineMode"
                @input="markModified(prompt.key)"
              ></textarea>
              <div class="prompt-actions">
                <button type="button" class="cc-btn small" @click="openPreview(prompt)">
                  <Eye :size="14" />
                  <span>{{ t('预览渲染') }}</span>
                </button>
                <button type="button" class="cc-btn small" @click="exportSingle(prompt.key)">
                  <Download :size="14" />
                  <span>{{ t('导出此项') }}</span>
                </button>
                <button type="button" class="cc-btn small" :disabled="isOnlineMode || !prompt.modified" @click="resetPrompt(prompt.key)">
                  <RotateCcw :size="14" />
                  <span>{{ t('重置为默认') }}</span>
                </button>
                <button type="button" class="cc-btn small primary" :disabled="isOnlineMode" @click="saveSingle(prompt.key)">
                  <Save :size="14" />
                  <span>{{ t('保存修改') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 预览渲染 -->
    <div v-if="previewPrompt" class="cc-modal-overlay preview-layer" @click.self="closePreview">
      <div class="cc-modal wide preview-modal" role="dialog" aria-modal="true">
        <div class="cc-modal-head">
          <div class="preview-title">
            <h3 class="cc-modal-title">{{ previewPrompt.name }}</h3>
            <code>{{ previewPrompt.key }}</code>
          </div>
          <button type="button" class="cc-modal-close" :aria-label="t('关闭')" @click="closePreview">
            <X :size="18" />
          </button>
        </div>
        <div class="cc-modal-body">
          <div v-if="previewVariables.length" class="preview-grid">
            <label v-for="variable in previewVariables" :key="variable" class="cc-field">
              <span class="cc-field-label">{{ variable }}</span>
              <input v-model="previewValues[variable]" class="cc-input" :placeholder="sampleValue(variable)" />
            </label>
          </div>
          <pre class="preview-content">{{ renderedPreview }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { promptStorage, type PromptItem, type PromptsByCategory } from '@/services/promptStorage';
import { toast } from '@/utils/toast';
import { createDadBundle, unwrapDadBundle } from '@/utils/dadBundle';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useI18n } from '@/i18n';
import {
  Upload, Download, RotateCcw, Save, X, Search, ChevronsUpDown, ChevronsDownUp,
  Lock, ChevronRight, ChevronDown, Eye,
} from 'lucide-vue-next';

withDefaults(defineProps<{ closable?: boolean }>(), { closable: false });
const emit = defineEmits<{ (e: 'close'): void }>();
const { t } = useI18n();

const gameStateStore = useGameStateStore();

// 云端修行仍允许用户编辑本地提示词；旧联机只读限制已移除。
const isOnlineMode = computed(() => false);

// 检测是否开启分步生成
const isSplitGeneration = computed(() => {
  const settings = localStorage.getItem('dad_game_settings');
  if (settings) {
    try {
      const parsed = JSON.parse(settings);
      return parsed.splitResponseGeneration === true; // 默认关闭，仅显式开启时为true
    } catch {
      return false;
    }
  }
  return false;
});

// 检测是否开启事件系统
const isEventSystemEnabled = computed(() => {
  return gameStateStore.eventSystem?.配置?.启用随机事件 !== false;
});

const promptsByCategory = ref<PromptsByCategory>({});
const expandedPrompts = ref<Record<string, boolean>>({});
const expandedCategories = ref<Record<string, boolean>>({});
const searchQuery = ref('');
const previewPrompt = ref<PromptItem | null>(null);
const previewValues = ref<Record<string, string>>({});

const displayPromptsByCategory = computed<PromptsByCategory>(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return promptsByCategory.value;

  const filtered: PromptsByCategory = {};
  for (const [categoryKey, categoryData] of Object.entries(promptsByCategory.value)) {
    const prompts = categoryData.prompts.filter((prompt) => {
      const haystack = [prompt.key, prompt.name, prompt.description ?? ''].join('\n').toLowerCase();
      return haystack.includes(query);
    });
    if (prompts.length > 0) {
      filtered[categoryKey] = { info: categoryData.info, prompts };
    }
  }
  return filtered;
});

onMounted(async () => {
  await loadPrompts();
});

async function loadPrompts() {
  promptsByCategory.value = await promptStorage.loadByCategory({
    isOnlineMode: isOnlineMode.value,
    isSplitGeneration: isSplitGeneration.value,
    isEventSystemEnabled: isEventSystemEnabled.value
  });
  // 默认展开第一个分类
  const firstCategory = Object.keys(promptsByCategory.value)[0];
  if (firstCategory) {
    expandedCategories.value[firstCategory] = true;
  }
}

watch(searchQuery, () => {
  const query = searchQuery.value.trim();
  if (!query) return;
  for (const key of Object.keys(displayPromptsByCategory.value)) {
    expandedCategories.value[key] = true;
  }
});


function toggleCategory(categoryKey: string) {
  expandedCategories.value[categoryKey] = !expandedCategories.value[categoryKey];
}

function togglePrompt(key: string) {
  expandedPrompts.value[key] = !expandedPrompts.value[key];
}

function openPreview(prompt: PromptItem) {
  previewPrompt.value = prompt;
  previewValues.value = Object.fromEntries(extractVariables(prompt.content).map((key) => [key, sampleValue(key)]));
}

function closePreview() {
  previewPrompt.value = null;
}

function extractVariables(content: string): string[] {
  const matches = [...content.matchAll(/\{\{\s*([\w.\-\u4e00-\u9fff]+)\s*\}\}|\{\s*([\w.\-\u4e00-\u9fff]+)\s*\}/g)];
  return [...new Set(matches.map((match) => (match[1] || match[2]).trim()).filter(Boolean))];
}

function sampleValue(variable: string): string {
  const normalized = variable.toLowerCase();
  if (normalized.includes('玩家') || normalized.includes('角色')) return '当前角色';
  if (normalized.includes('行动') || normalized.includes('输入')) return '尝试在山门外观察灵脉';
  if (normalized.includes('世界')) return '朝天大陆';
  if (normalized.includes('位置')) return '青云山脉';
  if (normalized.includes('历史') || normalized.includes('记忆')) return '上一回合发生的关键事实';
  return `[${variable}]`;
}

const previewVariables = computed(() => previewPrompt.value ? extractVariables(previewPrompt.value.content) : []);
const renderedPreview = computed(() => {
  if (!previewPrompt.value) return '';
  return previewPrompt.value.content.replace(/\{\{\s*([\w.\-\u4e00-\u9fff]+)\s*\}\}|\{\s*([\w.\-\u4e00-\u9fff]+)\s*\}/g, (_match, doubleKey: string, singleKey: string) => {
    const key = (doubleKey || singleKey).trim();
    return previewValues.value[key] ?? `[${key}]`;
  });
});

async function toggleEnabled(key: string, enabled: boolean) {
  // 更新本地状态
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      prompt.enabled = enabled;
      break;
    }
  }
  // 保存到存储
  await promptStorage.setEnabled(key, enabled);
  toast.info(enabled ? '已启用' : '已禁用');
}

function expandAllCategories() {
  for (const key in displayPromptsByCategory.value) {
    expandedCategories.value[key] = true;
  }
}

function collapseAllCategories() {
  for (const key in displayPromptsByCategory.value) {
    expandedCategories.value[key] = false;
  }
  // 同时折叠所有提示词
  expandedPrompts.value = {};
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function getWeightClass(weight: number): string {
  if (weight >= 9) return 'weight-high';
  if (weight >= 6) return 'weight-medium';
  return 'weight-low';
}

function markModified(key: string) {
  // 找到对应的提示词并标记为已修改
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      prompt.modified = prompt.content !== prompt.default;
      break;
    }
  }
}

/**
 * 更新提示词权重
 */
async function updateWeight(key: string, weight: number) {
  // 验证权重范围
  const clampedWeight = Math.min(10, Math.max(1, Math.round(weight)));

  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      prompt.weight = clampedWeight;
      // 保存到存储（保留当前内容和启用状态）
      await promptStorage.save(key, prompt.content, prompt.enabled, clampedWeight);
      toast.success(`权重已更新为 ${clampedWeight}`);
      break;
    }
  }
}

async function saveSingle(key: string) {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      await promptStorage.save(key, prompt.content, prompt.enabled, prompt.weight);
      toast.success(`已保存: ${prompt.name}`);
      break;
    }
  }
}

async function saveAll() {
  let savedCount = 0;
  for (const categoryKey in promptsByCategory.value) {
    for (const prompt of promptsByCategory.value[categoryKey].prompts) {
      if (prompt.modified) {
        await promptStorage.save(prompt.key, prompt.content, prompt.enabled, prompt.weight);
        savedCount++;
      }
    }
  }
  if (savedCount > 0) {
    toast.success(`已保存 ${savedCount} 项修改`);
  } else {
    toast.info('没有需要保存的修改');
  }
}

async function resetPrompt(key: string) {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      prompt.content = prompt.default;
      prompt.modified = false;
      await promptStorage.reset(key);
      toast.info(`已重置: ${prompt.name}`);
      break;
    }
  }
}

async function resetAllPrompts() {
  if (!confirm('确定要重置全部提示词为默认值吗？此操作不可撤销。')) {
    return;
  }
  await promptStorage.resetAll();
  await loadPrompts();
  toast.success('已重置全部提示词为默认值');
}

function exportSingle(key: string) {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      const data = createDadBundle('prompts', { [key]: prompt.content });
      downloadJSON(data, `prompt_${key}.json`);
      break;
    }
  }
}

async function exportPrompts() {
  const rawData = await promptStorage.exportAll();
  const data = createDadBundle('prompts', rawData);
  downloadJSON(data, 'prompts_all.json');
  toast.success('已导出全部提示词');
}

function importPrompts() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rawData = JSON.parse(text);
      // 使用 unwrapDadBundle 解析，兼容新旧格式
      const unwrapped = unwrapDadBundle(rawData);
      const promptsData = unwrapped.type === 'prompts' ? unwrapped.payload : rawData;
      const count = await promptStorage.importPrompts(promptsData);
      // 重新加载
      await loadPrompts();
      toast.success(`成功导入 ${count} 个提示词`);
    } catch {
      toast.error('导入失败，请检查文件格式');
    }
  };
  input.click();
}

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
/* ============================================================
   提示词管理 —— 令牌见 styles/xian-tokens.css，通用类见 creation-theme.css
   ============================================================ */
.prompt-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--cc-shell-bg);
  color: var(--cc-text);
}

/* ---------- 头部 ---------- */
.pm-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 1.1rem 1.25rem 1rem;
  border-bottom: 1px solid var(--cc-border);
  flex-shrink: 0;
}

.pm-header::after {
  content: '';
  position: absolute;
  left: 1.25rem;
  right: 1.25rem;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(var(--cc-gold-rgb), 0.55), transparent);
}

.pm-title {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.header-emblem {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(var(--cc-accent-rgb), 0.25) 0%, rgba(var(--cc-accent-rgb), 0.06) 75%);
  box-shadow: 0 0 0 1px rgba(var(--cc-gold-rgb), 0.5);
}

.header-emblem::before {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.4);
}

.emblem-glyph {
  font-family: var(--cc-calligraphy);
  font-size: 1.35rem;
  line-height: 1;
  color: var(--cc-accent);
}

.pm-title-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.pm-title-text h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: 0.18em;
}

.pm-title-text span {
  font-size: 0.78rem;
  color: var(--cc-text-3);
}

.pm-header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.danger-btn:hover:not(:disabled) {
  color: var(--cc-danger);
  border-color: rgba(var(--cc-danger-rgb), 0.55);
}

/* ---------- 工具条 ---------- */
.pm-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem 0.5rem;
  flex-shrink: 0;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 0;
}

.search-icon {
  position: absolute;
  left: 0.7rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--cc-text-3);
  pointer-events: none;
}

.search-input {
  padding-left: 2.1rem;
  padding-right: 2rem;
}

.clear-search {
  position: absolute;
  right: 0.4rem;
  top: 50%;
  display: flex;
  padding: 0.25rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--cc-text-3);
  cursor: pointer;
  transform: translateY(-50%);
}

.clear-search:hover {
  color: var(--cc-text);
}

.fold-switch {
  flex-shrink: 0;
}

.readonly-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.25rem 1.25rem 0;
  padding: 0.55rem 0.8rem;
  border: 1px solid rgba(var(--cc-warning-rgb), 0.4);
  border-radius: 6px;
  background: rgba(var(--cc-warning-rgb), 0.08);
  font-size: 0.82rem;
  color: var(--cc-warning);
}

/* ---------- 列表 ---------- */
.prompt-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.5rem 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.cc-placeholder.small {
  min-height: 200px;
}

.category-section {
  flex-shrink: 0;
  border: 1px solid var(--cc-border);
  border-radius: 10px;
  background: var(--cc-surface);
  overflow: hidden;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease;
}

.category-header:hover {
  background: var(--cc-surface-hover);
}

.category-header:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px rgba(var(--cc-accent-rgb), 0.4);
}

.expand-icon {
  flex-shrink: 0;
  color: var(--cc-gold);
  transition: transform 0.2s ease;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.category-name {
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  white-space: nowrap;
}

.category-count {
  flex-shrink: 0;
  padding: 0 0.45rem;
  border-radius: 999px;
  background: rgba(var(--cc-gold-rgb), 0.15);
  color: var(--cc-gold);
  font-size: 0.72rem;
  font-weight: 600;
}

.category-desc {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-size: 0.76rem;
  color: var(--cc-text-3);
}

.category-content {
  border-top: 1px solid var(--cc-divider);
}

.prompt-item + .prompt-item {
  border-top: 1px solid var(--cc-divider);
}

.prompt-item.open {
  background: rgba(var(--cc-gold-rgb), 0.03);
}

.prompt-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem 0.65rem 1.25rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.prompt-header:hover {
  background: var(--cc-surface-hover);
}

.prompt-header:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px rgba(var(--cc-accent-rgb), 0.35);
}

.prompt-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.prompt-title {
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--cc-text);
}

.prompt-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.74rem;
  color: var(--cc-text-3);
}

.prompt-item.off .prompt-title {
  color: var(--cc-text-3);
  text-decoration: line-through;
  text-decoration-color: rgba(var(--cc-gold-rgb), 0.5);
}

.prompt-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

.weight-editor {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: var(--cc-text-3);
}

.weight-input {
  width: 3rem;
  padding: 0.2rem 0.3rem;
  border: 1px solid var(--cc-border-strong);
  border-radius: 4px;
  background: var(--cc-inset);
  color: var(--cc-text);
  font-family: inherit;
  font-size: 0.8rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.weight-input.weight-high { color: var(--cc-gold); }
.weight-input.weight-medium { color: var(--cc-accent); }

.weight-input:disabled {
  opacity: 0.45;
}

.prompt-status {
  padding: 0.05rem 0.45rem;
  border: 1px solid var(--cc-border);
  border-radius: 3px;
  font-size: 0.68rem;
  color: var(--cc-text-3);
}

.prompt-status.modified {
  border-color: transparent;
  background: var(--cc-seal);
  color: var(--cc-seal-text);
}

.item-chevron {
  color: var(--cc-text-3);
  transition: transform 0.2s ease;
}

.prompt-item.open .item-chevron {
  transform: rotate(180deg);
  color: var(--cc-gold);
}

/* 开关 */
.toggle-switch {
  position: relative;
  flex-shrink: 0;
  width: 34px;
  height: 18px;
}

.toggle-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  border-radius: 18px;
  background: var(--cc-inset);
  border: 1px solid var(--cc-border-strong);
  cursor: pointer;
  transition: background 0.2s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #f5f2ea;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--cc-primary-bg);
  border-color: rgba(var(--cc-gold-rgb), 0.6);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(16px);
}

.toggle-switch input:focus-visible + .toggle-slider {
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

/* 展开内容 */
.prompt-content {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.25rem 1rem 1rem 1.25rem;
}

.prompt-key-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: var(--cc-text-3);
}

.prompt-key,
.preview-title code {
  padding: 0.05rem 0.4rem;
  border-radius: 3px;
  background: var(--cc-inset);
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 0.72rem;
  color: var(--cc-text-2);
}

.prompt-textarea {
  min-height: 280px;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 0.8rem;
  line-height: 1.7;
}

.prompt-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.45rem;
}

/* ---------- 预览 ---------- */
.preview-layer {
  z-index: 2200;
}

.preview-modal {
  width: min(860px, 100%);
}

.preview-title {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  min-width: 0;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.6rem;
}

.preview-content {
  margin: 0;
  padding: 0.9rem 1rem;
  max-height: 50vh;
  overflow: auto;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-inset);
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 0.78rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--cc-text-2);
}

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .pm-title-text span,
  .category-desc,
  .prompt-desc {
    display: none;
  }

  .pm-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .pm-header-actions .cc-btn span {
    display: none;
  }

  .prompt-list,
  .pm-toolbar {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
}
</style>
