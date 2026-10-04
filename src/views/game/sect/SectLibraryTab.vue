<template>
  <div class="library">
    <div class="lib-bar">
      <p>贡献 <b>{{ ctx.contribution.value }}</b> · 职位 <b>{{ ctx.position.value }}</b> · 职位越高，可入的楼层越多</p>
      <button type="button" class="cc-btn small" :disabled="busy" @click="generate">
        <Loader2 v-if="busy" :size="14" class="cc-spin" /><Sparkles v-else :size="14" />
        <span>{{ all.length ? '重新生成藏经' : 'AI 生成藏经' }}</span>
      </button>
    </div>

    <EmptyState v-if="!all.length" glyph="经" title="藏经阁尚未整理" desc="让 AI 依据宗门特色生成可兑换的功法" />

    <ListDetail v-else :open="!!selected && detailOpen" detail-label="功法详情" @close="detailOpen = false">
      <template #list>
        <ol class="floors">
          <li v-for="f in floors" :key="f.level" class="floor" :class="{ locked: !f.accessible }">
            <header class="floor-head">
              <span class="floor-no">{{ f.glyph }}</span>
              <b>{{ f.name }}</b>
              <small>{{ f.requirement }}</small>
              <span class="spacer"></span>
              <SealBadge v-if="!f.accessible" tone="muted"><Lock :size="11" />未解锁</SealBadge>
              <span v-else class="floor-count">{{ f.techniques.length }} 部</span>
            </header>
            <div v-if="f.accessible" class="spines">
              <button
                v-for="tch in f.techniques"
                :key="tch.id"
                type="button"
                class="spine"
                :class="{ active: selectedId === tch.id, owned: tch.owned }"
                :style="{ '--quality': qualityTone(tch.quality) }"
                :title="`${tch.name} · ${tch.quality} · ${tch.cost} 贡献`"
                @click="pick(tch.id)"
              >
                <span class="spine-name">{{ tch.name }}</span>
                <span class="spine-cost">{{ tch.owned ? '已学' : tch.cost }}</span>
              </button>
              <p v-if="!f.techniques.length" class="gm-muted">这一层暂无典籍。</p>
            </div>
            <p v-else class="floor-lock">需「{{ f.requirement }}」方可入内</p>
          </li>
        </ol>
      </template>
      <template #detail>
        <div v-if="selected" class="detail">
          <div class="gm-detail-body">
            <QualityText tag="h2" class="gm-detail-name" :quality="selected.quality">{{ selected.name }}</QualityText>
            <p class="d-meta">{{ selected.quality }} · 兑换 {{ selected.cost }} 贡献</p>
            <p class="gm-prose d-desc">{{ selected.description || '暂无描述' }}</p>
            <dl v-if="selected.extra.length" class="gm-kv d-kv">
              <template v-for="e in selected.extra" :key="e.k"><dt>{{ e.k }}</dt><dd>{{ e.v }}</dd></template>
            </dl>
          </div>
          <footer class="gm-detail-foot">
            <button v-if="selected.owned" type="button" class="cc-btn" disabled><Check :size="15" /><span>已学习</span></button>
            <button v-else type="button" class="cc-btn primary" :disabled="learning || !selected.canAfford" :title="selected.canAfford ? '' : '贡献不足'" @click="learn">
              <BookOpen :size="15" /><span>{{ selected.canAfford ? `用 ${selected.cost} 贡献学习` : '贡献不足' }}</span>
            </button>
          </footer>
        </div>
        <EmptyState v-else glyph="经" title="选一本典籍" compact />
      </template>
    </ListDetail>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { BookOpen, Check, Loader2, Lock, Sparkles } from 'lucide-vue-next';
import type { SectContext } from '@/composables/useSectContext';
import { useGameStateStore } from '@/stores/gameStateStore';
import { generateLibrary, learnTechnique } from '@/services/sectContentService';
import { qualityTone } from '@/utils/qualityTone';
import { toast } from '@/utils/toast';
import { confirmDialog } from '@/composables/useDialog';
import ListDetail from '@/components/game/ListDetail.vue';
import EmptyState from '@/components/game/EmptyState.vue';
import SealBadge from '@/components/game/SealBadge.vue';
import QualityText from '@/components/game/QualityText.vue';

const props = defineProps<{ ctx: SectContext }>();
const ctx = props.ctx;
const gs = useGameStateStore();

const owned = computed(() => new Set(Object.keys((gs.inventory as any)?.物品 || {})));

