<template>
  <div class="prompts">
    <div class="p-body" :class="{ 'show-preview': view === 'preview' }">
      <!-- 窄屏：编辑与预览切换显示 -->
      <div class="view-seg gm-seg" role="radiogroup" aria-label="编辑或预览">
        <button type="button" role="radio" :aria-checked="view === 'edit'" :class="{ active: view === 'edit' }" @click="view = 'edit'">编辑</button>
        <button type="button" role="radio" :aria-checked="view === 'preview'" :class="{ active: view === 'preview' }" @click="view = 'preview'">渲染预览</button>
      </div>

      <!-- 分类 -->
      <nav class="cats" aria-label="提示词分类">
        <label class="gm-search cat-search">
          <Search :size="15" />
          <input v-model="query" class="cc-input" type="search" placeholder="搜索名称 / 键名 / 描述" aria-label="搜索提示词" />
        </label>
        <p class="cat-sum">系统提示词 {{ total }} 项 · 已改 {{ modifiedCount }} · 停用 {{ disabledCount }}</p>

        <section
          v-for="slot in styleList"
          v-show="slotVisible(slot)"
          :key="slot.key"
          class="slot"
          :class="{ on: focus?.kind === 'style' && focus.key === slot.key }"
        >
          <button type="button" class="cat-head" @click="focusStyle(slot.key)">
            <b>{{ slot.name }}</b>
            <SealBadge v-if="!slot.enabled" tone="muted">停</SealBadge>
            <em>{{ slotEm(slot) }}</em>
          </button>
          <ul class="cat-list" role="listbox" :aria-label="slot.name + '预设'">
            <li v-for="p in visiblePresets(slot)" :key="p.id" class="item-row">
              <button type="button" role="option" class="item" :aria-selected="isPicked(slot, p.id)" :class="{ active: isPicked(slot, p.id) }" @click="pickPreset(slot.key, p.id)">
                <span class="dot" :class="{ on: isPicked(slot, p.id) }"></span>
                <span class="item-name">{{ p.name }}</span>
              </button>
              <button v-if="p.user" type="button" class="item-x" :aria-label="'删除预设 ' + p.name" @click="removeUser(slot.key, p.id)"><X :size="12" /></button>
            </li>
            <li v-if="showCustom(slot)">
              <button type="button" role="option" class="item" :aria-selected="isPicked(slot, 'custom')" :class="{ active: isPicked(slot, 'custom') }" @click="pickCustom(slot.key)">
                <span class="dot" :class="{ on: isPicked(slot, 'custom') }"></span>
                <span class="item-name">自定义</span>
              </button>
            </li>
          </ul>
        </section>
        <p v-if="Object.keys(systemFiltered).length" class="cat-split">系统提示词</p>

        <div v-for="(cat, ck) in systemFiltered" :key="ck" class="cat">
          <button type="button" class="cat-head" :aria-expanded="open.has(String(ck))" @click="toggleCat(String(ck))">
            <ChevronRight :size="14" class="caret" :class="{ open: open.has(String(ck)) }" />
            <b>{{ cat.info.name }}</b>
            <em>{{ cat.prompts.length }}</em>
          </button>
          <ul v-if="open.has(String(ck))" class="cat-list">
            <li v-for="p in cat.prompts" :key="p.key">
              <button type="button" class="item" :class="{ active: selectedKey === p.key, off: !p.enabled, idle: !!inactiveReason(p) }" @click="select(p.key)">
                <span class="dot" :class="{ on: p.enabled }"></span>
                <span class="item-name">{{ p.name }}</span>
                <SealBadge v-if="p.modified" tone="gold">改</SealBadge>
              </button>
            </li>
          </ul>
        </div>
        <EmptyState v-if="nothingMatched" glyph="寻" title="没有匹配的提示词" compact />
      </nav>

      <!-- 编辑 -->
      <section class="edit">
        <template v-if="activeStyle">
          <header class="e-head">
            <div class="e-id">
              <h3>{{ activeStyle.name }}</h3>
              <code>{{ activeStyle.key }}</code>
            </div>
            <label class="e-switch">
              <span class="gm-switch"><input type="checkbox" :checked="activeStyle.enabled" @change="setStyleEnabled(($event.target as HTMLInputElement).checked)" /><span></span></span>
              {{ activeStyle.enabled ? '启用' : '停用' }}
            </label>
          </header>
          <p class="e-desc">{{ activeStyle.desc }}。左侧点预设即生效；改下面的文字并保存，即为自定义。</p>
          <p class="e-status">{{ styleStatus }}</p>
          <p v-if="!activeStyle.enabled" class="e-note"><Info :size="14" />已停用，本段不会发给 AI。</p>

          <textarea v-model="draft" class="gm-field e-area" spellcheck="false" :aria-label="activeStyle.name + '内容'"></textarea>
          <p class="e-count">{{ draft.length }} 字 <template v-if="dirty">· 未保存</template></p>

          <footer class="e-foot">
            <button type="button" class="cc-btn small" :disabled="!canRestore" title="恢复到当前所基于的预设" @click="restorePreset"><RotateCcw :size="14" /><span>恢复预设</span></button>
            <button type="button" class="cc-btn small ghost" @click="saveAsPreset"><BookmarkPlus :size="14" /><span>另存为我的预设</span></button>
            <span class="spacer"></span>
            <button type="button" class="cc-btn small" :disabled="!dirty" @click="discardDraft">取消</button>
            <button type="button" class="cc-btn small primary" :disabled="!dirty" @click="saveStyle"><Save :size="14" /><span>保存</span></button>
          </footer>
        </template>
        <template v-else-if="selected">
          <header class="e-head">
            <div class="e-id">
              <h3>{{ selected.name }}</h3>
              <code>{{ selected.key }}</code>
            </div>
            <label class="e-switch">
              <span class="gm-switch"><input type="checkbox" :checked="selected.enabled" @change="setEnabled(($event.target as HTMLInputElement).checked)" /><span></span></span>
              {{ selected.enabled ? '启用' : '停用' }}
            </label>
          </header>
          <p v-if="selected.description" class="e-desc">{{ selected.description }}</p>
          <p v-if="inactiveReason(selected)" class="e-note"><Info :size="14" />{{ inactiveReason(selected) }}</p>

          <div class="e-weight">
            <span>权重</span>
            <RangeSlider v-model="draftWeight" :min="1" :max="10" :step="1" aria-label="权重" @commit="saveWeight" />
            <b>{{ draftWeight }}</b>
            <small>越高越靠前发送</small>
          </div>

          <textarea v-model="draft" class="gm-field e-area" spellcheck="false" aria-label="提示词内容"></textarea>
          <p class="e-count">{{ draft.length }} 字 <template v-if="dirty">· 未保存</template></p>

          <footer class="e-foot">
            <button type="button" class="cc-btn small" :disabled="!selected.modified && !dirty" title="恢复为内置默认内容" @click="resetOne"><RotateCcw :size="14" /><span>重置为默认</span></button>
            <button type="button" class="cc-btn small ghost" @click="exportOne"><Download :size="14" /><span>导出此项</span></button>
            <span class="spacer"></span>
            <button type="button" class="cc-btn small" :disabled="!dirty" @click="draft = selected.content">取消</button>
            <button type="button" class="cc-btn small primary" :disabled="!dirty" @click="saveOne"><Save :size="14" /><span>保存</span></button>
          </footer>
        </template>
        <EmptyState v-else glyph="令" title="选择文风、性格或一条提示词" desc="左侧上方是文风和主角性格预设，下方是系统提示词" compact />
      </section>

      <!-- 预览 -->
      <aside class="preview">
        <h4 class="gm-label">{{ activeStyle ? activeStyle.name + '预览' : '渲染预览' }}</h4>
        <template v-if="activeStyle">
          <p v-if="activeSample" class="sample-line">{{ activeSample }}</p>
          <p v-else class="gm-muted">{{ previewNote }}</p>
          <pre class="rendered">{{ draft }}</pre>
        </template>
        <template v-else-if="selected">
          <div v-if="variables.length" class="vars">
            <label v-for="k in variables" :key="k" class="var">
              <span>{{ k }}</span>
              <input v-model="sample[k]" class="gm-field" :aria-label="k" />
            </label>
          </div>
          <p v-else class="gm-muted">这条提示词没有 {{ '{' }}{{ '{' }}变量{{ '}' }}{{ '}' }}。</p>
          <pre class="rendered">{{ rendered }}</pre>
        </template>
        <p v-else class="gm-muted">选中文风时这里显示示例；选中系统提示词后可填样例值、看渲染结果。</p>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { BookmarkPlus, ChevronRight, Download, Info, RotateCcw, Save, Search, Upload, X } from 'lucide-vue-next';
