import { isTavernEnv } from './tavern';

export type NsfwGenderFilter = 'all' | 'male' | 'female';

export interface ContentSettings {
  nsfwMode: boolean;
  nsfwGenderFilter: NsfwGenderFilter;
  /** 外貌/仪容（与 NSFW 解耦，网页版也可单独开启） */
  splendorMode: boolean;
}

/** 默认值：酒馆沿用旧行为（NSFW 开）；网页版默认关；仪容默认开 */
function defaultContentSettings(): ContentSettings {
  return {
    nsfwMode: isTavernEnv(),
    nsfwGenderFilter: 'female',
    splendorMode: true,
  };
}

export function getNsfwSettingsFromStorage(): ContentSettings {
  const defaults = defaultContentSettings();
  try {
    const savedSettings = localStorage.getItem('dad_game_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings) as Partial<{
        enableNsfwMode: boolean;
        nsfwGenderFilter: NsfwGenderFilter;
        enableSplendorMode: boolean;
      }>;

      return {
        nsfwMode: parsed.enableNsfwMode !== undefined ? parsed.enableNsfwMode : defaults.nsfwMode,
        nsfwGenderFilter: parsed.nsfwGenderFilter || defaults.nsfwGenderFilter,
        splendorMode: parsed.enableSplendorMode !== undefined ? parsed.enableSplendorMode : defaults.splendorMode,
      };
    }
  } catch {
    // ignore
  }

  return defaults;
}

/** 设置页写入的本地开关优先；存档系统配置只作旧存档兜底 */
export function getContentSettings(systemConfig?: unknown): ContentSettings {
  const stored = getNsfwSettingsFromStorage();
  const cfg = systemConfig && typeof systemConfig === 'object' ? (systemConfig as Record<string, unknown>) : {};
  let raw: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(localStorage.getItem('dad_game_settings') || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed;
  } catch {
    // ignore
  }

  const pickBool = (rawKey: string, cfgValue: unknown, fallback: boolean): boolean => {
    if (typeof raw[rawKey] === 'boolean') return raw[rawKey] as boolean;
    if (typeof cfgValue === 'boolean') return cfgValue;
    return fallback;
  };

  const gender = raw.nsfwGenderFilter;
  return {
    nsfwMode: pickBool('enableNsfwMode', cfg.nsfwMode, stored.nsfwMode),
    nsfwGenderFilter:
      gender === 'all' || gender === 'male' || gender === 'female'
        ? gender
        : cfg.nsfwGenderFilter === 'all' || cfg.nsfwGenderFilter === 'male' || cfg.nsfwGenderFilter === 'female'
          ? cfg.nsfwGenderFilter
          : stored.nsfwGenderFilter,
    splendorMode: pickBool('enableSplendorMode', cfg.splendorMode, stored.splendorMode),
  };
}

export function ensureSystemConfigHasNsfw(systemConfig: unknown): unknown {
  const cfg: Record<string, unknown> =
    systemConfig && typeof systemConfig === 'object' ? (systemConfig as Record<string, unknown>) : {};
  const { nsfwMode, nsfwGenderFilter, splendorMode } = getNsfwSettingsFromStorage();

  if (cfg.nsfwMode === undefined) cfg.nsfwMode = nsfwMode;
  if (cfg.nsfwGenderFilter === undefined) cfg.nsfwGenderFilter = nsfwGenderFilter;
  if (cfg.splendorMode === undefined) cfg.splendorMode = splendorMode;

  return cfg;
}

export function ensureSaveDataHasTavernNsfw(saveData: unknown): unknown {
  if (!saveData || typeof saveData !== 'object') return saveData;
  const sd = saveData as Record<string, any>;

  // 兼容历史误写字段（避免出现 sd.ϵͳ 这种不可预期的键）
  if (sd['ϵͳ'] && !sd['系统']) {
    sd['系统'] = sd['ϵͳ'];
    delete sd['ϵͳ'];
  }

  const system = sd['系统'] && typeof sd['系统'] === 'object' ? sd['系统'] : {};
  system['配置'] = ensureSystemConfigHasNsfw(system['配置']);
  sd['系统'] = system;

  const cfg = system['配置'] as Record<string, any>;
  // 仪容/法身骨架：任一模式开启就保证 角色.身体 存在
  if (cfg.splendorMode || cfg.nsfwMode) {
    const role = sd['角色'] && typeof sd['角色'] === 'object' ? sd['角色'] : {};
    const body = role['身体'] && typeof role['身体'] === 'object' ? role['身体'] : {};
    if (cfg.nsfwMode) {
      if (body['部位开发'] === undefined) body['部位开发'] = {};
      if (body['部位'] === undefined) body['部位'] = {};
    }
    role['身体'] = body;
    sd['角色'] = role;
  }

  return sd;
}
