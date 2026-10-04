<template>
  <EmptyState v-if="!sm.profile.value" glyph="存" title="修仙路上尚未留存" desc="当前没有激活的角色" />

  <div v-else class="save-page">
    <!-- 当前存档 -->
    <section class="current">
      <span class="gm-disc lg">{{ charName.charAt(0) }}</span>
      <div class="cur-main">
        <p class="cur-line">
          <b class="cur-name">{{ charName }}</b>
          <span>{{ realmText }}</span>
          <span v-if="locationText">· {{ locationText }}</span>
        </p>
        <p class="cur-sub">
          当前存档 <b>{{ sm.current.value?.存档名 || sm.activeSlotKey.value || '—' }}</b>
          <span>· 最后保存 {{ relTime(sm.current.value?.最后保存时间 || sm.current.value?.保存时间) }}</span>
          <span v-if="playTime(sm.current.value?.游戏时长)">· 游戏时长 {{ playTime(sm.current.value?.游戏时长) }}</span>
        </p>
        <p v-if="sm.current.value?.云端同步信息" class="cur-cloud">
          <CloudStatus :info="sm.current.value.云端同步信息" />
        </p>
      </div>
    </section>

    <div class="cols">
      <!-- 存档列表 -->
      <section class="list-col" aria-label="存档列表">
        <header class="gm-sec-head">
          <span class="gm-sec-seal">档</span>
          <h3>存档</h3>
          <span class="aside">{{ sm.slots.value.length }} 个</span>
          <button v-if="!sm.isCloud.value" type="button" class="cc-btn small" :disabled="busy" @click="createSave"><Plus :size="14" /><span>新建存档</span></button>
        </header>

        <EmptyState v-if="!sm.slots.value.length" glyph="存" title="修仙路上尚未留存" compact>
          <button v-if="!sm.isCloud.value" type="button" class="cc-btn small primary" @click="createSave"><Plus :size="14" /><span>新建存档</span></button>
        </EmptyState>

        <ol v-else class="slots">
          <li v-for="s in sortedSlots" :key="sm.keyOf(s)" class="slot" :class="[sm.kindOf(s), { active: sm.isActive(s) }]">
            <span class="slot-dot" aria-hidden="true"></span>
            <div class="slot-card">
              <header class="slot-head">
                <b class="slot-name">{{ s.存档名 || sm.keyOf(s) }}</b>
                <SealBadge v-if="sm.isActive(s)" tone="seal">当前</SealBadge>
                <SealBadge v-if="sm.kindOf(s) === 'last'" tone="muted">对话前自动备份</SealBadge>
                <SealBadge v-if="sm.kindOf(s) === 'timed'" tone="muted">时间点存档</SealBadge>
                <SealBadge v-if="sm.kindOf(s) === 'cloud'" tone="accent">云端修行</SealBadge>
                <span class="slot-time">{{ relTime(s.最后保存时间 || s.保存时间) }}</span>
              </header>
              <p class="slot-meta">{{ s.角色名字 || charName }} · {{ s.境界 || '凡人' }} · {{ s.位置 || '未知' }}<template v-if="s.游戏内时间"> · {{ s.游戏内时间 }}</template></p>
              <CloudStatus v-if="s.云端同步信息" :info="s.云端同步信息" class="slot-cloud" />
              <div class="slot-ops">
                <button
                  v-if="s.云端同步信息?.冲突"
                  type="button"
                  class="cc-btn small danger"
                  :disabled="busy"
                  title="读取时选择用云端还是本机进度"
                  @click="load(s)"
                >
                  <GitMerge :size="14" /><span>处理冲突</span>
                </button>
                <button v-else type="button" class="cc-btn small" :disabled="busy || sm.isActive(s)" @click="load(s)">
                  <Play :size="14" /><span>读取</span>
                </button>
                <button v-if="sm.kindOf(s) === 'last'" type="button" class="cc-btn small" :disabled="busy" @click="rollback">
                  <History :size="14" /><span>回退到上次对话</span>
                </button>
                <button v-if="sm.kindOf(s) === 'normal'" type="button" class="cc-btn small" :disabled="busy" @click="overwrite(s)">
                  <Save :size="14" /><span>覆盖</span>
                </button>
                <button v-if="sm.kindOf(s) === 'normal' && !sm.isActive(s)" type="button" class="cc-btn small ghost" :disabled="busy" @click="rename(s)">
                  <Pencil :size="14" /><span>重命名</span>
                </button>
                <button type="button" class="cc-btn small ghost" :disabled="busy" @click="exportOne(s)">
                  <Download :size="14" /><span>导出</span>
                </button>
                <span class="spacer"></span>
                <button
                  type="button"
                  class="cc-icon-btn danger"
                  :disabled="busy || !!sm.undeletableReason(s)"
                  :title="sm.undeletableReason(s) || '删除存档'"
                  :aria-label="sm.undeletableReason(s) || '删除存档'"
                  @click="remove(s)"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </li>
        </ol>
      </section>

      <!-- 侧栏 -->
      <aside class="side-col">
        <section class="side-sec">
          <h4 class="gm-label">自动存档</h4>
          <div class="gm-form-row">
            <div class="gm-form-info">
              <span class="gm-form-name">对话前自动备份</span>
              <span class="gm-form-desc">每次发送前备份到「上次对话」，用于回退</span>
            </div>
            <label class="gm-switch"><input v-model="conversationBackup" type="checkbox" /><span></span></label>
          </div>
          <template v-if="!sm.isCloud.value">
            <div class="gm-form-row">
              <div class="gm-form-info">
                <span class="gm-form-name">时间点存档</span>
                <span class="gm-form-desc">按间隔覆盖「时间点存档」</span>
              </div>
              <label class="gm-switch"><input v-model="timedSave" type="checkbox" /><span></span></label>
            </div>
            <div v-if="timedSave" class="gm-form-row nested">
              <div class="gm-form-info"><span class="gm-form-name">间隔</span></div>
              <div class="interval">
                <input v-model.number="timedInterval" class="gm-field" type="number" min="1" max="120" aria-label="间隔分钟" />
                <span>分钟</span>
              </div>
            </div>
          </template>
        </section>

        <section class="side-sec">
          <h4 class="gm-label">存档操作</h4>
          <div class="ops">
            <button type="button" class="cc-btn small" :disabled="busy" @click="run(exportCharacter)"><UserRound :size="14" /><span>导出角色</span></button>
            <button type="button" class="cc-btn small" :disabled="busy" @click="run(exportAll)"><PackageOpen :size="14" /><span>导出全部</span></button>
            <button type="button" class="cc-btn small" :disabled="busy" @click="fileInput?.click()"><Upload :size="14" /><span>导入存档</span></button>
          </div>
          <p class="side-note">导入支持本游戏导出的存档文件；旧版结构会在读取时提示迁移，并先保留一份隐藏备份。</p>
          <input ref="fileInput" type="file" accept=".json" hidden @change="onFile" />
        </section>

        <details class="danger-zone">
          <summary><TriangleAlert :size="14" />危险操作</summary>
          <div class="ops">
            <button type="button" class="cc-btn small" :disabled="busy || !sm.activeSlotKey.value" @click="repair"><Wrench :size="14" /><span>修复当前存档</span></button>
            <button type="button" class="cc-btn small danger" :disabled="busy" @click="clearAll"><Trash2 :size="14" /><span>清空所有存档</span></button>
          </div>
          <p class="side-note">修复会补全缺失字段、修正数据类型，建议先导出备份。</p>
        </details>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue';
