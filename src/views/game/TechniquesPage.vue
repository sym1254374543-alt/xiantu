<template>
  <div class="tech-page">
    <PageTabs v-model="tab" :tabs="tabs" label="功法分类">
      <label v-if="tab !== 'practice'" class="gm-search tech-search">
        <Search :size="15" />
        <input v-model="query" class="cc-input" type="search" :placeholder="tab === 'skills' ? '搜索技能' : '搜索功法'" aria-label="搜索" />
      </label>
    </PageTabs>

    <!-- 修炼 -->
    <div v-if="tab === 'practice'" class="practice">
      <EmptyState v-if="!current" glyph="法" title="尚未修习功法" desc="从功法库中挑一部设为主修">
        <button type="button" class="cc-btn primary" @click="tab = 'library'"><Library :size="15" /><span>前往功法库</span></button>
      </EmptyState>

      <div v-else class="practice-grid">
        <div class="practice-main">
        <section class="banner" :style="{ '--quality': qualityTone(current.品质) }">
          <ProgressRing :percent="progressOf(current)" :size="96" :tone="progressOf(current) >= 100 ? 'hot' : 'accent'" />
          <div class="banner-main">
            <p class="banner-label">
              主修功法
              <SealBadge v-if="isCultivating(current)" tone="seal">修炼中</SealBadge>
            </p>
            <QualityText tag="h2" class="banner-name" :quality="current.品质">{{ current.名称 }}</QualityText>
            <p class="banner-meta">{{ qualityLabel(current.品质) || '品阶不明' }} · 修炼进度 {{ progressOf(current) }}%</p>
            <p class="banner-desc">{{ current.描述 || '暂无描述' }}</p>
            <ul v-if="flattenEffect(current.功法效果).length" class="effects">
              <li v-for="e in flattenEffect(current.功法效果)" :key="e" class="gm-chip">{{ e }}</li>
            </ul>
          </div>
        </section>

        <div class="acts">
          <button type="button" class="cc-btn primary" @click="notify('cultivate')"><Flame :size="15" /><span>修炼</span></button>
          <button type="button" class="cc-btn" @click="notify('secluded_cultivation')"><Moon :size="15" /><span>闭关</span></button>
          <button type="button" class="cc-btn" @click="deepCultivate"><Hourglass :size="15" /><span>深修</span></button>
          <button v-if="progressOf(current) >= 100" type="button" class="cc-btn breakthrough" @click="notify('breakthrough')">
            <Zap :size="15" /><span>突破</span>
          </button>
          <span class="spacer"></span>
          <button type="button" class="cc-btn ghost" :disabled="unequipping" @click="unequip(current)"><LogOut :size="15" /><span>卸下</span></button>
        </div>
        <p class="acts-note">以上按钮只会把意图告诉天道（下回合随输入发出），数值变化由剧情推演决定。</p>
        </div>

        <section class="route-sec">
          <header class="gm-sec-head">
            <span class="gm-sec-seal">阶</span>
            <h3>进阶路线</h3>
            <span class="aside">{{ unlockedCount(current) }} / {{ skillsOf(current).length }} 已解锁</span>
          </header>
          <ol v-if="skillsOf(current).length" class="route">
            <li
              v-for="sk in sortedSkills(current)"
              :key="sk.技能名称"
              class="node"
              :class="{ on: isUnlocked(current, sk) }"
            >
              <span class="node-dot">{{ sk.req }}%</span>
              <div class="node-body">
                <p class="node-title">
                  <b>{{ sk.技能名称 }}</b>
                  <SealBadge v-if="isUnlocked(current, sk)" tone="good">已解锁</SealBadge>
                  <SealBadge v-else tone="muted"><Lock :size="11" />修炼至 {{ sk.req }}%</SealBadge>
                </p>
                <p v-if="sk.技能描述" class="node-desc">{{ sk.技能描述 }}</p>
                <p v-if="sk.消耗" class="node-cost">消耗 {{ sk.消耗 }}</p>
              </div>
            </li>
          </ol>
          <p v-else class="gm-muted">此功法没有记载可修习的技能。</p>
        </section>
      </div>
    </div>

    <!-- 掌握技能 -->
    <ListDetail v-else-if="tab === 'skills'" class="tech-body" :open="!!selectedSkill && detailOpen" detail-label="技能详情" @close="detailOpen = false">
      <template #list>
        <EmptyState v-if="!mastered.length" glyph="技" title="尚未掌握技能" desc="修炼功法达到熟练度要求后自动掌握" />
        <EmptyState v-else-if="!filteredSkills.length" glyph="寻" title="没有符合的技能" compact>
          <button type="button" class="cc-btn small" @click="query = ''">清除搜索</button>
        </EmptyState>
        <ul v-else class="gm-list">
          <li v-for="(sk, i) in filteredSkills" :key="sk.技能名称 + sk.来源 + i">
            <button type="button" class="gm-row" :class="{ active: selectedSkillKey === skillKey(sk) }" @click="pickSkill(sk)">
              <ProgressRing :percent="toNumber(sk.熟练度)" :size="40" label="" />
              <span class="gm-row-main">
                <span class="gm-row-title">{{ sk.技能名称 }}</span>
                <span class="gm-row-sub">来自《{{ sk.来源 || '未知' }}》<template v-if="sk.消耗"> · {{ sk.消耗 }}</template></span>
              </span>
              <span class="gm-row-end">熟练 {{ toNumber(sk.熟练度) }}</span>
            </button>
          </li>
        </ul>
      </template>
      <template #detail>
        <div v-if="selectedSkill" class="gm-detail-body">
          <h2 class="gm-detail-name">{{ selectedSkill.技能名称 }}</h2>
          <p class="d-meta">来自《{{ selectedSkill.来源 || '未知' }}》</p>
          <dl class="gm-kv d-kv">
            <dt>熟练度</dt><dd>{{ toNumber(selectedSkill.熟练度) }}</dd>
            <dt>使用次数</dt><dd>{{ toNumber(selectedSkill.使用次数) }}</dd>
            <dt>消耗</dt><dd>{{ selectedSkill.消耗 || '无' }}</dd>
          </dl>
          <p class="gm-prose">{{ selectedSkill.技能描述 || '暂无描述' }}</p>
        </div>
        <EmptyState v-else glyph="技" title="选择一门技能" compact />
      </template>
    </ListDetail>

    <!-- 功法库 -->
    <ListDetail v-else class="tech-body" :open="!!selectedBook && detailOpen" detail-label="功法详情" @close="detailOpen = false">
      <template #list>
        <EmptyState v-if="!books.length" glyph="法" title="囊中没有功法" desc="奇遇、宗门藏经阁或坊市里都可能得到功法" />
        <EmptyState v-else-if="!filteredBooks.length" glyph="寻" title="没有符合的功法" compact>
          <button type="button" class="cc-btn small" @click="query = ''">清除搜索</button>
        </EmptyState>
        <ul v-else class="gm-list">
          <li v-for="b in filteredBooks" :key="b.物品ID">
            <button type="button" class="gm-row" :class="{ active: selectedBookId === b.物品ID }" :style="{ '--tone': qualityTone(b.品质) }" @click="pickBook(b.物品ID)">
              <span class="gm-disc" :style="{ '--tone': qualityTone(b.品质) }"><BookOpen :size="17" /></span>
              <span class="gm-row-main">
                <QualityText class="gm-row-title" :quality="b.品质">{{ b.名称 }}</QualityText>
                <span class="gm-row-sub">{{ qualityLabel(b.品质) || '品阶不明' }} · 进度 {{ progressOf(b) }}% · 技能 {{ skillsOf(b).length }}</span>
              </span>
              <SealBadge v-if="b.已装备" tone="seal">主修</SealBadge>
            </button>
          </li>
        </ul>
      </template>
      <template #detail>
        <div v-if="selectedBook" class="book-detail">
          <div class="gm-detail-body">
            <QualityText tag="h2" class="gm-detail-name" :quality="selectedBook.品质">{{ selectedBook.名称 }}</QualityText>
            <p class="d-meta">{{ qualityLabel(selectedBook.品质) || '品阶不明' }} · 修炼进度 {{ progressOf(selectedBook) }}%</p>
            <p class="gm-prose d-desc">{{ selectedBook.描述 || '暂无描述' }}</p>
            <section v-if="flattenEffect(selectedBook.功法效果).length" class="gm-section">
              <h4 class="gm-label">功法效果</h4>
              <ul class="lines"><li v-for="e in flattenEffect(selectedBook.功法效果)" :key="e">{{ e }}</li></ul>
            </section>
            <section v-if="skillsOf(selectedBook).length" class="gm-section">
              <h4 class="gm-label">功法技能</h4>
              <ul class="lines">
                <li v-for="sk in sortedSkills(selectedBook)" :key="sk.技能名称">
                  {{ sk.技能名称 }}（{{ sk.req }}% 解锁<template v-if="isUnlocked(selectedBook, sk)">，已解锁</template>）
                </li>
              </ul>
            </section>
          </div>
          <footer class="gm-detail-foot">
            <button v-if="selectedBook.已装备" type="button" class="cc-btn" :disabled="unequipping" @click="unequip(selectedBook)">
              <LogOut :size="15" /><span>卸下主修</span>
            </button>
            <button v-else type="button" class="cc-btn primary" :disabled="equipping" @click="setMain(selectedBook)">
              <Star :size="15" /><span>设为主修</span>
            </button>
          </footer>
        </div>
        <EmptyState v-else glyph="法" title="选择一部功法" compact />
      </template>
    </ListDetail>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { BookOpen, Flame, Hourglass, Library, Lock, LogOut, Moon, Search, Star, Zap } from 'lucide-vue-next';
