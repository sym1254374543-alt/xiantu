<template>
  <div class="settings" :class="{ 'is-modal': closable }">
    <!-- 弹窗模式（局外菜单打开）自带头部；局内由功能页容器提供标题和「恢复默认」 -->
    <header v-if="closable" class="modal-head">
      <h2 class="modal-title">{{ t('系统设置') }}</h2>
      <button type="button" class="cc-btn small" @click="resetSettings">
        <RotateCcw :size="14" />
        <span>{{ t('恢复默认') }}</span>
      </button>
      <button type="button" class="modal-close" :aria-label="t('关闭')" :title="t('关闭')" @click="emit('close')">
        <X :size="18" />
      </button>
    </header>

    <div ref="scrollEl" class="settings-scroll" @scroll.passive="onScroll">
      <div class="settings-grid">
        <!-- 分组目录 -->
        <nav class="toc" :aria-label="t('设置分组')">
          <button
            v-for="sec in sections"
            :key="sec.id"
            type="button"
            class="toc-item"
            :class="{ active: activeSection === sec.id }"
            @click="scrollToSection(sec.id)"
          >
            <span class="toc-seal">{{ t(sec.seal) }}</span>
            <span class="toc-text">
              <b>{{ t(sec.label) }}</b>
              <small>{{ t(sec.desc) }}</small>
            </span>
          </button>
          <p class="toc-note"><Check :size="13" />{{ t('改动即时生效，自动保存') }}</p>
        </nav>

        <div class="form">
          <!-- 显示 -->
          <section id="settings-sec-display" class="sec">
            <header class="sec-head">
              <span class="sec-seal">{{ t('显') }}</span>
              <h3>{{ t('显示') }}</h3>
            </header>

            <div class="row">
              <div class="row-info">
                <span class="row-name">{{ t('主题模式') }}</span>
                <span class="row-desc">{{ t('选择界面主题风格') }}</span>
              </div>
              <div class="seg" role="radiogroup" :aria-label="t('主题模式')">
                <button
                  v-for="opt in themeOptions"
                  :key="opt.value"
                  type="button"
                  role="radio"
                  :aria-checked="themePreference === opt.value"
                  :class="{ active: themePreference === opt.value }"
                  @click="setTheme(opt.value)"
                >
                  <component :is="opt.icon" :size="14" />
                  <span>{{ t(opt.label) }}</span>
                </button>
              </div>
            </div>

            <div class="row">
              <div class="row-info">
                <span class="row-name">{{ t('语言设置') }}</span>
                <span class="row-desc">{{ t('选择界面语言') }}</span>
              </div>
              <div class="seg" role="radiogroup" :aria-label="t('语言设置')">
                <button
                  v-for="opt in languageOptions"
                  :key="opt.value"
                  type="button"
                  role="radio"
                  :aria-checked="currentLanguage === opt.value"
                  :class="{ active: currentLanguage === opt.value }"
                  @click="changeLanguage(opt.value)"
                >
                  <span>{{ opt.label }}</span>
                </button>
              </div>
            </div>

            <div class="row">
              <div class="row-info">
                <label class="row-name" for="setting-ui-scale">{{ t('界面缩放') }}</label>
                <span class="row-desc">{{ t('按钮、菜单、面板和文字一起放大缩小；只想调正文请用「阅读 → 正文字号」') }}</span>
              </div>
              <div class="range">
                <RangeSlider
                  id="setting-ui-scale"
                  v-model="settings.uiScale"
                  :min="80"
                  :max="130"
                  :step="5"
                  :aria-label="t('界面缩放')"
                  @dragstart="beginUIScaleGesture"
                  @commit="endUIScaleGesture(settings.uiScale)"
                />
                <output>{{ settings.uiScale }}%</output>
              </div>
            </div>

            <div class="row">
              <div class="row-info">
                <label class="row-name" for="setting-fast-anim">{{ t('快速动画') }}</label>
                <span class="row-desc">{{ t('加速界面动画和过渡效果') }}</span>
              </div>
              <label class="switch">
                <input id="setting-fast-anim" v-model="settings.fastAnimations" type="checkbox" @change="applyAnimationSettings" />
                <span></span>
              </label>
            </div>
          </section>

          <!-- 阅读 -->
          <section id="settings-sec-reading" class="sec">
            <header class="sec-head">
              <span class="sec-seal">{{ t('阅') }}</span>
              <h3>{{ t('阅读') }}</h3>
            </header>

            <div class="row stacked">
              <div class="row-info">
                <span class="row-name">{{ t('字体') }}</span>
                <span class="row-desc">{{ t('作用于正文与界面；网络字体首次使用需加载片刻，失败时自动改用系统字体') }}</span>
              </div>
              <div class="fonts" role="radiogroup" :aria-label="t('字体')">
                <button
                  v-for="f in fontOptions"
                  :key="f.key"
                  type="button"
                  role="radio"
                  class="font-card"
                  :class="{ active: settings.fontFamily === f.key }"
                  :aria-checked="settings.fontFamily === f.key"
                  @click="pickFont(f.key)"
                >
                  <span class="font-sample" :style="{ fontFamily: f.stack }">山河道途</span>
                  <span class="font-name">{{ t(f.label) }}</span>
                  <span class="font-desc">{{ t(f.desc) }}</span>
                  <span v-if="settings.fontFamily === f.key" class="font-check"><Check :size="12" /></span>
                </button>
              </div>
            </div>

            <div class="row">
              <div class="row-info">
                <label class="row-name" for="setting-narrative-size">{{ t('正文字号') }}</label>
                <span class="row-desc">{{ t('只影响中间的故事正文') }}</span>
              </div>
              <div class="range">
                <RangeSlider
                  id="setting-narrative-size"
                  v-model="settings.narrativeSize"
                  :min="14"
                  :max="22"
                  :step="1"
                  :aria-label="t('正文字号')"
                  @update:modelValue="applyNarrativeSize"
                />
                <output>{{ settings.narrativeSize }}px</output>
              </div>
            </div>

            <div class="row">
              <div class="row-info">
                <span class="row-name">{{ t('正文行距') }}</span>
                <span class="row-desc">{{ t('行与行之间的留白') }}</span>
              </div>
              <div class="seg" role="radiogroup" :aria-label="t('正文行距')">
                <button
                  v-for="opt in leadingOptions"
                  :key="opt.value"
                  type="button"
                  role="radio"
                  :aria-checked="settings.narrativeLeading === opt.value"
                  :class="{ active: settings.narrativeLeading === opt.value }"
                  @click="pickLeading(opt.value)"
                >
                  <span>{{ t(opt.label) }}</span>
                </button>
              </div>
            </div>

            <div class="row">
              <div class="row-info">
                <span class="row-name">{{ t('叙事配色') }}</span>
                <span class="row-desc">{{ t(toneOptions.find((o) => o.value === settings.narrativeTone)?.desc || '') }}</span>
              </div>
              <div class="seg" role="radiogroup" :aria-label="t('叙事配色')">
                <button
                  v-for="opt in toneOptions"
                  :key="opt.value"
                  type="button"
                  role="radio"
                  :aria-checked="settings.narrativeTone === opt.value"
                  :class="{ active: settings.narrativeTone === opt.value }"
                  @click="pickTone(opt.value)"
                >
                  <span>{{ t(opt.label) }}</span>
                </button>
              </div>
            </div>

            <figure class="preview" :aria-label="t('正文预览')">
              <figcaption>{{ t('预览') }}</figcaption>
              <p class="p-env">【晨光初破，山岚如纱，自赤褐色的山岩裂隙间蒸腾而起。】</p>
              <p>竹庐之内，千夜盘膝而坐，双手结出引气印，四周游离的火行灵气仿佛受到无形牵引。</p>
              <p>秦岚站在门边，语速极快：<span class="p-dia">"师弟，黑砂岭的人至多半个时辰便会搜上岭来。"</span><span class="p-psy">此地已非善地。</span></p>
            </figure>
          </section>

          <!-- 游戏 -->
          <section id="settings-sec-game" class="sec">
            <header class="sec-head">
              <span class="sec-seal">{{ t('戏') }}</span>
              <h3>{{ t('游戏') }}</h3>
            </header>

            <div v-if="currentPlayerName" class="row stacked">
              <div class="row-info">
                <label class="row-name" for="setting-player-name">{{ t('修改道号') }}</label>
                <span class="row-desc">{{ t('修改当前角色的名字') }}</span>
              </div>
              <div class="inline">
                <input
                  id="setting-player-name"
                  v-model="newPlayerName"
                  class="field"
                  :placeholder="currentPlayerName"
                />
                <button
                  type="button"
                  class="cc-btn small"
                  :disabled="!newPlayerName || newPlayerName === currentPlayerName"
                  @click="updatePlayerName"
                >
                  <Save :size="14" />
                  <span>{{ t('确认') }}</span>
                </button>
              </div>
            </div>

            <div class="row">
              <div class="row-info">
                <label class="row-name" for="setting-action-options">{{ t('行动选项') }}</label>
                <span class="row-desc">{{ t('AI生成可选的行动建议') }}</span>
              </div>
              <label class="switch">
                <input id="setting-action-options" v-model="uiStore.enableActionOptions" type="checkbox" />
                <span></span>
              </label>
            </div>

            <div v-if="uiStore.enableActionOptions" class="row stacked nested">
              <div class="row-info">
                <label class="row-name" for="setting-action-prompt">{{ t('自定义行动选项提示词') }}</label>
                <span class="row-desc">{{ t('指导AI生成特定风格的行动选项（可选，留空使用默认）') }}</span>
              </div>
              <textarea
                id="setting-action-prompt"
                v-model="uiStore.actionOptionsPrompt"
                class="field area"
                :placeholder="t('例如：多生成修炼和探索类选项，减少战斗选项...')"
                rows="3"
              ></textarea>
            </div>

            <div class="row">
              <div class="row-info">
                <label class="row-name" for="setting-realm-map">{{ t('境界分层地图') }}</label>
                <span class="row-desc">{{ t('按角色境界分别记录世界地图，旧存档开启后将自动迁移') }}</span>
              </div>
              <label class="switch">
                <input id="setting-realm-map" v-model="settings.realmLayeredMap" type="checkbox" />
                <span></span>
              </label>
            </div>

            <div class="row">
              <div class="row-info">
                <label class="row-name" for="setting-protection">{{ t('存档保护强度') }}</label>
                <span class="row-desc">{{ t('控制AI指令的保护/拒绝力度；更低更自由，但更容易产生坏存档') }}</span>
              </div>
              <select id="setting-protection" v-model="uiStore.commandProtectionMode" class="field select">
                <option value="strict">{{ t('严格（推荐）') }}</option>
                <option value="skeleton">{{ t('仅骨干（更自由）') }}</option>
              </select>
            </div>
          </section>

          <!-- 高级 -->
          <section id="settings-sec-advanced" class="sec">
            <header class="sec-head">
              <span class="sec-seal">{{ t('玄') }}</span>
              <h3>{{ t('高级') }}</h3>
            </header>

            <div class="row">
              <div class="row-info">
                <span class="row-name">{{ t('提示词管理') }}</span>
                <span class="row-desc">{{ t('跳转到提示词页面修改提示词') }}</span>
              </div>
              <button type="button" class="cc-btn small" @click="openPromptManagement">
                <FileText :size="14" />
                <span>{{ t('打开') }}</span>
              </button>
            </div>

            <div class="row">
              <div class="row-info">
                <span class="row-name">{{ t('正则替换规则') }}</span>
                <span class="row-desc">{{ t('对AI输出进行替换：正则 / 纯文本（用于格式修正、屏蔽词替换等）') }}</span>
              </div>
              <button type="button" class="cc-btn small" @click="showReplaceRulesModal = true">
                <Replace :size="14" />
                <span>{{ t('编辑规则') }}</span>
                <span v-if="enabledReplaceRulesCount > 0" class="badge">{{ enabledReplaceRulesCount }}</span>
              </button>
            </div>

            <div class="row">
              <div class="row-info">
                <label class="row-name" for="setting-debug">{{ t('调试模式') }}</label>
                <span class="row-desc">{{ t('启用开发者调试信息和详细日志') }}</span>
              </div>
              <label class="switch">
                <input id="setting-debug" v-model="settings.debugMode" type="checkbox" />
                <span></span>
              </label>
            </div>

            <template v-if="settings.debugMode">
              <div class="row nested">
                <div class="row-info">
                  <label class="row-name" for="setting-console-debug">{{ t('控制台调试') }}</label>
                  <span class="row-desc">{{ t('在浏览器控制台显示详细调试信息') }}</span>
                </div>
                <label class="switch">
                  <input id="setting-console-debug" v-model="settings.consoleDebug" type="checkbox" />
                  <span></span>
                </label>
              </div>
              <div class="row nested">
                <div class="row-info">
                  <label class="row-name" for="setting-perf">{{ t('性能监控') }}</label>
                  <span class="row-desc">{{ t('监控组件性能和加载时间') }}</span>
                </div>
                <label class="switch">
                  <input id="setting-perf" v-model="settings.performanceMonitor" type="checkbox" />
                  <span></span>
                </label>
              </div>
            </template>

            <div class="row">
              <div class="row-info">
                <span class="row-name">{{ t('设置备份') }}</span>
                <span class="row-desc">{{ t('导出或导入设置配置文件') }}</span>
              </div>
              <div class="inline tight">
                <button type="button" class="cc-btn small" @click="exportSettings">
                  <Download :size="14" />
                  <span>{{ t('导出') }}</span>
                </button>
                <button type="button" class="cc-btn small" @click="importSettings">
                  <Upload :size="14" />
                  <span>{{ t('导入') }}</span>
                </button>
              </div>
            </div>

            <div class="row">
              <div class="row-info">
                <span class="row-name">{{ t('清理缓存') }}</span>
                <span class="row-desc">{{ t('清除游戏临时数据和缓存') }}</span>
              </div>
              <button type="button" class="cc-btn small danger" @click="clearCache">
                <Trash2 :size="14" />
                <span>{{ t('清理') }}</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <TextReplaceRulesModal
      :open="showReplaceRulesModal"
      :rules="settings.replaceRules"
      @close="showReplaceRulesModal = false"
      @save="handleSaveReplaceRules"
    />

    <!-- 提示词管理弹窗 -->
    <div v-if="showPromptModal" class="prompt-modal-overlay" @click.self="showPromptModal = false">
      <div class="prompt-modal-content">
        <PromptManagementPanel closable @close="showPromptModal = false" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
