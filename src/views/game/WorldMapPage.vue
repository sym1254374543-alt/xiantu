<template>
  <div class="map-page">
    <div ref="containerEl" class="canvas-wrap"></div>

    <!-- 左上：浮动工具条 -->
    <div class="float toolbar">
      <div class="world">
        <b>{{ map.worldName.value }}</b>
        <small v-if="map.worldBackground.value" :title="map.worldBackground.value">{{ map.worldBackground.value }}</small>
      </div>
      <div v-if="map.realmMapEnabled.value" class="realm-row">
        <div v-if="map.realmTabs.value.length" class="gm-seg" role="radiogroup" aria-label="境界地图">
          <button
            v-for="r in map.realmTabs.value"
            :key="r"
            type="button"
            role="radio"
            :aria-checked="map.currentRealmKey.value === r"
            :class="{ active: map.currentRealmKey.value === r }"
            @click="map.activeRealmTab.value = r"
          >
            {{ r }}
          </button>
        </div>
        <span v-else-if="!map.playerRealm.value" class="gm-muted">先在游戏中获得境界信息</span>
        <button
          v-if="map.playerRealm.value && !map.realmTabs.value.includes(map.playerRealm.value)"
          type="button"
          class="cc-btn small primary"
          :disabled="!!gen.busy.value"
          @click="genRealm(false)"
        >
          <Loader2 v-if="gen.busy.value === 'realm'" :size="14" class="cc-spin" /><Plus v-else :size="14" />
          <span>生成{{ map.playerRealm.value }}地图</span>
        </button>
        <button v-if="map.currentRealmHasMap.value" type="button" class="cc-btn small" :disabled="!!gen.busy.value" @click="genRealm(true)">
          <RefreshCw :size="14" /><span>重新生成</span>
        </button>
      </div>
      <div class="tool-row">
        <button type="button" class="cc-btn small ghost" title="定位到我" aria-label="定位到我" @click="centerOnPlayer"><LocateFixed :size="14" /><span>定位</span></button>
        <button v-if="map.hasMapContent.value" type="button" class="cc-btn small ghost" :disabled="!!gen.busy.value" @click="appendOpen = !appendOpen">
          <Loader2 v-if="gen.busy.value === 'append'" :size="14" class="cc-spin" /><PlusCircle v-else :size="14" /><span>追加生成</span>
        </button>
      </div>
      <form v-if="appendOpen" class="append" @submit.prevent="append">
        <label><input v-model="appendOpt.locations" type="checkbox" /> 地点</label>
        <input v-model.number="appendOpt.locationCount" class="gm-field num" type="number" min="1" max="10" :disabled="!appendOpt.locations" aria-label="地点数" />
        <label><input v-model="appendOpt.factions" type="checkbox" /> 势力</label>
        <input v-model.number="appendOpt.factionCount" class="gm-field num" type="number" min="1" max="5" :disabled="!appendOpt.factions" aria-label="势力数" />
        <button type="submit" class="cc-btn small primary" :disabled="!appendOpt.locations && !appendOpt.factions">生成</button>
      </form>
    </div>

    <!-- 右上：未收录地点 -->
    <button
      v-if="unmapped.list.value.length && !region"
      type="button"
      class="float badge"
      :class="{ active: panel === 'unmapped' }"
      :title="`${unmapped.list.value.length} 位人物在地图未收录的地点`"
      @click="panel = panel === 'unmapped' ? '' : 'unmapped'"
    >
      <MapPinOff :size="15" />未收录地点 <b>{{ unmapped.list.value.length }}</b>
    </button>

    <!-- 右下：图例 -->
    <div class="float legend" :class="{ shut: legendShut }">
      <button type="button" class="legend-head" :aria-expanded="!legendShut" @click="legendShut = !legendShut">
        图例 <ChevronDown :size="14" :class="{ flip: !legendShut }" />
      </button>
      <ul v-if="!legendShut">
        <li v-for="l in LEGEND" :key="l.label"><component :is="l.icon" :size="14" :style="{ color: l.color }" />{{ l.label }}</li>
      </ul>
    </div>

    <!-- 初始化 -->
    <div v-if="!map.hasMapContent.value && !region" class="init">
      <div class="init-card">
        <template v-if="gen.busy.value === 'init'">
          <Loader2 :size="32" class="cc-spin init-spin" />
          <h3>正在开辟山河…</h3>
          <p class="init-status">{{ gen.status.value || '稍候片刻' }}</p>
        </template>
        <template v-else-if="map.realmMapEnabled.value && !map.currentRealmHasMap.value">
          <span class="init-glyph">舆</span>
          <h3>本境界尚无地图</h3>
          <p>用左上角的「生成地图」为当前境界开辟一方天地，会带上低境界地图作为背景。</p>
        </template>
        <template v-else>
          <span class="init-glyph">舆</span>
          <h3>地图尚未初始化</h3>
          <p>当前世界还没有势力与地点。选择密度，让 AI 开辟山河。</p>
          <div class="gm-seg density" role="radiogroup" aria-label="地图密度">
            <button v-for="d in DENSITY_OPTIONS" :key="d.value" type="button" role="radio" :aria-checked="density === d.value" :class="{ active: density === d.value }" :title="d.desc" @click="density = d.value">
              {{ d.label }}
            </button>
          </div>
          <p class="init-desc">{{ DENSITY_OPTIONS.find((d) => d.value === density)?.desc }}</p>
          <button type="button" class="cc-btn primary" :disabled="!map.getCurrentWorldInfo()" @click="initialize"><Sparkles :size="15" /><span>初始化地图</span></button>
        </template>
      </div>
    </div>

    <!-- 右侧：信息抽屉（画布仍可拖动） -->
    <aside v-if="panel && !region" class="info">
      <header class="info-head">
        <h3>{{ panelTitle }}</h3>
        <button type="button" class="cc-modal-close" aria-label="关闭" @click="closePanel"><X :size="18" /></button>
      </header>
      <div class="info-body">
        <!-- 地点 -->
        <template v-if="panel === 'location' && picked">
          <p class="info-type">{{ typeName(picked.type || picked.类型) }}</p>
          <p class="gm-prose">{{ picked.description || picked.描述 || '暂无记载' }}</p>
          <dl class="gm-kv info-kv">
            <template v-if="picked.danger_level || picked.安全等级"><dt>安全等级</dt><dd>{{ picked.danger_level || picked.安全等级 }}</dd></template>
            <template v-if="picked.suitable_for || picked.适合境界"><dt>适合境界</dt><dd>{{ picked.suitable_for || picked.适合境界 }}</dd></template>
            <template v-if="picked.controlled_by || picked.控制势力"><dt>控制势力</dt><dd>{{ picked.controlled_by || picked.控制势力 }}</dd></template>
          </dl>
        </template>
        <!-- 势力 -->
        <template v-else-if="panel === 'faction' && picked">
          <p class="info-type">{{ picked.类型 || picked.type || '势力' }}<template v-if="picked.等级"> · {{ picked.等级 }}</template></p>
          <p class="gm-prose">{{ picked.description || picked.描述 }}</p>
          <dl class="gm-kv info-kv">
            <template v-if="leaderOf(picked)"><dt>首领</dt><dd>{{ leaderOf(picked)!.宗主 }}<small v-if="leaderOf(picked)!.宗主修为"> · {{ leaderOf(picked)!.宗主修为 }}</small></dd></template>
            <template v-if="memberCountOf(picked)"><dt>成员</dt><dd>{{ memberCountOf(picked) }} 人</dd></template>
            <template v-if="picked.与玩家关系"><dt>与你</dt><dd>{{ picked.与玩家关系 }}</dd></template>
          </dl>
          <div v-if="specialtiesOf(picked).length" class="chips"><span v-for="s in specialtiesOf(picked)" :key="s" class="gm-chip gold">{{ s }}</span></div>
        </template>
        <!-- 大陆 -->
        <template v-else-if="panel === 'continent' && picked">
          <p class="info-type">大陆</p>
          <p class="gm-prose">{{ picked.description || picked.描述 || '广袤的修仙大陆，蕴含无尽机缘与危险。' }}</p>
          <dl class="gm-kv info-kv">
            <template v-if="picked.气候"><dt>气候</dt><dd>{{ picked.气候 }}</dd></template>
            <template v-if="list(picked.地理特征).length"><dt>地理</dt><dd>{{ list(picked.地理特征).join('、') }}</dd></template>
            <template v-if="list(picked.天然屏障).length"><dt>屏障</dt><dd>{{ list(picked.天然屏障).join('、') }}</dd></template>
            <template v-if="picked.特点"><dt>特点</dt><dd>{{ picked.特点 }}</dd></template>
            <template v-if="list(picked.主要势力).length"><dt>主要势力</dt><dd>{{ list(picked.主要势力).join('、') }}</dd></template>
          </dl>
        </template>
        <!-- 未收录地点 -->
        <template v-else-if="panel === 'unmapped'">
          <p class="gm-muted">以下人物所在的地点还没收录到地图上，可让 AI 确定坐标后添加；忽略只在本次有效。</p>
          <ul class="unmapped">
            <li v-for="n in unmapped.list.value" :key="n.npcName" class="um">
              <div class="um-main">
                <b>{{ n.npcName }}</b>
                <small>{{ n.locationDesc }}</small>
                <small class="um-fallback">暂显示在：{{ n.continentName }}（大陆）<template v-if="n.buildingHint"> · 区域内：{{ n.buildingHint }}</template></small>
              </div>
              <div class="um-ops">
                <template v-if="unmapped.stateOf(n.npcName) === 'loading'"><Loader2 :size="14" class="cc-spin" /><span class="gm-muted">定位中</span></template>
                <SealBadge v-else-if="unmapped.stateOf(n.npcName) === 'success'" tone="good">已添加</SealBadge>
                <template v-else>
                  <button type="button" class="cc-btn small" @click="addUnmapped(n)"><MapPinPlus :size="14" /><span>添加「{{ n.locationHint }}」</span></button>
                  <button type="button" class="cc-btn small ghost" @click="unmapped.ignore(n.npcName)">忽略</button>
                </template>
              </div>
              <p v-if="unmapped.stateOf(n.npcName) === 'error'" class="um-err">{{ unmapped.errorOf(n.npcName) }}</p>
            </li>
          </ul>
          <p v-if="!unmapped.list.value.length" class="gm-muted">都处理完了。</p>
        </template>
      </div>
      <footer v-if="panel === 'location' && picked" class="info-foot">
        <button type="button" class="cc-btn primary" :disabled="gen.busy.value === 'region'" @click="enterRegion">
          <Loader2 v-if="gen.busy.value === 'region'" :size="15" class="cc-spin" /><Grid3x3 v-else :size="15" />
          <span>{{ gen.busy.value === 'region' ? '生成区域地图中' : '进入区域地图' }}</span>
        </button>
      </footer>
    </aside>

    <RegionMapView v-if="region" :region-map="region" @close="region = null" @open-npc="(n: string) => router.push({ path: '/game/npcs', query: { npc: n } })" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  AlertTriangle, Building2, ChevronDown, Gem, Grid3x3, Loader2, LocateFixed, MapPinOff, MapPinPlus, Mountain, Plus, PlusCircle, RefreshCw,
  Sparkles, Store, User, Users, X, Zap,
} from 'lucide-vue-next';
import type { RegionMap } from '@/types/gameMap';
import { useGameStateStore } from '@/stores/gameStateStore';
import { GameMapManager } from '@/utils/gameMapManager';
import { normalizeContinentBounds, normalizeLocationsData } from '@/utils/coordinateConverter';
import { useWorldMapData } from '@/composables/useWorldMapData';
import { DENSITY_OPTIONS, useMapGeneration, type MapDensity } from '@/composables/useMapGeneration';
import { useUnmappedNpcs, type UnmappedNpc } from '@/composables/useUnmappedNpcs';
import { confirmDialog } from '@/composables/useDialog';
import { toast } from '@/utils/toast';
import SealBadge from '@/components/game/SealBadge.vue';
import RegionMapView from './map/RegionMapView.vue';
import { FACTION_TYPES } from '@/utils/prompts/definitions/valueDomains';