import { promptStorage, type PromptItem, type PromptsByCategory } from '@/services/promptStorage';
import { CUSTOM_PRESET_ID, STYLE_PROMPT_KEYS, STYLE_SLOTS } from '@/data/stylePresets';
import { useStylePresets, type StyleSlotState } from '@/composables/useStylePresets';
import { askText, confirmDialog } from '@/composables/useDialog';
import { createDadBundle, unwrapDadBundle } from '@/utils/dadBundle';
import { downloadText } from '@/utils/gameDisplay';
import { useGameStateStore } from '@/stores/gameStateStore';
import { usePageActions } from '@/composables/usePageActions';
import { toast } from '@/utils/toast';
import RangeSlider from '@/components/common/RangeSlider.vue';
import EmptyState from '@/components/game/EmptyState.vue';
import SealBadge from '@/components/game/SealBadge.vue';

defineOptions({ name: 'PromptsPage' });

const gs = useGameStateStore();

/** 窄屏下编辑区与预览区二选一显示 */
const view = ref<'edit' | 'preview'>('edit');

// ─── 生效条件 ───
const splitGeneration = () => {
  try {
    return JSON.parse(localStorage.getItem('dad_game_settings') || '{}').splitResponseGeneration === true;
  } catch {
    return false;
  }
};
const eventSystemOn = () => (gs.eventSystem as any)?.配置?.启用随机事件 !== false;
const inactiveReason = (p: PromptItem) => {
  if (p.condition === 'splitGeneration' && !splitGeneration()) return '仅在「分步生成」开启时生效（API 管理 → 生成方式）';
  if (p.condition === 'eventSystem' && !eventSystemOn()) return '仅在世界事件的随机事件开启时生效';
  return '';
};

