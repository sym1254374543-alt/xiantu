<template>
  <div class="inv-page">
    <PageTabs v-model="tab" :tabs="tabs" label="背包分类">
      <template v-if="tab === 'items'">
        <label class="gm-search inv-search">
          <Search :size="15" />
          <input v-model="query" class="cc-input" type="search" placeholder="搜索物品" aria-label="搜索物品" />
        </label>
        <select v-model="typeFilter" class="gm-field" aria-label="分类">
          <option value="">全部类型</option>
          <option v-for="ty in presentTypes" :key="ty" :value="ty">{{ ty }}</option>
        </select>
        <select v-model="sortKey" class="gm-field" aria-label="排序">
          <option value="default">默认</option>
          <option value="quality">按品质</option>
          <option value="name">按名称</option>
        </select>
      </template>
    </PageTabs>

    <!-- 物品 -->
    <ListDetail v-if="tab === 'items'" class="inv-body" :open="!!selected && detailOpen" detail-label="物品详情" @close="detailOpen = false">
      <template #list>
        <EmptyState v-if="!allItems.length" glyph="囊" title="空空如也" desc="行囊里还没有任何物品" />
        <EmptyState v-else-if="!items.length" glyph="寻" title="没有符合条件的物品" compact>
          <button type="button" class="cc-btn small" @click="clearFilters">清除筛选</button>
        </EmptyState>
        <ul v-else class="grid" aria-label="物品">
          <li v-for="it in items" :key="it.物品ID">
            <button
              type="button"
              class="tile"
              :class="{ active: selected?.物品ID === it.物品ID }"
              :style="{ '--quality': qualityTone(it.品质) }"
              :title="`${it.名称}${qualityLabel(it.品质) ? ' · ' + qualityLabel(it.品质) : ''}`"
              @click="select(it.物品ID)"
            >
              <component :is="typeIcon(it.类型)" :size="26" :stroke-width="1.6" />
              <span class="tile-name">{{ it.名称 }}</span>
              <span v-if="it.数量 > 1" class="tile-qty">{{ it.数量 }}</span>
              <span v-if="isEquipped(it)" class="gm-seal tile-seal" title="已装备">装</span>
              <span v-else-if="isCultivating(it)" class="gm-seal tile-seal" title="修炼中">修</span>
            </button>
          </li>
        </ul>
      </template>

      <template #detail>
        <div v-if="selected" class="detail">
          <div class="gm-detail-body">
            <div class="d-head" :style="{ '--quality': qualityTone(selected.品质) }">
              <span class="d-icon"><component :is="typeIcon(selected.类型)" :size="30" :stroke-width="1.5" /></span>
              <div>
                <QualityText tag="h2" class="gm-detail-name d-name" :quality="selected.品质">{{ selected.名称 }}</QualityText>
                <p class="d-meta">
                  {{ selected.类型 }}<template v-if="qualityLabel(selected.品质)"> · {{ qualityLabel(selected.品质) }}</template>
                  <template v-if="selected.数量 > 1"> · 数量 {{ selected.数量 }}</template>
                </p>
              </div>
            </div>
            <div class="d-badges">
              <SealBadge v-if="isEquipped(selected)" tone="seal">已装备</SealBadge>
              <SealBadge v-if="isCultivating(selected)" tone="seal">修炼中</SealBadge>
              <SealBadge v-if="selected.类型 === '功法'" tone="gold">修炼进度 {{ selectedTechniqueProgress }}%</SealBadge>
            </div>

            <p class="gm-prose d-desc">{{ selected.描述 || '暂无描述' }}</p>

            <section v-if="effectLines(selected, '功法效果').length" class="gm-section">
              <h4 class="gm-label">功法效果</h4>
              <ul class="lines"><li v-for="l in effectLines(selected, '功法效果')" :key="l">{{ l }}</li></ul>
            </section>
            <section v-if="skillsOf(selected).length" class="gm-section">
              <h4 class="gm-label">功法技能</h4>
              <ul class="skills">
                <li v-for="sk in skillsOf(selected)" :key="sk.技能名称">
                  <b>{{ sk.技能名称 }}</b>
                  <span class="sk-meta">熟练度 {{ sk.熟练度要求 ?? sk.解锁需要熟练度 ?? 0 }}% 解锁<template v-if="sk.消耗"> · 消耗 {{ sk.消耗 }}</template></span>
                  <p v-if="sk.技能描述">{{ sk.技能描述 }}</p>
                </li>
              </ul>
            </section>
            <section v-if="effectLines(selected, '装备增幅').length" class="gm-section">
              <h4 class="gm-label">装备增幅</h4>
              <ul class="lines"><li v-for="l in effectLines(selected, '装备增幅')" :key="l">{{ l }}</li></ul>
            </section>
            <section v-if="effectLines(selected, '特殊效果').length" class="gm-section">
              <h4 class="gm-label">特殊效果</h4>
              <ul class="lines"><li v-for="l in effectLines(selected, '特殊效果')" :key="l">{{ l }}</li></ul>
            </section>
            <section v-if="effectLines(selected, '使用效果').length" class="gm-section">
              <h4 class="gm-label">使用效果</h4>
              <ul class="lines"><li v-for="l in effectLines(selected, '使用效果')" :key="l">{{ l }}</li></ul>
            </section>
          </div>

          <footer class="gm-detail-foot">
            <template v-if="selected.类型 === '装备'">
              <button v-if="isEquipped(selected)" type="button" class="cc-btn" :disabled="isBusy(selected)" @click="act(selected, 'unequip')">
                <ShieldOff :size="15" /><span>卸下</span>
              </button>
              <button v-else type="button" class="cc-btn primary" :disabled="isBusy(selected)" @click="act(selected, 'equip')">
                <Shield :size="15" /><span>装备</span>
              </button>
            </template>
            <template v-if="selected.类型 === '功法'">
              <button v-if="isCultivating(selected)" type="button" class="cc-btn" :disabled="isBusy(selected)" @click="act(selected, 'stop')">
                <Pause :size="15" /><span>停止修炼</span>
              </button>
              <button v-else type="button" class="cc-btn primary" :disabled="isBusy(selected)" @click="act(selected, 'cultivate')">
                <Flame :size="15" /><span>修炼</span>
              </button>
            </template>
            <button v-if="canUse(selected)" type="button" class="cc-btn primary" :disabled="isBusy(selected)" @click="act(selected, 'use')">
              <Sparkles :size="15" /><span>使用</span>
            </button>
            <button v-if="!isEquipped(selected) && !isCultivating(selected) && !selected.已装备" type="button" class="cc-btn danger" :disabled="isBusy(selected)" @click="act(selected, 'discard')">
              <Trash2 :size="15" /><span>丢弃</span>
            </button>
          </footer>
        </div>
        <EmptyState v-else glyph="囊" title="选择一件物品" desc="点选左侧格子查看详情" compact />
      </template>
    </ListDetail>

    <!-- 法宝 -->
    <div v-else-if="tab === 'gear'" class="gear">
      <p class="gear-count">已装备 <b>{{ equippedCount }}</b> / 6</p>
      <ul class="slots">
        <li v-for="slot in slots" :key="slot.key" class="slot" :class="{ empty: !slot.item }" :style="slot.item ? { '--quality': qualityTone(slot.item.品质) } : undefined">
          <span class="slot-name">{{ slot.label }}</span>
          <template v-if="slot.item">
            <QualityText tag="h3" class="slot-item" :quality="slot.item.品质">{{ slot.item.名称 }}</QualityText>
            <p class="slot-meta">{{ qualityLabel(slot.item.品质) || slot.item.类型 }}</p>
            <p class="slot-desc">{{ slot.item.描述 }}</p>
            <ul v-if="effectLines(slot.item, '装备增幅').length || effectLines(slot.item, '特殊效果').length" class="lines slot-lines">
              <li v-for="l in [...effectLines(slot.item, '装备增幅'), ...effectLines(slot.item, '特殊效果')]" :key="l">{{ l }}</li>
            </ul>
            <button type="button" class="cc-btn small slot-btn" :disabled="isBusy(slot.item)" @click="act(slot.item, 'unequip')">
              <ShieldOff :size="14" /><span>卸下</span>
            </button>
          </template>
          <span v-else class="slot-empty">空</span>
        </li>
      </ul>
    </div>

    <!-- 财产 -->
    <div v-else class="wealth">
      <header class="wealth-head">
        <div>
          <span class="gm-label plain">总价值</span>
          <p class="wealth-total"><b>{{ formatNumber(wallet.totalInBase.value) }}</b><span>{{ wallet.baseName.value }}</span></p>
        </div>
        <p class="market">
          <MapPin :size="14" />
          {{ wallet.market.value.place }}
          <span>· {{ wallet.market.value.stable ? '汇率平稳' : `市场倍率 ×${wallet.market.value.multiplier.toFixed(3)}` }}</span>
        </p>
      </header>

      <EmptyState v-if="!wallet.rows.value.length" glyph="财" title="囊中羞涩" desc="还没有任何钱财" compact />
      <ul v-else class="coins">
        <li v-for="row in wallet.rows.value" :key="row.id" class="coin" :class="{ stone: row.tier >= 0 }" :style="{ '--tier': row.tier }">
          <span class="coin-mark"><Gem v-if="row.tier >= 0" :size="18" /><Coins v-else :size="18" /></span>
          <span class="coin-main">
            <b>{{ row.name }}</b>
            <small>{{ row.desc || `价值度 ${row.valueDegree}` }}</small>
          </span>
          <span class="coin-amount">
            <b>{{ formatNumber(row.amount) }}</b>
            <small>≈ {{ formatNumber(row.baseValue) }} {{ wallet.baseName.value }}</small>
          </span>
          <span class="coin-ops">
            <button
              v-if="row.up"
              type="button"
              class="cc-btn small"
              :disabled="row.amount < row.up.cost || coinBusy"
              :title="`${row.up.cost} ${row.name} → 1 ${row.up.toName}`"
              @click="exchange(row.id, 'up')"
            >
              <ArrowUp :size="13" /><span>兑换</span>
            </button>
            <button
              v-if="row.down"
              type="button"
              class="cc-btn small"
              :disabled="row.amount < 1 || coinBusy"
              :title="`1 ${row.name} → ${row.down.yield} ${row.down.toName}`"
              @click="exchange(row.id, 'down')"
            >
              <ArrowDown :size="13" /><span>分解</span>
            </button>
            <button type="button" class="cc-icon-btn danger" title="删除币种" aria-label="删除币种" :disabled="coinBusy" @click="removeCoin(row.id, row.name)">
              <Trash2 :size="14" />
            </button>
          </span>
        </li>
      </ul>
      <p class="wealth-note">兑换 = 用本币换一枚上一级（基准 100 : 1，手续费 2%）；分解 = 一枚拆成下一级。实际比例随所在地区市场倍率浮动，按钮悬停可看换算。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ArrowDown, ArrowUp, BookOpen, Coins, Flame, FlaskRound, Gem, MapPin, Package, Pause, RefreshCw, Search, Shield, ShieldOff,
  Sparkles, Sword, Trash2, Undo2,
} from 'lucide-vue-next';
import type { Item } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore';
import { EnhancedActionQueueManager } from '@/utils/enhancedActionQueue';
import { qualityTone, qualityKey } from '@/utils/qualityTone';
import { flattenEffect, qualityLabel, techniqueProgress, toNumber } from '@/utils/gameDisplay';
import { isTavernEnv } from '@/utils/tavern';
import { useWallet } from '@/composables/useWallet';
import { usePageActions } from '@/composables/usePageActions';
import { askQuantity, confirmDialog } from '@/composables/useDialog';
import PageTabs from '@/components/game/PageTabs.vue';
import ListDetail from '@/components/game/ListDetail.vue';
import EmptyState from '@/components/game/EmptyState.vue';
import QualityText from '@/components/game/QualityText.vue';
import SealBadge from '@/components/game/SealBadge.vue';

