<template>
  <div class="sect-page">
    <!-- 身份条：所有标签共用 -->
    <div v-if="ctx.joined.value" class="identity">
      <span class="gm-sec-seal big">{{ ctx.sectName.value.charAt(0) }}</span>
      <b class="id-name">{{ ctx.sectName.value }}</b>
      <SealBadge tone="seal">{{ ctx.position.value }}</SealBadge>
      <span class="id-kv">贡献 <b>{{ ctx.contribution.value }}</b></span>
      <span class="id-kv">声望 <b>{{ ctx.reputation.value }}</b></span>
      <span v-if="ctx.joinDate.value" class="id-kv">入门 {{ fmtDate(ctx.joinDate.value) }}</span>
      <span class="spacer"></span>
      <button type="button" class="cc-btn small ghost danger" @click="leave"><LogOut :size="14" /><span>退出宗门</span></button>
    </div>

    <PageTabs v-model="tab" :tabs="tabs" label="宗门分类" @update:model-value="syncRoute" />

    <div class="sect-body">
      <!-- 概览 -->
      <template v-if="tab === 'overview'">
        <EmptyState v-if="!ctx.allSects.value.length && !ctx.joined.value" glyph="宗" title="尘世间的宗门势力等你探索" desc="世界里还没有势力数据，先去世界地图初始化">
          <button type="button" class="cc-btn primary" @click="router.push({ name: 'WorldMap' })"><Map :size="15" /><span>去世界地图初始化</span></button>
        </EmptyState>

        <!-- 已加入：本宗档案 -->
        <div v-else-if="ctx.joined.value && !browsing" class="mine">
          <div class="mine-col">
            <SectProfile v-if="ctx.profile.value" :sect="ctx.profile.value" current />
            <EmptyState v-else glyph="宗" title="宗门档案缺失" desc="世界势力里找不到本宗的记录" compact />
          </div>
          <aside class="mine-side">
            <h4 class="gm-label">宗门事务</h4>
            <button v-for="q in quickWithManage" :key="q.key" type="button" class="gm-row quick" @click="tab = q.key; syncRoute(q.key)">
              <component :is="q.icon" :size="18" class="q-icon" />
              <span class="gm-row-main">
                <span class="gm-row-title">{{ q.label }}</span>
                <span class="gm-row-sub">{{ q.desc }}</span>
              </span>
              <ChevronRight :size="15" />
            </button>
            <button type="button" class="cc-btn small ghost browse" @click="browsing = true"><Globe :size="14" /><span>浏览天下宗门</span></button>
          </aside>
        </div>

        <!-- 天下宗门 -->
        <div v-else class="world">
          <div class="gm-toolbar">
            <label class="gm-search">
              <Search :size="15" />
              <input v-model="query" class="cc-input" type="search" placeholder="搜索宗门" aria-label="搜索宗门" />
            </label>
            <span class="gm-muted">{{ filteredSects.length }} / {{ ctx.allSects.value.length }}</span>
            <span class="spacer"></span>
            <button v-if="ctx.joined.value" type="button" class="cc-btn small ghost" @click="browsing = false"><ArrowLeft :size="14" /><span>回到本宗</span></button>
          </div>
          <ListDetail class="world-body" :open="!!selected && detailOpen" :detail-width="440" detail-label="宗门详情" @close="detailOpen = false">
            <template #list>
              <EmptyState v-if="!filteredSects.length" glyph="寻" title="没有符合的宗门" compact>
                <button type="button" class="cc-btn small" @click="query = ''">清除搜索</button>
              </EmptyState>
              <ul v-else class="gm-list">
                <li v-for="s in filteredSects" :key="String(s.id || s.名称)">
                  <button type="button" class="gm-row" :class="{ active: selected?.名称 === s.名称 }" @click="pick(s)">
                    <span class="gm-disc">{{ s.名称.charAt(0) }}</span>
                    <span class="gm-row-main">
                      <span class="gm-row-title">{{ s.名称 }}</span>
                      <span class="gm-row-sub">{{ s.类型 || '宗门' }}<template v-if="s.等级"> · {{ s.等级 }}</template><template v-if="s.所在大洲"> · {{ s.所在大洲 }}</template></span>
                    </span>
                    <SealBadge v-if="s.名称 === ctx.sectName.value" tone="seal">本宗</SealBadge>
                    <SealBadge v-else-if="s.与玩家关系" :tone="/敌|仇/.test(String(s.与玩家关系)) ? 'bad' : /友|盟/.test(String(s.与玩家关系)) ? 'good' : 'muted'">{{ s.与玩家关系 }}</SealBadge>
                  </button>
                </li>
              </ul>
            </template>
            <template #detail>
              <div v-if="selected" class="detail">
                <div class="gm-detail-body"><SectProfile :sect="selected" :current="selected.名称 === ctx.sectName.value" /></div>
                <footer class="gm-detail-foot">
                  <button
                    v-if="selected.名称 !== ctx.sectName.value"
                    type="button"
                    class="cc-btn primary"
                    :disabled="busy || selected.可否加入 === false"
                    :title="selected.可否加入 === false ? '该宗门暂不接受加入' : ''"
                    @click="join(selected)"
                  >
                    <UserPlus :size="15" /><span>{{ selected.可否加入 === false ? '不收弟子' : '申请加入' }}</span>
                  </button>
                  <button type="button" class="cc-btn danger" :disabled="busy" title="从世界势力与宗门档案中删除" @click="removeFaction(selected)">
                    <Trash2 :size="15" /><span>删除势力</span>
                  </button>
                </footer>
              </div>
              <EmptyState v-else glyph="宗" title="选择一个宗门" desc="查看宗门档案、领导层与入门条件" compact />
            </template>
          </ListDetail>
        </div>
      </template>

      <SectMembersTab v-else-if="tab === 'members'" :ctx="ctx" />
      <SectLibraryTab v-else-if="tab === 'library'" :ctx="ctx" />
      <SectTasksTab v-else-if="tab === 'tasks'" :ctx="ctx" />
      <SectShopTab v-else-if="tab === 'contribution'" :ctx="ctx" />
      <SectManageTab v-else-if="tab === 'management'" :ctx="ctx" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft, BookOpen, Building2, ChevronRight, ClipboardList, Coins, Globe, LogOut, Map, Search, Trash2, UserPlus, Users,
} from 'lucide-vue-next';
import type { WorldFaction } from '@/types/game';
import { useSectContext } from '@/composables/useSectContext';
import { deleteFaction, joinSect, leaveSect } from '@/services/sectContentService';
import { confirmDialog } from '@/composables/useDialog';
import { toast } from '@/utils/toast';
import PageTabs from '@/components/game/PageTabs.vue';
import ListDetail from '@/components/game/ListDetail.vue';
import EmptyState from '@/components/game/EmptyState.vue';
import SealBadge from '@/components/game/SealBadge.vue';
import SectProfile from './sect/SectProfile.vue';
import SectMembersTab from './sect/SectMembersTab.vue';
import SectLibraryTab from './sect/SectLibraryTab.vue';
import SectTasksTab from './sect/SectTasksTab.vue';
import SectShopTab from './sect/SectShopTab.vue';
import SectManageTab from './sect/SectManageTab.vue';