// ─── 数据 ───
const HIDDEN = new Set<string>(STYLE_PROMPT_KEYS);
const styles = useStylePresets();
const data = ref<PromptsByCategory>({});
const open = ref(new Set<string>());
const query = ref('');

type Focus = { kind: 'style'; key: string } | { kind: 'prompt'; key: string };
const focus = ref<Focus | null>({ kind: 'style', key: 'styleNarrative' });
/** 点了「自定义」但还没改字时，也要高亮自定义 */
const forceCustom = ref(false);

const load = async () => {
  // 旧联机专用条目不再展示；分步 / 事件条目展示但标注是否生效
  data.value = await promptStorage.loadByCategory({ isOnlineMode: false, isSplitGeneration: true, isEventSystemEnabled: true });
  for (const k of Object.keys(data.value)) if (!data.value[k].prompts.length) delete data.value[k];
  await styles.load();
  if (!open.value.size) {
    const first = Object.keys(data.value).find((k) => data.value[k].prompts.some((p) => !HIDDEN.has(p.key)));
    if (first) open.value = new Set([first]);
  }
  if (!focus.value) focus.value = { kind: 'style', key: 'styleNarrative' };
};
onMounted(load);

const all = computed(() => Object.values(data.value).flatMap((c) => c.prompts));
const systemAll = computed(() => all.value.filter((p) => !HIDDEN.has(p.key)));
const total = computed(() => systemAll.value.length);
const modifiedCount = computed(() => systemAll.value.filter((p) => p.modified).length);
const disabledCount = computed(() => systemAll.value.filter((p) => !p.enabled).length);

