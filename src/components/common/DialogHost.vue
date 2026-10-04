<template>
  <Teleport to="body">
    <div v-if="top" class="cc-modal-overlay dialog-layer" @click.self="cancel">
      <div
        ref="boxEl"
        class="cc-modal solid dialog"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="`dlg-title-${top.id}`"
        @keydown.esc.prevent="cancel"
      >
        <header class="cc-modal-head">
          <h3 :id="`dlg-title-${top.id}`" class="cc-modal-title">{{ top.options.title }}</h3>
          <button type="button" class="cc-modal-close" :aria-label="t('关闭')" :title="t('关闭')" @click="cancel">
            <X :size="18" />
          </button>
        </header>

        <div class="cc-modal-body">
          <!-- 确认 -->
          <template v-if="top.kind === 'confirm'">
            <p v-if="top.options.message" class="dlg-msg">{{ top.options.message }}</p>
            <ul v-if="top.options.details?.length" class="dlg-details">
              <li v-for="(d, i) in top.options.details" :key="i">{{ d }}</li>
            </ul>
          </template>

          <!-- 文字 -->
          <template v-else-if="top.kind === 'text'">
            <p v-if="top.options.message" class="dlg-msg">{{ top.options.message }}</p>
            <label class="cc-field">
              <span v-if="top.options.label" class="cc-field-label">{{ top.options.label }}</span>
              <textarea
                v-if="top.options.multiline"
                ref="inputEl"
                v-model="textValue"
                class="cc-input"
                rows="6"
                :placeholder="top.options.placeholder"
              ></textarea>
              <input
                v-else
                ref="inputEl"
                v-model="textValue"
                class="cc-input"
                type="text"
                :placeholder="top.options.placeholder"
                @keydown.enter.prevent="submit"
              />
            </label>
            <p v-if="textError" class="dlg-error">{{ textError }}</p>
          </template>

          <!-- 数量 -->
          <template v-else-if="top.kind === 'quantity'">
            <p v-if="top.options.itemName" class="dlg-item">
              <b>{{ top.options.itemName }}</b>
              <span>{{ top.options.maxLabel ?? t('持有') }} {{ top.options.max }}{{ top.options.unit || '' }}</span>
            </p>
            <p v-if="top.options.message" class="dlg-msg">{{ top.options.message }}</p>
            <div class="qty">
              <button type="button" class="cc-icon-btn qty-step" :aria-label="t('减少')" :disabled="qty <= qtyMin" @click="setQty(qty - 1)">
                <Minus :size="16" />
              </button>
              <input
                ref="inputEl"
                class="cc-input qty-input"
                type="number"
                :min="qtyMin"
                :max="top.options.max"
                :value="qty"
                @input="setQty(Number(($event.target as HTMLInputElement).value))"
                @keydown.enter.prevent="submit"
              />
              <button type="button" class="cc-icon-btn qty-step" :aria-label="t('增加')" :disabled="qty >= top.options.max" @click="setQty(qty + 1)">
                <Plus :size="16" />
              </button>
            </div>
            <div class="qty-quick">
              <button v-for="q in quickValues" :key="q.label" type="button" class="gm-chip" @click="setQty(q.value)">{{ q.label }}</button>
            </div>
          </template>
        </div>

        <footer class="cc-modal-foot">
          <button type="button" class="cc-btn" @click="cancel">{{ cancelText }}</button>
          <button
            ref="okEl"
            type="button"
            class="cc-btn"
            :class="isDanger ? 'danger-solid' : 'primary'"
            @click="submit"
          >
            {{ okText }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Minus, Plus, X } from 'lucide-vue-next';
import { dialogQueue, settleDialog } from '@/composables/useDialog';
import { useI18n } from '@/i18n';

const { t } = useI18n();

const top = computed(() => dialogQueue[0] ?? null);
const textValue = ref('');
const textError = ref('');
const qty = ref(1);
const inputEl = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);
const okEl = ref<HTMLButtonElement | null>(null);

