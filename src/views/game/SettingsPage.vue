<template>
  <div class="settings-page">
    <PageTabs v-model="tab" :tabs="tabs" label="设置分组">
      <span class="auto-note"><Check :size="13" />改动即时生效，自动保存</span>
    </PageTabs>

    <div class="s-body">
      <!-- 显示 -->
      <div v-if="tab === 'display'" class="cards">
        <section class="card">
          <h4 class="c-name">主题</h4>
          <p class="c-desc">界面的明暗风格；跟随系统时随系统深浅色自动切换</p>
          <div class="theme-picks" role="radiogroup" aria-label="主题">
            <button
              v-for="o in THEMES"
              :key="o.value"
              type="button"
              role="radio"
              class="theme-pick"
              :class="[o.value, { active: s.theme.value === o.value }]"
              :aria-checked="s.theme.value === o.value"
              @click="s.setTheme(o.value)"
            >
              <span class="swatch" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="tp-name"><component :is="o.icon" :size="14" />{{ o.label }}</span>
            </button>
          </div>
        </section>

        <section class="card">
          <h4 class="c-name">界面缩放</h4>
          <p class="c-desc">按钮、菜单、面板和文字一起放大缩小；只想调正文请到「阅读 → 正文字号」</p>
          <div class="range">
            <RangeSlider v-model="set.uiScale" :min="80" :max="130" :step="5" aria-label="界面缩放" @dragstart="beginUIScaleGesture" @commit="endUIScaleGesture(set.uiScale)" />
            <output>{{ set.uiScale }}%</output>
          </div>
        </section>

        <section class="card">
          <h4 class="c-name">语言</h4>
          <p class="c-desc">界面文字使用的语言</p>
          <div class="gm-seg" role="radiogroup" aria-label="语言">
            <button v-for="o in LANGS" :key="o.value" type="button" role="radio" :aria-checked="lang === o.value" :class="{ active: lang === o.value }" @click="changeLanguage(o.value)">{{ o.label }}</button>
          </div>
        </section>

        <section class="card">
          <div class="c-row">
            <div>
              <h4 class="c-name">快速动画</h4>
              <p class="c-desc">缩短界面动画和过渡时间</p>
            </div>
            <label class="gm-switch"><input v-model="set.fastAnimations" type="checkbox" aria-label="快速动画" /><span></span></label>
          </div>
        </section>
      </div>

      <!-- 阅读 -->
      <div v-else-if="tab === 'reading'" class="reading">
        <div class="cards">
          <section class="card wide">
            <h4 class="c-name">字体</h4>
            <p class="c-desc">作用于正文与界面；网络字体首次使用需加载片刻，失败时自动改用系统字体</p>
            <div class="fonts" role="radiogroup" aria-label="字体">
              <button
                v-for="f in FONT_OPTIONS"
                :key="f.key"
                type="button"
                role="radio"
                class="font-card"
                :class="{ active: set.fontFamily === f.key }"
                :aria-checked="set.fontFamily === f.key"
                @click="set.fontFamily = f.key"
              >
                <span class="font-sample" :style="{ fontFamily: f.stack }">山河道途</span>
                <span class="font-name">{{ f.label }}</span>
                <span class="font-desc">{{ f.desc }}</span>
                <span v-if="set.fontFamily === f.key" class="font-check"><Check :size="12" /></span>
              </button>
            </div>
          </section>

          <section class="card">
            <h4 class="c-name">正文字号</h4>
            <p class="c-desc">只影响中间的故事正文</p>
            <div class="range">
              <RangeSlider v-model="set.narrativeSize" :min="14" :max="22" :step="1" aria-label="正文字号" />
              <output>{{ set.narrativeSize }}px</output>
            </div>
          </section>

          <section class="card">
            <h4 class="c-name">正文行距</h4>
            <p class="c-desc">行与行之间的留白</p>
            <div class="gm-seg" role="radiogroup" aria-label="正文行距">
              <button v-for="o in LEADINGS" :key="o.value" type="button" role="radio" :aria-checked="set.narrativeLeading === o.value" :class="{ active: set.narrativeLeading === o.value }" @click="set.narrativeLeading = o.value">{{ o.label }}</button>
            </div>
          </section>

          <section class="card">
            <h4 class="c-name">叙事配色</h4>
            <p class="c-desc">{{ TONES.find((o) => o.value === set.narrativeTone)?.desc }}</p>
            <div class="gm-seg" role="radiogroup" aria-label="叙事配色">
              <button v-for="o in TONES" :key="o.value" type="button" role="radio" :aria-checked="set.narrativeTone === o.value" :class="{ active: set.narrativeTone === o.value }" @click="set.narrativeTone = o.value">{{ o.label }}</button>
            </div>
          </section>
        </div>

        <figure class="preview" aria-label="正文预览">
          <figcaption class="gm-label">正文预览</figcaption>
          <p class="p-env">【晨光初破，山岚如纱，自赤褐色的山岩裂隙间蒸腾而起。】</p>
          <p>竹庐之内，{{ s.playerName.value || '千夜' }}盘膝而坐，双手结出引气印，四周游离的火行灵气仿佛受到无形牵引。</p>
          <p>秦岚站在门边，语速极快：<span class="p-dia">"师弟，黑砂岭的人至多半个时辰便会搜上岭来。"</span><span class="p-psy">此地已非善地。</span></p>
          <p>檐下风铃轻响，远处传来几声鹤唳，山道尽头隐约可见火光。</p>
        </figure>
      </div>

      <!-- 游戏 -->
      <div v-else-if="tab === 'game'" class="cards">
        <section v-if="s.playerName.value" class="card">
          <h4 class="c-name">道号</h4>
          <p class="c-desc">修改当前角色的名字，保存后写入当前存档</p>
          <form class="inline" @submit.prevent="rename">
            <input v-model="newName" class="gm-field grow" :placeholder="s.playerName.value" aria-label="新道号" />
            <button type="submit" class="cc-btn small" :disabled="!newName.trim() || newName.trim() === s.playerName.value"><Save :size="14" /><span>确认</span></button>
          </form>
        </section>

        <section class="card">
          <div class="c-row">
            <div>
              <h4 class="c-name">行动选项</h4>
              <p class="c-desc">每回合由 AI 给出可选的行动建议</p>
            </div>
            <label class="gm-switch"><input v-model="ui.enableActionOptions" type="checkbox" aria-label="行动选项" /><span></span></label>
          </div>
          <textarea
            v-if="ui.enableActionOptions"
            v-model="ui.actionOptionsPrompt"
            class="gm-field area"
            rows="3"
            placeholder="自定义行动选项的风格（可选，留空用默认）。例如：多给修炼和探索类选项，少给战斗选项"
            aria-label="自定义行动选项提示词"
          ></textarea>
        </section>

        <section class="card">
          <div class="c-row">
            <div>
              <h4 class="c-name">境界分层地图</h4>
              <p class="c-desc">按角色境界分别记录世界地图，旧存档开启后自动迁移</p>
            </div>
            <label class="gm-switch"><input v-model="set.realmLayeredMap" type="checkbox" aria-label="境界分层地图" /><span></span></label>
          </div>
        </section>

        <section class="card">
          <h4 class="c-name">存档保护强度</h4>
          <p class="c-desc">控制 AI 指令的保护和拒绝力度；越低越自由，但更容易产生坏存档</p>
          <div class="gm-seg" role="radiogroup" aria-label="存档保护强度">
            <button type="button" role="radio" :aria-checked="ui.commandProtectionMode === 'strict'" :class="{ active: ui.commandProtectionMode === 'strict' }" @click="ui.commandProtectionMode = 'strict'">严格（推荐）</button>
            <button type="button" role="radio" :aria-checked="ui.commandProtectionMode === 'skeleton'" :class="{ active: ui.commandProtectionMode === 'skeleton' }" @click="ui.commandProtectionMode = 'skeleton'">仅骨干</button>
          </div>
        </section>
      </div>

      <!-- 高级 -->
      <div v-else class="cards">
        <section class="card">
          <h4 class="c-name">提示词管理</h4>
          <p class="c-desc">查看和修改发给 AI 的各段提示词</p>
          <button type="button" class="cc-btn small" @click="router.push('/game/prompts')"><FileText :size="14" /><span>打开提示词管理</span></button>
        </section>

        <section class="card">
          <h4 class="c-name">正则替换规则 <SealBadge v-if="s.enabledRuleCount.value" tone="gold">{{ s.enabledRuleCount.value }} 条启用</SealBadge></h4>
          <p class="c-desc">对 AI 输出做替换：正则或纯文本，用于格式修正、屏蔽词替换等</p>
          <button type="button" class="cc-btn small" @click="rulesOpen = true"><Replace :size="14" /><span>编辑规则</span></button>
        </section>

        <section class="card">
          <div class="c-row">
            <div>
              <h4 class="c-name">调试模式</h4>
              <p class="c-desc">启用开发者调试信息和详细日志</p>
            </div>
            <label class="gm-switch"><input v-model="set.debugMode" type="checkbox" aria-label="调试模式" /><span></span></label>
          </div>
          <template v-if="set.debugMode">
            <div class="c-row sub">
              <span>控制台调试<small>在浏览器控制台显示详细调试信息</small></span>
              <label class="gm-switch"><input v-model="set.consoleDebug" type="checkbox" aria-label="控制台调试" /><span></span></label>
            </div>
            <div class="c-row sub">
              <span>性能监控<small>监控组件性能和加载时间</small></span>
              <label class="gm-switch"><input v-model="set.performanceMonitor" type="checkbox" aria-label="性能监控" /><span></span></label>
            </div>

            <!-- 运行诊断：数值未匹配、走保底等情况在此展开查看（手机端无需控制台） -->
            <div class="c-row sub diag-row">
              <button type="button" class="diag-toggle" @click="diagOpen = !diagOpen">
                <span class="diag-title">
                  运行诊断
                  <SealBadge v-if="diagItems.length" tone="gold">{{ diagItems.length }}</SealBadge>
                </span>
                <small>{{ diagOpen ? '点击收起' : '数值未匹配、走保底等情况' }}</small>
              </button>
              <button v-if="diagItems.length" type="button" class="diag-clear" @click="clearDiag">清空</button>
            </div>
            <div v-if="diagOpen" class="diag-panel">
              <p v-if="!diagItems.length" class="diag-empty">暂无诊断信息——说明数值都匹配上了。</p>
              <ul v-else class="diag-list">
                <li v-for="(d, i) in diagItems" :key="i" :class="'lv-' + d.level">
                  <span class="diag-scope">{{ d.scope }}</span>
                  <span class="diag-msg">{{ d.message }}</span>
                  <span v-if="d.detail" class="diag-detail">{{ d.detail }}</span>
                </li>
              </ul>
            </div>
          </template>
        </section>

        <section class="card">
          <h4 class="c-name">设置备份</h4>
          <p class="c-desc">把全部设置导出为文件，或从文件导入</p>
          <div class="inline">
            <button type="button" class="cc-btn small" @click="s.exportSettings"><Download :size="14" /><span>导出</span></button>
            <button type="button" class="cc-btn small" @click="s.importSettings"><Upload :size="14" /><span>导入</span></button>
          </div>
        </section>

        <section class="card">
          <h4 class="c-name">清理缓存</h4>
          <p class="c-desc">清除临时数据和缓存，不影响存档</p>
          <button type="button" class="cc-btn small danger" @click="s.clearCache"><Trash2 :size="14" /><span>清理缓存</span></button>
        </section>
      </div>
    </div>

    <TextReplaceRulesModal :open="rulesOpen" :rules="set.replaceRules" @close="rulesOpen = false" @save="s.saveRules" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Check, Download, FileText, Monitor, Moon, Replace, RotateCcw, Save, Sun, Trash2, Upload } from 'lucide-vue-next';
