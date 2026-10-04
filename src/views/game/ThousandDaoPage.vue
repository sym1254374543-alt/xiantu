<template>
  <EmptyState v-if="!daos.length" glyph="道" title="尚未悟得大道" desc="大道三千，可从所修功法中领悟，也可观天地自然而得">
    <button type="button" class="cc-btn primary" @click="notify('comprehend_from_technique')"><BookOpen :size="15" /><span>从功法领悟</span></button>
    <button type="button" class="cc-btn" @click="notify('comprehend_nature')"><Mountain :size="15" /><span>观天地悟道</span></button>
  </EmptyState>

  <div v-else class="dao-page">
    <div class="gm-toolbar">
      <p class="stats">
        已悟 <b>{{ unlockedCount }}</b> 道 <i>·</i> 总悟道值 <b>{{ totalExp.toLocaleString('zh-CN') }}</b>
        <template v-if="mainDao"> <i>·</i> 主道 <b class="main">{{ mainDao.name }}</b></template>
      </p>
      <span class="spacer"></span>
      <div class="gm-seg" role="radiogroup" aria-label="分类">
        <button type="button" role="radio" :aria-checked="cat === ''" :class="{ active: cat === '' }" @click="cat = ''">全部</button>
        <button
          v-for="c in presentCategories"
          :key="c.key"
          type="button"
          role="radio"
          :aria-checked="cat === c.key"
          :class="{ active: cat === c.key }"
          @click="cat = c.key"
        >
          {{ c.label }}<em>{{ c.count }}</em>
        </button>
      </div>
      <select v-model="sortKey" class="gm-field" aria-label="排序">
        <option value="progress">按进度</option>
        <option value="stage">按阶段</option>
        <option value="exp">按经验</option>
        <option value="name">按名称</option>
      </select>
    </div>

    <ListDetail :open="!!selected && detailOpen" :detail-width="420" detail-label="大道详情" @close="detailOpen = false">
      <template #list>
        <!-- 星图：主道居中，其余环绕；连线 = 关系 -->
        <div class="map">
          <svg class="map-svg" viewBox="-300 -230 600 460" role="img" aria-label="大道星图">
            <circle class="orbit" r="165" />
            <circle class="orbit faint" r="90" />
            <line
              v-for="(e, i) in edges"
              :key="'e' + i"
              :class="['edge', e.kind]"
              :x1="e.a.x" :y1="e.a.y" :x2="e.b.x" :y2="e.b.y"
            />
            <g
              v-for="n in nodes"
              :key="n.name"
              class="node"
              :class="{ active: selectedName === n.name, main: n.main, locked: !n.unlocked }"
              :transform="`translate(${n.x} ${n.y})`"
              tabindex="0"
              role="button"
              :aria-label="`${n.name}，${n.stage}`"
              @click="pick(n.name)"
              @keydown.enter="pick(n.name)"
            >
              <circle class="node-halo" :r="n.r + 7" />
              <circle class="node-ring" :r="n.r" />
              <circle class="node-arc" :r="n.r" :stroke-dasharray="`${(n.percent / 100) * 2 * Math.PI * n.r} 999`" :transform="'rotate(-90)'" />
              <text class="node-char" text-anchor="middle" dominant-baseline="central">{{ n.name.charAt(0) }}</text>
              <text class="node-name" :y="n.r + 22" text-anchor="middle">{{ n.name }}</text>
              <text class="node-stage" :y="n.r + 38" text-anchor="middle">{{ n.stage }}</text>
            </g>
          </svg>
          <ul class="legend" aria-label="图例">
            <li><i class="edge-sample 相生"></i>相生</li>
            <li><i class="edge-sample 互补"></i>互补</li>
            <li><i class="edge-sample 相克"></i>相克</li>
            <li><i class="edge-sample 冲突"></i>冲突</li>
          </ul>
        </div>

        <!-- 窄屏：列表 -->
        <ul class="gm-list dao-list">
          <li v-for="d in list" :key="d.name">
            <button type="button" class="gm-row" :class="{ active: selectedName === d.name }" @click="pick(d.name)">
              <span class="gm-disc">{{ d.name.charAt(0) }}</span>
              <span class="gm-row-main">
                <span class="gm-row-title">{{ d.name }}</span>
                <span class="gm-row-sub">{{ daoCategoryLabel(d.category) }} · {{ daoStageName(d.data) }} · {{ daoProgress(d.data).percent }}%</span>
              </span>
            </button>
          </li>
        </ul>
      </template>

      <template #detail>
        <div v-if="selected" class="detail">
          <div class="gm-detail-body">
            <header class="d-head">
              <h2 class="gm-detail-name">{{ selected.name }}</h2>
              <SealBadge tone="seal">{{ daoStageName(selected.data) }}</SealBadge>
              <SealBadge tone="muted">{{ daoCategoryLabel(selected.category) }}</SealBadge>
            </header>
            <p v-if="selected.data.描述" class="gm-prose d-desc">{{ selected.data.描述 }}</p>

            <!-- 层级轨道 -->
            <ol class="track" aria-label="阶段">
              <li
                v-for="(s, i) in stageTrack"
                :key="s.name"
                :class="{ done: i < stageIdx, now: i === stageIdx }"
                :title="s.desc || undefined"
              >
                <span class="track-dot"><Check v-if="i < stageIdx" :size="11" /></span>
                <span class="track-name">{{ s.name }}</span>
              </li>
            </ol>

            <section class="gm-section">
              <h4 class="gm-label">一 · 能做什么</h4>
              <ul v-if="daoEffects(selected.data).length" class="lines">
                <li v-for="e in daoEffects(selected.data)" :key="e">{{ e }}</li>
              </ul>
              <p v-else class="gm-muted">暂无记录，AI 会依据大道规则和当前阶段推演。</p>
            </section>

            <section class="gm-section">
              <h4 class="gm-label">二 · 下一步要什么</h4>
              <div class="gm-meter" style="--meter: var(--gm-cultivation)">
                <div class="gm-meter-row">
                  <span>悟道经验</span>
                  <b>{{ daoProgress(selected.data).cur }}<i> / {{ daoProgress(selected.data).need }}</i></b>
                </div>
                <div class="gm-meter-track"><span :style="{ width: daoProgress(selected.data).percent + '%' }"></span></div>
              </div>
              <ul v-if="daoConditions(selected.data).length" class="lines cond">
                <li v-for="c in daoConditions(selected.data)" :key="c">{{ c }}</li>
              </ul>
              <p v-else class="gm-muted">除经验外无额外突破条件记载。</p>
            </section>

            <section class="gm-section">
              <h4 class="gm-label">三 · 限制或强化什么</h4>
              <dl v-if="relationRows.length" class="rel">
                <template v-for="r in relationRows" :key="r.kind">
                  <dt :class="r.kind">{{ r.kind }}</dt>
                  <dd>{{ r.values.join('、') }}</dd>
                </template>
              </dl>
              <p v-else class="gm-muted">尚未发现与其他大道的关联。</p>
            </section>
          </div>
          <footer class="gm-detail-foot">
            <button type="button" class="cc-btn" @click="notify('comprehend', selected.name)"><Lightbulb :size="15" /><span>感悟此道</span></button>
            <button type="button" class="cc-btn" @click="notify('meditate', selected.name)"><Moon :size="15" /><span>深度参悟</span></button>
            <button v-if="daoProgress(selected.data).canBreak" type="button" class="cc-btn breakthrough" @click="notify('dao_breakthrough', selected.name)">
              <Zap :size="15" /><span>尝试突破</span>
            </button>
          </footer>
        </div>
        <EmptyState v-else glyph="道" title="选择一条大道" desc="点星图上的节点查看" compact />
      </template>
    </ListDetail>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { BookOpen, Check, Lightbulb, Moon, Mountain, Zap } from 'lucide-vue-next';
