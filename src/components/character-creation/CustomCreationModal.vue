<template>
  <transition name="modal-fade">
    <div v-if="visible" class="cc-modal-overlay" @click.self="close">
      <div class="cc-modal wide" role="dialog" aria-modal="true" :aria-label="title">
        <div class="cc-modal-head">
          <h2 class="cc-modal-title">{{ title }}</h2>
          <button type="button" class="cc-modal-close" :aria-label="$t('关闭')" @click="close">
            <X :size="18" />
          </button>
        </div>

        <div class="cc-modal-body">
          <div v-for="field in visibleFields" :key="field.key" class="cc-field">
            <label v-if="field.type !== 'dynamic-list'" :for="field.key">{{ field.label }}</label>
            <input
              v-if="field.type === 'text' || field.type === 'color' || field.type === 'number'"
              :id="field.key"
              v-model="formData[field.key]"
              class="cc-input"
              :class="{ 'color-input': field.type === 'color' }"
              :placeholder="field.placeholder"
              :type="field.type"
            />
            <textarea
              v-else-if="field.type === 'textarea'"
              :id="field.key"
              v-model="formData[field.key]"
              class="cc-input"
              :placeholder="field.placeholder"
              rows="5"
            ></textarea>
            <select
              v-else-if="field.type === 'select'"
              :id="field.key"
              v-model="formData[field.key]"
              class="cc-input"
            >
              <option v-for="opt in field.options" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <!-- 动态列表字段 -->
            <div v-else-if="field.type === 'dynamic-list'" class="dynamic-list">
              <div class="list-header">
                <span class="cc-field-label">{{ field.label }}</span>
                <button type="button" class="cc-btn small" @click="addListItem(field)">
                  <Plus :size="14" />
                  <span>{{ $t('添加') }}</span>
                </button>
              </div>
              <div v-if="Array.isArray(formData[field.key]) && (formData[field.key] as unknown[]).length > 0" class="list-items">
                <div v-for="(item, index) in (formData[field.key] as Record<string, unknown>[])" :key="index" class="list-row">
                  <div class="row-inputs">
                    <select v-if="field.columns[0].type === 'select'" v-model="(item as any)[field.columns[0].key]" class="cc-input">
                      <option v-for="opt in field.columns[0].options" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </option>
                    </select>
                    <input v-else v-model="(item as any)[field.columns[0].key]" :placeholder="field.columns[0].placeholder" class="cc-input" />

                    <input v-if="field.columns[1]" v-model="(item as any)[field.columns[1].key]" :placeholder="field.columns[1].placeholder" class="cc-input" />
                    <input v-if="field.columns[2]" v-model="(item as any)[field.columns[2].key]" :placeholder="field.columns[2].placeholder" class="cc-input" type="number" step="0.1" />
                  </div>
                  <button type="button" class="cc-icon-btn danger" :title="$t('删除此项')" @click="removeListItem(field, index)">
                    <Trash2 :size="13" />
                  </button>
                </div>
              </div>
              <div v-else class="empty-rows">{{ $t('暂无数据') }}</div>
            </div>
          </div>

          <div v-if="errors.length" class="cc-errors">
            <p v-for="(error, index) in errors" :key="index">{{ error }}</p>
          </div>
        </div>

        <div class="cc-modal-foot">
          <button type="button" class="cc-btn" @click="close">{{ $t('关闭') }}</button>
          <button type="button" class="cc-btn primary" @click="submit">
            <Check :size="15" />
            <span>{{ $t('确认') }}</span>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Check, Plus, Trash2, X } from 'lucide-vue-next';

type BaseField = {
  key: string;
  label: string;
  placeholder?: string;
  condition?: (data: Record<string, unknown>) => boolean;
};

type InputField = BaseField & { type: 'text' | 'textarea' | 'color' | 'number' };
type SelectField = BaseField & { type: 'select'; options: readonly { value: string; label: string }[] };
type DynamicListField = BaseField & {
  type: 'dynamic-list';
  columns: {
    key: string;
    placeholder?: string;
    type?: 'text' | 'select';
    options?: readonly { value: string; label: string }[];
  }[];
};
export type ModalField = InputField | SelectField | DynamicListField;

const props = defineProps<{
  visible: boolean;
  title: string;
  fields: readonly ModalField[];
  validationFn: (data: Record<string, unknown>) => { valid: boolean; errors: string[] };
  initialData?: Record<string, unknown>; // 新增：用于编辑模式的初始数据
}>();

const emit = defineEmits(['close', 'submit']);

const formData = ref<Record<string, unknown>>({});
const errors = ref<string[]>([]);

// Computed property to filter visible fields based on conditions
const visibleFields = computed(() => {
  return props.fields.filter(field => {
    if (!field.condition) return true;
    return field.condition(formData.value);
  });
});

// Initialize form data when fields change or when initialData is provided
watch(() => [props.fields, props.initialData] as const, ([newFields, initialData]) => {
  const newFormData: Record<string, unknown> = {};

  newFields.forEach((field) => {
    const initialValue = initialData?.[field.key];
    if (field.type === 'select') {
      newFormData[field.key] = initialValue ?? field.options?.[0]?.value ?? '';
    } else if (field.type === 'dynamic-list') {
      // Ensure we have an array, deep copy if it exists to avoid mutation of props
      newFormData[field.key] = Array.isArray(initialValue) ? JSON.parse(JSON.stringify(initialValue)) : [];
    } else {
      newFormData[field.key] = initialValue ?? '';
    }
  });
  formData.value = newFormData;
}, { immediate: true, deep: true });

function addListItem(field: DynamicListField) {
  const list = formData.value[field.key];
  if (!Array.isArray(list)) {
    // If it's not an array, initialize it as an empty one.
    formData.value[field.key] = [];
  }
  
  const newItem: Record<string, string | number> = {};
  field.columns.forEach(column => {
    if (column.type === 'select' && column.options) {
      newItem[column.key] = column.options[0]?.value || '';
    } else {
      newItem[column.key] = '';
    }
  });
  
  // After ensuring it's an array, we can safely push.
  (formData.value[field.key] as unknown[]).push(newItem);
}

function removeListItem(field: DynamicListField, index: number) {
  const list = formData.value[field.key];
  if (Array.isArray(list)) {
    list.splice(index, 1);
  }
}

function close() {
  emit('close');
}

function submit() {
  errors.value = [];
  const validationResult = props.validationFn(formData.value);
  if (validationResult.valid) {
    emit('submit', { ...formData.value });
    close();
  } else {
    errors.value = validationResult.errors;
  }
}
</script>

<style scoped>
/* 外观见 styles/creation-theme.css 的 cc-modal / cc-field */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.22s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.color-input {
  height: 40px;
  padding: 0.25rem;
  cursor: pointer;
}

/* 动态列表 */
.dynamic-list {
  padding: 0.85rem;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.4);
  border-radius: 8px;
  background: rgba(var(--cc-gold-rgb), 0.04);
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.7rem;
}

.list-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.row-inputs {
  display: flex;
  flex: 1;
  gap: 0.5rem;
  min-width: 0;
}

.empty-rows {
  padding: 1rem;
  text-align: center;
  font-size: 0.82rem;
  color: var(--cc-text-3);
}

@media (max-width: 600px) {
  .row-inputs {
    flex-direction: column;
  }
}
</style>