import type { TechniqueItem } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore';
import { EnhancedActionQueueManager } from '@/utils/enhancedActionQueue';
import { qualityTone } from '@/utils/qualityTone';
import { flattenEffect, qualityLabel, techniqueProgress, toNumber } from '@/utils/gameDisplay';
import { queueGameAction } from '@/utils/actionTexts';
import { toast } from '@/utils/toast';
import { askQuantity, confirmDialog } from '@/composables/useDialog';
import PageTabs from '@/components/game/PageTabs.vue';
import ListDetail from '@/components/game/ListDetail.vue';
import EmptyState from '@/components/game/EmptyState.vue';
import ProgressRing from '@/components/game/ProgressRing.vue';
import QualityText from '@/components/game/QualityText.vue';
import SealBadge from '@/components/game/SealBadge.vue';

defineOptions({ name: 'TechniquesPage' });

const gs = useGameStateStore();
const characterStore = useCharacterStore();

type Book = TechniqueItem & { 解锁需要熟练度?: number };

const books = computed<Book[]>(() =>
  Object.entries((gs.inventory as any)?.物品 || {})
    .filter(([, v]: [string, any]) => v && v.类型 === '功法')
    .map(([id, v]) => ({ ...(v as Book), 物品ID: (v as Book).物品ID || id })),
);
const current = computed(() => books.value.find((b) => b.已装备) || null);
const mastered = computed<any[]>(() => (Array.isArray(gs.masteredSkills) ? gs.masteredSkills : []));