defineOptions({ name: 'WorldMapPage' });

const gs = useGameStateStore();
const router = useRouter();
const map = useWorldMapData();
const gen = useMapGeneration(map);
const unmapped = useUnmappedNpcs(map);

const LEGEND = [
  { label: '山川湖海', icon: Mountain, color: 'var(--gm-life)' },
  { label: '势力据点', icon: Building2, color: 'var(--cc-gold)' },
  { label: '城镇都市', icon: Store, color: 'var(--gm-mp)' },
  { label: '灵脉宝地', icon: Sparkles, color: 'var(--gm-cultivation)' },
  { label: '异变区域', icon: Gem, color: 'var(--q-xian)' },
  { label: '凶险之地', icon: AlertTriangle, color: 'var(--cc-danger)' },
  { label: '其他特殊', icon: Zap, color: 'var(--cc-warning)' },
  { label: '你的位置', icon: User, color: 'var(--cc-seal)' },
  { label: '人物位置', icon: Users, color: 'var(--cc-text-2)' },
];
const legendShut = ref(false);

const TYPE_NAMES: Record<string, string> = {
  natural_landmark: '山川湖海', sect_power: '势力据点', city_town: '城镇都市', blessed_land: '灵脉宝地', treasure_land: '异变区域',
  dangerous_area: '凶险之地', special_other: '其他特殊',
};
const typeName = (t: string) => TYPE_NAMES[t] || t || '未知类型';
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : []);
const leaderOf = (p: any) => p?.领导层 || p?.leadership || null;
const memberCountOf = (p: any) => p?.成员数量?.总数 ?? p?.成员数量?.total ?? p?.memberCount?.total ?? null;
const specialtiesOf = (p: any) => [...new Set([...list(p?.特色列表), ...list(p?.特色)])];