const styleList = computed(() => STYLE_SLOTS.map((d) => styles.slots[d.key]).filter(Boolean));

const systemFiltered = computed<PromptsByCategory>(() => {
  const q = query.value.trim().toLowerCase();
  const out: PromptsByCategory = {};
  for (const [k, c] of Object.entries(data.value)) {
    let prompts = c.prompts.filter((p) => !HIDDEN.has(p.key));
    if (q) prompts = prompts.filter((p) => [p.key, p.name, p.description ?? ''].join('\n').toLowerCase().includes(q));
    if (prompts.length) out[k] = { info: c.info, prompts };
  }
  return out;
});
const nothingMatched = computed(() => !styleList.value.some((slot) => slotVisible(slot)) && !Object.keys(systemFiltered.value).length);
watch(query, (q) => {
  if (q.trim()) open.value = new Set(Object.keys(systemFiltered.value));
});
const toggleCat = (k: string) => {
  const s = new Set(open.value);
  if (s.has(k)) s.delete(k);
  else s.add(k);
  open.value = s;
};

// ─── 选中 / 编辑 ───
const selectedKey = computed(() => (focus.value?.kind === 'prompt' ? focus.value.key : ''));
const selected = computed(() => all.value.find((p) => p.key === selectedKey.value) || null);
const activeStyle = computed(() => (focus.value?.kind === 'style' ? styles.slots[focus.value.key] : null));
const draft = ref('');
const draftWeight = ref(5);
const savedContent = computed(() => {
  if (focus.value?.kind === 'style') return styles.slots[focus.value.key]?.content ?? '';
  return selected.value?.content ?? '';
});
const dirty = computed(() => !!focus.value && draft.value !== savedContent.value);

watch(savedContent, (content) => {
  draft.value = content;
  forceCustom.value = false;
  if (selected.value) draftWeight.value = selected.value.weight ?? 5;
}, { immediate: true });

const guardDirty = async () => {
  if (!dirty.value) return true;
  const name = activeStyle.value?.name || selected.value?.name || '当前内容';
  return confirmDialog({ title: '放弃修改', message: `「${name}」有未保存的修改，切换会丢失。`, confirmText: '放弃并切换', danger: true });
};

const select = async (key: string) => {
  if (focus.value?.kind === 'prompt' && focus.value.key === key) return;
  if (!(await guardDirty())) return;
  focus.value = { kind: 'prompt', key };
};

interface Choice { id: string; name: string; desc?: string; sample?: string; content: string; user?: boolean }