import type { DaoData } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';
import {
  DAO_CATEGORIES, DAO_STAGE_NAMES, daoCategory, daoCategoryLabel, daoConditions, daoEffects, daoProgress, daoRelations,
  daoStageIndex, daoStageName,
} from '@/utils/daoDisplay';
import { queueGameAction } from '@/utils/actionTexts';
import { toast } from '@/utils/toast';
import ListDetail from '@/components/game/ListDetail.vue';
import EmptyState from '@/components/game/EmptyState.vue';
import SealBadge from '@/components/game/SealBadge.vue';

defineOptions({ name: 'ThousandDaoPage' });

const gs = useGameStateStore();

interface DaoEntry { name: string; data: DaoData; category: string }

const daos = computed<DaoEntry[]>(() =>
  Object.entries(((gs.thousandDao as any)?.大道列表 || {}) as Record<string, DaoData>)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([k, v]) => ({ name: v.道名 || k, data: v, category: daoCategory(v.道名 || k, v) })),
);

const unlockedCount = computed(() => daos.value.filter((d) => d.data.是否解锁 !== false).length);
const totalExp = computed(() => daos.value.reduce((s, d) => s + (Number(d.data.总经验) || 0), 0));

/** 主道：阶段最高、其次总经验最多 */
const mainDao = computed(() =>
  [...daos.value].sort((a, b) => daoStageIndex(b.data) - daoStageIndex(a.data) || (b.data.总经验 || 0) - (a.data.总经验 || 0))[0] || null,
);