import {
  Download, GitMerge, History, PackageOpen, Pencil, Play, Plus, RefreshCw, Save, Trash2, TriangleAlert, Upload, UserRound, Wrench,
} from 'lucide-vue-next';
import type { SaveSlot } from '@/types/game';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useSaveManager } from '@/composables/useSaveManager';
import { usePageActions } from '@/composables/usePageActions';
import { askText, confirmDialog } from '@/composables/useDialog';
import { formatRealmWithStage } from '@/utils/realmUtils';
import { toast } from '@/utils/toast';
import EmptyState from '@/components/game/EmptyState.vue';
import SealBadge from '@/components/game/SealBadge.vue';

defineOptions({ name: 'SavePage' });

const cs = useCharacterStore();
const gs = useGameStateStore();
const sm = useSaveManager();

const charName = computed(() => String((gs.character as any)?.名字 || sm.profile.value?.角色?.名字 || '无名'));
const realmText = computed(() => formatRealmWithStage((gs.attributes as any)?.境界));
const locationText = computed(() => String((gs.location as any)?.描述 || ''));

/** 当前 → 特殊槽位 → 其他按保存时间倒序 */
const sortedSlots = computed(() => {
  const time = (s: SaveSlot) => new Date(s.最后保存时间 || s.保存时间 || 0).getTime() || 0;
  const rank = (s: SaveSlot) => (sm.isActive(s) ? 0 : sm.kindOf(s) === 'last' ? 1 : sm.kindOf(s) === 'timed' ? 2 : 3);
  return [...sm.slots.value].sort((a, b) => rank(a) - rank(b) || time(b) - time(a));
});

