<template>
  <div class="events-page">
    <div class="events-col">
      <div class="next">
        <span class="gm-sec-seal">候</span>
        <div class="next-main">
          <span class="next-label">下次世界事件</span>
          <b v-if="!sys.config.value.启用随机事件">随机事件已关闭</b>
          <b v-else-if="sys.nextEventTime.value">{{ formatGameTime(sys.nextEventTime.value, false) }}<small v-if="yearsLeft !== null">（约 {{ yearsLeft }} 年后）</small></b>
          <b v-else>尚未抽取</b>
        </div>
        <button v-if="sys.config.value.启用随机事件" type="button" class="cc-btn small" :disabled="rerolling" @click="reroll">
          <Dices :size="14" /><span>{{ sys.nextEventTime.value ? '重新抽取' : '抽取' }}</span>
        </button>
      </div>

      <EmptyState v-if="!sys.events.value.length" glyph="劫" title="天下太平，暂无大事" desc="世界事件发生后会按时间记在这里" />

      <ol v-else class="timeline">
        <li v-for="(ev, i) in sys.events.value" :key="ev.事件ID || i" class="ev" :class="impactClass(ev.影响等级)">
          <div class="ev-time">
            <b>{{ ev.发生时间?.年 ?? '?' }}年</b>
            <span>{{ ev.发生时间?.月 ?? '?' }}月{{ ev.发生时间?.日 ?? '?' }}日</span>
          </div>
          <span class="ev-dot" aria-hidden="true"></span>
          <article class="ev-card">
            <header class="ev-head">
              <span class="ev-type">{{ ev.事件类型 || '事件' }}</span>
              <h3 class="ev-name">{{ ev.事件名称 || '无名事件' }}</h3>
              <SealBadge v-if="ev.影响等级" :tone="impactTone(ev.影响等级)">{{ ev.影响等级 }}</SealBadge>
              <span class="spacer"></span>
              <button type="button" class="cc-icon-btn danger" title="删除事件" aria-label="删除事件" @click="remove(ev)"><Trash2 :size="14" /></button>
            </header>
            <p class="ev-desc" :class="{ clamp: !expanded.has(key(ev, i)) }">{{ ev.事件描述 }}</p>
            <button v-if="(ev.事件描述 || '').length > 90" type="button" class="ev-more" @click="toggle(key(ev, i))">
              {{ expanded.has(key(ev, i)) ? '收起' : '展开全文' }}
            </button>
            <p class="ev-meta">
              <span v-if="ev.影响范围"><MapPin :size="13" />{{ ev.影响范围 }}</span>
              <span v-if="ev.相关人物?.length"><Users :size="13" />{{ ev.相关人物.join('、') }}</span>
              <span v-if="ev.相关势力?.length"><Landmark :size="13" />{{ ev.相关势力.join('、') }}</span>
              <span v-if="ev.事件来源" class="src">来源：{{ ev.事件来源 }}</span>
            </p>
          </article>
        </li>
      </ol>
    </div>

    <!-- 事件规则 -->
    <SideDrawer :open="rulesOpen" title="事件规则" :width="520" @close="rulesOpen = false">
      <template v-if="draft">
        <div class="gm-form-row">
          <div class="gm-form-info">
            <span class="gm-form-name">启用随机事件</span>
            <span class="gm-form-desc">按间隔自动触发世界事件，由 AI 生成</span>
          </div>
          <label class="gm-switch"><input v-model="draft.启用随机事件" type="checkbox" /><span></span></label>
        </div>

        <template v-if="draft.启用随机事件">
          <div class="gm-form-row nested">
            <div class="gm-form-info">
              <span class="gm-form-name">触发间隔（年）</span>
              <span class="gm-form-desc">最小 ≥ 1，最大 ≥ 最小</span>
            </div>
            <div class="range-pair">
              <input v-model.number="draft.最小间隔年" class="gm-field num" type="number" min="1" aria-label="最小间隔年" />
              <span>至</span>
              <input v-model.number="draft.最大间隔年" class="gm-field num" type="number" :min="draft.最小间隔年" aria-label="最大间隔年" :class="{ invalid: draft.最大间隔年 < draft.最小间隔年 }" />
            </div>
          </div>

          <div class="gm-form-row stacked nested">
            <div class="gm-form-info">
              <span class="gm-form-name">启用的事件类型</span>
            </div>
            <div class="types">
              <label v-for="ty in EVENT_TYPES" :key="ty" class="type-chip" :class="{ on: draft.启用事件类型?.[ty] }">
                <input v-model="draft.启用事件类型![ty]" type="checkbox" />
                {{ ty }}
              </label>
            </div>
          </div>

          <div v-if="draft.启用事件类型?.特殊NPC" class="gm-form-row nested">
            <div class="gm-form-info">
              <span class="gm-form-name">特殊 NPC 概率</span>
              <span class="gm-form-desc">触发事件时出现特殊人物的几率</span>
            </div>
            <div class="inline">
              <input v-model.number="draft.特殊NPC概率" class="gm-field num" type="number" min="0" max="100" aria-label="特殊NPC概率" />
              <span class="unit">%</span>
            </div>
          </div>

          <div class="gm-form-row stacked nested">
            <div class="gm-form-info">
              <span class="gm-form-name">事件提示词</span>
              <span class="gm-form-desc">生成事件时附加给 AI 的要求，可留空</span>
            </div>
            <textarea v-model="draft.事件提示词" class="gm-field" rows="4" placeholder="例如：多写秘境与异宝，少写灾祸"></textarea>
          </div>

          <div class="gm-form-row stacked nested">
            <div class="gm-form-info">
              <span class="gm-form-name">自定义事件</span>
              <span class="gm-form-desc">描述模板可用占位符，如 {玩家名}、{位置}</span>
            </div>
            <ul v-if="draft.自定义事件?.length" class="customs">
              <li v-for="(c, i) in draft.自定义事件" :key="c.id || i" class="custom">
                <div class="custom-row">
                  <input v-model="c.名称" class="gm-field" placeholder="事件名称" aria-label="事件名称" />
                  <select v-model="c.类型" class="gm-field" aria-label="类型">
                    <option v-for="ty in EVENT_TYPES" :key="ty" :value="ty">{{ ty }}</option>
                  </select>
                  <select v-model="c.影响等级" class="gm-field" aria-label="影响等级">
                    <option v-for="lv in IMPACT_LEVELS" :key="lv" :value="lv">{{ lv }}</option>
                  </select>
                  <button type="button" class="cc-icon-btn danger" title="删除" aria-label="删除自定义事件" @click="removeCustom(i)"><Trash2 :size="14" /></button>
                </div>
                <textarea v-model="c.描述模板" class="gm-field" rows="2" placeholder="描述模板"></textarea>
              </li>
            </ul>
            <button type="button" class="cc-btn small add" @click="addCustom"><Plus :size="14" /><span>添加自定义事件</span></button>
          </div>
        </template>
      </template>
      <template #foot>
        <button type="button" class="cc-btn" @click="rulesOpen = false">取消</button>
        <button type="button" class="cc-btn primary" :disabled="saving || !draftValid" @click="saveRules">
          <Save :size="15" /><span>保存规则</span>
        </button>
      </template>
    </SideDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Dices, Landmark, MapPin, Plus, Save, SlidersHorizontal, Trash2, Users } from 'lucide-vue-next';
