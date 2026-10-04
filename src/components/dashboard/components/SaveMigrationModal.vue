<template>
  <div class="migration">
    <header class="m-head">
      <span class="m-seal" aria-hidden="true">档</span>
      <div>
        <h4>检测到旧版存档结构</h4>
        <p>此存档不符合 V3（五领域：元数据 / 角色 / 社交 / 世界 / 系统），必须迁移后才能加载。</p>
      </div>
    </header>

    <dl class="gm-kv m-kv">
      <dt>角色 ID</dt><dd>{{ characterId }}</dd>
      <dt>存档槽位</dt><dd>{{ saveSlot }}</dd>
    </dl>

    <section>
      <h5 class="gm-label">检测到的旧字段</h5>
      <div class="m-tags">
        <span v-for="k in legacyKeysFound" :key="k" class="gm-chip">{{ k }}</span>
      </div>
    </section>

    <p class="m-hint">操作会先在 IndexedDB 创建一份隐藏备份（不出现在存档列表），再把当前槽位覆盖写回为 V3 新结构。</p>

    <footer class="m-actions">
      <button type="button" class="cc-btn" :disabled="busy" @click="cancelMigration">取消</button>
      <button type="button" class="cc-btn primary" :disabled="busy" @click="confirmMigration">
        {{ busy ? '正在迁移…' : '备份并迁移' }}
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

interface Props {
  characterId: string;
  saveSlot: string;
  legacyKeysFound: string[];
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

const props = defineProps<Props>();
const busy = ref(false);
let resolved = false;

const confirmMigration = async () => {
  if (busy.value) return;
  busy.value = true;
  try {
    resolved = true;
    await props.onConfirm?.();
  } finally {
    busy.value = false;
  }
};

const cancelMigration = () => {
  if (busy.value) return;
  resolved = true;
  props.onCancel?.();
};

onBeforeUnmount(() => {
  if (!resolved) {
    props.onCancel?.();
  }
});
</script>

<style scoped>
.migration {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: var(--cc-text);
}

.m-head {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
}

.m-seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border: 1.5px solid var(--cc-seal);
  border-radius: 4px;
  color: var(--cc-seal);
  font-family: var(--cc-calligraphy);
  font-size: 22px;
  transform: rotate(-4deg);
}

.m-head h4 {
  margin: 0 0 0.3rem;
  font-family: var(--cc-calligraphy);
  font-size: 22px;
  font-weight: 400;
  letter-spacing: 0.12em;
}

.m-head p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--cc-text-2);
}

section .gm-label {
  margin-bottom: 0.5rem;
}

.m-kv {
  margin: 0;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--gm-line);
  border-radius: 6px;
  background: var(--cc-inset);
}

.m-kv dd {
  word-break: break-all;
}

.m-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--cc-text-2);
}

.m-list li {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  line-height: 1.6;
}

.m-list li::before {
  content: '';
  flex-shrink: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--cc-warning);
  transform: translateY(-2px);
}

.m-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.m-hint {
  margin: 0;
  padding: 0.6rem 0.8rem;
  border-left: 2px solid rgba(var(--cc-gold-rgb), 0.6);
  background: rgba(var(--cc-gold-rgb), 0.06);
  font-size: 12px;
  line-height: 1.7;
  color: var(--cc-text-2);
}

.m-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