function queryText() {
  return query.value.trim().toLowerCase();
}
function visiblePresets(slot: StyleSlotState): Choice[] {
  const choices: Choice[] = [
    ...slot.builtins.map((p) => ({ id: p.id, name: p.name, desc: p.desc, sample: p.sample, content: p.content })),
    ...slot.userPresets.map((p) => ({ id: p.id, name: p.name, content: p.content, user: true })),
  ];
  const q = queryText();
  if (!q || slot.name.toLowerCase().includes(q) || slot.desc.toLowerCase().includes(q)) return choices;
  return choices.filter((p) => p.name.toLowerCase().includes(q) || (p.desc || '').toLowerCase().includes(q));
}
function showCustom(slot: StyleSlotState) {
  const q = queryText();
  if (!q) return true;
  if (slot.name.toLowerCase().includes(q) || slot.desc.toLowerCase().includes(q)) return true;
  return '自定义'.includes(q);
}
function slotVisible(slot: StyleSlotState) {
  const q = queryText();
  if (!q) return true;
  if (slot.name.toLowerCase().includes(q) || slot.desc.toLowerCase().includes(q)) return true;
  if ('自定义'.includes(q)) return true;
  return visiblePresets(slot).length > 0;
}
function pickedId(slot: StyleSlotState) {
  const focused = focus.value?.kind === 'style' && focus.value.key === slot.key;
  if (focused && (forceCustom.value || draft.value !== slot.content)) return CUSTOM_PRESET_ID;
  return slot.customized || slot.presetId === CUSTOM_PRESET_ID ? CUSTOM_PRESET_ID : slot.presetId;
}
function isPicked(slot: StyleSlotState, id: string) {
  return pickedId(slot) === id;
}
function slotEm(slot: StyleSlotState) {
  const focused = focus.value?.kind === 'style' && focus.value.key === slot.key;
  if (focused && draft.value !== slot.content) return '未保存';
  if (focused && forceCustom.value) return '自定义';
  if (slot.customized || slot.presetId === CUSTOM_PRESET_ID) return '自定义';
  return [...slot.builtins, ...slot.userPresets].find((p) => p.id === slot.presetId)?.name || '自定义';
}
const styleStatus = computed(() => {
  const slot = activeStyle.value;
  if (!slot) return '';
  const base = slot.builtins.find((p) => p.id === slot.basePresetId);
  if (pickedId(slot) === CUSTOM_PRESET_ID) {
    if (!slot.customized && draft.value === slot.content) return base ? `基于${base.name}修改，保存后即为自定义` : '修改后保存即为自定义';
    return base ? `已自定义（基于${base.name}）` : '自定义';
  }
  const preset = slot.builtins.find((p) => p.id === slot.presetId);
  if (preset) return `${preset.name} · ${preset.desc}`;
  const mine = slot.userPresets.find((p) => p.id === slot.presetId);
  return mine ? `${mine.name} · 我的预设` : '';
});
const activeSample = computed(() => {
  const slot = activeStyle.value;
  if (!slot) return '';
  return slot.builtins.find((p) => p.id === pickedId(slot))?.sample || '';
});
const previewNote = computed(() => {
  const slot = activeStyle.value;
  if (!slot || activeSample.value) return '';
  if (pickedId(slot) === CUSTOM_PRESET_ID) return '自定义内容没有固定示例，以编辑区保存的文字为准。';
  return '这条预设没有单独的示例片段，下面就是会发给 AI 的内容。';
});
const canRestore = computed(() => {
  const slot = activeStyle.value;
  if (!slot) return false;
  const preset = slot.builtins.find((p) => p.id === slot.basePresetId) || slot.builtins[0];
  return !!preset && draft.value.trim() !== preset.content.trim();
});

