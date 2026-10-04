<template>
  <div v-if="open" class="overlay" @click.self="close">
    <div class="modal" @click.stop>
      <div class="header">
        <div class="title">
          <h3>正则替换规则</h3>
          <p class="subtitle">用于对 AI 输出进行替换处理（可用正则或纯文本）</p>
        </div>
        <button class="icon-btn" @click="close" aria-label="关闭">×</button>
      </div>

      <div class="body">
        <div class="left">
          <div class="left-actions">
            <button class="btn" @click="addRule">新增规则</button>
          </div>

          <div class="rule-list">
            <button
              v-for="(rule, idx) in draftRules"
              :key="rule.id"
              class="rule-item"
              :class="{ active: idx === selectedIndex }"
              @click="selectedIndex = idx"
            >
              <div class="rule-row">
                <span class="rule-badge" :class="{ off: !rule.enabled }">{{ rule.enabled ? '启用' : '停用' }}</span>
                <span class="rule-mode">{{ rule.mode === 'regex' ? '正则' : '文本' }}</span>
              </div>
              <div class="rule-pattern">{{ rule.pattern || '（未填写匹配）' }}</div>
              <div class="rule-repl">{{ rule.replacement || '（替换为空）' }}</div>
            </button>
          </div>
        </div>

        <div class="right">
          <div v-if="currentRule" class="editor">
            <div class="editor-row">
              <label class="label">启用</label>
              <input type="checkbox" v-model="currentRule.enabled" />
            </div>

            <div class="editor-row">
              <label class="label">匹配模式</label>
              <select v-model="currentRule.mode" class="select">
                <option value="regex">正则</option>
                <option value="text">纯文本</option>
              </select>
            </div>

            <div class="editor-row editor-row-vertical">
              <label class="label">匹配内容</label>
              <textarea v-model="currentRule.pattern" class="textarea" rows="3" placeholder="pattern 或 纯文本"></textarea>
            </div>

            <div class="editor-row editor-row-vertical">
              <label class="label">替换为</label>
              <textarea v-model="currentRule.replacement" class="textarea" rows="3" placeholder="可为空（表示删除）"></textarea>
              <div v-if="currentRule.mode === 'regex'" class="hint">
                支持捕获组：例如用 <code>$1</code> 引用分组
              </div>
            </div>

            <div class="options">
              <label class="opt">
                <input type="checkbox" v-model="currentRule.global" />
                全局（g）
              </label>
              <label class="opt">
                <input type="checkbox" v-model="currentRule.ignoreCase" />
                忽略大小写（i）
              </label>
              <label class="opt" :class="{ disabled: currentRule.mode !== 'regex' }">
                <input type="checkbox" v-model="currentRule.multiline" :disabled="currentRule.mode !== 'regex'" />
                多行（m）
              </label>
              <label class="opt" :class="{ disabled: currentRule.mode !== 'regex' }">
                <input type="checkbox" v-model="currentRule.dotAll" :disabled="currentRule.mode !== 'regex'" />
                点号匹配换行（s）
              </label>
            </div>

            <div v-if="ruleError" class="error">
              {{ ruleError }}
            </div>

            <div class="editor-actions">
              <button class="btn btn-secondary" :disabled="selectedIndex <= 0" @click="moveUp">上移</button>
              <button class="btn btn-secondary" :disabled="selectedIndex >= draftRules.length - 1" @click="moveDown">下移</button>
              <button class="btn btn-danger" :disabled="draftRules.length === 0" @click="removeRule">删除</button>
            </div>
          </div>
          <div v-else class="empty">
            暂无规则，点击“新增规则”开始配置
          </div>
        </div>
      </div>

      <div class="footer">
        <button class="btn btn-secondary" @click="close">取消</button>
        <button class="btn" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TextReplaceRule } from '@/types/textRules';

const props = defineProps<{
  open: boolean;
  rules: TextReplaceRule[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', rules: TextReplaceRule[]): void;
}>();

const draftRules = ref<TextReplaceRule[]>([]);
const selectedIndex = ref(0);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    const raw = Array.isArray(props.rules) ? props.rules : [];
    draftRules.value = JSON.parse(JSON.stringify(raw)) as TextReplaceRule[];
    if (draftRules.value.length === 0) {
      selectedIndex.value = 0;
    } else {
      selectedIndex.value = Math.min(selectedIndex.value, draftRules.value.length - 1);
    }
  },
  { immediate: true },
);

const currentRule = computed(() => {
  return draftRules.value[selectedIndex.value] ?? null;
});