// ─── 筛选排序 ───
const cat = ref('');
const sortKey = ref<'progress' | 'stage' | 'exp' | 'name'>('progress');
const presentCategories = computed(() =>
  DAO_CATEGORIES.map((c) => ({ ...c, count: daos.value.filter((d) => d.category === c.key).length })).filter((c) => c.count),
);
const list = computed(() => {
  const arr = daos.value.filter((d) => !cat.value || d.category === cat.value);
  const by: Record<string, (a: DaoEntry, b: DaoEntry) => number> = {
    progress: (a, b) => daoProgress(b.data).percent - daoProgress(a.data).percent,
    stage: (a, b) => daoStageIndex(b.data) - daoStageIndex(a.data),
    exp: (a, b) => (b.data.总经验 || 0) - (a.data.总经验 || 0),
    name: (a, b) => a.name.localeCompare(b.name, 'zh'),
  };
  return [...arr].sort(by[sortKey.value]);
});

// ─── 星图布局 ───
const nodes = computed(() => {
  const main = mainDao.value?.name;
  const others = list.value.filter((d) => d.name !== main);
  const out: { name: string; x: number; y: number; r: number; main: boolean; unlocked: boolean; stage: string; percent: number }[] = [];
  const mk = (d: DaoEntry, x: number, y: number, isMain: boolean) => ({
    name: d.name, x, y, r: isMain ? 34 : 24, main: isMain,
    unlocked: d.data.是否解锁 !== false, stage: daoStageName(d.data), percent: daoProgress(d.data).percent,
  });
  const mainEntry = list.value.find((d) => d.name === main);
  if (mainEntry) out.push(mk(mainEntry, 0, -10, true));
  const ringR = others.length > 8 ? 175 : 160;
  others.forEach((d, i) => {
    const a = -Math.PI / 2 + (Math.PI * 2 * i) / Math.max(1, others.length) + (others.length === 1 ? Math.PI / 4 : 0);
    out.push(mk(d, Math.cos(a) * ringR, Math.sin(a) * (ringR * 0.8) - 10, false));
  });
  return out;
});

const edges = computed(() => {
  const pos = new Map(nodes.value.map((n) => [n.name, n]));
  const seen = new Set<string>();
  const out: { a: { x: number; y: number }; b: { x: number; y: number }; kind: string }[] = [];
  for (const d of list.value) {
    for (const r of daoRelations(d.data)) {
      if (r.kind === '融合条件') continue;
      for (const target of r.values) {
        const t = [...pos.keys()].find((k) => k === target || target.includes(k) || k.includes(target.replace(/之?道$/, '')));
        if (!t || t === d.name) continue;
        const key = [d.name, t].sort().join('|') + r.kind;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ a: pos.get(d.name)!, b: pos.get(t)!, kind: r.kind });
      }
    }
  }
  return out;
});

// ─── 选中 ───
const selectedName = ref('');
const detailOpen = ref(false);
const selected = computed(() => daos.value.find((d) => d.name === selectedName.value) || null);
const pick = (name: string) => {
  selectedName.value = name;
  detailOpen.value = true;
};
watch(
  mainDao,
  (m) => {
    if (!selectedName.value && m && window.innerWidth > 768) selectedName.value = m.name;
  },
  { immediate: true },
);

const stageIdx = computed(() => daoStageIndex(selected.value?.data));
const stageTrack = computed(() =>
  DAO_STAGE_NAMES.map((fallback, i) => {
    const s = selected.value?.data.阶段列表?.[i] as { 名称?: string; 描述?: string } | undefined;
    return { name: s?.名称 || fallback, desc: s?.描述 || '' };
  }),
);
const relationRows = computed(() => daoRelations(selected.value?.data).filter((r) => r.values.length));

// ─── 操作：都进行动队列 ───
const notify = (kind: 'comprehend' | 'meditate' | 'dao_breakthrough' | 'comprehend_from_technique' | 'comprehend_nature', name = '') => {
  queueGameAction(kind, name);
  toast.success('已记入行动，下回合随输入发出');
};
</script>

<style scoped>
.dao-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;
  padding-top: 1rem;
}

.stats {
  margin: 0;
  font-size: 14px;
  color: var(--cc-text-2);
}

.stats b {
  margin: 0 0.15rem;
  font-size: 17px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--cc-gold);
}

.stats b.main {
  font-family: var(--cc-calligraphy);
  font-size: 19px;
  font-weight: 400;
}

.stats i {
  margin: 0 0.4rem;
  font-style: normal;
  color: var(--cc-text-3);
}