defineOptions({ name: 'SectPage' });

const ctx = useSectContext();
const route = useRoute();
const router = useRouter();

type TabKey = 'overview' | 'members' | 'library' | 'tasks' | 'contribution' | 'management';
/** 标签 ↔ 旧子路由（保留兼容，进入子路由时选中对应标签） */
const ROUTE_OF: Record<TabKey, string> = {
  overview: 'SectOverview', members: 'SectMembers', library: 'SectLibrary', tasks: 'SectTasks', contribution: 'SectContribution', management: 'SectManagement',
};
const TAB_OF = Object.fromEntries(Object.entries(ROUTE_OF).map(([k, v]) => [v, k])) as Record<string, TabKey>;

const tab = ref<TabKey>('overview');

const tabs = computed(() => [
  { key: 'overview', label: '概览' },
  { key: 'members', label: '成员', count: ctx.members.value.length || null, hidden: !ctx.joined.value },
  { key: 'library', label: '藏经', hidden: !ctx.joined.value },
  { key: 'tasks', label: '任务', hidden: !ctx.joined.value },
  { key: 'contribution', label: '兑换', hidden: !ctx.joined.value },
  { key: 'management', label: '经营', hidden: !ctx.joined.value || !ctx.isLeader.value },
]);

const allowed = (t: TabKey) => !tabs.value.find((x) => x.key === t)?.hidden;

watch(
  () => route.name,
  (name) => {
    const t = TAB_OF[String(name)];
    tab.value = t && allowed(t) ? t : 'overview';
  },
  { immediate: true },
);
watch([() => ctx.joined.value, () => ctx.isLeader.value], () => {
  if (!allowed(tab.value)) tab.value = 'overview';
});

const syncRoute = (key: string) => {
  const name = ROUTE_OF[key as TabKey];
  if (name && route.name !== name) router.replace({ name });
};

