/**
 * 文风 / 主角性格槽位。
 * 正文存在 promptStorage（与提示词管理同一份），预设选择和用户预设存在 localStorage。
 */
import { reactive } from 'vue';
import { promptStorage } from '@/services/promptStorage';
import {
  CUSTOM_PRESET_ID,
  STYLE_SLOTS,
  styleSlotDef,
  type StylePreset,
  type StyleSlotDef,
} from '@/data/stylePresets';

const META_KEY = 'dad_style_meta';

export interface UserStylePreset {
  id: string;
  name: string;
  content: string;
}

interface SlotMeta {
  basePresetId?: string;
  userPresets?: UserStylePreset[];
}

export interface StyleSlotState {
  key: string;
  name: string;
  desc: string;
  presetId: string;
  basePresetId: string;
  customized: boolean;
  content: string;
  enabled: boolean;
  weight: number;
  builtins: StylePreset[];
  userPresets: UserStylePreset[];
}

const slots = reactive<Record<string, StyleSlotState>>({});

function norm(s: string) {
  return s.replace(/\r\n/g, '\n').trim();
}

function readMeta(): Record<string, SlotMeta> {
  try {
    const raw = JSON.parse(localStorage.getItem(META_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeMeta(all: Record<string, SlotMeta>) {
  localStorage.setItem(META_KEY, JSON.stringify(all));
}

function blank(def: StyleSlotDef): StyleSlotState {
  const first = def.presets[0];
  return {
    key: def.key,
    name: def.name,
    desc: def.desc,
    presetId: first.id,
    basePresetId: first.id,
    customized: false,
    content: first.content,
    enabled: true,
    weight: def.weight,
    builtins: def.presets,
    userPresets: [],
  };
}

for (const def of STYLE_SLOTS) slots[def.key] = blank(def);

function persistMeta(key: string) {
  const slot = slots[key];
  const def = styleSlotDef(key);
  if (!slot || !def) return;
  const all = readMeta();
  const firstId = def.presets[0].id;
  if (!slot.userPresets.length && slot.basePresetId === firstId) delete all[key];
  else all[key] = { basePresetId: slot.basePresetId, userPresets: slot.userPresets };
  writeMeta(all);
}

async function persistContent(key: string, content: string) {
  const slot = slots[key];
  const def = styleSlotDef(key);
  if (!slot || !def) return;
  const isFactoryDefault =
    norm(content) === norm(def.presets[0].content) && slot.enabled && slot.weight === def.weight;
  if (isFactoryDefault) await promptStorage.reset(key);
  else await promptStorage.save(key, content, slot.enabled, slot.weight);
}

function syncSelection(slot: StyleSlotState, content: string, meta: SlotMeta) {
  const hitBuiltin = slot.builtins.find((p) => norm(p.content) === norm(content));
  const hitUser = slot.userPresets.find((p) => norm(p.content) === norm(content));
  if (hitBuiltin) {
    slot.presetId = hitBuiltin.id;
    slot.basePresetId = hitBuiltin.id;
    slot.customized = false;
    return;
  }
  if (hitUser) {
    slot.presetId = hitUser.id;
    slot.basePresetId = meta.basePresetId && slot.builtins.some((p) => p.id === meta.basePresetId)
      ? meta.basePresetId
      : slot.builtins[0].id;
    slot.customized = false;
    return;
  }
  slot.presetId = CUSTOM_PRESET_ID;
  slot.basePresetId = meta.basePresetId && slot.builtins.some((p) => p.id === meta.basePresetId)
    ? meta.basePresetId
    : slot.builtins[0].id;
  slot.customized = true;
}

export function useStylePresets() {
  async function load() {
    const all = await promptStorage.loadAll();
    const metaAll = readMeta();
    for (const def of STYLE_SLOTS) {
      const saved = all[def.key];
      const meta = metaAll[def.key] ?? {};
      const slot = slots[def.key] ?? blank(def);
      slot.builtins = def.presets;
      slot.userPresets = Array.isArray(meta.userPresets) ? meta.userPresets.filter((p) => p && p.id && p.name && typeof p.content === 'string') : [];
      slot.content = saved?.content ?? def.presets[0].content;
      slot.enabled = saved?.enabled !== false;
      slot.weight = saved?.weight ?? def.weight;
      syncSelection(slot, slot.content, meta);
      slots[def.key] = slot;
    }
  }

  async function applyPreset(key: string, presetId: string) {
    const slot = slots[key];
    if (!slot) return;
    const preset = [...slot.builtins, ...slot.userPresets].find((p) => p.id === presetId);
    if (!preset) return;
    const isBuiltin = slot.builtins.some((p) => p.id === presetId);
    if (isBuiltin) slot.basePresetId = presetId;
    slot.content = preset.content;
    slot.presetId = presetId;
    slot.customized = false;
    await persistContent(key, preset.content);
    persistMeta(key);
  }

  async function saveContent(key: string, content: string) {
    const slot = slots[key];
    if (!slot) return;
    slot.content = content;
    syncSelection(slot, content, { basePresetId: slot.basePresetId, userPresets: slot.userPresets });
    await persistContent(key, content);
    persistMeta(key);
  }

  async function addUserPreset(key: string, name: string, content: string) {
    const slot = slots[key];
    const trimmed = name.trim();
    if (!slot || !trimmed) return;
    const preset: UserStylePreset = { id: `user_${Date.now().toString(36)}`, name: trimmed, content };
    slot.userPresets = [...slot.userPresets, preset];
    persistMeta(key);
    await applyPreset(key, preset.id);
  }

  async function removeUserPreset(key: string, presetId: string) {
    const slot = slots[key];
    if (!slot) return;
    slot.userPresets = slot.userPresets.filter((p) => p.id !== presetId);
    if (slot.presetId === presetId) {
      slot.presetId = CUSTOM_PRESET_ID;
      slot.customized = true;
    }
    persistMeta(key);
  }

  function resetMeta() {
    localStorage.removeItem(META_KEY);
  }

  async function setEnabled(key: string, enabled: boolean) {
    const slot = slots[key];
    if (!slot) return;
    slot.enabled = enabled;
    await promptStorage.setEnabled(key, enabled);
  }

  return { slots, load, applyPreset, saveContent, addUserPreset, removeUserPreset, setEnabled, resetMeta };
}
