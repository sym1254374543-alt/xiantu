<template>
  <div class="craft-page">
    <!-- 左：炉鼎 -->
    <section class="forge">
      <div class="forge-top">
        <div class="gm-seg" role="radiogroup" aria-label="炼制类型">
          <button v-for="m in modes" :key="m" type="button" role="radio" :aria-checked="type === m" :class="{ active: type === m }" @click="type = m">
            <FlaskRound v-if="m === '炼丹'" :size="14" /><Hammer v-else :size="14" />{{ m }}
          </button>
        </div>
        <p class="forge-hint">点槽位选中，再点右侧材料放入；同一材料放入次数不超过持有数量。</p>
        <div v-if="simulation" class="sim-rate" :title="simulation.analysis || undefined">
          <ProgressRing :percent="simulation.successRate" :size="48" tone="accent" />
          <small>推演成功率</small>
        </div>
      </div>

      <div class="cauldron-wrap">
        <div class="cauldron-stage">
          <div class="cauldron" :class="{ busy: busy }">
            <span class="cauldron-glyph">{{ type === '炼丹' ? '丹' : '器' }}</span>
            <span class="cauldron-fire" :class="fire">{{ fire }}</span>
          </div>
          <button
            v-for="(slot, i) in slots"
            :key="i"
            type="button"
            class="slot"
            :class="{ active: activeSlot === i, filled: !!slot }"
            :style="slotStyle(i)"
            :aria-label="slot ? `槽位${i + 1}：${itemOf(slot)?.名称}，点击移除` : `槽位${i + 1}：空`"
            @click="onSlotClick(i)"
          >
            <template v-if="slot && itemOf(slot)">
              <QualityText class="slot-name" :quality="itemOf(slot)!.品质">{{ itemOf(slot)!.名称 }}</QualityText>
              <X :size="12" class="slot-x" />
            </template>
            <span v-else class="slot-empty">{{ i + 1 }}</span>
          </button>
        </div>
      </div>

      <div class="controls">
        <label class="ctl">
          <span class="ctl-name">火候 <b>{{ fire }}</b></span>
          <RangeSlider v-model="firePercent" :min="1" :max="100" aria-label="火候" />
          <output>{{ firePercent }}%</output>
        </label>
        <label class="ctl">
          <span class="ctl-name">灵气投入</span>
          <RangeSlider v-model="manaPercent" :min="1" :max="100" aria-label="灵气投入" />
          <output>{{ manaPercent }}% <small>-{{ plan.灵气.基础消耗 }}</small></output>
        </label>
        <label class="ctl">
          <span class="ctl-name">神识投入</span>
          <RangeSlider v-model="spiritPercent" :min="1" :max="100" aria-label="神识投入" />
          <output>{{ spiritPercent }}% <small>-{{ plan.神识.基础消耗 }}</small></output>
        </label>
        <div class="ctl formation">
          <label class="ctl-name" for="craft-formation">阵法</label>
          <select id="craft-formation" v-model="formationId" class="gm-field">
            <option v-for="f in formations" :key="f.id" :value="f.id">{{ f.name }}{{ f.id === 'none' ? '' : `（灵气 +${f.extraManaPercent}% · 神识 +${f.extraSpiritPercent}%）` }}</option>
          </select>
          <small class="formation-desc">{{ formation.desc }}</small>
        </div>
      </div>

      <footer class="forge-foot">
        <p class="cost">
          合计消耗 灵气 <b>{{ plan.灵气.总消耗 }}</b> / {{ plan.灵气.当前 }} · 神识 <b>{{ plan.神识.总消耗 }}</b> / {{ plan.神识.当前 }}
        </p>
        <label class="sim-toggle" title="开启后先让 AI 推演成功率，确认后再炼">
          <span class="gm-switch"><input v-model="enableSimulation" type="checkbox" /><span></span></span>
          成功率推演
        </label>
        <button type="button" class="cc-btn" :disabled="busy || !filledCount" @click="clearSlots"><Eraser :size="15" /><span>清空</span></button>
        <button type="button" class="cc-btn primary" :disabled="busy || !filledCount" @click="start">
          <Loader2 v-if="busy" :size="15" class="cc-spin" /><Flame v-else :size="15" />
          <span>{{ busy ? busyText : '开炉炼制' }}</span>
        </button>
      </footer>
    </section>

    <!-- 右：材料架 -->
    <aside class="shelf" aria-label="材料架">
      <header class="shelf-head">
        <h3 class="gm-label plain">材料架 <em>{{ materials.length }}</em></h3>
        <label class="gm-search">
          <Search :size="15" />
          <input v-model="query" class="cc-input" type="search" placeholder="搜索材料" aria-label="搜索材料" />
        </label>
      </header>
      <EmptyState v-if="!materials.length" glyph="材" title="没有可用材料" desc="炼制只能使用类型为「材料」且未装备的物品" compact>
        <button type="button" class="cc-btn small" @click="router.push('/game/inventory')"><Package :size="14" /><span>去背包看看</span></button>
      </EmptyState>
      <template v-else>
        <ul class="gm-list shelf-list">
          <li v-for="m in pagedMaterials" :key="m.物品ID">
            <button type="button" class="gm-row" :disabled="left(m) <= 0" @click="put(m)">
              <span class="gm-row-main">
                <QualityText class="gm-row-title" :quality="m.品质">{{ m.名称 }}</QualityText>
                <span class="gm-row-sub">{{ qualityLabel(m.品质) || '凡品' }}<template v-if="m.描述"> · {{ m.描述 }}</template></span>
              </span>
              <span class="gm-row-end">余 {{ left(m) }}</span>
            </button>
          </li>
        </ul>
        <div v-if="pages > 1" class="gm-pager">
          <button type="button" class="cc-icon-btn" aria-label="上一页" :disabled="page <= 1" @click="page--"><ChevronLeft :size="14" /></button>
          <span>{{ page }} / {{ pages }}</span>
          <button type="button" class="cc-icon-btn" aria-label="下一页" :disabled="page >= pages" @click="page++"><ChevronRight :size="14" /></button>
        </div>
      </template>
    </aside>

    <!-- 结果 -->
    <Teleport to="body">
      <div v-if="result" class="cc-modal-overlay result-layer" @click.self="result = null">
        <div class="cc-modal solid result" role="dialog" aria-modal="true" aria-labelledby="craft-result-title" @keydown.esc="result = null">
          <header class="cc-modal-head">
            <h3 id="craft-result-title" class="cc-modal-title">{{ result.success ? `${type}功成` : `${type}失败` }}</h3>
            <button type="button" class="cc-modal-close" aria-label="关闭" @click="result = null"><X :size="18" /></button>
          </header>
          <div class="cc-modal-body">
            <div class="res-head" :style="{ '--quality': qualityTone(result.quality) }">
              <span class="res-seal" :class="{ fail: !result.success }">{{ result.success ? '成' : '败' }}</span>
              <div>
                <QualityText tag="h2" class="res-name" :quality="result.quality">{{ result.item.名称 }}</QualityText>
                <p class="res-meta">{{ result.item.类型 }} · {{ qualityLabel(result.quality) }} · 成功率 {{ result.successRate }}%</p>
              </div>
            </div>
            <p class="gm-prose">{{ result.item.描述 }}</p>
            <h4 class="gm-label">炼制过程</h4>
            <p class="res-process">{{ result.processText }}</p>
          </div>
          <footer class="cc-modal-foot">
            <button type="button" class="cc-btn primary" @click="result = null">收入行囊</button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronLeft, ChevronRight, Eraser, Flame, FlaskRound, Hammer, Loader2, Package, Search, X } from 'lucide-vue-next';