// 势力判定：类型取自值域总表（唯一来源），并兼容依据领导层/成员数推断
const isFaction = (l: any) =>
  (FACTION_TYPES as readonly string[]).includes(l?.类型) ||
  l?.type === 'sect_power' ||
  !!(l?.leadership || l?.领导层 || l?.memberCount || l?.成员数量);

// ─── 画布 ───
const canvasEl = ref<HTMLCanvasElement | null>(null);
const containerEl = ref<HTMLDivElement | null>(null);
let manager: GameMapManager | null = null;
let rendering = false;
let pageAlive = true;

const renderData = (reset = true) => {
  if (!manager) return;
  const wi = (map.getCurrentWorldInfo() ?? gs.worldInfo) as any;
  if (reset) manager.clear();
  if (!wi) {
    syncPlayer();
    syncNpcs();
    return;
  }
  const cfg = map.mapRenderConfig.value;
  for (const c of wi.大陆信息 ?? []) {
    try {
      const b = c.大洲边界 || c.continent_bounds;
      if (b) {
        c.continent_bounds = normalizeContinentBounds(b, cfg.width, cfg.height);
        c.大洲边界 = c.continent_bounds;
      }
      manager.addContinent(c);
    } catch (e) {
      console.error('[地图] 大陆加载失败', c, e);
    }
  }
  // 势力只画势力范围，地点由地点信息统一管理
  for (const f of normalizeLocationsData(wi.势力信息 ?? [], cfg)) {
    try {
      if ((f as any).territoryBounds?.length >= 3) manager.addTerritory(f);
    } catch (e) {
      console.error('[地图] 势力加载失败', f, e);
    }
  }
  for (const l of normalizeLocationsData(wi.地点信息 ?? [], cfg)) {
    try {
      manager.addLocation(l);
    } catch (e) {
      console.error('[地图] 地点加载失败', l, e);
    }
  }
  syncPlayer();
  syncNpcs();
};