function newId() {
  return `rule_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const addRule = () => {
  draftRules.value.push({
    id: newId(),
    enabled: true,
    mode: 'regex',
    pattern: '',
    replacement: '',
    global: true,
    ignoreCase: false,
    multiline: false,
    dotAll: false,
  });
  selectedIndex.value = draftRules.value.length - 1;
};

const removeRule = () => {
  if (draftRules.value.length === 0) return;
  draftRules.value.splice(selectedIndex.value, 1);
  selectedIndex.value = Math.max(0, Math.min(selectedIndex.value, draftRules.value.length - 1));
};

const moveUp = () => {
  if (selectedIndex.value <= 0) return;
  const idx = selectedIndex.value;
  const [item] = draftRules.value.splice(idx, 1);
  draftRules.value.splice(idx - 1, 0, item);
  selectedIndex.value = idx - 1;
};

const moveDown = () => {
  if (selectedIndex.value >= draftRules.value.length - 1) return;
  const idx = selectedIndex.value;
  const [item] = draftRules.value.splice(idx, 1);
  draftRules.value.splice(idx + 1, 0, item);
  selectedIndex.value = idx + 1;
};

const ruleError = computed(() => {
  const rule = currentRule.value;
  if (!rule) return null;
  if (!rule.pattern?.trim()) return null;

  if (rule.mode !== 'regex') return null;

  const flags =
    `${rule.global === false ? '' : 'g'}` +
    `${rule.ignoreCase ? 'i' : ''}` +
    `${rule.multiline ? 'm' : ''}` +
    `${rule.dotAll ? 's' : ''}`;
  try {
     
    new RegExp(rule.pattern, flags);
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `正则无效：${msg}`;
  }
});

const close = () => emit('close');

const save = () => {
  emit('save', draftRules.value);
  emit('close');
};
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 2000;
}

.modal {
  width: min(980px, 100%);
  max-height: 85vh;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(15, 23, 42, 0.92);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.55);
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.title h3 {
  margin: 0;
  font-size: 1.2rem;
}

.subtitle {
  margin: 0.35rem 0 0;
  color: rgba(148, 163, 184, 0.95);
  font-size: 0.92rem;
}

.icon-btn {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
}

.body {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 0;
  min-height: 0;
  flex: 1;
}

.left {
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.left-actions {
  padding: 0.9rem 0.9rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.rule-list {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  min-height: 0;
}

.rule-item {
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(30, 41, 59, 0.40);
  border-radius: 12px;
  padding: 10px 10px;
  cursor: pointer;
  text-align: left;
  color: inherit;
}

.rule-item.active {
  border-color: rgba(147, 197, 253, 0.28);
  background: rgba(51, 65, 85, 0.45);
}

.rule-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.rule-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(34, 197, 94, 0.30);
  color: rgba(34, 197, 94, 0.95);
}

.rule-badge.off {
  border-color: rgba(148, 163, 184, 0.25);
  color: rgba(148, 163, 184, 0.95);
}

.rule-mode {
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.95);
}

.rule-pattern {
  font-size: 0.9rem;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rule-repl {
  margin-top: 4px;
  font-size: 0.82rem;
  color: rgba(148, 163, 184, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.right {
  padding: 1rem 1.25rem;
  overflow: auto;
  min-height: 0;
}

.editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.editor-row-vertical {
  align-items: flex-start;
  flex-direction: column;
}

.label {
  width: 90px;
  color: rgba(148, 163, 184, 0.95);
  font-size: 0.9rem;
}

.select {
  width: 220px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
  padding: 10px 12px;
}

.textarea {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(30, 41, 59, 0.40);
  color: #e2e8f0;
  padding: 10px 12px;
  resize: vertical;
}

.hint {
  margin-top: 8px;
  color: rgba(148, 163, 184, 0.95);
  font-size: 0.9rem;
}

.hint code {
  padding: 1px 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.6);
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  padding: 0.5rem 0;
}

.opt {
  display: flex;
  gap: 8px;
  align-items: center;
  color: rgba(226, 232, 240, 0.95);
}

.opt.disabled {
  opacity: 0.6;
}

.error {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: rgba(127, 29, 29, 0.25);
  color: rgba(254, 202, 202, 0.95);
}

.editor-actions {
  display: flex;
  gap: 10px;
  padding-top: 6px;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 1rem 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
}

.btn:hover {
  background: rgba(51, 65, 85, 0.75);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-secondary {
  background: rgba(30, 41, 59, 0.40);
}

.btn-danger {
  border-color: rgba(239, 68, 68, 0.25);
}

.btn-danger:hover {
  background: rgba(127, 29, 29, 0.35);
  border-color: rgba(239, 68, 68, 0.45);
}

.empty {
  color: rgba(148, 163, 184, 0.95);
  padding: 2rem 1rem;
}

@media (max-width: 900px) {
  .body {
    grid-template-columns: 1fr;
  }

  .left {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
}
</style>