defineOptions({ name: 'InventoryPage' });

const gs = useGameStateStore();
const characterStore = useCharacterStore();
const queue = EnhancedActionQueueManager.getInstance();
const wallet = useWallet();

const allItems = computed<Item[]>(() =>
  Object.entries((gs.inventory as any)?.物品 || {})
    .filter(([, v]) => v && typeof v === 'object')
    .map(([id, v]) => ({ ...(v as Item), 物品ID: (v as Item).物品ID || id })),
);

const equipmentIds = computed(() => {
  const eq = (gs.equipment || {}) as Record<string, unknown>;
  return [1, 2, 3, 4, 5, 6].map((i) => {
    const v = eq[`装备${i}`];
    if (!v) return null;
    if (typeof v === 'string') return v;
    return (v as any)?.物品ID ?? null;
  });
});
const equippedCount = computed(() => equipmentIds.value.filter(Boolean).length);

const tab = ref<'items' | 'gear' | 'wealth'>('items');
const tabs = computed(() => [
  { key: 'items', label: '物品', count: allItems.value.length },
  { key: 'gear', label: '法宝', count: `${equippedCount.value}/6` },
  { key: 'wealth', label: '财产' },
]);

// ─── 筛选 ───
const query = ref('');
const typeFilter = ref('');
const sortKey = ref<'default' | 'quality' | 'name'>('default');
const QUALITY_ORDER = ['凡', '黄', '玄', '地', '天', '仙', '神', '圣', '道'];
const presentTypes = computed(() => [...new Set(allItems.value.map((i) => i.类型).filter(Boolean))]);