import type { EventSystemConfig, GameEvent } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';
import { EVENT_TYPES, IMPACT_LEVELS, useEventSystem } from '@/composables/useEventSystem';
import { usePageActions } from '@/composables/usePageActions';
import { confirmDialog } from '@/composables/useDialog';
import { formatGameTime } from '@/utils/gameDisplay';
import { toast } from '@/utils/toast';
import { cloneDeep } from 'lodash';
import EmptyState from '@/components/game/EmptyState.vue';
import SealBadge from '@/components/game/SealBadge.vue';
import SideDrawer from '@/components/game/SideDrawer.vue';

defineOptions({ name: 'EventsPage' });

const gs = useGameStateStore();
const sys = useEventSystem();

const yearsLeft = computed(() => {
  const n = sys.nextEventTime.value;
  const now = gs.gameTime;
  if (!n || !now) return null;
  return Math.max(0, n.年 - now.年);
});

const impactClass = (lv?: string) => ({ 轻微: 'lv1', 中等: 'lv2', 重大: 'lv3', 灾难: 'lv4' })[lv || ''] || 'lv1';
const impactTone = (lv?: string) => (lv === '灾难' || lv === '重大' ? 'bad' : lv === '中等' ? 'gold' : 'muted');

const expanded = ref(new Set<string>());
const key = (ev: GameEvent, i: number) => ev.事件ID || `i${i}`;
const toggle = (k: string) => {
  const s = new Set(expanded.value);
  if (s.has(k)) s.delete(k);
  else s.add(k);
  expanded.value = s;
};