import type { Item } from '@/types/game';
import type { CraftingType } from '@/utils/craftingSystem';
import { useGameStateStore } from '@/stores/gameStateStore';
import { CRAFTING_FORMATIONS, fireLabel } from '@/data/craftingFormations';
import { craft, resourcePlan, simulate, type CraftResult, type SimulationResult } from '@/services/craftingService';
import { qualityTone } from '@/utils/qualityTone';
import { qualityLabel } from '@/utils/gameDisplay';
import { toast } from '@/utils/toast';
import { confirmDialog } from '@/composables/useDialog';
import RangeSlider from '@/components/common/RangeSlider.vue';
import EmptyState from '@/components/game/EmptyState.vue';
import ProgressRing from '@/components/game/ProgressRing.vue';
import QualityText from '@/components/game/QualityText.vue';

defineOptions({ name: 'CraftingPage' });

const gs = useGameStateStore();
const router = useRouter();

const modes: CraftingType[] = ['炼丹', '炼器'];
const type = ref<CraftingType>('炼丹');
const firePercent = ref(50);
const manaPercent = ref(16);
const spiritPercent = ref(16);
const formationId = ref('none');
const enableSimulation = ref(true);

const formations = computed(() => CRAFTING_FORMATIONS[type.value]);
const formation = computed(() => formations.value.find((f) => f.id === formationId.value) ?? formations.value[0]);
watch(type, () => {
  if (!formations.value.some((f) => f.id === formationId.value)) formationId.value = 'none';
});
const fire = computed(() => fireLabel(firePercent.value));
const plan = computed(() => resourcePlan({ manaPercent: manaPercent.value, spiritPercent: spiritPercent.value, formation: formation.value }));