const qtyMin = computed(() => (top.value?.kind === 'quantity' ? Math.max(1, top.value.options.min ?? 1) : 1));

const isDanger = computed(() => {
  const d = top.value;
  if (!d) return false;
  return (d.kind === 'confirm' || d.kind === 'quantity') && !!d.options.danger;
});

const okText = computed(() => top.value?.options.confirmText || t('确定'));
const cancelText = computed(() => (top.value?.kind === 'confirm' && top.value.options.cancelText) || t('取消'));

const quickValues = computed(() => {
  if (top.value?.kind !== 'quantity') return [];
  if (top.value.options.presets?.length) return top.value.options.presets;
  const max = top.value.options.max;
  const list = [1, 5, 10].filter((n) => n < max).map((n) => ({ label: String(n), value: n }));
  if (max > 2) list.push({ label: t('一半'), value: Math.max(1, Math.floor(max / 2)) });
  list.push({ label: t('全部'), value: max });
  return list;
});

const setQty = (n: number) => {
  if (top.value?.kind !== 'quantity') return;
  const max = top.value.options.max;
  qty.value = Math.max(qtyMin.value, Math.min(max, Math.floor(Number.isFinite(n) ? n : qtyMin.value)));
};

watch(
  () => top.value?.id,
  async () => {
    const d = top.value;
    if (!d) return;
    textError.value = '';
    if (d.kind === 'text') textValue.value = d.options.defaultValue ?? '';
    if (d.kind === 'quantity') qty.value = Math.max(1, Math.min(d.options.max, d.options.defaultValue ?? 1));
    await nextTick();
    if (d.kind === 'confirm') okEl.value?.focus();
    else {
      inputEl.value?.focus();
      if (inputEl.value && 'select' in inputEl.value) inputEl.value.select();
    }
  },
  { immediate: true },
);

const cancel = () => {
  const d = top.value;
  if (!d) return;
  settleDialog(d.id, d.kind === 'confirm' ? false : null);
};

const submit = () => {
  const d = top.value;
  if (!d) return;
  if (d.kind === 'confirm') return settleDialog(d.id, true);
  if (d.kind === 'quantity') return settleDialog(d.id, qty.value);
  const v = textValue.value.trim();
  const err = d.options.validate ? d.options.validate(v) : v ? null : t('不能为空');
  if (err) {
    textError.value = err;
    return;
  }
  settleDialog(d.id, v);
};
</script>

<style scoped>
.dialog-layer {
  z-index: 3000;
}

.dialog {
  width: min(440px, 100%);
}

.dlg-msg {
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
  color: var(--cc-text);
  white-space: pre-wrap;
}

.dlg-details {
  margin: 0;
  padding: 0.6rem 0.9rem 0.6rem 1.6rem;
  border-left: 2px solid rgba(var(--cc-gold-rgb), 0.35);
  background: var(--gm-block, var(--cc-surface));
  font-size: 14px;
  line-height: 1.7;
  color: var(--cc-text-2);
}

.dlg-error {
  margin: 0;
  font-size: 13px;
  color: var(--cc-danger);
}

.dlg-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin: 0;
}

.dlg-item b {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.dlg-item span {
  font-size: 13px;
  color: var(--cc-text-2);
}

.qty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.qty-step {
  width: 38px;
  height: 38px;
}

.qty-step:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.qty-input {
  flex: 1;
  text-align: center;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.qty-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.qty-quick .gm-chip {
  cursor: pointer;
}

.cc-btn.danger-solid {
  border-color: rgba(var(--cc-danger-rgb), 0.7);
  background: rgba(var(--cc-danger-rgb), 0.16);
  color: var(--cc-danger);
}

.cc-btn.danger-solid:hover {
  background: rgba(var(--cc-danger-rgb), 0.26);
}
</style>