import { useGameSettings } from '@/composables/useGameSettings';
import { usePageActions } from '@/composables/usePageActions';
import type { ThemePreference } from '@/composables/useTheme';
import { useI18n } from '@/i18n';
import { useUIStore } from '@/stores/uiStore';
import { FONT_OPTIONS, beginUIScaleGesture, endUIScaleGesture, type NarrativeLeading, type NarrativeTone } from '@/utils/readingPrefs';
import { toast } from '@/utils/toast';
import RangeSlider from '@/components/common/RangeSlider.vue';
import PageTabs from '@/components/game/PageTabs.vue';
import SealBadge from '@/components/game/SealBadge.vue';
import TextReplaceRulesModal from '@/components/common/TextReplaceRulesModal.vue';
import { diagnostics } from '@/utils/diagnostics';
import { onUnmounted } from 'vue';

defineOptions({ name: 'SettingsPage' });

// ─── 运行诊断：可展开查看数值未匹配/走保底等情况（手机端无需控制台）───
const diagOpen = ref(false);
const diagVersion = ref(diagnostics.version);
const unsubscribeDiag = diagnostics.subscribe(() => {
  diagVersion.value = diagnostics.version;
});
onUnmounted(unsubscribeDiag);
const diagItems = computed(() => {
  void diagVersion.value; // 依赖 version 触发更新
  return diagnostics.list();
});
const clearDiag = () => diagnostics.clear();

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: '暗夜', icon: Moon },
  { value: 'light', label: '素笺', icon: Sun },
  { value: 'auto', label: '跟随系统', icon: Monitor },
];
const LANGS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
] as const;
const LEADINGS: { value: NarrativeLeading; label: string }[] = [
  { value: 'tight', label: '紧凑' },
  { value: 'normal', label: '适中' },
  { value: 'loose', label: '宽松' },
];
const TONES: { value: NarrativeTone; label: string; desc: string }[] = [
  { value: 'vivid', label: '彩色', desc: '环境青、对话金、心理紫' },
  { value: 'plain', label: '素雅', desc: '只给对话着色，更像书页' },
];