/* ---------- 星图 ---------- */
.map {
  position: relative;
  flex: 1;
  min-height: 360px;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 46%, rgba(var(--cc-gold-rgb), 0.08), transparent 55%),
    var(--gm-block);
  overflow: hidden;
}

.map-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.orbit {
  fill: none;
  stroke: rgba(var(--cc-gold-rgb), 0.16);
  stroke-dasharray: 3 6;
}

.orbit.faint {
  stroke: var(--gm-line);
}

.edge {
  stroke-width: 1.6;
  opacity: 0.8;
}

.edge.相生 { stroke: var(--cc-gold); }
.edge.互补 { stroke: var(--gm-mp); stroke-dasharray: 2 5; }
.edge.相克 { stroke: var(--cc-danger); stroke-dasharray: 8 5; }
.edge.冲突 { stroke: var(--cc-danger); stroke-dasharray: 2 3; }

.node {
  cursor: pointer;
  outline: none;
}

.node-halo {
  fill: transparent;
  stroke: transparent;
}

.node-ring {
  fill: var(--cc-solid-bg);
  stroke: rgba(var(--cc-gold-rgb), 0.45);
  stroke-width: 1.2;
}

.node-arc {
  fill: none;
  stroke: var(--gm-cultivation);
  stroke-width: 3;
  stroke-linecap: round;
}

.node-char {
  fill: var(--cc-gold);
  font-family: var(--cc-calligraphy);
  font-size: 22px;
}

.node.main .node-char {
  font-size: 32px;
}

.node-name {
  fill: var(--cc-text);
  font-size: 14px;
  letter-spacing: 0.1em;
}

.node-stage {
  fill: var(--cc-text-2);
  font-size: 12px;
}

.node.locked {
  opacity: 0.5;
}

.node:hover .node-halo,
.node:focus-visible .node-halo {
  stroke: rgba(var(--cc-gold-rgb), 0.35);
}

.node.active .node-halo {
  fill: rgba(var(--cc-gold-rgb), 0.12);
  stroke: var(--cc-gold);
}

.legend {
  position: absolute;
  right: 12px;
  bottom: 10px;
  display: flex;
  gap: 0.8rem;
  margin: 0;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--cc-solid-bg);
  font-size: 12px;
  color: var(--cc-text-2);
  list-style: none;
}

.legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.edge-sample {
  display: inline-block;
  width: 18px;
  height: 0;
  border-top: 2px solid var(--cc-gold);
}

.edge-sample.互补 { border-top: 2px dotted var(--gm-mp); }
.edge-sample.相克 { border-top: 2px dashed var(--cc-danger); }
.edge-sample.冲突 { border-top: 2px dotted var(--cc-danger); }

.dao-list {
  display: none;
}

/* ---------- 详情 ---------- */
.detail {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.d-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.6rem;
}

.d-desc {
  margin-top: 0.6rem;
}

.track {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  margin: 1.1rem 0 0.4rem;
  padding: 0;
  list-style: none;
}

.track li {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  font-size: 12px;
  color: var(--cc-text-3);
}

.track li::before {
  content: '';
  position: absolute;
  top: 8px;
  left: -50%;
  width: 100%;
  height: 2px;
  background: var(--gm-line);
}

.track li:first-child::before {
  display: none;
}

.track li.done::before,
.track li.now::before {
  background: var(--cc-gold);
}

.track-dot {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid var(--cc-border-strong);
  border-radius: 50%;
  background: var(--cc-solid-bg);
  color: var(--cc-solid-bg);
}

.track li.done .track-dot {
  border-color: var(--cc-gold);
  background: var(--cc-gold);
}

.track li.now .track-dot {
  border: 2px solid var(--cc-seal);
  box-shadow: 0 0 0 3px rgba(var(--cc-gold-rgb), 0.18);
}

.track li.now {
  color: var(--cc-text);
  font-weight: 600;
}

.detail .gm-section {
  margin-top: 1.25rem;
}

.lines {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 14px;
  line-height: 1.8;
}

.lines.cond {
  margin-top: 0.6rem;
}

.rel {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.4rem 0.9rem;
  margin: 0;
  font-size: 14px;
}

.rel dt {
  letter-spacing: 0.1em;
  color: var(--cc-gold);
}

.rel dt.相克,
.rel dt.冲突 {
  color: var(--cc-danger);
}

.rel dt.互补 {
  color: var(--gm-mp);
}

.rel dd {
  margin: 0;
}

.cc-btn.breakthrough {
  border-color: var(--cc-seal);
  background: var(--cc-seal);
  color: var(--cc-seal-text);
}

@media (max-width: 768px) {
  .dao-page {
    padding-top: 0.75rem;
  }

  .map {
    display: none;
  }

  .dao-list {
    display: flex;
  }
}
</style>