// ─── 材料 ───
const items = computed<Record<string, Item>>(() => ((gs.inventory as any)?.物品 || {}) as Record<string, Item>);
const materials = computed(() =>
  Object.values(items.value).filter((i) => i && i.类型 === '材料' && !i.已装备 && (i.数量 ?? 0) > 0),
);
const query = ref('');
const PER_PAGE = 8;
const page = ref(1);
const filtered = computed(() => materials.value.filter((m) => !query.value.trim() || m.名称.includes(query.value.trim())));
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PER_PAGE)));
const pagedMaterials = computed(() => filtered.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE));
watch([query, pages], () => {
  if (page.value > pages.value) page.value = 1;
});

// ─── 槽位 ───
const SLOT_COUNT = 5;
const slots = ref<(string | null)[]>(Array(SLOT_COUNT).fill(null));
const activeSlot = ref(0);
const filledCount = computed(() => slots.value.filter(Boolean).length);
const itemOf = (id: string) => items.value[id] || null;
const used = (id: string) => slots.value.filter((s) => s === id).length;
const left = (m: Item) => (m.数量 ?? 0) - used(m.物品ID);

const slotStyle = (i: number) => {
  const a = -Math.PI / 2 + (Math.PI * 2 * i) / SLOT_COUNT;
  return { left: `${50 + Math.cos(a) * 41}%`, top: `${50 + Math.sin(a) * 41}%` };
};

const onSlotClick = (i: number) => {
  if (slots.value[i]) {
    slots.value[i] = null;
    slots.value = [...slots.value];
  }
  activeSlot.value = i;
};

const put = (m: Item) => {
  if (left(m) <= 0) return toast.error('该材料数量不足');
  let idx = slots.value[activeSlot.value] ? slots.value.findIndex((s) => !s) : activeSlot.value;
  if (idx < 0) return toast.error('材料槽已满');
  const next = [...slots.value];
  next[idx] = m.物品ID;
  slots.value = next;
  idx = next.findIndex((s) => !s);
  if (idx >= 0) activeSlot.value = idx;
};

const clearSlots = () => {
  slots.value = Array(SLOT_COUNT).fill(null);
  activeSlot.value = 0;
  simulation.value = null;
};

// 材料被别处用掉时清理槽位
watch(items, () => {
  const next = slots.value.map((s) => (s && items.value[s] ? s : null));
  if (next.some((s, i) => s !== slots.value[i])) slots.value = next;
});

// ─── 流程 ───
const busy = ref(false);
const busyText = ref('');
const simulation = ref<SimulationResult | null>(null);
const result = ref<CraftResult | null>(null);

watch([type, firePercent, manaPercent, spiritPercent, formationId, slots], () => {
  simulation.value = null;
});

const params = () => ({
  type: type.value,
  slotItemIds: slots.value.filter((s): s is string => !!s),
  firePercent: firePercent.value,
  manaPercent: manaPercent.value,
  spiritPercent: spiritPercent.value,
  formation: formation.value,
});

const start = async () => {
  if (busy.value) return;
  busy.value = true;
  try {
    let overrideRate: number | undefined;
    if (enableSimulation.value) {
      busyText.value = '推演中';
      try {
        const sim = await simulate(params());
        simulation.value = sim;
        const details = [
          sim.predictedQuality ? `预计品质：${qualityLabel(sim.predictedQuality)}` : '',
          sim.analysis,
          ...sim.warnings.map((w) => `注意：${w}`),
        ].filter(Boolean);
        const ok = await confirmDialog({
          title: '推演完成',
          message: `推演成功率 ${sim.successRate}%，是否继续炼制？`,
          details,
          confirmText: '继续炼制',
        });
        if (!ok) return;
        overrideRate = sim.successRate;
      } catch (e) {
        if (e instanceof Error && /请先放入|未就绪|不足|不存在|不是材料|已装备/.test(e.message)) throw e;
        toast.warning('推演失败，将直接炼制');
      }
    }
    busyText.value = '炼制中';
    const snapshotParams = params();
    result.value = await craft(snapshotParams, overrideRate);
    slots.value = Array(SLOT_COUNT).fill(null);
    activeSlot.value = 0;
    simulation.value = null;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '炼制失败');
  } finally {
    busy.value = false;
  }
};
</script>

<style scoped>
.craft-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 1.25rem;
  height: 100%;
  min-height: 0;
  padding-top: 1rem;
}

.forge {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: radial-gradient(ellipse at 50% 42%, rgba(var(--cc-gold-rgb), 0.09), transparent 60%), var(--gm-block);
}

.forge-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}

.forge-hint {
  margin: 0;
  font-size: 13px;
  color: var(--cc-text-3);
}

.cauldron-wrap {
  display: flex;
  justify-content: center;
  flex: 1;
  min-height: 300px;
  padding: 0.5rem 0;
}

.cauldron-stage {
  position: relative;
  width: min(100%, 420px, 52vh);
  aspect-ratio: 1;
}

