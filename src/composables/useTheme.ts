/**
 * 全局主题：唯一的主题状态来源
 * - 偏好：light / dark / auto（跟随系统）
 * - 持久化到 localStorage('theme')，并写入 <html data-theme> 与 color-scheme
 */
import { computed, ref, watch } from 'vue';

export type ThemePreference = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

const normalizePreference = (value: unknown): ThemePreference | null => {
  if (value === 'light' || value === 'dark' || value === 'auto') return value;
  // 旧版设置中的「仙途」主题从未有对应样式，按暗色处理
  if (value === 'xiantu') return 'dark';
  return null;
};

const readInitialPreference = (): ThemePreference => {
  try {
    const stored = normalizePreference(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // 忽略存储不可用
  }
  return 'dark';
};

const mediaQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const preference = ref<ThemePreference>(readInitialPreference());
const systemPrefersDark = ref(mediaQuery ? mediaQuery.matches : true);

mediaQuery?.addEventListener?.('change', (e) => {
  systemPrefersDark.value = e.matches;
});

const resolvedTheme = computed<ResolvedTheme>(() => {
  if (preference.value === 'auto') return systemPrefersDark.value ? 'dark' : 'light';
  return preference.value;
});

watch(
  resolvedTheme,
  (theme) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  },
  { immediate: true },
);

watch(preference, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // 忽略存储不可用
  }
}, { immediate: true });

export function useTheme() {
  const setTheme = (value: unknown) => {
    const next = normalizePreference(value);
    if (next) preference.value = next;
  };

  const toggleTheme = () => {
    preference.value = resolvedTheme.value === 'dark' ? 'light' : 'dark';
  };

  return {
    preference,
    resolvedTheme,
    isDark: computed(() => resolvedTheme.value === 'dark'),
    setTheme,
    toggleTheme,
  };
}