const items = computed(() => {
  const q = query.value.trim();
  let arr = allItems.value.filter((i) => (!q || i.名称.includes(q)) && (!typeFilter.value || i.类型 === typeFilter.value));
  if (sortKey.value === 'quality') {
    arr = [...arr].sort((a, b) =>
      QUALITY_ORDER.indexOf(qualityKey(b.品质)) - QUALITY_ORDER.indexOf(qualityKey(a.品质))
      || toNumber((b.品质 as any)?.grade) - toNumber((a.品质 as any)?.grade));
  } else if (sortKey.value === 'name') {
    arr = [...arr].sort((a, b) => a.名称.localeCompare(b.名称, 'zh'));
  }
  return arr;
});

const clearFilters = () => {
  query.value = '';
  typeFilter.value = '';
};

// ─── 选中 ───
const selectedId = ref('');
const detailOpen = ref(false);
const selected = computed(() => allItems.value.find((i) => i.物品ID === selectedId.value) || null);
const selectedTechniqueProgress = computed(() => techniqueProgress(selected.value, gs.techniqueSystem));
const select = (id: string) => {
  selectedId.value = id;
  detailOpen.value = true;
};

// ─── 展示辅助 ───
const TYPE_ICON: Record<string, unknown> = { 装备: Sword, 功法: BookOpen, 丹药: FlaskRound, 材料: Gem };
const typeIcon = (t: string) => TYPE_ICON[t] || Package;