const quick = [
  { key: 'members' as TabKey, label: '成员', desc: '高层与同门，拜见、交谈', icon: Users },
  { key: 'library' as TabKey, label: '藏经阁', desc: '以贡献学习功法', icon: BookOpen },
  { key: 'tasks' as TabKey, label: '任务堂', desc: '接取差事赚取贡献', icon: ClipboardList },
  { key: 'contribution' as TabKey, label: '贡献兑换', desc: '丹药、法宝、材料', icon: Coins },
];
const quickWithManage = computed(() => (ctx.isLeader.value ? [...quick, { key: 'management' as TabKey, label: '宗门经营', desc: '府库、设施、按旬结算', icon: Building2 }] : quick));

// ─── 天下宗门 ───
const browsing = ref(false);
const query = ref('');
const filteredSects = computed(() => {
  const q = query.value.trim();
  return ctx.allSects.value.filter((s) => !q || s.名称.includes(q) || String(s.类型 || '').includes(q) || String(s.所在大洲 || '').includes(q));
});
const selectedName = ref('');
const detailOpen = ref(false);
const selected = computed(() => ctx.allSects.value.find((s) => s.名称 === selectedName.value) || null);
const pick = (s: WorldFaction) => {
  selectedName.value = s.名称;
  detailOpen.value = true;
};

const fmtDate = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

const busy = ref(false);
const run = async (fn: () => Promise<unknown>) => {
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '操作失败');
  } finally {
    busy.value = false;
  }
};

const join = async (s: WorldFaction) => {
  if (s.可否加入 === false) return toast.warning('该宗门暂不接受加入');
  const current = ctx.sectName.value;
  const ok = await confirmDialog(
    current
      ? { title: '改投宗门', message: `你已是${current}弟子。退出并加入「${s.名称}」？退出会清空本宗的贡献与兑换数据。`, confirmText: '退出并加入', danger: true }
      : { title: '申请加入', message: `拜入「${s.名称}」，成为外门弟子？`, confirmText: '加入' },
  );
  if (!ok) return;
  await run(async () => {
    await joinSect(s);
    browsing.value = false;
    toast.success(`已加入 ${s.名称}`);
  });
};

const leave = async () => {
  const name = ctx.sectName.value;
  const ok = await confirmDialog({ title: '退出宗门', message: `退出${name}？退出后将清空该宗门的贡献、藏经、任务与兑换数据。`, confirmText: '退出', danger: true });
  if (!ok) return;
  await run(async () => {
    await leaveSect();
    tab.value = 'overview';
    syncRoute('overview');
    toast.success(`已退出 ${name}`);
  });
};

const removeFaction = async (s: WorldFaction) => {
  const ok = await confirmDialog({
    title: '删除势力',
    message: `从世界中移除「${s.名称}」？`,
    details: ['会同时从：世界.信息.势力信息', '以及：社交.宗门.宗门档案 中删除'],
    confirmText: '删除',
    danger: true,
  });
  if (!ok) return;
  await run(async () => {
    await deleteFaction(s);
    if (selectedName.value === s.名称) selectedName.value = '';
    toast.success(`已移除势力：${s.名称}`);
  });
};
</script>

<style scoped>
.sect-page {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding-top: 0.9rem;
}

.identity {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  flex-shrink: 0;
  padding: 0.6rem 0.9rem;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.28);
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(var(--cc-gold-rgb), 0.1), transparent 60%), var(--gm-block);
}

.gm-sec-seal.big {
  width: 34px;
  height: 34px;
  font-size: 20px;
  background: var(--cc-seal);
  border-color: var(--cc-seal);
  color: var(--cc-seal-text);
}

.id-name {
  font-family: var(--cc-calligraphy);
  font-size: 22px;
  font-weight: 400;
  letter-spacing: 0.15em;
}

.id-kv {
  font-size: 14px;
  color: var(--cc-text-2);
}

.id-kv b {
  font-weight: 500;
  color: var(--cc-gold);
}

.identity .spacer {
  flex: 1;
}

.sect-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-x: clip;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.sect-body > * {
  flex-shrink: 0;
}

.sect-body > .world,
.sect-body > .mine,
.sect-body > :deep(.library),
.sect-body > :deep(.shop) {
  flex: 1;
  min-height: 0;
}

.mine {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 2rem;
  padding-bottom: 1.5rem;
}

.mine-col {
  max-width: 880px;
  min-width: 0;
}

.mine-side {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.mine-side .gm-label {
  margin-bottom: 0.3rem;
}

.quick .q-icon {
  color: var(--cc-gold);
}

.browse {
  align-self: flex-start;
  margin-top: 0.6rem;
}

.world {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.world-body {
  min-height: 0;
}

.detail {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

@media (max-width: 1100px) {
  .mine {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