import {
  Save, RotateCcw, Trash2, Download, Upload, FileText, X, Check,
  Sun, Moon, Monitor, Replace,
} from 'lucide-vue-next';
import { toast } from '@/utils/toast';
import { debug } from '@/utils/debug';
import { useI18n } from '@/i18n';
import RangeSlider from '@/components/common/RangeSlider.vue';
import TextReplaceRulesModal from '@/components/common/TextReplaceRulesModal.vue';
import PromptManagementPanel from '@/components/dashboard/PromptManagementPanel.vue';
import type { TextReplaceRule } from '@/types/textRules';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useUIStore } from '@/stores/uiStore';
import { unwrapDadBundle } from '@/utils/dadBundle';
import { useTheme, type ThemePreference } from '@/composables/useTheme';
import { vectorMemoryService } from '@/services/vectorMemoryService';
import { usePageActions } from '@/composables/usePageActions';
import { confirmDialog } from '@/composables/useDialog';
import {
  FONT_OPTIONS, DEFAULT_FONT, DEFAULT_TONE, DEFAULT_NARRATIVE_SIZE, DEFAULT_LEADING, DEFAULT_UI_SCALE,
  applyFont, applyNarrativeTone, applyNarrativeSize, applyNarrativeLeading, applyUIScale as applyRootUIScale,
  beginUIScaleGesture, endUIScaleGesture,
  ensureFontLoaded, type FontKey, type NarrativeTone, type NarrativeLeading,
} from '@/utils/readingPrefs';