const relTime = (t: unknown) => {
  if (!t) return '未保存';
  const d = new Date(t as string);
  if (Number.isNaN(d.getTime())) return '未知';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const playTime = (min?: number) => {
  if (!min || min < 1) return '';
  const h = Math.floor(min / 60);
  return h ? `${h} 小时 ${min % 60} 分` : `${min} 分钟`;
};

// ─── 自动存档 ───
const conversationBackup = computed({
  get: () => gs.conversationAutoSaveEnabled,
  set: (v: boolean) => {
    gs.setConversationAutoSaveEnabled(v);
    toast.info(`对话前自动备份已${v ? '开启' : '关闭'}`);
  },
});
const timedSave = computed({
  get: () => gs.timeBasedSaveEnabled,
  set: (v: boolean) => gs.setTimeBasedSaveEnabled(v),
});
const timedInterval = computed({
  get: () => gs.timeBasedSaveInterval,
  set: (v: number) => {
    if (Number.isFinite(v) && v >= 1) gs.setTimeBasedSaveInterval(Math.min(120, Math.floor(v)));
  },
});

// ─── 操作 ───
const busy = ref(false);
const run = async (fn: () => Promise<unknown>) => {
  if (busy.value) return;
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '操作失败');
  } finally {
    busy.value = false;
  }
};

const quickSave = () => run(async () => {
  await cs.saveCurrentGame({ notifyIfNoActive: true });
  toast.success('已保存');
});

const refresh = () => run(() => cs.loadSaves());

const createSave = async () => {
  const name = await askText({
    title: '新建存档',
    label: '存档名',
    defaultValue: `存档${sm.slots.value.filter((s) => sm.kindOf(s) === 'normal').length + 1}`,
    confirmText: '保存',
    validate: (v) => (!v ? '存档名不能为空' : sm.slots.value.some((s) => s.存档名 === v) ? '已有同名存档' : null),
  });
  if (!name) return;
  await run(async () => {
    await cs.saveCurrentGame({ notifyIfNoActive: true });
    const id = await cs.saveAsNewSlot(name);
    if (id) toast.success(`已新建存档「${name}」`);
  });
};

const overwrite = async (s: SaveSlot) => {
  const ok = await confirmDialog({ title: '覆盖存档', message: `用当前进度覆盖「${s.存档名}」？原内容无法恢复。`, confirmText: '覆盖', danger: true });
  if (!ok) return;
  await run(async () => {
    await cs.saveCurrentGame({ notifyIfNoActive: true });
    await cs.saveToSlot(s.存档名);
    toast.success(`已覆盖「${s.存档名}」`);
  });
};

const load = async (s: SaveSlot) => {
  if (!s.云端同步信息?.冲突) {
    const ok = await confirmDialog({ title: '读取存档', message: `读取「${s.存档名}」？当前未保存的进度会丢失。`, confirmText: '读取' });
    if (!ok) return;
  }
  await run(async () => {
    const done = await cs.loadGameById(sm.keyOf(s));
    if (done !== false) toast.success(`已读取「${s.存档名}」`);
  });
};