const router = useRouter();
const ui = useUIStore();
const s = useGameSettings();
const set = s.settings;

const tab = ref<'display' | 'reading' | 'game' | 'advanced'>('display');
const tabs = computed(() => [
  { key: 'display', label: '显示' },
  { key: 'reading', label: '阅读' },
  { key: 'game', label: '游戏' },
  { key: 'advanced', label: '高级', count: s.enabledRuleCount.value || null },
]);

const { setLanguage, currentLanguage: lang } = useI18n();
const changeLanguage = (v: 'zh' | 'en') => {
  if (lang.value === v) return;
  setLanguage(v);
  toast.success('语言设置已更新');
};

const newName = ref('');
const rename = async () => {
  if (await s.renamePlayer(newName.value)) newName.value = '';
};

const rulesOpen = ref(false);

usePageActions([
  { key: 'import', title: '导入', icon: Upload, onClick: s.importSettings },
  { key: 'export', title: '导出', icon: Download, onClick: s.exportSettings },
  { key: 'reset', title: '恢复默认', icon: RotateCcw, onClick: s.reset },
]);
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--cc-text);
}

.auto-note {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
  font-size: 12px;
  color: var(--cc-text-3);
}

.s-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem 0 2rem;
}

/* ---------- 卡片网格 ---------- */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  align-content: start;
  gap: 1rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  padding: 1rem 1.15rem 1.1rem;
  border: 1px solid var(--gm-line);
  border-radius: 8px;
  background: var(--gm-block);
}