const isEquipped = (it: Item) => equipmentIds.value.includes(it.物品ID) || (it.类型 === '装备' && !!it.已装备);
const isCultivating = (it: Item) => it.类型 === '功法' && (gs.cultivation as any)?.修炼功法?.物品ID === it.物品ID;
const canUse = (it: Item) => it.类型 === '丹药' || (it.类型 !== '装备' && it.类型 !== '功法' && !!(it as any).使用效果);
const skillsOf = (it: Item) => (it.类型 === '功法' && Array.isArray((it as any).功法技能) ? (it as any).功法技能 : []);
const effectLines = (it: Item, key: string) => flattenEffect((it as any)[key]);

const formatNumber = (n: number) => {
  const v = Math.round(n * 100) / 100;
  return v >= 10000 ? `${(v / 10000).toFixed(v >= 100000 ? 1 : 2)}万` : v.toLocaleString('zh-CN');
};

// ─── 物品操作（带忙碌锁） ───
const busyIds = ref(new Set<string>());
const isBusy = (it: Item) => busyIds.value.has(it.物品ID);
const undoCount = ref(queue.getUndoActionsCount());

type Act = 'equip' | 'unequip' | 'cultivate' | 'stop' | 'use' | 'discard';
const act = async (it: Item, kind: Act) => {
  if (isBusy(it)) return;
  let qty = 1;
  if (kind === 'use' || kind === 'discard') {
    if (it.数量 > 1) {
      const n = await askQuantity({
        title: kind === 'use' ? '使用物品' : '丢弃物品',
        itemName: it.名称,
        max: it.数量,
        confirmText: kind === 'use' ? '使用' : '丢弃',
        danger: kind === 'discard',
      });
      if (!n) return;
      qty = n;
    } else if (kind === 'discard') {
      const ok = await confirmDialog({ title: '丢弃物品', message: `丢弃《${it.名称}》？丢弃后可在页头撤销。`, confirmText: '丢弃', danger: true });
      if (!ok) return;
    }
  }
  busyIds.value = new Set(busyIds.value).add(it.物品ID);
  try {
    if (kind === 'equip') await queue.equipItem(it);
    else if (kind === 'unequip') await queue.unequipItem(it);
    else if (kind === 'cultivate') await queue.cultivateItem(it);
    else if (kind === 'stop') await queue.stopCultivation(it);
    else if (kind === 'use') await queue.useItem(it, qty);
    else await queue.discardItem(it, qty);
  } finally {
    const next = new Set(busyIds.value);
    next.delete(it.物品ID);
    busyIds.value = next;
    undoCount.value = queue.getUndoActionsCount();
  }
};

