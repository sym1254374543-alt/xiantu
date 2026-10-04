<template>
  <div class="shop">
    <div class="shop-bar">
      <div class="gm-seg" role="radiogroup" aria-label="物品分类">
        <button v-for="c in cats" :key="c.key" type="button" role="radio" :aria-checked="cat === c.key" :class="{ active: cat === c.key }" @click="cat = c.key">
          {{ c.label }}<em>{{ c.count }}</em>
        </button>
      </div>
      <span class="spacer"></span>
      <span class="balance">贡献 <b>{{ ctx.contribution.value }}</b></span>
      <button type="button" class="cc-btn small" :disabled="busy" @click="generate">
        <Loader2 v-if="busy" :size="14" class="cc-spin" /><Sparkles v-else :size="14" />
        <span>{{ items.length ? '重新上架' : 'AI 生成商店' }}</span>
      </button>
    </div>

    <EmptyState v-if="!items.length" glyph="换" title="贡献堂尚未上架" desc="让 AI 按宗门特色与你的境界上架可兑换物品" compact />

    <ListDetail v-else class="shop-body" :open="!!selected && detailOpen" detail-label="物品详情" @close="detailOpen = false">
      <template #list>
        <ul class="grid">
          <li v-for="it in list" :key="it.id">
            <button
              type="button"
              class="tile"
              :class="{ active: selectedId === it.id, sold: it.stock === 0 }"
              :style="{ '--quality': qualityTone(it.quality) }"
              @click="pick(it.id)"
            >
              <span class="tile-type">{{ it.type }}</span>
              <QualityText class="tile-name" :quality="it.quality">{{ it.name }}</QualityText>
              <span class="tile-cost" :class="{ poor: ctx.contribution.value < it.cost }">{{ it.cost }} 贡献</span>
              <span v-if="it.stock !== undefined" class="tile-stock">{{ it.stock === 0 ? '售罄' : `余 ${it.stock}` }}</span>
            </button>
          </li>
        </ul>
      </template>
      <template #detail>
        <div v-if="selected" class="detail">
          <div class="gm-detail-body">
            <QualityText tag="h2" class="gm-detail-name" :quality="selected.quality">{{ selected.name }}</QualityText>
            <p class="d-meta">{{ selected.type }} · {{ selected.quality }}<template v-if="selected.stock !== undefined"> · 库存 {{ selected.stock }}</template></p>
            <p class="gm-prose d-desc">{{ selected.description || '暂无描述' }}</p>
            <dl v-if="selected.extra.length" class="gm-kv d-kv">
              <template v-for="e in selected.extra" :key="e.k"><dt>{{ e.k }}</dt><dd>{{ e.v }}</dd></template>
            </dl>
          </div>
          <footer class="gm-detail-foot">
            <button type="button" class="cc-btn primary" :disabled="buying || selected.stock === 0 || ctx.contribution.value < selected.cost" @click="buy">
              <Coins :size="15" />
              <span>{{ selected.stock === 0 ? '已售罄' : ctx.contribution.value < selected.cost ? '贡献不足' : `用 ${selected.cost} 贡献兑换` }}</span>
            </button>
          </footer>
        </div>
        <EmptyState v-else glyph="换" title="选一件物品" compact />
      </template>
    </ListDetail>

    <details class="ways">
      <summary>贡献获取途径</summary>
      <ul>
        <li>完成宗门任务（任务标签里接取）</li>
        <li>上交稀有材料、丹药或法宝</li>
        <li>在宗门大比、试炼中取得名次</li>
        <li>为宗门立功：护山、除魔、寻得机缘</li>
      </ul>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Coins, Loader2, Sparkles } from 'lucide-vue-next';
import type { SectContext } from '@/composables/useSectContext';
import { exchangeItem, generateShop, mapItemType } from '@/services/sectContentService';
import { qualityTone } from '@/utils/qualityTone';
import { toast } from '@/utils/toast';
import { confirmDialog } from '@/composables/useDialog';
import ListDetail from '@/components/game/ListDetail.vue';
import EmptyState from '@/components/game/EmptyState.vue';
import QualityText from '@/components/game/QualityText.vue';

const props = defineProps<{ ctx: SectContext }>();
const ctx = props.ctx;