const props = withDefaults(defineProps<{ closable?: boolean }>(), { closable: false });
const emit = defineEmits<{ (e: 'close'): void }>();

const { t, setLanguage, currentLanguage } = useI18n();
const { preference: themePreference, setTheme } = useTheme();

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '明亮', icon: Sun },
  { value: 'dark', label: '暗黑', icon: Moon },
  { value: 'auto', label: '跟随系统', icon: Monitor },
];

const languageOptions = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
] as const;

// 左侧分组目录
const sections = [
  { id: 'display', seal: '显', label: '显示', desc: '主题、语言与界面大小' },
  { id: 'reading', seal: '阅', label: '阅读', desc: '字体、正文字号与叙事配色' },
  { id: 'game', seal: '戏', label: '游戏', desc: '道号、行动选项与存档' },
  { id: 'advanced', seal: '玄', label: '高级', desc: '提示词、替换规则与调试' },
] as const;
const activeSection = ref<string>('display');
const scrollEl = ref<HTMLElement | null>(null);
const scrollToSection = (id: string) => {
  activeSection.value = id;
  document.getElementById(`settings-sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
const onScroll = () => {
  const box = scrollEl.value;
  if (!box) return;
  const top = box.getBoundingClientRect().top + 80;
  let current: string = sections[0].id;
  for (const sec of sections) {
    const el = document.getElementById(`settings-sec-${sec.id}`);
    if (el && el.getBoundingClientRect().top <= top) current = sec.id;
  }
  // 滚到底时最后一组也要能点亮
  if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) current = sections[sections.length - 1].id;
  activeSection.value = current;
};

const fontOptions = FONT_OPTIONS;
const toneOptions: { value: NarrativeTone; label: string; desc: string }[] = [
  { value: 'vivid', label: '彩色', desc: '环境青、对话金、心理紫' },
  { value: 'plain', label: '素雅', desc: '只给对话着色，更像书页' },
];
const leadingOptions: { value: NarrativeLeading; label: string }[] = [
  { value: 'tight', label: '紧凑' },
  { value: 'normal', label: '适中' },
  { value: 'loose', label: '宽松' },
];

const characterStore = useCharacterStore();
const gameStateStore = useGameStateStore();
const uiStore = useUIStore();
const changeLanguage = (lang: 'zh' | 'en') => {
  if (currentLanguage.value === lang) return;
  setLanguage(lang);
  toast.success(t('语言设置已更新'));
};

// 道号修改相关
const newPlayerName = ref('');
const currentPlayerName = computed(() => {
  return gameStateStore.character?.名字 || '';
});

// 更新玩家道号
const updatePlayerName = async () => {
  if (!newPlayerName.value || newPlayerName.value === currentPlayerName.value) {
    return;
  }

  try {
    // 更新 gameStateStore 中的角色身份信息（V3：gameStateStore.character）
    if (gameStateStore.character) {
      (gameStateStore.character as any).名字 = newPlayerName.value;
    }

    // 同步到 characterStore 并保存到当前存档槽位
    const currentSlotName = characterStore.rootState.当前激活存档?.存档槽位;
    if (currentSlotName) {
      await characterStore.saveToSlot(currentSlotName);
    }

    toast.success(`道号已修改为「${newPlayerName.value}」`);
    newPlayerName.value = ''; // 清空输入框
  } catch (error) {
    console.error('修改道号失败:', error);
    toast.error('修改道号失败，请重试');
  }
};

// 设置数据结构
const settings = reactive({
  // 显示设置（主题由 useTheme 即时生效，这里仅用于导出/导入）
  theme: themePreference.value as string,
  uiScale: DEFAULT_UI_SCALE,

  // 阅读
  fontFamily: DEFAULT_FONT as FontKey,
  narrativeTone: DEFAULT_TONE as NarrativeTone,
  narrativeSize: DEFAULT_NARRATIVE_SIZE,
  narrativeLeading: DEFAULT_LEADING as NarrativeLeading,

  // 游戏设置
  fastAnimations: false,
  splitResponseGeneration: false,  // 默认关闭分步生成
  realmLayeredMap: false, // 境界分层地图开关

  // 🔞 成人内容（仅酒馆环境可用；非酒馆环境将被忽略/隐藏）
  enableNsfwMode: true,
  nsfwGenderFilter: 'female' as 'all' | 'male' | 'female',


  // 高级设置
  debugMode: false,
  consoleDebug: false,
  performanceMonitor: false,
  replaceRules: [] as TextReplaceRule[],
});

const loading = ref(false);

// 自动保存：设置加载完成后，任何改动都即时应用并在 400ms 后静默写入
const ready = ref(false);
let persistTimer: number | null = null;
watch(
  settings,
  () => {
    if (!ready.value) return;
    if (persistTimer) window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      persistTimer = null;
      void saveSettings({ silent: true });
    }, 400);
  },
  { deep: true },
);
const showReplaceRulesModal = ref(false);
const showPromptModal = ref(false);

const enabledReplaceRulesCount = computed(() => {
  const rules = (settings as any).replaceRules as TextReplaceRule[] | undefined;
  if (!Array.isArray(rules)) return 0;
  return rules.filter(r => r && r.enabled).length;
});

const normalizeReplaceRules = (rawRules: unknown): TextReplaceRule[] => {
  if (!Array.isArray(rawRules)) return [];
  return rawRules.slice(0, 50).map((r: any, idx: number) => ({
    id: typeof r?.id === 'string' ? r.id.slice(0, 80) : `rule_${idx}`,
    enabled: r?.enabled !== false,
    mode: r?.mode === 'text' ? 'text' : 'regex',
    pattern: typeof r?.pattern === 'string' ? r.pattern.slice(0, 500) : '',
    replacement: typeof r?.replacement === 'string' ? r.replacement.slice(0, 1500) : '',
    ignoreCase: !!r?.ignoreCase,
    global: r?.global !== false,
    multiline: !!r?.multiline,
    dotAll: !!r?.dotAll,
  }));
};

const persistReplaceRules = (rules: TextReplaceRule[]) => {
  try {
    const raw = localStorage.getItem('dad_game_settings');
    const parsed = raw ? JSON.parse(raw) : {};
    const base =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    const next = { ...base, replaceRules: rules };
    localStorage.setItem('dad_game_settings', JSON.stringify(next));
  } catch {
  }
};

const handleSaveReplaceRules = (rules: TextReplaceRule[]) => {
  const normalizedRules = normalizeReplaceRules(rules);
  (settings as any).replaceRules = normalizedRules;
  persistReplaceRules(normalizedRules);
};

// 监听调试模式变化
watch(() => settings.debugMode, (newValue) => {
  debug.setMode(newValue);
  debug.log('设置面板', `调试模式${newValue ? '已启用' : '已禁用'}`);
});

// 加载设置
const loadSettings = async () => {
  debug.timeStart('加载设置');
  try {
    // 先从localStorage加载设置
    const savedSettings = localStorage.getItem('dad_game_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      Object.assign(settings, parsed);
      delete (settings as Record<string, unknown>).fontSize;
      settings.theme = themePreference.value;
      debug.log('设置面板', '设置加载成功', parsed);
    } else {
      debug.log('设置面板', '使用默认设置');
    }

    // 初始化时同步到 gameStateStore
    let currentStoreSettings = gameStateStore.userSettings as Record<string, any>;
    if (typeof currentStoreSettings !== 'object' || currentStoreSettings === null) {
      currentStoreSettings = {};
    }
    // 注意这里如果不加触发，可能会导致 UI 不渲染，强刷保证赋值
    if (currentStoreSettings['境界分层地图'] !== settings.realmLayeredMap) {
      gameStateStore.userSettings = {
        ...currentStoreSettings,
        '境界分层地图': settings.realmLayeredMap,
      };
    }

  } catch (error) {
    debug.error('设置面板', '加载设置失败', error);
    toast.error('加载设置失败，将使用默认设置');
  } finally {
    debug.timeEnd('加载设置');
  }
};

// 保存设置
const saveSettings = async ({ silent = false }: { silent?: boolean } = {}) => {
  if (loading.value) return;

  loading.value = true;
  debug.timeStart('保存设置');

  try {
    // 验证设置
    validateSettings();
    settings.theme = themePreference.value;

    // 保存到localStorage
    localStorage.setItem('dad_game_settings', JSON.stringify(settings));

    // 同步到 gameStateStore
    let currentStoreSettings = gameStateStore.userSettings as Record<string, any>;
    if (typeof currentStoreSettings !== 'object' || currentStoreSettings === null) {
      currentStoreSettings = {};
    }
    gameStateStore.userSettings = {
      ...currentStoreSettings,
      '境界分层地图': settings.realmLayeredMap,
    };

    debug.log('设置面板', '设置已保存到localStorage', settings);

    // 应用设置
    await applySettings();

    if (!silent) toast.success(t('设置已保存并应用'));

  } catch (error) {
    debug.error('设置面板', '保存设置失败', error);
    toast.error(`保存设置失败: ${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    loading.value = false;
    debug.timeEnd('保存设置');
  }
};

// 验证设置
const validateSettings = () => {
  debug.group('设置验证');

  try {
    // 验证UI缩放
    if (settings.uiScale < 80 || settings.uiScale > 130) {
      settings.uiScale = Math.max(80, Math.min(130, settings.uiScale));
      debug.warn('设置面板', `UI缩放值已修正为: ${settings.uiScale}%`);
    }

    if (typeof (settings as any).splitResponseGeneration !== 'boolean') {
      (settings as any).splitResponseGeneration = false;  // 默认关闭分步生成
    }

    // 正则替换规则：确保结构正确并限制大小，避免卡顿/存储膨胀
    const rawReplaceRules = (settings as any).replaceRules;
    (settings as any).replaceRules = normalizeReplaceRules(rawReplaceRules);

    debug.log('设置面板', '设置验证完成');
  } catch (error) {
    debug.error('设置面板', '设置验证失败', error);
    throw new Error('设置验证失败');
  } finally {
    debug.groupEnd();
  }
};

// 应用设置
const applySettings = async () => {
  debug.group('应用设置');

  try {
    // 应用UI缩放
    applyUIScale();


    // 应用动画设置
    applyAnimationSettings();

    // 阅读偏好
    applyFont(settings.fontFamily);
    applyNarrativeTone(settings.narrativeTone);
    applyNarrativeSize(settings.narrativeSize);
    applyNarrativeLeading(settings.narrativeLeading);

    // 应用调试模式
    debug.setMode(settings.debugMode);

    debug.log('设置面板', '所有设置已应用');
  } catch (error) {
    debug.error('设置面板', '应用设置时出错', error);
    throw error;
  } finally {
    debug.groupEnd();
  }
};

// 应用UI缩放
const applyUIScale = () => {
  applyRootUIScale(settings.uiScale);
  debug.log('设置面板', `UI缩放已应用: ${settings.uiScale}%`);
};

// 阅读偏好：点选即生效（自动保存由 watch 负责）
const pickFont = (key: FontKey) => {
  settings.fontFamily = key;
  applyFont(key);
};
const pickTone = (tone: NarrativeTone) => {
  settings.narrativeTone = tone;
  applyNarrativeTone(tone);
};
const pickLeading = (leading: NarrativeLeading) => {
  settings.narrativeLeading = leading;
  applyNarrativeLeading(leading);
};

// 应用动画设置
const applyAnimationSettings = () => {
  const transitionSeconds = settings.fastAnimations ? 0.12 : 0.2;
  document.documentElement.style.setProperty('--transition-fast', `all ${transitionSeconds}s ease-in-out`);
  debug.log('设置面板', `动画速度已应用: ${transitionSeconds}s`);
};

// uiStore 已在脚本顶部初始化
// 重置设置
const resetSettings = async () => {
  const ok = await confirmDialog({
    title: '重置设置',
    message: '确定要重置所有设置为默认值吗？这将清除所有自定义配置。',
    confirmText: '确认重置',
    danger: true,
  });
  if (!ok) return;
  debug.log('设置面板', '开始重置设置');
  setTheme('dark');
  Object.assign(settings, {
    theme: 'dark',
    uiScale: DEFAULT_UI_SCALE,
    fontFamily: DEFAULT_FONT,
    narrativeTone: DEFAULT_TONE,
    narrativeSize: DEFAULT_NARRATIVE_SIZE,
    narrativeLeading: DEFAULT_LEADING,
    fastAnimations: false,
    splitResponseGeneration: false,  // 默认关闭分步生成
    debugMode: false,
    consoleDebug: false,
    performanceMonitor: false,
  });
  saveSettings();
  toast.info('设置已重置为默认值');
};

// 局内页头的「恢复默认」；弹窗模式自带头部按钮
usePageActions(() => (props.closable ? [] : [{ key: 'reset', title: '恢复默认', icon: RotateCcw, onClick: resetSettings }]));

// 清理缓存
const clearCache = async () => {
  const ok = await confirmDialog({
    title: '清理缓存',
    message: '确定要清理缓存吗？这将删除临时数据但不会影响存档。',
    confirmText: '确认清理',
    danger: true,
  });
  if (!ok) return;
  debug.log('设置面板', '开始清理缓存');
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('dad_cache_') || key.startsWith('temp_') || key.startsWith('debug_') || key.includes('_temp'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
    debug.log('设置面板', `缓存清理完成，共清理 ${keysToRemove.length} 项数据`);
    toast.success(`已清理 ${keysToRemove.length} 项缓存数据`);
  } catch (error) {
    debug.error('设置面板', '清理缓存失败', error);
    toast.error('清理缓存失败');
  }
};

// 导出设置
const exportSettings = () => {
  debug.log('设置面板', '开始导出设置');

  try {
    const exportData = {
      settings: { ...settings, theme: themePreference.value },
      exportInfo: {
        timestamp: new Date().toISOString(),
        version: '3.7.4',
        userAgent: navigator.userAgent,
        gameVersion: '仙途 v3.7.4'
      }
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `仙途-设置备份-${dateStr}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(link.href);

    debug.log('设置面板', '设置导出成功');
    toast.success('设置已导出');

  } catch (error) {
    debug.error('设置面板', '导出设置失败', error);
    toast.error('导出设置失败');
  }
};

// 导入设置
const importSettings = () => {
  debug.log('设置面板', '开始导入设置');

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // 🔥 支持 dad.bundle 格式和旧格式
      const unwrapped = unwrapDadBundle(importData);

      // 提取设置数据
      let settingsData: any = null;

      if (unwrapped.type === 'settings') {
        // dad.bundle 格式或旧格式 { type: 'settings', settings: {...} }
        settingsData = unwrapped.payload;
      } else if (importData.settings) {
        // 旧导出格式 { settings: {...}, exportInfo: {...} }
        settingsData = importData.settings;
      } else if (unwrapped.type === null && typeof unwrapped.payload === 'object') {
        // 直接是设置对象（最旧的格式）
        settingsData = unwrapped.payload;
      }

      if (!settingsData || typeof settingsData !== 'object') {
        throw new Error('无效的设置文件格式');
      }

      // 验证并合并设置
      const validatedSettings = { ...settings, ...settingsData };
      Object.assign(settings, validatedSettings);
      setTheme(settings.theme);

      await saveSettings();

      debug.log('设置面板', '设置导入成功', settingsData);
      toast.success('设置导入成功并已应用');
    } catch (error) {
      debug.error('设置面板', '导入设置失败', error);
      toast.error(`导入设置失败: ${error instanceof Error ? error.message : '请检查文件格式'}`);
    }
  };

  input.click();
};

const openPromptManagement = () => {
  showPromptModal.value = true;
};

// 读取向量记忆服务的真实配置，供设置面板初始化日志和调试状态使用。
const loadVectorMemoryConfig = () => {
  const config = vectorMemoryService.getConfig();
  const status = vectorMemoryService.getEmbeddingStatus();
  debug.log('设置面板', '向量记忆配置已加载', {
    enabled: config.enabled,
    maxRetrieveCount: config.maxRetrieveCount,
    minSimilarity: config.minSimilarity,
    embeddingAvailable: status.available,
    embeddingModel: status.model,
  });
};

onBeforeUnmount(() => {
  if (persistTimer) {
    window.clearTimeout(persistTimer);
    void saveSettings({ silent: true });
  }
});

// 组件挂载时加载设置
onMounted(async () => {
  debug.log('设置面板', '组件已加载');
  await loadSettings();
  loadVectorMemoryConfig();
  // 字体卡片里要用各自的字体写样字
  FONT_OPTIONS.forEach((f) => ensureFontLoaded(f.key));
  await nextTick();
  ready.value = true;

  // 初始加载时不再强制应用设置，以避免覆盖全局主题
  // applySettings(); // 移除此调用

  // 🔧 开发者控制：如果启用授权验证且未验证，自动弹出验证窗口
});
</script>


<style scoped>
/* ============================================================
   系统设置 —— 版式 L6：左分组目录 + 右平铺表单（无卡片套卡片）
   只用全局 --cc-* / --gm-* 令牌，暗亮主题自动跟随
   ============================================================ */
.settings {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--cc-text);
}

.settings.is-modal {
  background: var(--cc-solid-bg);
}

/* ---------- 弹窗头部 ---------- */
.modal-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
  padding: 0.9rem 1.1rem 0.8rem 1.4rem;
  border-bottom: 1px solid var(--gm-line);
}

.modal-title {
  flex: 1;
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 24px;
  font-weight: 400;
  letter-spacing: 0.2em;
  color: var(--cc-text);
}

.modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--cc-text-3);
  cursor: pointer;
}

.modal-close:hover {
  background: var(--gm-block-hover);
  color: var(--cc-text);
}

/* ---------- 骨架 ---------- */
.settings-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.settings-grid {
  display: grid;
  grid-template-columns: 220px minmax(0, 760px);
  justify-content: center;
  gap: 3rem;
  padding: 1.5rem 1.5rem 3rem;
}

/* ---------- 分组目录 ---------- */
.toc {
  position: sticky;
  top: 1.5rem;
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.toc-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.6rem 0.7rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--cc-text-2);
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.toc-item:hover {
  background: var(--gm-block-hover);
  color: var(--cc-text);
}

.toc-item.active {
  background: linear-gradient(90deg, rgba(var(--cc-gold-rgb), 0.15), rgba(var(--cc-gold-rgb), 0.02));
  color: var(--cc-text);
}

.toc-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--cc-gold);
}

.toc-seal,
.sec-seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.45);
  border-radius: 5px;
  background: rgba(var(--cc-gold-rgb), 0.08);
  color: var(--cc-gold);
  font-family: var(--cc-calligraphy);
  line-height: 1;
}

.toc-seal {
  width: 30px;
  height: 30px;
  font-size: 17px;
}

.toc-item.active .toc-seal {
  background: var(--cc-seal);
  border-color: var(--cc-seal);
  color: var(--cc-seal-text);
}

.toc-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.toc-text b {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.2em;
}

.toc-text small {
  font-size: 12px;
  color: var(--cc-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toc-note {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.9rem 0 0;
  padding: 0.8rem 0.7rem 0;
  border-top: 1px solid var(--gm-line);
  font-size: 12px;
  color: var(--cc-text-3);
}

.toc-note svg {
  color: var(--cc-success);
}

/* ---------- 分组 ---------- */
.sec {
  scroll-margin-top: 1.5rem;
}

.sec + .sec {
  margin-top: 2.75rem;
}

.sec-head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(var(--cc-gold-rgb), 0.28);
}

.sec-seal {
  width: 28px;
  height: 28px;
  font-size: 16px;
}

.sec-head h3 {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 24px;
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.3em;
  color: var(--cc-text);
}

/* ---------- 行 ---------- */
.row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem 0.25rem;
  border-bottom: 1px solid var(--gm-line);
}

.row.stacked {
  flex-direction: column;
  align-items: stretch;
  gap: 0.8rem;
}

.row.nested {
  margin-left: 0.4rem;
  padding-left: 1.1rem;
  border-left: 2px solid rgba(var(--cc-gold-rgb), 0.25);
}

.row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.row-name {
  font-size: 15px;
  letter-spacing: 0.08em;
  color: var(--cc-text);
}

.row-desc {
  font-size: 13px;
  line-height: 1.55;
  color: var(--cc-text-3);
}

/* ---------- 控件：分段 ---------- */
.seg {
  display: inline-flex;
  flex-shrink: 0;
  padding: 3px;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-inset);
}

.seg button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.85rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--cc-text-2);
  font-size: 14px;
  letter-spacing: 0.08em;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.seg button:hover {
  color: var(--cc-text);
}

.seg button.active {
  border-color: rgba(var(--cc-gold-rgb), 0.5);
  background: rgba(var(--cc-gold-rgb), 0.14);
  color: var(--cc-gold);
}

/* ---------- 控件：滑块 ---------- */
.range {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-shrink: 0;
}

.range :deep(.range-slider) {
  flex: 0 0 180px;
  width: 180px;
}

.range output {
  flex: none;
  width: 4.2em;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--cc-gold);
}

/* ---------- 控件：开关 ---------- */
.switch {
  position: relative;
  flex-shrink: 0;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.switch span {
  position: absolute;
  inset: 0;
  border: 1px solid var(--cc-border-strong);
  border-radius: 999px;
  background: var(--cc-inset);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.switch span::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--cc-text-3);
  transition: transform 0.2s ease, background 0.2s ease;
}

.switch input:checked + span {
  border-color: rgba(var(--cc-gold-rgb), 0.7);
  background: rgba(var(--cc-gold-rgb), 0.28);
}

.switch input:checked + span::after {
  background: var(--cc-gold);
  transform: translateX(20px);
}

.switch input:focus-visible + span {
  outline: 2px solid rgba(var(--cc-gold-rgb), 0.6);
  outline-offset: 2px;
}

/* ---------- 控件：输入 ---------- */
.inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.inline.tight {
  flex-shrink: 0;
}

.field {
  min-width: 0;
  height: 36px;
  padding: 0 0.8rem;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--cc-inset);
  color: var(--cc-text);
  font: inherit;
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.inline .field {
  flex: 1;
}

.field:focus {
  outline: none;
  border-color: rgba(var(--cc-gold-rgb), 0.6);
}

.field.area {
  height: auto;
  padding: 0.6rem 0.8rem;
  line-height: 1.6;
  resize: vertical;
}

.field.select {
  flex-shrink: 0;
  min-width: 180px;
  padding-right: 2rem;
  background: var(--cc-inset) var(--cc-caret) no-repeat right 0.7rem center;
  appearance: none;
  cursor: pointer;
}

.cc-btn.danger {
  border-color: rgba(var(--cc-danger-rgb), 0.4);
  color: var(--cc-danger);
}

.cc-btn.danger:hover:not(:disabled) {
  border-color: rgba(var(--cc-danger-rgb), 0.7);
  background: rgba(var(--cc-danger-rgb), 0.1);
}

.badge {
  min-width: 18px;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--cc-seal);
  color: var(--cc-seal-text);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

/* ---------- 字体卡片 ---------- */
.fonts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.font-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.85rem 0.9rem 0.75rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--gm-block);
  color: var(--cc-text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.font-card:hover {
  border-color: rgba(var(--cc-gold-rgb), 0.45);
  background: var(--gm-block-hover);
}

.font-card.active {
  border-color: rgba(var(--cc-gold-rgb), 0.75);
  background: linear-gradient(160deg, rgba(var(--cc-gold-rgb), 0.14), rgba(var(--cc-gold-rgb), 0.03));
}

.font-sample {
  margin-bottom: 0.3rem;
  font-size: 24px;
  line-height: 1.2;
  letter-spacing: 0.08em;
  color: var(--cc-text);
}

.font-name {
  font-size: 14px;
  letter-spacing: 0.1em;
  color: var(--cc-text);
}

.font-desc {
  font-size: 12px;
  color: var(--cc-text-3);
}

.font-check {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--cc-seal);
  color: var(--cc-seal-text);
}

/* ---------- 正文预览（用的就是正文的字号 / 行距 / 配色变量） ---------- */
.preview {
  margin: 1.1rem 0 0;
  padding: 0.8rem 1.4rem 0.4rem;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.3);
  border-radius: 8px;
  background: var(--gm-block);
}

.preview figcaption {
  margin-bottom: 0.6rem;
  font-size: 12px;
  letter-spacing: 0.3em;
  color: var(--cc-text-3);
}

.preview p {
  margin: 0 0 0.7rem;
  font-size: var(--narrative-size, 17px);
  line-height: var(--narrative-leading, 2);
  letter-spacing: 0.04em;
  text-indent: 2em;
  color: var(--cc-text);
}

.preview .p-env {
  color: var(--gm-text-env);
}

.preview .p-dia {
  color: var(--gm-text-dialogue);
  font-weight: 500;
}

.preview .p-psy {
  color: var(--gm-text-psy);
  font-style: italic;
}

/* ---------- 提示词管理弹窗 ---------- */
.prompt-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.prompt-modal-content {
  display: flex;
  flex-direction: column;
  width: min(900px, 100%);
  height: min(820px, 88vh);
  overflow: hidden;
  border: 1px solid var(--cc-shell-border);
  border-radius: 12px;
  background: var(--cc-solid-bg);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

/* ---------- 窄容器（弹窗、平板、手机）：目录变成顶部横排 ---------- */
@container (max-width: 820px) {
  .settings-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
    padding: 0 1rem 2.5rem;
  }

  .toc {
    top: 0;
    z-index: 2;
    flex-direction: row;
    gap: 0.3rem;
    margin: 0 -1rem;
    padding: 0.6rem 1rem;
    overflow-x: auto;
    background: var(--cc-solid-bg);
    border-bottom: 1px solid var(--gm-line);
  }

  .toc-item {
    width: auto;
    flex-shrink: 0;
    gap: 0.45rem;
    padding: 0.35rem 0.7rem 0.35rem 0.4rem;
  }

  .toc-item.active::before,
  .toc-text small,
  .toc-note {
    display: none;
  }

  .toc-seal {
    width: 24px;
    height: 24px;
    font-size: 14px;
  }

  .toc-text b {
    font-size: 14px;
    letter-spacing: 0.1em;
  }

  .sec {
    scroll-margin-top: 4rem;
  }

  .fonts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container (max-width: 520px) {
  .row:not(.stacked) {
    flex-wrap: wrap;
    gap: 0.7rem;
  }

  .row-info {
    flex-basis: 100%;
  }

  .range :deep(.range-slider) {
    flex-basis: 150px;
    width: 150px;
  }

  .field.select {
    width: 100%;
  }
}
</style>