const tab = ref<'practice' | 'skills' | 'library'>('practice');
const tabs = computed(() => [
  { key: 'practice', label: '修炼' },
  { key: 'skills', label: '掌握技能', count: mastered.value.length },
  { key: 'library', label: '功法库', count: books.value.length },
]);

const query = ref('');
const detailOpen = ref(false);

// ─── 展示辅助 ───
const progressOf = (b: Book) => techniqueProgress(b, gs.techniqueSystem);
const isCultivating = (b: Book) => (gs.cultivation as any)?.修炼功法?.物品ID === b.物品ID;
const skillsOf = (b: Book) => (Array.isArray(b.功法技能) ? b.功法技能 : []);
const sortedSkills = (b: Book) =>
  skillsOf(b)
    .map((s) => ({ ...s, req: toNumber(s.熟练度要求 ?? (s as any).解锁需要熟练度) }))
    .sort((a, c) => a.req - c.req);
const isUnlocked = (b: Book, sk: { 技能名称: string; req: number }) =>
  (Array.isArray(b.已解锁技能) && b.已解锁技能.includes(sk.技能名称)) || progressOf(b) >= sk.req;
const unlockedCount = (b: Book) => sortedSkills(b).filter((s) => isUnlocked(b, s)).length;

// ─── 修炼操作：只通知 AI ───
const notify = (kind: 'cultivate' | 'secluded_cultivation' | 'breakthrough') => {
  if (!current.value) return;
  queueGameAction(kind, current.value.名称);
  toast.success('已记入行动，下回合随输入发出');
};

