<template>
  <EmptyState v-if="!allNpcs.length" glyph="缘" title="尚未结识他人" desc="在游戏中与更多人物互动，结下的缘分会记在这里" />

  <div v-else class="npcs-page">
    <div class="gm-toolbar npc-tools">
      <label class="gm-search">
        <Search :size="15" />
        <input v-model="query" class="cc-input" type="search" placeholder="搜索名字" aria-label="搜索名字" />
      </label>
      <div class="gm-seg" role="radiogroup" aria-label="筛选">
        <button
          v-for="f in filters"
          :key="f.key"
          type="button"
          role="radio"
          :aria-checked="filter === f.key"
          :class="{ active: filter === f.key }"
          @click="filter = f.key"
        >
          {{ f.label }}<em>{{ f.count }}</em>
        </button>
      </div>
      <select v-if="relationOptions.length > 1" v-model="relationFilter" class="gm-field" aria-label="按关系筛选">
        <option value="">全部关系</option>
        <option v-for="r in relationOptions" :key="r" :value="r">{{ r }}</option>
      </select>
      <span class="spacer"></span>
      <select v-model="sortKey" class="gm-field" aria-label="排序">
        <option value="favor">按好感</option>
        <option value="realm">按境界</option>
        <option value="name">按名字</option>
      </select>
    </div>

    <div class="npc-layout">
      <ListDetail :open="!!selected && detailOpen" :detail-width="560" detail-label="人物详情" @close="detailOpen = false">
        <template #list>
          <EmptyState v-if="!list.length" glyph="寻" title="没有符合条件的人物" compact>
            <button type="button" class="cc-btn small" @click="clearFilters">清除筛选</button>
          </EmptyState>
          <ul v-else class="gm-list npc-list">
            <li v-for="npc in list" :key="npc.名字">
              <div class="gm-row npc-row" :class="{ active: selected?.名字 === npc.名字 }" :style="{ '--tone': favorInfo(npc.好感度).tone }">
                <button type="button" class="npc-row-main" @click="select(npc.名字)">
                  <span class="gm-disc" :style="{ '--tone': favorInfo(npc.好感度).tone }">{{ npc.名字.charAt(0) }}</span>
                  <span class="gm-row-main">
                    <span class="gm-row-title">{{ npc.名字 }}</span>
                    <span class="gm-row-sub">{{ formatRealmWithStage(npc.境界) }} · {{ npc.与玩家关系 || '相识' }}</span>
                  </span>
                  <span class="favor-mini" :title="`好感 ${npc.好感度 ?? 0}（${favorInfo(npc.好感度).label}）`">
                    <b :style="{ color: favorInfo(npc.好感度).tone }">{{ npc.好感度 ?? 0 }}</b>
                    <span class="favor-track"><span :style="{ width: favorInfo(npc.好感度).percent + '%', background: favorInfo(npc.好感度).tone }"></span></span>
                  </span>
                </button>
                <button
                  type="button"
                  class="star"
                  :class="{ on: npc.实时关注 }"
                  :title="npc.实时关注 ? '取消实时关注' : '实时关注'"
                  :aria-label="npc.实时关注 ? '取消实时关注' : '实时关注'"
                  :aria-pressed="!!npc.实时关注"
                  :disabled="busy === npc.名字"
                  @click="toggleFollow(npc)"
                >
                  <Star :size="16" :fill="npc.实时关注 ? 'currentColor' : 'none'" />
                </button>
              </div>
            </li>
          </ul>
        </template>

      <template #detail>
        <div v-if="selected" class="npc-detail">
          <header class="nd-head">
            <span class="gm-disc lg" :style="{ '--tone': favorInfo(selected.好感度).tone }">{{ selected.名字.charAt(0) }}</span>
            <div class="nd-id">
              <h2 class="gm-detail-name">{{ selected.名字 }}</h2>
              <p class="nd-sub">{{ formatRealmWithStage(selected.境界) }} · {{ selected.与玩家关系 || '相识' }}</p>
            </div>
          </header>

          <div class="nd-favor">
            <div class="gm-meter" :style="{ '--meter': favorInfo(selected.好感度).tone }">
              <div class="gm-meter-row">
                <span>好感 · {{ favorInfo(selected.好感度).label }}</span>
                <b>{{ selected.好感度 ?? 0 }}<i> / 100</i></b>
              </div>
              <div class="gm-meter-track"><span :style="{ width: favorInfo(selected.好感度).percent + '%' }"></span></div>
            </div>
            <label class="nd-follow" title="关注的人物会在每回合由 AI 主动更新状态">
              <span class="gm-switch">
                <input type="checkbox" :checked="!!selected.实时关注" :disabled="busy === selected.名字" @change="toggleFollow(selected)" />
                <span></span>
              </span>
              <span>实时关注</span>
            </label>
          </div>

          <PageTabs v-model="tab" :tabs="detailTabs" label="人物详情分类" />

          <div class="nd-body">
            <!-- 概况 -->
            <template v-if="tab === 'overview'">
              <dl class="gm-kv nd-kv">
                <dt>性别</dt><dd>{{ selected.性别 || '未知' }}</dd>
                <dt>种族</dt><dd>{{ selected.种族 || '人族' }}</dd>
                <dt>年龄</dt><dd>{{ npcAge(selected) }}</dd>
                <dt>出身</dt><dd>{{ nameOf(selected.出生) || '不详' }}</dd>
                <dt>势力</dt><dd>{{ selected.势力归属 || '无' }}</dd>
                <dt>所在</dt><dd>{{ selected.当前位置?.描述 || '行踪未定' }}</dd>
              </dl>
              <section v-if="selected.当前外貌状态 || selected.当前内心想法" class="gm-section nd-now">
                <h4 class="gm-label">此刻</h4>
                <p v-if="selected.当前外貌状态" class="gm-prose"><b>神态</b>{{ selected.当前外貌状态 }}</p>
                <p v-if="selected.当前内心想法" class="gm-prose thought"><b>心念</b>{{ selected.当前内心想法 }}</p>
              </section>
              <section class="gm-section">
                <h4 class="gm-label">外貌</h4>
                <p class="gm-prose">{{ selected.外貌描述 || selected.外貌 || '未曾细看' }}</p>
              </section>
              <section v-if="traits(selected).length" class="gm-section">
                <h4 class="gm-label">性格</h4>
                <div class="chips"><span v-for="tr in traits(selected)" :key="tr" class="gm-chip">{{ tr }}</span></div>
              </section>
              <section v-if="bottomLines(selected).length" class="gm-section">
                <h4 class="gm-label">人格底线</h4>
                <div class="chips"><span v-for="b in bottomLines(selected)" :key="b" class="gm-chip bad">{{ b }}</span></div>
              </section>
            </template>

            <!-- 风华：仅酒馆 -->
            <template v-else-if="tab === 'splendor'">
              <SplendorProfile :view="npcSplendor" />
            </template>

            <!-- 属性 -->
            <template v-else-if="tab === 'attrs'">
              <dl class="gm-kv nd-kv">
                <dt>境界</dt><dd>{{ formatRealmWithStage(selected.境界) }}</dd>
                <dt>灵根</dt>
                <dd :style="{ color: spiritRootTone(selected.灵根) }">
                  {{ formatSpiritRoot(selected.灵根).name }}<template v-if="formatSpiritRoot(selected.灵根).grade"> · {{ formatSpiritRoot(selected.灵根).grade }}</template>
                </dd>
              </dl>
              <section class="gm-section nd-vitals">
                <VitalRow v-for="v in npcVitals(selected)" :key="v.key" :info="v" />
              </section>
              <section v-if="talentsOf(selected).length" class="gm-section">
                <h4 class="gm-label">天赋</h4>
                <div class="chips">
                  <span v-for="tl in talentsOf(selected)" :key="tl.name" class="gm-chip gold" :title="tl.desc">{{ tl.name }}</span>
                </div>
              </section>
              <section class="gm-section">
                <h4 class="gm-label">先天六司</h4>
                <RadarChart class="nd-radar" :items="sixSiItems(selected)" :size="210" />
              </section>
            </template>

            <!-- 记忆 -->
            <template v-else-if="tab === 'memory'">
              <div class="mem-tools">
                <span class="gm-muted">共 {{ memories.length }} 条</span>
                <span class="spacer"></span>
                <label class="mem-count">
                  总结最旧
                  <input v-model.number="summarizeCount" class="gm-field" type="number" min="3" :max="Math.max(3, memories.length)" />
                  条
                </label>
                <button type="button" class="cc-btn small" :disabled="memories.length < 3 || summarizing" :title="memories.length < 3 ? '至少 3 条记忆才能总结' : ''" @click="summarize">
                  <Loader2 v-if="summarizing" :size="14" class="cc-spin" />
                  <Sparkles v-else :size="14" />
                  <span>{{ summarizing ? '总结中' : 'AI 总结' }}</span>
                </button>
              </div>

              <ol v-if="pagedMemories.length" class="mem-list">
                <li v-for="m in pagedMemories" :key="m.index" class="mem-item">
                  <span v-if="m.time" class="mem-time">{{ m.time }}</span>
                  <p class="mem-text">{{ m.text }}</p>
                  <span class="mem-ops">
                    <button type="button" class="cc-icon-btn" title="编辑" aria-label="编辑" @click="editMemory(m.index, m.text)"><Pencil :size="14" /></button>
                    <button type="button" class="cc-icon-btn danger" title="删除" aria-label="删除" @click="removeMemory(m.index)"><Trash2 :size="14" /></button>
                  </span>
                </li>
              </ol>
              <p v-else class="gm-muted">暂无记忆。</p>

              <div v-if="memPages > 1" class="gm-pager">
                <button type="button" class="cc-icon-btn" aria-label="上一页" :disabled="memPage <= 1" @click="memPage--"><ChevronLeft :size="14" /></button>
                <span>{{ memPage }} / {{ memPages }}</span>
                <button type="button" class="cc-icon-btn" aria-label="下一页" :disabled="memPage >= memPages" @click="memPage++"><ChevronRight :size="14" /></button>
              </div>

              <section v-if="summaries.length" class="gm-section">
                <h4 class="gm-label">记忆总结</h4>
                <ol class="mem-list">
                  <li v-for="(s, i) in summaries" :key="i" class="mem-item summary">
                    <p class="mem-text">{{ s }}</p>
                    <span class="mem-ops">
                      <button type="button" class="cc-icon-btn danger" title="删除总结" aria-label="删除总结" @click="removeSummary(i)"><Trash2 :size="14" /></button>
                    </span>
                  </li>
                </ol>
              </section>
            </template>

            <!-- 背包 -->
            <template v-else-if="tab === 'bag'">
              <div v-if="currencies.length" class="coins">
                <span v-for="c in currencies" :key="c.name" class="gm-chip gold">{{ c.name }} {{ c.amount }}</span>
              </div>
              <ul v-if="npcItems.length" class="gm-list">
                <li v-for="it in npcItems" :key="it.物品ID || it.名称" class="gm-row bag-row">
                  <span class="gm-row-main">
                    <QualityText class="gm-row-title" :quality="it.品质">{{ it.名称 }}<template v-if="it.数量 > 1"> ×{{ it.数量 }}</template></QualityText>
                    <span class="gm-row-sub">{{ it.类型 }}<template v-if="qualityLabel(it.品质)"> · {{ qualityLabel(it.品质) }}</template><template v-if="it.描述"> · {{ it.描述 }}</template></span>
                  </span>
                  <span class="bag-ops">
                    <button type="button" class="cc-btn small ghost" title="交易" @click="queueItemAction(selected, it, 'trade')"><Handshake :size="14" /><span>交易</span></button>
                    <button type="button" class="cc-btn small ghost" title="索要" @click="queueItemAction(selected, it, 'request')"><HandHelping :size="14" /><span>索要</span></button>
                    <button type="button" class="cc-btn small ghost danger" title="偷窃" @click="queueItemAction(selected, it, 'steal')"><EyeOff :size="14" /><span>偷窃</span></button>
                  </span>
                </li>
              </ul>
              <p v-else-if="!currencies.length" class="gm-muted">身无长物。</p>
            </template>

            <!-- 私密 -->
            <template v-else-if="tab === 'private'">
              <dl class="gm-kv nd-kv">
                <template v-for="row in privateRows" :key="row.label">
                  <dt>{{ row.label }}</dt><dd>{{ row.value }}</dd>
                </template>
              </dl>
              <section v-if="privateParts.length" class="gm-section">
                <h4 class="gm-label">身体部位</h4>
                <ul class="parts">
                  <li v-for="p in privateParts" :key="p.部位名称">
                    <div class="part-head">
                      <b>{{ p.部位名称 }}</b>
                      <span>敏感 {{ p.敏感度 ?? 0 }} · 开发 {{ p.开发度 ?? 0 }}</span>
                    </div>
                    <p v-if="p.特征描述" class="gm-prose">{{ p.特征描述 }}</p>
                  </li>
                </ul>
              </section>
            </template>
          </div>

          <footer class="gm-detail-foot nd-foot">
            <button type="button" class="cc-btn small" title="导出人物数据（JSON）" @click="exportNpc(selected)"><Download :size="14" /><span>导出人物</span></button>
            <button type="button" class="cc-btn small" title="导出记忆（JSON）" @click="exportNpcMemories(selected)"><FileDown :size="14" /><span>导出记忆</span></button>
            <button v-if="inTavern" type="button" class="cc-btn small" title="导出到世界书（不含记忆）" @click="toWorldbook"><BookUp :size="14" /><span>世界书</span></button>
            <button type="button" class="cc-btn small danger" title="删除人物" @click="removeNpc"><Trash2 :size="14" /><span>删除</span></button>
          </footer>
        </div>
        <EmptyState v-else glyph="缘" title="选择一位人物" desc="左侧列表点选即可查看详情" compact />
      </template>
      </ListDetail>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  BookUp, ChevronLeft, ChevronRight, Download, EyeOff, FileDown, HandHelping, Handshake, Loader2, Pencil, Search, Sparkles, Star, Trash2,
} from 'lucide-vue-next';
import type { NpcProfile } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';
import { formatRealmWithStage } from '@/utils/realmUtils';
import { spiritRootTone } from '@/utils/qualityTone';
import { isTavernEnv } from '@/utils/tavern';
import { getNsfwSettingsFromStorage } from '@/utils/nsfw';
import { toast } from '@/utils/toast';
import {
  SIX_SI_KEYS, ageFrom, descOf, favorInfo, formatSpiritRoot, nameOf, normalizeSixSi, qualityLabel, toNumber, vitalInfo,
} from '@/utils/gameDisplay';
import {
  deleteMemory, deleteNpc, deleteSummary, exportNpc, exportNpcMemories, exportNpcToWorldbook, memoryParts,
  queueItemAction, setFollow, summarizeMemories, updateMemory,
} from '@/services/npcService';
import { askText, confirmDialog } from '@/composables/useDialog';
import ListDetail from '@/components/game/ListDetail.vue';
import EmptyState from '@/components/game/EmptyState.vue';
import PageTabs from '@/components/game/PageTabs.vue';
import VitalRow from '@/components/game/VitalRow.vue';
import RadarChart from '@/components/game/RadarChart.vue';
import QualityText from '@/components/game/QualityText.vue';
import SplendorProfile from '@/components/game/SplendorProfile.vue';
import { splendorFromNpc } from '@/utils/splendor';