const focusStyle = async (key: string) => {
  if (focus.value?.kind === 'style' && focus.value.key === key) return;
  if (!(await guardDirty())) return;
  focus.value = { kind: 'style', key };
};
const pickPreset = async (key: string, presetId: string) => {
  const slot = styles.slots[key];
  const preset = slot && [...slot.builtins, ...slot.userPresets].find((p) => p.id === presetId);
  if (!slot || !preset) return;
  const staying = focus.value?.kind === 'style' && focus.value.key === key;
  if (!staying && !(await guardDirty())) return;
  const current = staying ? draft.value : slot.content;
  if (current.trim() === preset.content.trim() && slot.content.trim() === preset.content.trim()) {
    focus.value = { kind: 'style', key };
    forceCustom.value = false;
    return;
  }
  const losingEdits = slot.customized || (staying && dirty.value);
  if (losingEdits) {
    const ok = await confirmDialog({
      title: '切换预设',
      message: `改用「${preset.name}」？当前${slot.name}内容会被覆盖。`,
      confirmText: '切换',
      danger: true,
    });
    if (!ok) return;
  }
  focus.value = { kind: 'style', key };
  await styles.applyPreset(key, presetId);
  syncCache(key);
  toast.success(`已切换：${preset.name}`);
};
const pickCustom = async (key: string) => {
  const staying = focus.value?.kind === 'style' && focus.value.key === key;
  if (!staying && !(await guardDirty())) return;
  focus.value = { kind: 'style', key };
  forceCustom.value = true;
};
const saveStyle = async () => {
  const slot = activeStyle.value;
  if (!slot) return;
  await styles.saveContent(slot.key, draft.value);
  syncCache(slot.key);
  toast.success(styles.slots[slot.key].customized ? `已保存自定义${slot.name}` : `已保存：${slot.name}`);
};
const discardDraft = () => {
  draft.value = savedContent.value;
  forceCustom.value = false;
};
const restorePreset = async () => {
  const slot = activeStyle.value;
  if (!slot) return;
  const preset = slot.builtins.find((p) => p.id === slot.basePresetId) || slot.builtins[0];
  const ok = await confirmDialog({ title: '恢复预设', message: `把${slot.name}恢复为「${preset.name}」？当前修改会丢失。`, confirmText: '恢复', danger: true });
  if (!ok) return;
  await styles.applyPreset(slot.key, preset.id);
  syncCache(slot.key);
  toast.info(`已恢复：${preset.name}`);
};
const saveAsPreset = async () => {
  const slot = activeStyle.value;
  if (!slot) return;
  const name = await askText({
    title: '另存为我的预设',
    label: '预设名称',
    placeholder: '例如：冷幽默',
    validate: (v) => (v.trim() ? null : '请填写名称'),
  });
  if (!name) return;
  await styles.addUserPreset(slot.key, name, draft.value);
  syncCache(slot.key);
  toast.success(`已保存预设：${name.trim()}`);
};
const removeUser = async (key: string, id: string) => {
  const preset = styles.slots[key]?.userPresets.find((p) => p.id === id);
  if (!preset) return;
  const ok = await confirmDialog({ title: '删除预设', message: `删除「${preset.name}」？正在使用的文风内容会保留为自定义。`, confirmText: '删除', danger: true });
  if (!ok) return;
  await styles.removeUserPreset(key, id);
  toast.info(`已删除：${preset.name}`);
};
const setStyleEnabled = async (on: boolean) => {
  const slot = activeStyle.value;
  if (!slot) return;
  await styles.setEnabled(slot.key, on);
  patchLocal(slot.key, { enabled: on });
  toast.info(on ? '已启用' : '已停用');
};

const patchLocal = (key: string, patch: Partial<PromptItem>) => {
  for (const c of Object.values(data.value)) {
    const p = c.prompts.find((x) => x.key === key);
    if (p) Object.assign(p, patch);
  }
};
const syncCache = (key: string) => {
  const slot = styles.slots[key];
  const item = all.value.find((p) => p.key === key);
  if (!slot || !item) return;
  patchLocal(key, { content: slot.content, modified: slot.content !== item.default, enabled: slot.enabled });
};

const setEnabled = async (on: boolean) => {
  const p = selected.value;
  if (!p) return;
  await promptStorage.setEnabled(p.key, on);
  patchLocal(p.key, { enabled: on });
  toast.info(on ? '已启用' : '已停用');
};

const saveWeight = async () => {
  const p = selected.value;
  if (!p) return;
  const w = Math.min(10, Math.max(1, Math.round(draftWeight.value)));
  if (w === p.weight) return;
  await promptStorage.save(p.key, p.content, p.enabled, w);
  patchLocal(p.key, { weight: w });
  toast.success(`权重已设为 ${w}`);
};

const saveOne = async () => {
  const p = selected.value;
  if (!p) return;
  await promptStorage.save(p.key, draft.value, p.enabled, draftWeight.value);
  patchLocal(p.key, { content: draft.value, modified: draft.value !== p.default });
  toast.success(`已保存：${p.name}`);
};

const resetOne = async () => {
  const p = selected.value;
  if (!p) return;
  const ok = await confirmDialog({ title: '重置为默认', message: `把「${p.name}」恢复为内置默认内容？你的修改会丢失。`, confirmText: '重置', danger: true });
  if (!ok) return;
  await promptStorage.reset(p.key);
  patchLocal(p.key, { content: p.default, modified: false });
  draft.value = p.default;
  toast.info(`已重置：${p.name}`);
};