.cauldron {
  position: absolute;
  inset: 26%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, rgba(var(--cc-gold-rgb), 0.22), var(--cc-inset) 70%);
  box-shadow: 0 0 0 1px rgba(var(--cc-gold-rgb), 0.45), 0 0 0 10px rgba(var(--cc-gold-rgb), 0.05), 0 0 40px -8px rgba(var(--cc-gold-rgb), 0.35);
}

.cauldron.busy {
  animation: breathe 1.6s ease-in-out infinite;
}

@keyframes breathe {
  50% { box-shadow: 0 0 0 1px rgba(var(--cc-gold-rgb), 0.7), 0 0 0 14px rgba(var(--cc-gold-rgb), 0.08), 0 0 60px -4px rgba(var(--cc-gold-rgb), 0.55); }
}

.cauldron-glyph {
  font-family: var(--cc-calligraphy);
  font-size: clamp(40px, 7vh, 64px);
  line-height: 1;
  color: var(--cc-gold);
}

.cauldron-fire {
  margin-top: 0.3rem;
  font-size: 13px;
  letter-spacing: 0.3em;
  color: var(--cc-warning);
}

.cauldron-fire.暴火,
.cauldron-fire.武火 {
  color: var(--cc-danger);
}

.sim-rate {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.sim-rate small {
  font-size: 12px;
  color: var(--cc-text-2);
}

.slot {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 23%;
  aspect-ratio: 1;
  padding: 0.3rem;
  border: 1px dashed var(--cc-border-strong);
  border-radius: 50%;
  background: var(--cc-solid-bg);
  color: var(--cc-text-3);
  cursor: pointer;
  transform: translate(-50%, -50%);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.slot.filled {
  border-style: solid;
  border-color: rgba(var(--cc-gold-rgb), 0.55);
}

.slot.active {
  border-color: var(--cc-gold);
  box-shadow: 0 0 0 3px rgba(var(--cc-gold-rgb), 0.2);
}

.slot-name {
  display: -webkit-box;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.3;
  text-align: center;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.slot-x {
  position: absolute;
  top: 8%;
  right: 8%;
  color: var(--cc-text-3);
}

.slot-empty {
  font-family: var(--cc-calligraphy);
  font-size: 20px;
  color: rgba(var(--cc-gold-rgb), 0.35);
}

.controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem 2rem;
  padding: 1rem 0 0.25rem;
  border-top: 1px solid var(--gm-line);
}

.ctl {
  display: grid;
  grid-template-columns: 6.5em minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
}

.ctl-name {
  font-size: 14px;
  letter-spacing: 0.1em;
  color: var(--cc-text-2);
}

.ctl-name b {
  font-weight: 500;
  color: var(--cc-warning);
}

.ctl output {
  min-width: 5.5em;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--cc-gold);
}

.ctl output small {
  font-size: 12px;
  color: var(--cc-text-3);
}

.ctl.formation {
  grid-template-columns: 6.5em minmax(0, 1fr);
}

.formation-desc {
  grid-column: 2;
  font-size: 12px;
  color: var(--cc-text-3);
}

.forge-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 0.9rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--gm-line);
}

.cost {
  flex: 1;
  min-width: 14em;
  margin: 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.cost b {
  font-weight: 500;
  color: var(--cc-danger);
}

.sim-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
  color: var(--cc-text-2);
  cursor: pointer;
}

/* ---------- 材料架 ---------- */
.shelf {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  padding: 1rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--gm-block);
}

.shelf-head {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.shelf-head .gm-search {
  width: 100%;
}

.shelf-head em {
  font-style: normal;
  color: var(--cc-text-3);
}

.shelf-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.shelf-list .gm-row:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ---------- 结果 ---------- */
.result-layer {
  z-index: 2600;
}

.res-head {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.res-seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 6px;
  background: var(--cc-seal);
  color: var(--cc-seal-text);
  font-family: var(--cc-calligraphy);
  font-size: 32px;
}

.res-seal.fail {
  background: var(--cc-inset);
  color: var(--cc-text-2);
  box-shadow: 0 0 0 1px var(--cc-border-strong);
}

.res-name {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 30px;
  font-weight: 400;
  letter-spacing: 0.1em;
}

.res-meta {
  margin: 0.2rem 0 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.res-process {
  margin: 0;
  font-size: var(--narrative-size, 16px);
  line-height: var(--narrative-leading, 1.9);
  text-indent: 2em;
  white-space: pre-wrap;
}

@media (max-width: 1100px) {
  .craft-page {
    grid-template-columns: minmax(0, 1fr) 280px;
  }

  .controls {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .craft-page {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding-top: 0.75rem;
  }

  .forge,
  .shelf {
    overflow: visible;
  }

  .cauldron-stage {
    width: min(100%, 320px);
  }

  .ctl {
    grid-template-columns: 5.5em minmax(0, 1fr) auto;
  }
}
</style>