.card.wide {
  grid-column: 1 / -1;
}

.card > .gm-seg,
.card > .range,
.card > .inline,
.card > .cc-btn,
.card > .theme-picks,
.card > .fonts,
.card > .area {
  margin-top: 0.55rem;
}

.card > .cc-btn {
  align-self: flex-start;
}

.card > .gm-seg {
  align-self: flex-start;
}

.c-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.08em;
}

.c-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--cc-text-2);
}

.c-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

/* ─── 运行诊断 ─── */
.diag-row {
  align-items: center;
}

.diag-toggle {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.diag-title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 14px;
}

.diag-toggle small {
  font-size: 12px;
  color: var(--cc-text-2);
}

.diag-clear {
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--cc-border, rgba(255, 255, 255, 0.15));
  border-radius: 4px;
  background: none;
  color: var(--cc-text-2);
  font-size: 12px;
  cursor: pointer;
}

.diag-panel {
  max-height: 320px;
  overflow-y: auto;
  padding: 0.5rem 0.6rem;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
}

.diag-empty {
  margin: 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.diag-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.diag-list li {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding-left: 0.5rem;
  border-left: 2px solid var(--cc-text-2);
  font-size: 12.5px;
  line-height: 1.5;
}

.diag-list li.lv-info {
  border-left-color: #63b3ed;
}

.diag-list li.lv-warn {
  border-left-color: #daa520;
}

.diag-list li.lv-error {
  border-left-color: #f56565;
}

.diag-scope {
  font-weight: 600;
  color: var(--cc-gold);
}

.diag-msg {
  color: var(--cc-text-1, inherit);
}

.diag-detail {
  color: var(--cc-text-2);
  word-break: break-all;
}

.c-row > div {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.c-row.sub {
  margin-top: 0.6rem;
  padding: 0.6rem 0 0 0.9rem;
  border-top: 1px dashed var(--gm-line);
  font-size: 14px;
}

.c-row.sub span {
  display: flex;
  flex-direction: column;
}

.c-row.sub small {
  font-size: 12px;
  color: var(--cc-text-3);
}

.inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.grow {
  flex: 1;
  min-width: 140px;
}

.area {
  width: 100%;
  resize: vertical;
  font-size: 13px;
  line-height: 1.6;
}

/* ---------- 滑块 ---------- */
.range {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.range output {
  flex: none;
  width: 4.2em;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--cc-gold);
}

/* ---------- 主题色卡 ---------- */
.theme-picks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.theme-pick {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: transparent;
  color: var(--cc-text-2);
  font-family: inherit;
  cursor: pointer;
}

.theme-pick.active {
  border-color: rgba(var(--cc-gold-rgb), 0.75);
  background: rgba(var(--cc-gold-rgb), 0.1);
  color: var(--cc-text);
}

.swatch {
  display: grid;
  grid-template-columns: 1fr 2fr;
  grid-template-rows: 1fr 1fr;
  gap: 3px;
  height: 46px;
  padding: 4px;
  border-radius: 5px;
  background: #0d1220;
}

.swatch i {
  border-radius: 3px;
  background: #1d2536;
}

.swatch i:first-child {
  grid-row: 1 / 3;
  background: #151c2b;
}

.swatch i:last-child {
  background: #c9a45c;
  opacity: 0.8;
}

.theme-pick.light .swatch {
  background: #eef0ea;
}

.theme-pick.light .swatch i {
  background: #fbfbf8;
}

.theme-pick.light .swatch i:first-child {
  background: #e4e7df;
}

.theme-pick.light .swatch i:last-child {
  background: #2f6b67;
}

.theme-pick.auto .swatch {
  background: linear-gradient(135deg, #0d1220 50%, #eef0ea 50%);
}

.theme-pick.auto .swatch i {
  background: rgba(128, 128, 128, 0.35);
}

.theme-pick.auto .swatch i:last-child {
  background: #c9a45c;
}

.tp-name {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  font-size: 13px;
}

/* ---------- 阅读：左设置、右预览 ---------- */
.reading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
  align-items: start;
  gap: 1.25rem;
}

.reading .cards {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.fonts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.6rem;
}

.font-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.8rem 0.9rem 0.7rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-inset);
  color: var(--cc-text);
  text-align: left;
  cursor: pointer;
}

.font-card:hover {
  border-color: rgba(var(--cc-gold-rgb), 0.45);
}

.font-card.active {
  border-color: rgba(var(--cc-gold-rgb), 0.75);
  background: linear-gradient(160deg, rgba(var(--cc-gold-rgb), 0.14), rgba(var(--cc-gold-rgb), 0.03));
}

.font-sample {
  margin-bottom: 0.25rem;
  font-size: 22px;
  line-height: 1.2;
  letter-spacing: 0.08em;
}

.font-name {
  font-size: 13px;
  letter-spacing: 0.1em;
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

.preview {
  position: sticky;
  top: 0;
  margin: 0;
  padding: 1rem 1.5rem 0.6rem;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.35);
  border-radius: 8px;
  background: var(--gm-block);
}

.preview figcaption {
  margin-bottom: 0.8rem;
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

@media (max-width: 1200px) {
  .reading {
    grid-template-columns: minmax(0, 1fr);
  }

  .preview {
    position: static;
    order: -1;
  }
}

@media (max-width: 768px) {
  .auto-note {
    display: none;
  }

  .cards,
  .reading .cards {
    grid-template-columns: minmax(0, 1fr);
  }

  .theme-picks {
    gap: 0.4rem;
  }
}
</style>