const exportOne = () => {
  const p = selected.value;
  if (!p) return;
  downloadText(`prompt_${p.key}.json`, JSON.stringify(createDadBundle('prompts', { [p.key]: p.content }), null, 2));
};

// ─── 预览 ───
const VAR_RE = /\{\{\s*([\w.\-一-鿿]+)\s*\}\}|\{\s*([\w.\-一-鿿]+)\s*\}/g;
const variables = computed(() => [...new Set([...draft.value.matchAll(VAR_RE)].map((m) => (m[1] || m[2]).trim()).filter(Boolean))]);
const sample = reactive<Record<string, string>>({});
const sampleFor = (k: string) => {
  if (/玩家|角色/.test(k)) return '当前角色';
  if (/行动|输入/.test(k)) return '尝试在山门外观察灵脉';
  if (/世界/.test(k)) return '朝天大陆';
  if (/位置/.test(k)) return '青云山脉';
  if (/历史|记忆/.test(k)) return '上一回合发生的关键事实';
  return `[${k}]`;
};
watch(variables, (vs) => vs.forEach((k) => {
  if (!(k in sample)) sample[k] = sampleFor(k);
}), { immediate: true });
const rendered = computed(() => draft.value.replace(VAR_RE, (_m, a: string, b: string) => sample[(a || b).trim()] ?? `[${(a || b).trim()}]`));

// ─── 全局 ───
const saveAll = async () => {
  if (!dirty.value) {
    toast.info('没有需要保存的修改');
    return;
  }
  if (activeStyle.value) await saveStyle();
  else await saveOne();
};
const resetAll = async () => {
  const ok = await confirmDialog({ title: '重置全部提示词', message: '把全部提示词恢复为默认值？文风和主角性格也会回到默认预设，自定义预设一并删除，无法撤销。', confirmText: '全部重置', danger: true });
  if (!ok) return;
  await promptStorage.resetAll();
  styles.resetMeta();
  await load();
  toast.success('已重置全部提示词');
};
const exportAll = async () => {
  downloadText('prompts_all.json', JSON.stringify(createDadBundle('prompts', await promptStorage.exportAll()), null, 2));
  toast.success('已导出全部提示词');
};
const importAll = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const unwrapped = unwrapDadBundle(raw);
      const n = await promptStorage.importPrompts(unwrapped.type === 'prompts' ? unwrapped.payload : raw);
      await load();
      toast.success(`已导入 ${n} 个提示词`);
    } catch {
      toast.error('导入失败，请检查文件格式');
    }
  };
  input.click();
};

const actions = computed(() => [
  { key: 'import', title: '导入', icon: Upload, onClick: importAll },
  { key: 'export', title: '导出全部', icon: Download, onClick: exportAll },
  { key: 'reset', title: '重置全部', icon: RotateCcw, onClick: resetAll },
  { key: 'save', title: '保存', icon: Save, onClick: saveAll, primary: true },
]);
usePageActions(actions);
</script>

<style scoped>
.prompts {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--cc-text);
}

.p-body {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 300px;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  padding-top: 1rem;
}

.view-seg {
  display: none;
}


.cats,
.edit,
.preview {
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--gm-block);
}

.cats {
  padding: 0.6rem;
}

.cat-search {
  width: 100%;
}

.cat-sum {
  margin: 0.5rem 0.3rem 0.4rem;
  font-size: 12px;
  color: var(--cc-text-3);
}

.slot.on {
  border-radius: 6px;
  background: rgba(var(--cc-gold-rgb), 0.06);
}

.cat-split {
  margin: 0.85rem 0.3rem 0.15rem;
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--cc-text-3);
}

.item-row {
  display: flex;
  align-items: center;
}

.item-row .item {
  flex: 1;
  min-width: 0;
}