defineOptions({ name: 'NpcsPage' });

const gs = useGameStateStore();
const route = useRoute();

const allNpcs = computed<NpcProfile[]>(() =>
  Object.entries(gs.relationships || {})
    .filter(([, v]) => v && typeof v === 'object')
    .map(([k, v]) => ({ ...v, 名字: v.名字 || k })),
);

// ─── 筛选 / 排序 ───
const query = ref('');
const filter = ref<'all' | 'follow' | 'sect'>('all');
const relationFilter = ref('');
const sortKey = ref<'favor' | 'realm' | 'name'>('favor');

const mySect = computed(() => String((gs.sectMemberInfo as any)?.宗门名称 || ''));

const filters = computed(() => [
  { key: 'all' as const, label: '全部', count: allNpcs.value.length },
  { key: 'follow' as const, label: '关注中', count: allNpcs.value.filter((n) => n.实时关注).length },
  ...(mySect.value ? [{ key: 'sect' as const, label: '同门', count: allNpcs.value.filter((n) => n.势力归属 === mySect.value).length }] : []),
]);

const relationOptions = computed(() => [...new Set(allNpcs.value.map((n) => n.与玩家关系).filter(Boolean))]);

const REALM_ORDER = ['凡人', '练气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '渡劫', '大乘', '真仙'];
const realmRank = (n: NpcProfile) => {
  const name = String((n.境界 as any)?.名称 ?? n.境界 ?? '');
  const i = REALM_ORDER.findIndex((r) => name.includes(r));
  return i < 0 ? -1 : i;
};

const list = computed(() => {
  const q = query.value.trim();
  let arr = allNpcs.value.filter((n) => !q || n.名字.includes(q));
  if (filter.value === 'follow') arr = arr.filter((n) => n.实时关注);
  if (filter.value === 'sect') arr = arr.filter((n) => n.势力归属 === mySect.value);
  if (relationFilter.value) arr = arr.filter((n) => n.与玩家关系 === relationFilter.value);
  const sorted = [...arr];
  if (sortKey.value === 'favor') sorted.sort((a, b) => toNumber(b.好感度) - toNumber(a.好感度));
  if (sortKey.value === 'realm') sorted.sort((a, b) => realmRank(b) - realmRank(a));
  if (sortKey.value === 'name') sorted.sort((a, b) => a.名字.localeCompare(b.名字, 'zh'));
  return sorted;
});

const clearFilters = () => {
  query.value = '';
  filter.value = 'all';
  relationFilter.value = '';
};

// ─── 选中 ───
const selectedName = ref('');
const detailOpen = ref(false);
const selected = computed(() => allNpcs.value.find((n) => n.名字 === selectedName.value) || null);

const select = (name: string) => {
  selectedName.value = name;
  detailOpen.value = true;
};

const applyQuery = () => {
  const q = route.query.npc;
  if (typeof q === 'string' && q) select(q);
  else if (!selected.value && list.value.length && window.innerWidth > 768) selectedName.value = list.value[0].名字;
};
onMounted(applyQuery);
onActivated(applyQuery);
watch(() => route.query.npc, applyQuery);

// ─── 环境 ───
const inTavern = ref(false);
const nsfw = ref<{ nsfwMode: boolean; nsfwGenderFilter: string }>({ nsfwMode: false, nsfwGenderFilter: 'all' });
const refreshEnv = () => {
  inTavern.value = isTavernEnv();
  nsfw.value = getNsfwSettingsFromStorage();
};
onMounted(refreshEnv);
onActivated(refreshEnv);

const showPrivate = computed(() => {
  const n = selected.value;
  if (!n?.私密信息 || !inTavern.value || !nsfw.value.nsfwMode) return false;
  const g = nsfw.value.nsfwGenderFilter;
  if (g === 'male') return n.性别 === '男';
  if (g === 'female') return n.性别 === '女';
  return true;
});

// ─── 详情标签 ───
const tab = ref('overview');
const memories = computed(() => (Array.isArray(selected.value?.记忆) ? selected.value!.记忆 : []));
const summaries = computed(() => {
  const s = selected.value?.记忆总结 as unknown;
  if (Array.isArray(s)) return s.map(String);
  return typeof s === 'string' && s ? [s] : [];
});
const npcItems = computed(() => Object.values(selected.value?.背包?.物品 || {}).filter((i) => i && typeof i === 'object'));

const currencies = computed(() => {
  const bag = selected.value?.背包;
  if (!bag) return [];
  const wallet = bag.货币 && typeof bag.货币 === 'object' ? Object.values(bag.货币) : [];
  return wallet.filter((c) => toNumber(c?.数量) > 0).map((c) => ({ name: c.名称 || c.币种, amount: toNumber(c.数量) }));
});

const npcSplendor = computed(() => splendorFromNpc(selected.value));

const detailTabs = computed(() => [
  { key: 'overview', label: '概况' },
  { key: 'splendor', label: '风华', hidden: !inTavern.value },
  { key: 'attrs', label: '属性' },
  { key: 'memory', label: '记忆', count: memories.value.length || null },
  { key: 'bag', label: '背包', count: npcItems.value.length || null },
  { key: 'private', label: '私密', hidden: !showPrivate.value },
]);

watch(selectedName, () => {
  memPage.value = 1;
  if (tab.value === 'private' && !showPrivate.value) tab.value = 'overview';
  if (tab.value === 'splendor' && !inTavern.value) tab.value = 'overview';
});

// ─── 展示辅助 ───
const npcAge = (n: NpcProfile) => {
  if (!n.出生日期) return '不详';
  return `${ageFrom(n.出生日期, gs.gameTime)} 岁`;
};
const traits = (n: NpcProfile) => (Array.isArray(n.性格特征) ? n.性格特征 : n.性格 ? [n.性格] : []).filter(Boolean);
const bottomLines = (n: NpcProfile) => (Array.isArray(n.人格底线) ? n.人格底线 : n.人格底线 ? [n.人格底线] : []).filter(Boolean);
const talentsOf = (n: NpcProfile) => (Array.isArray(n.天赋) ? n.天赋 : []).map((t) => ({ name: nameOf(t), desc: descOf(t) })).filter((t) => t.name);
const sixSiItems = (n: NpcProfile) => {
  const s = normalizeSixSi(n.先天六司);
  return SIX_SI_KEYS.map((k) => ({ label: k, value: s[k] }));
};
const npcVitals = (n: NpcProfile) => {
  const a = (n.属性 || {}) as any;
  const age = n.出生日期 ? ageFrom(n.出生日期, gs.gameTime) : 0;
  return [
    vitalInfo('气血', a.气血?.当前, a.气血?.上限),
    vitalInfo('灵气', a.灵气?.当前, a.灵气?.上限),
    vitalInfo('神识', a.神识?.当前, a.神识?.上限),
    vitalInfo('寿元', age, a.寿元上限),
  ];
};

const privateRows = computed(() => {
  const p = selected.value?.私密信息 as Record<string, any> | undefined;
  if (!p) return [];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, v: unknown) => {
    if (v === undefined || v === null || v === '') return;
    const value = Array.isArray(v) ? v.join('、') : typeof v === 'boolean' ? (v ? '是' : '否') : String(v);
    if (value) rows.push({ label, value });
  };
  add('处子', p.是否为处女);
  add('性格倾向', p.性格倾向);
  add('性取向', p.性取向);
  add('经验', p.性经验等级);
  add('当前状态', p.当前性状态);
  add('渴望程度', p.性渴望程度);
  add('次数', p.性交总次数);
  add('伴侣', p.性伴侣名单);
  add('癖好', p.性癖好);
  add('特殊体质', p.特殊体质);
  add('亲密偏好', p.亲密偏好);
  add('禁忌', p.禁忌清单);
  add('生育', p.生育状态?.当前状态);
  return rows;
});