const items = computed(() => {
  const raw = ctx.sectSystem.value?.宗门贡献商店?.[ctx.sectName.value];
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any, i: number) => {
    const stockRaw = r?.stock ?? r?.库存;
    const extra = [['使用效果', r?.使用效果], ['限购数量', r?.限购数量], ['职位要求', r?.职位要求]]
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => ({ k: String(k), v: String(v) }));
    return {
      id: String(r?.id || r?.物品ID || `sect_item_${i}`),
      name: String(r?.name || r?.名称 || '未知物品'),
      type: mapItemType(String(r?.type || r?.类型 || '其他')),
      quality: String(r?.quality || r?.品质 || '凡品'),
      description: String(r?.description || r?.描述 || ''),
      cost: Number(r?.cost ?? r?.价格 ?? 0) || 0,
      stock: stockRaw === undefined || stockRaw === null ? undefined : Number(stockRaw),
      extra,
    };
  });
});

const cat = ref('all');
const cats = computed(() => [
  { key: 'all', label: '全部', count: items.value.length },
  ...['丹药', '功法', '装备', '材料', '其他']
    .map((k) => ({ key: k, label: k, count: items.value.filter((i) => i.type === k).length }))
    .filter((c) => c.count),
]);
const list = computed(() => (cat.value === 'all' ? items.value : items.value.filter((i) => i.type === cat.value)));

const selectedId = ref('');
const detailOpen = ref(false);
const selected = computed(() => items.value.find((i) => i.id === selectedId.value) || null);
const pick = (id: string) => {
  selectedId.value = id;
  detailOpen.value = true;
};

const buying = ref(false);
const buy = async () => {
  const s = selected.value;
  if (!s) return;
  const ok = await confirmDialog({ title: '兑换', message: `花费 ${s.cost} 贡献兑换「${s.name}」？`, confirmText: '兑换' });
  if (!ok) return;
  buying.value = true;
  try {
    await exchangeItem(ctx.sectName.value, s);
    toast.success('兑换成功，已放入背包');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '兑换失败');
  } finally {
    buying.value = false;
  }
};

const busy = ref(false);
const generate = async () => {
  if (items.value.length) {
    const ok = await confirmDialog({ title: '重新上架', message: '用 AI 重新生成贡献商店，现有货架会被替换。', confirmText: '重新上架' });
    if (!ok) return;
  }
  busy.value = true;
  try {
    await generateShop(ctx);
    toast.success('贡献商店已更新');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '生成失败');
  } finally {
    busy.value = false;
  }
};
</script>

<style scoped>
.shop {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;
}

.shop-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.shop-bar .spacer {
  flex: 1;
}

.balance {
  font-size: 14px;
  color: var(--cc-text-2);
}

.balance b {
  font-size: 17px;
  font-weight: 500;
  color: var(--cc-gold);
}

.shop-body {
  min-height: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.6rem;
  margin: 0;
  padding: 0 0.25rem 0.5rem 0;
  list-style: none;
}

.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  width: 100%;
  min-height: 108px;
  padding: 0.7rem 0.8rem;
  border: 1px solid color-mix(in srgb, var(--quality) 40%, var(--cc-border));
  border-radius: 6px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--quality) 12%, transparent), transparent 65%), var(--gm-block);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.tile:hover {
  border-color: var(--quality);
}

.tile.active {
  box-shadow: 0 0 0 2px rgba(var(--cc-gold-rgb), 0.45);
}

.tile.sold {
  opacity: 0.5;
}

.tile-type {
  font-size: 12px;
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

.tile-name {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.tile-cost {
  margin-top: auto;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--cc-gold);
}

.tile-cost.poor {
  color: var(--cc-text-3);
}

.tile-stock {
  position: absolute;
  top: 0.55rem;
  right: 0.6rem;
  font-size: 12px;
  color: var(--cc-text-2);
}

.detail {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.d-meta {
  margin: 0.25rem 0 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.d-desc {
  margin-top: 0.9rem;
}

.d-kv {
  margin-top: 1rem;
}

.ways {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.ways summary {
  letter-spacing: 0.15em;
  cursor: pointer;
}

.ways ul {
  margin: 0.4rem 0 0;
  padding-left: 1.2rem;
  line-height: 1.8;
}
</style>