const all = computed(() => {
  const raw = ctx.sectSystem.value?.宗门藏经阁?.[ctx.sectName.value];
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any, i: number) => {
    const id = String(r?.id || r?.物品ID || `sect_tech_${i}`);
    const quality = String(r?.quality || r?.品质 || '凡品');
    const cost = Number(r?.cost ?? r?.价格 ?? 0) || 0;
    const extra = [
      ['功法效果', r?.功法效果], ['境界要求', r?.境界要求], ['职位要求', r?.职位要求], ['剩余数量', r?.剩余数量],
    ].filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => ({ k: String(k), v: String(v) }));
    return {
      id,
      name: String(r?.name || r?.名称 || '未知功法'),
      quality,
      tier: (quality.match(/[凡黄玄地天仙神]/) || ['凡'])[0],
      cost,
      description: String(r?.description || r?.描述 || ''),
      extra,
      owned: owned.value.has(id),
      canAfford: ctx.contribution.value >= cost,
    };
  });
});

const floors = computed(() => {
  const lv = ctx.level.value;
  const by = (tiers: string[]) => all.value.filter((t) => tiers.includes(t.tier));
  return [
    { level: 1, glyph: '壹', name: '第一层', requirement: '外门弟子可入', accessible: lv >= 1, techniques: by(['凡', '黄']) },
    { level: 2, glyph: '贰', name: '第二层', requirement: '内门弟子可入', accessible: lv >= 2, techniques: by(['玄']) },
    { level: 3, glyph: '叁', name: '第三层', requirement: '真传弟子可入', accessible: lv >= 3, techniques: by(['地']) },
    { level: 4, glyph: '密', name: '禁区密库', requirement: '核心弟子 + 长老令牌', accessible: lv >= 4, techniques: by(['天', '仙', '神']) },
  ];
});

const selectedId = ref('');
const detailOpen = ref(false);
const selected = computed(() => all.value.find((t) => t.id === selectedId.value) || null);
const pick = (id: string) => {
  selectedId.value = id;
  detailOpen.value = true;
};

const learning = ref(false);
const learn = async () => {
  const s = selected.value;
  if (!s) return;
  const ok = await confirmDialog({ title: '学习功法', message: `花费 ${s.cost} 贡献学习《${s.name}》？功法会放入背包。`, confirmText: '学习' });
  if (!ok) return;
  learning.value = true;
  try {
    await learnTechnique(s);
    toast.success('已学习，功法已放入背包');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '学习失败');
  } finally {
    learning.value = false;
  }
};

const busy = ref(false);
const generate = async () => {
  if (all.value.length) {
    const ok = await confirmDialog({ title: '重新生成藏经', message: '用 AI 重新生成整座藏经阁，现有条目会被替换（已学的功法不受影响）。', confirmText: '重新生成' });
    if (!ok) return;
  }
  busy.value = true;
  try {
    await generateLibrary(ctx);
    toast.success('藏经阁已更新');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '生成失败');
  } finally {
    busy.value = false;
  }
};
</script>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;
}

.lib-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.lib-bar p {
  flex: 1;
  margin: 0;
  font-size: 14px;
  color: var(--cc-text-2);
}

.lib-bar b {
  font-weight: 500;
  color: var(--cc-gold);
}

.floors {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0 0.25rem 1rem 0;
  list-style: none;
}

.floor {
  padding: 0.8rem 1rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--gm-block);
}

.floor.locked {
  border-style: dashed;
  background: transparent;
}

.floor-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.floor-head .spacer {
  flex: 1;
}

.floor-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: var(--cc-seal);
  color: var(--cc-seal-text);
  font-family: var(--cc-calligraphy);
  font-size: 15px;
}

.floor.locked .floor-no {
  background: var(--cc-inset);
  color: var(--cc-text-3);
}

.floor-head b {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.1em;
}

.floor-head small,
.floor-count {
  font-size: 13px;
  color: var(--cc-text-2);
}

.floor-lock {
  margin: 0.6rem 0 0;
  font-size: 13px;
  color: var(--cc-text-3);
}

/* 书脊：竖排书名 */
.spines {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.8rem;
}

.spine {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  width: 44px;
  height: 150px;
  padding: 0.55rem 0 0.4rem;
  border: 1px solid color-mix(in srgb, var(--quality) 45%, var(--cc-border));
  border-radius: 3px 5px 5px 3px;
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.18) 0 3px, transparent 3px),
    linear-gradient(180deg, color-mix(in srgb, var(--quality) 18%, transparent), var(--gm-block-2));
  color: var(--quality);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease;
}

.spine:hover {
  transform: translateY(-3px);
  border-color: var(--quality);
}

.spine.active {
  box-shadow: 0 0 0 2px rgba(var(--cc-gold-rgb), 0.45);
}

.spine.owned {
  opacity: 0.6;
}

.spine-name {
  overflow: hidden;
  font-family: var(--cc-calligraphy);
  font-size: 16px;
  line-height: 1.05;
  writing-mode: vertical-rl;
  letter-spacing: 0.05em;
  max-height: 110px;
}

.spine-cost {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
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
</style>