// 按性别过滤不合适的部位
const MALE_ONLY = ['阴茎', '肉棒', '睾丸', '阴囊'];
const FEMALE_ONLY = ['小穴', '阴道', '子宫', '阴蒂', '乳房', '胸部'];
const privateParts = computed(() => {
  const n = selected.value;
  const parts = Array.isArray(n?.私密信息?.身体部位) ? n!.私密信息!.身体部位 : [];
  const block = n?.性别 === '男' ? FEMALE_ONLY : n?.性别 === '女' ? MALE_ONLY : [];
  return parts.filter((p) => p && !block.some((b) => String(p.部位名称 || '').includes(b)));
});

// ─── 记忆分页 ───
const MEM_PAGE = 10;
const memPage = ref(1);
const memPages = computed(() => Math.max(1, Math.ceil(memories.value.length / MEM_PAGE)));
const pagedMemories = computed(() =>
  memories.value
    .map((m, index) => ({ index, ...memoryParts(m) }))
    .slice((memPage.value - 1) * MEM_PAGE, memPage.value * MEM_PAGE),
);
watch(memPages, (n) => {
  if (memPage.value > n) memPage.value = n;
});

// ─── 操作 ───
const busy = ref('');
const run = async (name: string, fn: () => Promise<unknown>, fail = '操作失败') => {
  busy.value = name;
  try {
    await fn();
  } catch (e) {
    toast.error(`${fail}：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    busy.value = '';
  }
};

const toggleFollow = (n: NpcProfile) => run(n.名字, () => setFollow(n.名字, !n.实时关注));

const editMemory = async (index: number, text: string) => {
  const n = selected.value;
  if (!n) return;
  const v = await askText({ title: '编辑记忆', defaultValue: text, multiline: true, confirmText: '保存' });
  if (v === null || v === text) return;
  await run(n.名字, () => updateMemory(n.名字, index, v), '保存失败');
};

const removeMemory = async (index: number) => {
  const n = selected.value;
  if (!n) return;
  const ok = await confirmDialog({ title: '删除记忆', message: `删除 ${n.名字} 的这条记忆？`, details: [memoryParts(memories.value[index]).text], confirmText: '删除', danger: true });
  if (ok) await run(n.名字, () => deleteMemory(n.名字, index), '删除失败');
};

const removeSummary = async (index: number) => {
  const n = selected.value;
  if (!n) return;
  const ok = await confirmDialog({ title: '删除记忆总结', message: '删除后无法恢复。', confirmText: '删除', danger: true });
  if (ok) await run(n.名字, () => deleteSummary(n.名字, index), '删除失败');
};

const summarizeCount = ref(10);
const summarizing = ref(false);
const summarize = async () => {
  const n = selected.value;
  if (!n) return;
  const count = Math.min(Math.max(3, summarizeCount.value || 10), memories.value.length);
  const ok = await confirmDialog({ title: 'AI 总结记忆', message: `把 ${n.名字} 最旧的 ${count} 条记忆交给 AI 总结成一段，原条目会被删除。`, confirmText: '开始总结' });
  if (!ok) return;
  summarizing.value = true;
  try {
    const done = await summarizeMemories(n.名字, count);
    toast.success(`已总结 ${done} 条记忆`);
  } catch (e) {
    toast.error(`总结失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    summarizing.value = false;
  }
};

const toWorldbook = () =>
  run(selected.value!.名字, async () => {
    const book = await exportNpcToWorldbook(selected.value!);
    toast.success(`已写入世界书「${book}」`);
  }, '导出失败');

const removeNpc = async () => {
  const n = selected.value;
  if (!n) return;
  const ok = await confirmDialog({
    title: '删除人物',
    message: `从人物名录中删除「${n.名字}」？其记忆、好感、背包会一并删除，无法恢复。`,
    confirmText: '删除',
    danger: true,
  });
  if (!ok) return;
  await run(n.名字, async () => {
    await deleteNpc(n.名字);
    selectedName.value = '';
    detailOpen.value = false;
  }, '删除失败');
};
</script>

<style scoped>
.npcs-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;
  padding-top: 1rem;
}

