<template>
  <div class="migration">
    <header class="m-head">
      <span class="m-seal" aria-hidden="true">宗</span>
      <div>
        <h4>检测到旧版宗门存档</h4>
        <p>将把宗门数据升级到 V{{ targetVersion }}，只写入 V3 路径（不再保留旧字段）。</p>
      </div>
    </header>

    <section>
      <h5 class="gm-label">检测原因</h5>
      <ul class="m-list">
        <li v-for="reason in displayReasons" :key="reason">{{ reason }}</li>
      </ul>
    </section>

    <dl class="gm-kv m-kv">
      <dt>当前宗门</dt><dd>{{ currentSectName }}</dd>
      <dt>势力数量</dt><dd>{{ factionCount }}</dd>
      <dt>存档模式</dt><dd>{{ modeLabel }}</dd>
    </dl>

    <p class="m-hint">迁移前会自动备份：单机模式生成新存档槽，联机模式写入本地备份记录。</p>

    <footer class="m-actions">
      <button type="button" class="cc-btn" :disabled="isMigrating" @click="later">稍后再说</button>
      <button type="button" class="cc-btn primary" :disabled="isMigrating" @click="runMigration">
        {{ isMigrating ? '正在迁移…' : '创建备份并迁移' }}
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useUIStore } from '@/stores/uiStore';
import { toast } from '@/utils/toast';
import * as storage from '@/utils/indexedDBManager';
import { migrateSectSaveData, SECT_SYSTEM_VERSION } from '@/utils/sectMigration';
import type { SaveData } from '@/types/game';

interface Props {
  reasons?: string[];
  fromVersion?: number;
  toVersion?: number;
}

const props = defineProps<Props>();
const characterStore = useCharacterStore();
const gameStateStore = useGameStateStore();
const uiStore = useUIStore();
const isMigrating = ref(false);

const targetVersion = computed(() => props.toVersion ?? SECT_SYSTEM_VERSION);
const displayReasons = computed(() => props.reasons?.length ? props.reasons : ['检测到旧版宗门字段']);

const currentSectName = computed(() => {
  const fromPlayer = gameStateStore.sectMemberInfo?.宗门名称;
  const fromSystem = gameStateStore.sectSystem?.当前宗门 ?? undefined;
  return fromPlayer || fromSystem || '未加入宗门';
});

const factionCount = computed(() => {
  const sectSystem = gameStateStore.sectSystem;
  if (sectSystem?.宗门档案) {
    return Object.keys(sectSystem.宗门档案).length;
  }
  return gameStateStore.worldInfo?.势力信息?.length || 0;
});

const modeLabel = computed(() => characterStore.activeCharacterProfile?.模式 || '未知');

const formatStamp = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const createBackup = async (saveData: SaveData) => {
  const active = characterStore.rootState.当前激活存档;
  const profile = characterStore.activeCharacterProfile;
  if (!active || !profile) {
    toast.warning('无法创建备份：未找到激活存档');
    return;
  }

  const backupName = `宗门迁移备份-${formatStamp()}`;

  if (profile.模式 === '单机') {
    await characterStore.saveAsNewSlot(backupName);
    return;
  }

  await storage.saveSaveData(active.角色ID, backupName, saveData);
  const backupIndexKey = 'sect_migration_backups';
  const record = { 角色ID: active.角色ID, 存档槽位: backupName, 时间: new Date().toISOString() };
  const existing = JSON.parse(localStorage.getItem(backupIndexKey) || '[]');
  existing.push(record);
  localStorage.setItem(backupIndexKey, JSON.stringify(existing.slice(-20)));
  toast.success(`已创建本地备份：${backupName}`);
};

const runMigration = async () => {
  if (isMigrating.value) return;
  isMigrating.value = true;

  try {
    const saveData = gameStateStore.getCurrentSaveData();
    if (!saveData) {
      toast.error('未找到存档数据，无法迁移');
      return;
    }

    await createBackup(saveData);

    const migrated = migrateSectSaveData(saveData);
    gameStateStore.loadFromSaveData(migrated);
    await characterStore.saveCurrentGame();

    toast.success('宗门存档迁移完成');
    uiStore.hideDetailModal();
  } catch (error) {
    toast.error(`宗门存档迁移失败：${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    isMigrating.value = false;
  }
};

const later = () => {
  uiStore.hideDetailModal();
};
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