const syncPlayer = () => {
  if (!manager) return;
  const c = map.resolvePlayerCoordinates(gs.location);
  if (c) manager.updatePlayerPosition(c, String((gs.character as any)?.名字 || '道友'));
  else manager.clearPlayerMarker();
};
const syncNpcs = () => manager?.updateNPCPositions(map.npcMarkers());

/** 每次重建都用新画布。旧画布上的 WebGL 上下文释放后不能再创建渲染器。 */
const mountCanvas = () => {
  const host = containerEl.value;
  if (!host) return null;
  const rect = host.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(rect.width || 800));
  canvas.height = Math.max(1, Math.floor(rect.height || 600));
  host.replaceChildren(canvas);
  canvasEl.value = canvas;
  return canvas;
};

const setup = async () => {
  if (!pageAlive || !containerEl.value || rendering) return;
  rendering = true;
  try {
    await new Promise((r) => requestAnimationFrame(r));
    if (!pageAlive || !containerEl.value) return;
    manager?.destroy();
    manager = null;
    const canvas = mountCanvas();
    if (!canvas) return;
    manager = new GameMapManager(canvas, { ...map.mapRenderConfig.value, theme: themeName() });
    manager.on('locationClick', onLocationClick);
    manager.on('continentClick', onContinentClick);
    renderData(true);
  } catch (e) {
    manager?.destroy();
    manager = null;
    if (!pageAlive) return;
    const msg = (e as Error).message || '';
    toast.error(/shader|WebGL/.test(msg) ? '地图初始化失败：显卡不支持或 WebGL 被禁用' : `地图初始化失败：${msg}`);
  } finally {
    rendering = false;
  }
};