.npc-layout {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* 人物详情包含长文本和多组属性，桌面端与列表保持接近的视觉比重。 */
.npc-layout :deep(.list-detail) {
  grid-template-columns: minmax(0, 1fr) minmax(480px, 1fr);
}

@media (max-width: 1100px) {
  .npc-layout :deep(.list-detail) {
    grid-template-columns: minmax(0, 1fr) minmax(420px, 0.95fr);
  }
}

.npc-list {
  padding-right: 0.25rem;
}

.npc-row {
  padding: 0;
  gap: 0;
}

.npc-row-main {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex: 1;
  min-width: 0;
  padding: 0.55rem 0.85rem;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.npc-row:hover {
  background: var(--gm-block-hover);
}

.favor-mini {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  width: 90px;
}

.favor-mini b {
  font-size: 14px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.favor-track {
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--cc-inset);
  overflow: hidden;
}

.favor-track > span {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
}

.star {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  margin-right: 0.35rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--cc-text-3);
  cursor: pointer;
}

.star:hover {
  color: var(--cc-gold);
  background: var(--gm-block-2);
}

.star.on {
  color: var(--cc-gold);
}

/* ---------- 详情 ---------- */
.npc-detail {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.nd-head {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.25rem 0.75rem;
}

.nd-id {
  min-width: 0;
}

.nd-sub {
  margin: 0.2rem 0 0;
  font-size: 14px;
  color: var(--cc-text-2);
}

.nd-favor {
  display: flex;
  align-items: flex-end;
  gap: 1.25rem;
  padding: 0 1.25rem 0.9rem;
}

.nd-favor .gm-meter {
  flex: 1;
  max-width: 360px;
}

.nd-follow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  font-size: 14px;
  letter-spacing: 0.1em;
  color: var(--cc-text-2);
  cursor: pointer;
}

.npc-detail :deep(.page-tabs) {
  padding: 0 0.75rem;
}

.nd-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem 1.25rem 1.25rem;
}