const rollback = async () => {
  const ok = await confirmDialog({ title: '回退到上次对话', message: '把进度恢复到上一次发送前的状态？当前进度会被覆盖。', confirmText: '回退', danger: true });
  if (ok) await run(() => cs.rollbackToLastConversation());
};

const rename = async (s: SaveSlot) => {
  const name = await askText({
    title: '重命名存档',
    label: '新名字',
    defaultValue: s.存档名,
    confirmText: '保存',
    validate: (v) => (!v ? '存档名不能为空' : v !== s.存档名 && sm.slots.value.some((x) => x.存档名 === v) ? '已有同名存档' : null),
  });
  if (!name || name === s.存档名) return;
  await run(() => cs.renameSave(cs.rootState.当前激活存档!.角色ID, sm.keyOf(s), name));
};

const remove = async (s: SaveSlot) => {
  if (sm.undeletableReason(s)) return;
  const ok = await confirmDialog({ title: '删除存档', message: `删除「${s.存档名}」？此操作不可撤销。`, confirmText: '删除', danger: true });
  if (!ok) return;
  await run(async () => {
    await cs.deleteSaveById(sm.keyOf(s));
    await cs.loadSaves();
    toast.success('存档已删除');
  });
};

const exportOne = (s: SaveSlot) => run(async () => {
  await sm.exportSlot(s);
  toast.success(`已导出「${s.存档名}」`);
});
const exportCharacter = async () => toast.success(`已导出角色（含 ${await sm.exportCharacter()} 个存档）`);
const exportAll = async () => toast.success(`已导出 ${await sm.exportAll()} 个存档`);

const fileInput = ref<HTMLInputElement | null>(null);
const onFile = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  await run(async () => toast.success(`已导入 ${await sm.importFile(file)} 个存档`));
};

const repair = async () => {
  const ok = await confirmDialog({
    title: '修复当前存档',
    message: '对当前存档做数据结构修复：补全缺失字段、修正数据类型。建议先导出备份。',
    confirmText: '开始修复',
  });
  if (!ok) return;
  await run(async () => {
    await sm.repairCurrent();
    toast.success('存档修复完成');
  });
};

const clearAll = async () => {
  if (!(await confirmDialog({ title: '清空所有存档', message: '删除这个角色的全部存档？此操作不可撤销。', confirmText: '继续', danger: true }))) return;
  if (!(await confirmDialog({ title: '再次确认', message: '再次确认：将永久删除所有存档数据！', confirmText: '确认清空', danger: true }))) return;
  await run(async () => {
    await cs.clearAllSaves();
    toast.success('所有存档已清空');
  });
};

usePageActions(() => [
  { key: 'refresh', title: '刷新', icon: RefreshCw, onClick: refresh, disabled: busy.value },
  { key: 'save', title: '快速存档', icon: Save, onClick: quickSave, primary: true, busy: busy.value },
]);

// ─── 云端同步状态小组件 ───
const CloudStatus = defineComponent({
  props: { info: { type: Object, required: true } },
  setup(props) {
    return () => {
      const i = props.info as NonNullable<SaveSlot['云端同步信息']>;
      const tags: { text: string; tone: string }[] = [];
      if (i.冲突) tags.push({ text: '冲突', tone: 'bad' });
      else if (i.需要同步) tags.push({ text: '待上传', tone: 'gold' });
      else tags.push({ text: '已同步', tone: 'good' });
      if (i.后端创建失败) tags.push({ text: '后端创建失败', tone: 'bad' });
      const parts = [
        typeof i.版本 === 'number' ? `v${i.版本}` : '',
        i.最后同步 ? `最后同步 ${relTime(i.最后同步)}` : '',
        i.需要同步 && i.本地修改时间 ? `本地修改 ${relTime(i.本地修改时间)}` : '',
      ].filter(Boolean);
      return h('span', { class: 'cloud-status' }, [
        h('span', { class: 'cloud-label' }, '云端'),
        ...tags.map((t) => h(SealBadge, { tone: t.tone as any }, () => t.text)),
        parts.length ? h('span', { class: 'cloud-meta' }, parts.join(' · ')) : null,
      ]);
    };
  },
});
</script>