/** 画布配色跟随主题：暗色墨夜描金、亮色宣纸淡墨 */
const themeName = (): 'light' | 'dark' => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
let themeObserver: MutationObserver | null = null;

/** 换主题只改配色并重画，不拆 WebGL。同一块画布上重建渲染器会失败。 */
const applyTheme = () => {
  if (!pageAlive) return;
  if (!manager) {
    void setup();
    return;
  }
  manager.setTheme(themeName());
  renderData(true);
};

const onResize = () => {
  if (!manager || !containerEl.value) return;
  const r = containerEl.value.getBoundingClientRect();
  try {
    manager.resize(r.width, r.height);
  } catch {
    /* resize 过程中偶发错误可忽略 */
  }
};

onMounted(async () => {
  await setup();
  window.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onResize);
  themeObserver = new MutationObserver(() => applyTheme());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
});
onActivated(async () => {
  await nextTick();
  onResize();
});
onBeforeUnmount(() => {
  pageAlive = false;
  window.removeEventListener('resize', onResize);
  document.removeEventListener('fullscreenchange', onResize);
  themeObserver?.disconnect();
  manager?.destroy();
  manager = null;
});

watch(() => gs.location, () => {
  syncPlayer();
  syncNpcs(); // 与玩家同处的人物要让位
}, { deep: true });
watch(() => gs.relationships, syncNpcs, { deep: true });
watch(() => `${map.mapRenderConfig.value.width}x${map.mapRenderConfig.value.height}`, () => setup());
// 只比较长度与 Tab，避免深度监听反复重绘
watch(
  () => {
    const wi = map.activeWorldInfo.value as any;
    return [wi?.大陆信息?.length, wi?.势力信息?.length, wi?.地点信息?.length, map.currentRealmKey.value].join('|');
  },
  () => {
    if (!gen.busy.value) renderData(true);
  },
);