// ─── 法宝槽 ───
const SLOT_LABELS = ['头', '身', '手', '足', '佩', '器'];
const slots = computed(() =>
  equipmentIds.value.map((id, i) => ({
    key: `装备${i + 1}`,
    label: SLOT_LABELS[i],
    item: id ? allItems.value.find((it) => it.物品ID === id) || null : null,
  })),
);

// ─── 财产 ───
const coinBusy = ref(false);
const exchange = async (id: string, dir: 'up' | 'down') => {
  coinBusy.value = true;
  try {
    if (dir === 'up') await wallet.exchangeUp(id);
    else await wallet.exchangeDown(id);
  } finally {
    coinBusy.value = false;
  }
};
const removeCoin = async (id: string, name: string) => {
  const ok = await confirmDialog({
    title: '删除币种',
    message: `删除「${name}」并清空其数量？之后剧情里仍可能由 AI 重新创建。`,
    confirmText: '删除',
    danger: true,
  });
  if (!ok) return;
  coinBusy.value = true;
  try {
    await wallet.removeCurrency(id);
  } finally {
    coinBusy.value = false;
  }
};

// ─── 页头 ───
const syncing = ref(false);
const syncFromTavern = async () => {
  syncing.value = true;
  try {
    await characterStore.reloadFromStorage();
  } finally {
    syncing.value = false;
  }
};
const undo = async () => {
  await queue.undoLastAction();
  undoCount.value = queue.getUndoActionsCount();
};

usePageActions(() => [
  { key: 'undo', title: '撤销上次操作', icon: Undo2, onClick: undo, hidden: undoCount.value === 0 },
  { key: 'sync', title: '从酒馆同步', icon: RefreshCw, onClick: syncFromTavern, busy: syncing.value, hidden: !isTavernEnv() },
]);
</script>

<style scoped>
.inv-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;
  padding-top: 0.5rem;
}

.inv-search {
  width: 200px;
}

.inv-body {
  min-height: 0;
}