<style scoped>
.save-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  height: 100%;
  min-height: 0;
  padding-top: 1.25rem;
}

.current {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  flex-shrink: 0;
  padding: 1rem 1.25rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(var(--cc-gold-rgb), 0.08), transparent 60%), var(--gm-block);
}

.cur-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.cur-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0;
  font-size: 15px;
  color: var(--cc-text-2);
}

.cur-name {
  font-family: var(--cc-calligraphy);
  font-size: 26px;
  font-weight: 400;
  letter-spacing: 0.1em;
  color: var(--cc-text);
}

.cur-sub,
.cur-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.cur-sub b {
  font-weight: 500;
  color: var(--cc-gold);
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 1.5rem;
  flex: 1;
  min-height: 0;
}

.list-col,
.side-col {
  min-height: 0;
  overflow-y: auto;
}

.list-col .gm-sec-head .cc-btn {
  margin-left: 0.75rem;
}

/* ---------- 存档时间线 ---------- */
.slots {
  position: relative;
  margin: 0;
  padding: 0 0 1rem;
  list-style: none;
}

.slots::before {
  content: '';
  position: absolute;
  top: 12px;
  bottom: 1rem;
  left: 7px;
  width: 2px;
  background: var(--gm-line);
}

.slot {
  position: relative;
  display: flex;
  gap: 0.9rem;
  padding-bottom: 0.8rem;
}

.slot-dot {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 0.85rem;
  border: 2px solid var(--cc-border-strong);
  border-radius: 50%;
  background: var(--cc-solid-bg);
}

.slot.active .slot-dot {
  border-color: var(--cc-seal);
  background: var(--cc-seal);
}

.slot.last .slot-dot,
.slot.timed .slot-dot {
  border-style: dashed;
}

.slot-card {
  flex: 1;
  min-width: 0;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--gm-block);
}

.slot.active .slot-card {
  border-color: rgba(var(--cc-gold-rgb), 0.5);
}

.slot-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.5rem;
}

.slot-name {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.slot-time {
  margin-left: auto;
  font-size: 13px;
  color: var(--cc-text-2);
}

.slot-meta {
  margin: 0.3rem 0 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.slot-cloud {
  margin-top: 0.35rem;
}

.slot-ops {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.6rem;
}

.slot-ops .spacer {
  flex: 1;
}

:deep(.cloud-status) {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  font-size: 12px;
}

:deep(.cloud-label) {
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

:deep(.cloud-meta) {
  color: var(--cc-text-3);
}

/* ---------- 侧栏 ---------- */
.side-col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.side-sec,
.danger-zone {
  padding: 0.9rem 1rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--gm-block);
}

.side-sec .gm-label {
  margin-bottom: 0.3rem;
}

.side-sec .gm-form-row:last-child {
  border-bottom: none;
}

.interval {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 14px;
  color: var(--cc-text-2);
}

.interval .gm-field {
  width: 72px;
  text-align: center;
}

.ops {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.side-note {
  margin: 0.6rem 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--cc-text-3);
}

.danger-zone {
  border-color: rgba(var(--cc-danger-rgb), 0.3);
}

.danger-zone summary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 14px;
  letter-spacing: 0.15em;
  color: var(--cc-danger);
  cursor: pointer;
}

@media (max-width: 1100px) {
  .cols {
    grid-template-columns: minmax(0, 1fr) 280px;
  }
}

@media (max-width: 768px) {
  .save-page {
    display: block;
    overflow-y: auto;
    padding-top: 0.75rem;
  }

  .current {
    margin-bottom: 1rem;
  }

  .cols {
    display: flex;
    flex-direction: column;
  }

  .list-col,
  .side-col {
    overflow: visible;
  }
}
</style>