.item-x {
  flex-shrink: 0;
  padding: 0.25rem;
  border: none;
  background: none;
  color: var(--cc-text-3);
  cursor: pointer;
}

.item-x:hover {
  color: var(--cc-danger, var(--cc-text));
}

.cat-head {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  padding: 0.45rem 0.4rem;
  border: none;
  background: none;
  color: var(--cc-text);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.cat-head b {
  flex: 1;
  font-weight: 600;
  letter-spacing: 0.1em;
}

.cat-head em {
  font-size: 12px;
  font-style: normal;
  color: var(--cc-text-3);
}

.caret {
  color: var(--cc-text-3);
  transition: transform 0.15s ease;
}

.caret.open {
  transform: rotate(90deg);
}

.cat-list {
  margin: 0 0 0.4rem;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  min-height: 32px;
  padding: 0.25rem 0.5rem 0.25rem 1.4rem;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--cc-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.item:hover {
  background: var(--gm-block-hover);
}

.item.active {
  background: rgba(var(--cc-gold-rgb), 0.14);
  box-shadow: inset 2px 0 0 var(--cc-gold);
}

.item.off .item-name,
.item.idle .item-name {
  color: var(--cc-text-3);
}

.item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--cc-text-3);
  opacity: 0.5;
}

.dot.on {
  background: var(--cc-success);
  opacity: 1;
}

/* ---------- 编辑 ---------- */
.edit {
  display: flex;
  flex-direction: column;
  padding: 1rem 1.1rem;
}

.e-head {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.e-id {
  flex: 1;
  min-width: 0;
}

.e-id h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.e-id code {
  font-size: 12px;
  color: var(--cc-text-3);
}

.e-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
  color: var(--cc-text-2);
  cursor: pointer;
}

.e-desc {
  margin: 0.5rem 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--cc-text-2);
}

.e-status {
  margin: 0.35rem 0 0;
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--cc-gold);
}

.e-note {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.5rem 0 0;
  font-size: 13px;
  color: var(--cc-warning);
}

.e-weight {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
  margin: 0.9rem 0 0.7rem;
  font-size: 14px;
  color: var(--cc-text-2);
}

.e-weight :deep(.range-slider) {
  flex: 0 1 180px;
  width: auto;
  min-width: 100px;
}

.e-weight b {
  min-width: 1.5em;
  font-weight: 500;
  color: var(--cc-gold);
}

.e-weight span,
.e-weight small {
  white-space: nowrap;
}

.e-weight small {
  font-size: 12px;
  color: var(--cc-text-3);
}

.e-area {
  flex: 1;
  width: 100%;
  min-height: 260px;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
}

.e-count {
  margin: 0.35rem 0 0;
  font-size: 12px;
  color: var(--cc-text-3);
}

.e-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.8rem;
}

.e-foot .spacer {
  flex: 1;
}

/* ---------- 预览 ---------- */
.preview {
  padding: 0.9rem 1rem;
}

.preview .gm-label {
  margin-bottom: 0.7rem;
}

.vars {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 0.8rem;
}

.var {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 12px;
  color: var(--cc-text-2);
}

.sample-line {
  margin: 0 0 0.8rem;
  padding: 0.15rem 0 0.15rem 0.7rem;
  border-left: 2px solid var(--cc-gold);
  color: var(--cc-text);
  font-size: 14px;
  line-height: 1.8;
}

.rendered {
  margin: 0;
  padding: 0.7rem 0.8rem;
  border-radius: 6px;
  background: var(--cc-inset);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1200px) {
  .p-body {
    grid-template-columns: 240px minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .cats {
    grid-row: 1 / 3;
  }

  .view-seg {
    display: inline-flex;
    justify-self: start;
  }

  .preview,
  .show-preview .edit {
    display: none;
  }

  .show-preview .preview {
    display: block;
  }
}

@media (max-width: 768px) {
  .p-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(12rem, 40%) minmax(0, 1fr);
  }

  .view-seg {
    justify-self: start;
  }

  .cats {
    grid-row: auto;
  }
}
</style>