const centerOnPlayer = () => {
  const c = map.resolvePlayerCoordinates(gs.location);
  if (c && manager) manager.centerTo(c.x, c.y);
  else toast.info('无法在当前地图上找到你的位置');
};

// ─── 信息抽屉 ───
const panel = ref<'' | 'location' | 'faction' | 'continent' | 'unmapped'>('');
const picked = ref<any>(null);
const panelTitle = computed(() =>
  panel.value === 'unmapped' ? '未收录地点' : String(picked.value?.name || picked.value?.名称 || ''),
);
const onLocationClick = (d: unknown) => {
  const data = (d as any)?.location || d;
  if (!data) return;
  picked.value = data;
  panel.value = isFaction(data) ? 'faction' : 'location';
};
const onContinentClick = (d: unknown) => {
  if (!d) return;
  picked.value = d;
  panel.value = 'continent';
};
const closePanel = () => {
  panel.value = '';
  picked.value = null;
};

// ─── 生成 ───
const density = ref<MapDensity>('normal');
const initialize = async () => {
  try {
    await gen.initializeMap(density.value);
    renderData(true);
    toast.success('地图初始化完成');
  } catch (e) {
    toast.error(`地图初始化失败：${(e as Error).message}`);
  }
};

const appendOpen = ref(false);
const appendOpt = reactive({ locations: true, locationCount: 3, factions: false, factionCount: 1 });
const append = async () => {
  appendOpen.value = false;
  try {
    const r = await gen.generateAdditional({ ...appendOpt });
    if (!r) return;
    renderData(true);
    toast.success(`已追加 ${[r.factions && `${r.factions} 个势力`, r.locations && `${r.locations} 个地点`].filter(Boolean).join('、') || '0 项'}`);
  } catch (e) {
    toast.error(`追加生成失败：${(e as Error).message}`);
  }
};

const genRealm = async (overwrite: boolean) => {
  if (overwrite) {
    const ok = await confirmDialog({
      title: '重新生成境界地图',
      message: `重新生成【${map.currentRealmKey.value}】的世界地图？当前的地点、势力会被覆盖。`,
      confirmText: '重新生成',
      danger: true,
    });
    if (!ok) return;
  }
  try {
    toast.info('正在生成境界地图…');
    const realm = await gen.generateCurrentRealmMap(overwrite);
    renderData(true);
    toast.success(`【${realm}】境界地图生成完成`);
  } catch (e) {
    toast.error((e as Error).message);
  }
};

// ─── 区域地图 / 未收录 ───
const region = ref<RegionMap | null>(null);
const enterRegion = async () => {
  try {
    region.value = await gen.openRegionMap(picked.value);
    closePanel();
  } catch (e) {
    toast.error((e as Error).message);
  }
};

const addUnmapped = async (n: UnmappedNpc) => {
  const name = await unmapped.add(n);
  if (name) toast.success(`已将「${name}」添加到世界地图`);
};
</script>

<style scoped>
.map-page {
  position: relative;
  height: 100%;
  min-height: 0;
  margin: 0.75rem 0 0;
  overflow: hidden;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--gm-block);
}

.canvas-wrap {
  position: absolute;
  inset: 0;
}

.canvas-wrap canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.float {
  position: absolute;
  z-index: 10;
  border: 1px solid var(--cc-border-strong);
  border-radius: 8px;
  background: color-mix(in srgb, var(--cc-solid-bg) 90%, transparent);
  box-shadow: 0 10px 28px -12px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
}

.toolbar {
  top: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  max-width: min(520px, calc(100% - 24px));
  padding: 0.7rem 0.8rem;
}