const remove = async (ev: GameEvent) => {
  const ok = await confirmDialog({
    title: '删除事件记录',
    message: `删除「${ev.事件名称}」？只删记录，不影响已发生的剧情。`,
    details: [`【${ev.事件类型}】${ev.事件名称}`],
    confirmText: '删除',
    danger: true,
  });
  if (!ok) return;
  await sys.deleteEvent(ev);
  toast.success('已删除');
};

const rerolling = ref(false);
const reroll = async () => {
  rerolling.value = true;
  try {
    await sys.rerollNextEvent();
    toast.success('已重新抽取下次事件时间');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '抽取失败');
  } finally {
    rerolling.value = false;
  }
};

// ─── 规则抽屉：编辑副本，保存时整体写回 ───
const rulesOpen = ref(false);
const draft = ref<EventSystemConfig | null>(null);
const openRules = () => {
  draft.value = cloneDeep(sys.config.value);
  rulesOpen.value = true;
};
const draftValid = computed(() => !!draft.value && draft.value.最小间隔年 >= 1 && draft.value.最大间隔年 >= draft.value.最小间隔年);
const addCustom = () => {
  draft.value!.自定义事件 = [
    ...(draft.value!.自定义事件 || []),
    { id: `custom_${Date.now()}`, 名称: '', 类型: '世界变革', 影响等级: '中等', 描述模板: '', 启用: true },
  ];
};
const removeCustom = async (i: number) => {
  const c = draft.value!.自定义事件![i];
  if (c?.名称 || c?.描述模板) {
    const ok = await confirmDialog({ title: '删除自定义事件', message: `删除「${c.名称 || '未命名'}」？保存规则后生效。`, confirmText: '删除', danger: true });
    if (!ok) return;
  }
  draft.value!.自定义事件 = draft.value!.自定义事件!.filter((_, idx) => idx !== i);
};
const saving = ref(false);
const saveRules = async () => {
  if (!draft.value) return;
  saving.value = true;
  try {
    await sys.saveConfig(draft.value);
    toast.success('事件规则已保存');
    rulesOpen.value = false;
  } finally {
    saving.value = false;
  }
};

usePageActions(() => [{ key: 'rules', title: '事件规则', icon: SlidersHorizontal, onClick: openRules }]);
</script>

<style scoped>
.events-page {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
}

.events-col {
  display: flex;
  flex-direction: column;
  max-width: 900px;
  min-height: 100%;
  margin: 0 auto;
  padding: 1.25rem 0 2rem;
}

.next {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 1.5rem;
  padding: 0.85rem 1.1rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--gm-block);
}

.next-main {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
}

.next-label {
  font-size: 13px;
  letter-spacing: 0.2em;
  color: var(--cc-text-2);
}

.next-main b {
  font-size: 17px;
  font-weight: 500;
  color: var(--cc-gold);
}