const deepCultivate = async () => {
  if (!current.value) return;
  const days = await askQuantity({
    title: '深度修炼',
    itemName: `《${current.value.名称}》`,
    message: '闭门不出，专心修炼若干天。时间会随剧情推进。',
    max: 365,
    maxLabel: '最多',
    unit: '天',
    defaultValue: 7,
    presets: [1, 7, 30, 90, 180, 365].map((d) => ({ label: `${d}天`, value: d })),
    confirmText: '开始深修',
  });
  if (!days) return;
  queueGameAction('deep_cultivation', current.value.名称, { days });
  toast.success(`已记入 ${days} 天深修，下回合随输入发出`);
};

const unequipping = ref(false);
const unequip = async (b: Book) => {
  const ok = await confirmDialog({
    title: '卸下功法',
    message: `卸下《${b.名称}》？修炼进度（${progressOf(b)}%）会保留在功法上。`,
    confirmText: '卸下',
  });
  if (!ok) return;
  unequipping.value = true;
  try {
    if (isCultivating(b)) await EnhancedActionQueueManager.getInstance().stopCultivation(b);
    await characterStore.unequipTechnique(b.物品ID);
  } finally {
    unequipping.value = false;
  }
};

const equipping = ref(false);
const setMain = async (b: Book) => {
  if (current.value && current.value.物品ID !== b.物品ID) {
    const ok = await confirmDialog({
      title: '切换功法',
      message: `当前主修《${current.value.名称}》，改为主修《${b.名称}》？原功法进度会保留。`,
      confirmText: '切换',
    });
    if (!ok) return;
  }
  equipping.value = true;
  try {
    await characterStore.equipTechnique(b.物品ID);
  } finally {
    equipping.value = false;
  }
};

// ─── 掌握技能 ───
const skillKey = (s: any) => `${s.技能名称}@${s.来源}`;
const selectedSkillKey = ref('');
const filteredSkills = computed(() => {
  const q = query.value.trim();
  return mastered.value.filter((s) => !q || String(s.技能名称 || '').includes(q) || String(s.来源 || '').includes(q));
});
const selectedSkill = computed(() => mastered.value.find((s) => skillKey(s) === selectedSkillKey.value) || null);
const pickSkill = (s: any) => {
  selectedSkillKey.value = skillKey(s);
  detailOpen.value = true;
};

// ─── 功法库 ───
const selectedBookId = ref('');
const filteredBooks = computed(() => {
  const q = query.value.trim();
  return books.value.filter((b) => !q || b.名称.includes(q));
});
const selectedBook = computed(() => books.value.find((b) => b.物品ID === selectedBookId.value) || null);
const pickBook = (id: string) => {
  selectedBookId.value = id;
  detailOpen.value = true;
};
</script>