.world {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.world b {
  font-family: var(--cc-calligraphy);
  font-size: 22px;
  font-weight: 400;
  letter-spacing: 0.15em;
}

.world small {
  overflow: hidden;
  font-size: 12px;
  color: var(--cc-text-2);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.realm-row,
.tool-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.append {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--gm-line);
  font-size: 13px;
  color: var(--cc-text-2);
}

.append label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.gm-field.num {
  width: 56px;
  height: 30px;
  text-align: center;
}

.badge {
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.8rem;
  color: var(--cc-warning);
  font-size: 13px;
  cursor: pointer;
}

.badge b {
  font-weight: 600;
}

.badge.active {
  border-color: var(--cc-warning);
}

.legend {
  right: 12px;
  bottom: 12px;
  min-width: 128px;
  padding: 0.4rem 0.7rem 0.55rem;
}

.legend.shut {
  padding-bottom: 0.4rem;
}

.legend-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: var(--cc-text-2);
  font-size: 12px;
  letter-spacing: 0.3em;
  cursor: pointer;
}

.legend-head svg {
  transition: transform 0.2s ease;
}

.legend-head svg.flip {
  transform: rotate(180deg);
}

.legend ul {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0.45rem 0 0;
  padding: 0;
  font-size: 12px;
  color: var(--cc-text);
  list-style: none;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.init {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(4, 8, 16, 0.25);
}

.init-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  width: min(420px, 100%);
  padding: 1.75rem 1.5rem;
  border: 1px solid var(--cc-border-strong);
  border-radius: 8px;
  background: var(--cc-solid-bg);
  text-align: center;
}

.init-glyph {
  font-family: var(--cc-calligraphy);
  font-size: 64px;
  line-height: 1;
  color: rgba(var(--cc-gold-rgb), 0.35);
}

.init-spin {
  color: var(--cc-gold);
}

.init-card h3 {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0.15em;
}

.init-card p {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--cc-text-2);
}

.init-status {
  max-width: 100%;
  overflow: hidden;
  font-size: 12px !important;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.init-desc {
  font-size: 12px !important;
}

/* ---------- 信息抽屉 ---------- */
.info {
  position: absolute;
  top: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  width: min(380px, calc(100% - 24px));
  border: 1px solid var(--cc-border-strong);
  border-radius: 8px;
  background: var(--cc-solid-bg);
  box-shadow: -12px 0 32px -12px rgba(0, 0, 0, 0.45);
}

.info-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.6rem 0.6rem 1.1rem;
  border-bottom: 1px solid var(--gm-line);
}

.info-head h3 {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 24px;
  font-weight: 400;
  letter-spacing: 0.12em;
}

.info-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.9rem 1.1rem;
}

.info-type {
  margin: 0 0 0.5rem;
  font-size: 13px;
  letter-spacing: 0.2em;
  color: var(--cc-gold);
}

.info-kv {
  margin-top: 0.9rem;
}

.info-kv small {
  color: var(--cc-text-2);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.8rem;
}

.info-foot {
  display: flex;
  padding: 0.8rem 1.1rem;
  border-top: 1px solid var(--gm-line);
}

.info-foot .cc-btn {
  flex: 1;
}

.unmapped {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0.8rem 0 0;
  padding: 0;
  list-style: none;
}

.um {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
}

.um-main {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.um-main b {
  font-size: 15px;
  font-weight: 600;
}

.um-main small {
  font-size: 12px;
  color: var(--cc-text-2);
}

.um-fallback {
  color: var(--cc-text-3) !important;
}

.um-ops {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.um-err {
  margin: 0.4rem 0 0;
  font-size: 12px;
  color: var(--cc-danger);
}

@media (max-width: 768px) {
  .map-page {
    margin-top: 0.5rem;
  }

  .toolbar {
    right: 12px;
    max-width: none;
  }

  .badge {
    top: auto;
    bottom: 12px;
    left: 12px;
    right: auto;
  }

  .legend {
    display: none;
  }

  .info {
    top: auto;
    left: 12px;
    width: auto;
    max-height: 60%;
  }
}
</style>