.nd-kv {
  margin-bottom: 1.1rem;
}

.nd-now b {
  margin-right: 0.6rem;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.2em;
  color: var(--cc-gold);
}

.nd-now .thought {
  font-style: italic;
  color: var(--gm-text-psy);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.nd-vitals {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.nd-radar {
  margin: 0 auto;
}

.mem-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.mem-tools .spacer {
  flex: 1;
}

.mem-count {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 13px;
  color: var(--cc-text-2);
}

.mem-count .gm-field {
  width: 64px;
  height: 32px;
  padding: 0 0.5rem;
  text-align: center;
}

.mem-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mem-item {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.2rem 0.75rem;
  padding: 0.7rem 0 0.7rem 1rem;
  border-bottom: 1px solid var(--gm-line);
}

.mem-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 1.05rem;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(var(--cc-gold-rgb), 0.7);
}

.mem-item.summary::before {
  background: var(--cc-seal);
}

.mem-time {
  grid-column: 1;
  font-size: 12px;
  letter-spacing: 0.05em;
  color: var(--cc-gold);
}

.mem-text {
  grid-column: 1;
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
  color: var(--cc-text);
  word-break: break-word;
}

.mem-ops {
  grid-column: 2;
  grid-row: 1 / span 2;
  display: flex;
  gap: 0.3rem;
  align-self: start;
  opacity: 0.55;
  transition: opacity 0.2s ease;
}

.mem-item:hover .mem-ops,
.mem-ops:focus-within {
  opacity: 1;
}

.coins {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.9rem;
}

.bag-row {
  flex-wrap: wrap;
}

.bag-ops {
  display: flex;
  gap: 0.25rem;
}

.parts {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.part-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 14px;
}

.part-head span {
  font-size: 13px;
  color: var(--cc-text-2);
}

.nd-foot {
  flex-wrap: wrap;
}

.nd-foot .cc-btn {
  flex: 0 1 auto;
}

.nd-foot .cc-btn.danger {
  margin-left: auto;
}

@media (hover: none) {
  .mem-ops {
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .npcs-page {
    padding-top: 0.75rem;
  }

  .npc-layout :deep(.list-detail) {
    grid-template-columns: minmax(0, 1fr);
  }

  .npc-tools .gm-seg {
    order: 3;
  }

  .favor-mini {
    width: 64px;
  }

  .bag-ops .cc-btn span {
    display: none;
  }
}
</style>