<style scoped>
.tech-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;
  padding-top: 0.5rem;
}

.tech-search {
  width: 220px;
}

.tech-body {
  min-height: 0;
}

.practice {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.practice-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, 1fr);
  align-items: start;
  gap: 2rem;
  padding-bottom: 1.5rem;
}

.practice-main {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.banner {
  display: flex;
  align-items: center;
  gap: 1.75rem;
  padding: 1.5rem 1.75rem;
  border: 1px solid color-mix(in srgb, var(--quality) 40%, var(--cc-border));
  border-radius: 8px;
  background: linear-gradient(100deg, color-mix(in srgb, var(--quality) 12%, transparent), transparent 65%), var(--gm-block);
}

.banner-main {
  min-width: 0;
}

.banner-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.3em;
  color: var(--cc-gold);
}

.banner-name {
  margin: 0.3rem 0 0.2rem;
  font-family: var(--cc-calligraphy);
  font-size: 40px;
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: 0.12em;
}

.banner-meta {
  margin: 0;
  font-size: 14px;
  color: var(--cc-text-2);
}

.banner-desc {
  max-width: 46em;
  margin: 0.7rem 0 0;
  font-size: 15px;
  line-height: 1.85;
  color: var(--cc-text);
}

.effects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.8rem 0 0;
  padding: 0;
  list-style: none;
}

.acts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.acts .spacer {
  flex: 1;
}

.cc-btn.breakthrough {
  border-color: var(--cc-seal);
  background: var(--cc-seal);
  color: var(--cc-seal-text);
}

.acts-note {
  margin: 0.5rem 0 0;
  font-size: 13px;
  color: var(--cc-text-3);
}

.route-sec {
  min-width: 0;
}

.route {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
}

.node {
  position: relative;
  display: flex;
  gap: 1rem;
  padding-bottom: 1.25rem;
}

.node::before {
  content: '';
  position: absolute;
  left: 23px;
  top: 48px;
  bottom: 0;
  width: 2px;
  background: var(--gm-line);
}

.node.on::before {
  background: linear-gradient(180deg, var(--cc-gold), rgba(var(--cc-gold-rgb), 0.25));
}

.node:last-child::before {
  display: none;
}

.node-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border: 1px dashed var(--cc-border-strong);
  border-radius: 50%;
  background: var(--cc-inset);
  color: var(--cc-text-3);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.node.on .node-dot {
  border: 1px solid var(--cc-gold);
  background: radial-gradient(circle at 35% 30%, rgba(var(--cc-gold-rgb), 0.3), var(--gm-block-2) 70%);
  color: var(--cc-gold);
  box-shadow: 0 0 12px -2px rgba(var(--cc-gold-rgb), 0.5);
}

.node-body {
  flex: 1;
  min-width: 0;
  padding: 0.55rem 0.9rem 0.65rem;
  border-radius: 6px;
  background: var(--gm-block);
}

.node:not(.on) .node-body {
  opacity: 0.75;
}

.node-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

.node-title b {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.node-desc {
  margin: 0.3rem 0 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--cc-text-2);
}

.node-cost {
  margin: 0.2rem 0 0;
  font-size: 13px;
  color: var(--gm-mp);
}

.d-meta {
  margin: 0.25rem 0 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.d-kv {
  margin: 1rem 0;
}

.d-desc {
  margin-top: 0.9rem;
}

.book-detail {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.book-detail .gm-section {
  margin-top: 1.1rem;
}

.lines {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 14px;
  line-height: 1.8;
}

@media (max-width: 1200px) {
  .practice-grid {
    grid-template-columns: minmax(0, 1fr);
    max-width: 900px;
  }

  .practice-main {
    position: static;
  }
}

@media (max-width: 768px) {
  .tech-search {
    width: 100%;
  }

  .banner {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.1rem;
  }

  .banner-name {
    font-size: 32px;
  }
}
</style>