/* ---------- 格架 ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 0.6rem;
  margin: 0;
  padding: 0 0.25rem 1rem 0;
  list-style: none;
}

.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: 100%;
  aspect-ratio: 1 / 1.08;
  padding: 0.5rem 0.35rem 0.4rem;
  border: 1px solid color-mix(in srgb, var(--quality) 45%, var(--cc-border));
  border-radius: 6px;
  background: radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--quality) 14%, transparent), var(--gm-block) 70%);
  color: var(--quality);
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.tile:hover {
  border-color: color-mix(in srgb, var(--quality) 80%, transparent);
  transform: translateY(-1px);
}

.tile.active {
  border-color: var(--cc-gold);
  box-shadow: 0 0 0 2px rgba(var(--cc-gold-rgb), 0.35);
}

.tile-name {
  max-width: 100%;
  overflow: hidden;
  font-size: 13px;
  color: var(--cc-text);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tile-qty {
  position: absolute;
  top: 4px;
  left: 4px;
  min-width: 20px;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--cc-inset);
  color: var(--cc-text);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.tile-seal {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 12px;
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
  align-items: center;
  gap: 0.9rem;
}

.d-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--quality) 22%, transparent), var(--gm-block-2) 70%);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--quality) 50%, transparent);
  color: var(--quality);
}

.d-name {
  font-size: 26px;
}

.d-meta {
  margin: 0.2rem 0 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.d-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.8rem 0 0;
}

.d-desc {
  margin: 0.9rem 0 0;
}

.detail .gm-section {
  margin-top: 1.1rem;
}

.lines {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 14px;
  line-height: 1.8;
  color: var(--cc-text);
}

.skills {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.skills li {
  padding: 0.55rem 0.7rem;
  border-left: 2px solid rgba(var(--cc-gold-rgb), 0.4);
  background: var(--gm-block-2);
}

.skills b {
  font-size: 15px;
  font-weight: 500;
}

.sk-meta {
  display: block;
  font-size: 12px;
  color: var(--cc-text-2);
}

.skills p {
  margin: 0.25rem 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--cc-text-2);
}

.gm-detail-foot {
  flex-wrap: wrap;
}

/* ---------- 法宝 ---------- */
.gear {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.gear-count {
  margin: 0 0 0.9rem;
  font-size: 14px;
  color: var(--cc-text-2);
}

.gear-count b {
  font-size: 18px;
  color: var(--cc-gold);
}

.slots {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  max-width: 1100px;
  margin: 0;
  padding: 0 0 1rem;
  list-style: none;
}

.slot {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 190px;
  padding: 1rem 1.1rem;
  border: 1px solid color-mix(in srgb, var(--quality, var(--cc-border)) 45%, var(--cc-border));
  border-radius: 8px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--quality, transparent) 10%, transparent), transparent 60%), var(--gm-block);
}

.slot.empty {
  align-items: center;
  justify-content: center;
  border-style: dashed;
  background: transparent;
}

.slot-name {
  position: absolute;
  top: 0.7rem;
  left: 0.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.45);
  border-radius: 4px;
  color: var(--cc-gold);
  font-family: var(--cc-calligraphy);
  font-size: 15px;
}

.slot-item {
  margin: 1.8rem 0 0;
  font-family: var(--cc-calligraphy);
  font-size: 24px;
  font-weight: 400;
  letter-spacing: 0.08em;
}

.slot-meta {
  margin: 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.slot-desc {
  margin: 0.3rem 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--cc-text-2);
}

.slot-lines {
  font-size: 13px;
}

.slot-btn {
  align-self: flex-start;
  margin-top: auto;
}

.slot-empty {
  font-family: var(--cc-calligraphy);
  font-size: 44px;
  color: rgba(var(--cc-gold-rgb), 0.2);
}

/* ---------- 财产 ---------- */
.wealth {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  max-width: 900px;
}

.wealth-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(var(--cc-gold-rgb), 0.28);
}

.wealth-total {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  margin: 0.4rem 0 0;
}

.wealth-total b {
  font-family: var(--cc-calligraphy);
  font-size: 44px;
  font-weight: 400;
  line-height: 1;
  color: var(--cc-gold);
}

.wealth-total span {
  font-size: 14px;
  color: var(--cc-text-2);
}

.market {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  font-size: 14px;
  color: var(--cc-text);
}

.market span {
  color: var(--cc-text-2);
}

.coins {
  margin: 0;
  padding: 0;
  list-style: none;
}

.coin {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 0.25rem;
  border-bottom: 1px solid var(--gm-line);
}

.coin-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--gm-block-2);
  color: var(--cc-text-2);
}

.coin.stone .coin-mark {
  background: color-mix(in srgb, var(--q-xuan) calc(8% + var(--tier) * 8%), transparent);
  color: var(--q-xuan);
}

.coin-main,
.coin-amount {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.coin-main b {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.08em;
}

.coin-main small,
.coin-amount small {
  font-size: 12px;
  color: var(--cc-text-3);
}

.coin-amount {
  align-items: flex-end;
}

.coin-amount b {
  font-size: 18px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.coin-ops {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.wealth-note {
  margin: 1rem 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--cc-text-3);
}

@media (max-width: 1100px) {
  .slots {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .inv-search {
    width: 140px;
  }

  .grid {
    grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  }

  .slots {
    grid-template-columns: minmax(0, 1fr);
  }

  .slot {
    min-height: 0;
  }

  .coin {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .coin-ops {
    grid-column: 2 / -1;
    justify-content: flex-end;
  }
}
</style>