.next-main small {
  margin-left: 0.4rem;
  font-size: 13px;
  font-weight: 400;
  color: var(--cc-text-2);
}

/* ---------- 时间线 ---------- */
.timeline {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
}

.timeline::before {
  content: '';
  position: absolute;
  top: 6px;
  bottom: 0;
  left: 99px;
  width: 2px;
  background: linear-gradient(180deg, rgba(var(--cc-gold-rgb), 0.5), var(--gm-line) 70%);
}

.ev {
  --tone: var(--cc-text-3);

  position: relative;
  display: grid;
  grid-template-columns: 78px 28px minmax(0, 1fr);
  gap: 0 0.5rem;
  padding-bottom: 1.25rem;
}

.ev.lv2 { --tone: var(--cc-gold); }
.ev.lv3 { --tone: var(--cc-danger); }
.ev.lv4 { --tone: var(--cc-seal); }

.ev-time {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-top: 0.55rem;
  font-variant-numeric: tabular-nums;
}

.ev-time b {
  font-size: 15px;
  font-weight: 500;
  color: var(--cc-text);
}

.ev-time span {
  font-size: 12px;
  color: var(--cc-text-2);
}

.ev-dot {
  position: relative;
  z-index: 1;
  justify-self: center;
  width: 12px;
  height: 12px;
  margin-top: 0.85rem;
  border: 2px solid var(--tone);
  border-radius: 50%;
  background: var(--cc-solid-bg);
}

.ev.lv3 .ev-dot,
.ev.lv4 .ev-dot {
  background: var(--tone);
}

.ev-card {
  padding: 0.75rem 1rem 0.8rem;
  border: 1px solid var(--cc-border);
  border-left: 3px solid var(--tone);
  border-radius: 6px;
  background: var(--gm-block);
}

.ev-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.6rem;
}

.ev-head .spacer {
  flex: 1;
}

.ev-type {
  padding: 0.05rem 0.45rem;
  border-radius: 3px;
  background: var(--cc-seal);
  color: var(--cc-seal-text);
  font-size: 12px;
  letter-spacing: 0.1em;
}

.ev-name {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.ev-desc {
  margin: 0.5rem 0 0;
  font-size: 15px;
  line-height: 1.85;
  color: var(--cc-text);
  white-space: pre-wrap;
}

.ev-desc.clamp {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.ev-more {
  padding: 0;
  border: none;
  background: none;
  color: var(--cc-accent);
  font-size: 13px;
  cursor: pointer;
}

.ev-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin: 0.55rem 0 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.ev-meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.ev-meta .src {
  margin-left: auto;
  color: var(--cc-text-3);
}

/* ---------- 规则表单 ---------- */
.range-pair,
.inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
  color: var(--cc-text-2);
}

.gm-field.num {
  width: 72px;
  text-align: center;
}

.unit {
  color: var(--cc-text-2);
}

.types {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.type-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--cc-border);
  border-radius: 4px;
  background: var(--cc-inset);
  color: var(--cc-text-2);
  font-size: 14px;
  cursor: pointer;
}

.type-chip input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.type-chip.on {
  border-color: rgba(var(--cc-gold-rgb), 0.55);
  background: rgba(var(--cc-gold-rgb), 0.14);
  color: var(--cc-gold);
}

.type-chip:has(input:focus-visible) {
  outline: 2px solid rgba(var(--cc-gold-rgb), 0.6);
}

.gm-form-row textarea {
  width: 100%;
}

.customs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.custom {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
}

.custom-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7.5em 5.5em auto;
  gap: 0.4rem;
}

.cc-btn.add {
  align-self: flex-start;
}

@media (max-width: 768px) {
  .events-col {
    padding-top: 0.75rem;
  }

  .timeline::before {
    left: 71px;
  }

  .ev {
    grid-template-columns: 56px 22px minmax(0, 1fr);
    gap: 0 0.35rem;
  }

  .custom-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
</style>
