<template>
  <div class="region">
    <header class="region-head">
      <button type="button" class="cc-btn small ghost" @click="emit('close')"><ArrowLeft :size="15" /><span>返回世界地图</span></button>
      <h3 class="region-name">{{ regionMap.name }}</h3>
      <span class="region-scale">{{ regionMap.gridWidth }} × {{ regionMap.gridHeight }} 格</span>
    </header>

    <div class="region-body">
      <div class="grid-wrap">
        <div class="grid" :style="{ gridTemplateColumns: `repeat(${regionMap.gridWidth}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${regionMap.gridHeight}, minmax(0, 1fr))` }">
          <template v-for="row in rows" :key="row">
            <button
              v-for="col in regionMap.gridWidth"
              :key="`${col}-${row}`"
              type="button"
              class="cell"
              :class="cellClass(col, row)"
              :disabled="!at(col, row)"
              :title="at(col, row)?.name"
              @click="pick(col, row)"
            >
              <template v-if="at(col, row)">
                <component :is="ICONS[at(col, row)!.type] || Home" :size="16" class="cell-icon" />
                <span class="cell-name">{{ at(col, row)!.name }}</span>
                <span v-if="isPlayer(at(col, row)!.id)" class="me" title="你在此">我</span>
                <span v-if="npcsIn(at(col, row)!.id).length" class="npc-count">{{ npcsIn(at(col, row)!.id).length }}</span>
              </template>
            </button>
          </template>
        </div>
      </div>

      <aside class="side">
        <template v-if="selected">
          <h4 class="side-title">
            <component :is="ICONS[selected.type] || Home" :size="17" />
            {{ selected.name }}
          </h4>
          <p class="side-type">{{ TYPE_NAMES[selected.type] || selected.type }}<template v-if="selected.isEntrance"> · 入口</template></p>
          <p v-if="selected.description" class="gm-prose side-desc">{{ selected.description }}</p>
          <p v-if="isPlayer(selected.id)" class="side-me"><MapPin :size="14" />你当前在此</p>
          <h5 class="gm-label">当前在此</h5>
          <ul v-if="npcsIn(selected.id).length" class="people">
            <li v-for="n in npcsIn(selected.id)" :key="n">
              <button type="button" class="gm-chip" @click="emit('open-npc', n)">{{ n }}</button>
            </li>
          </ul>
          <p v-else class="gm-muted">此处没有认识的人。</p>
        </template>
        <template v-else>
          <h4 class="side-title">此地人物</h4>
          <ul v-if="allHere.length" class="people-list">
            <li v-for="p in allHere" :key="p.name">
              <button type="button" class="gm-chip" @click="emit('open-npc', p.name)">{{ p.name }}</button>
              <small>{{ p.building }}</small>
            </li>
          </ul>
          <p v-else class="gm-muted">区域里没有认识的人。点格子看建筑详情。</p>
        </template>

        <ul class="legend">
          <li v-for="(n, k) in TYPE_NAMES" :key="k"><component :is="ICONS[k]" :size="13" />{{ n }}</li>
        </ul>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowLeft, DoorOpen, FlaskConical, Home, Landmark, Lock, MapPin, Trees } from 'lucide-vue-next';
import type { RegionBuilding, RegionBuildingType, RegionMap } from '@/types/gameMap';
import { useGameStateStore } from '@/stores/gameStateStore';

const props = defineProps<{ regionMap: RegionMap }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'open-npc', name: string): void }>();
const gs = useGameStateStore();

const ICONS: Record<RegionBuildingType, unknown> = {
  entrance: DoorOpen, main: Landmark, residential: Home, functional: FlaskConical, restricted: Lock, wilderness: Trees,
};
const TYPE_NAMES: Record<RegionBuildingType, string> = {
  entrance: '入口', main: '主体建筑', residential: '居所', functional: '功能建筑', restricted: '禁区', wilderness: '自然地形',
};

/** 游戏坐标 y 向上增大：从 gridHeight 渲染到 1，左下角为 (1,1) */
const rows = computed(() => Array.from({ length: props.regionMap.gridHeight }, (_, i) => props.regionMap.gridHeight - i));

const byCell = computed(() => new Map(props.regionMap.buildings.map((b) => [`${b.gridX},${b.gridY}`, b])));
const at = (x: number, y: number): RegionBuilding | null => byCell.value.get(`${x},${y}`) ?? null;

const matchesRegion = (rid: unknown) => rid === props.regionMap.linkedLocationId || rid === props.regionMap.id;

const playerBuilding = computed(() => {
  const loc = gs.location as any;
  return loc?.regionId && matchesRegion(loc.regionId) ? loc.buildingId ?? null : null;
});
const isPlayer = (id: string) => playerBuilding.value === id;

const entranceId = computed(() => props.regionMap.buildings.find((b) => b.isEntrance)?.id ?? props.regionMap.buildings[0]?.id ?? null);

/** NPC 落格：regionId+buildingId 精确 → regionId 落入口 → 描述含地点名按末段匹配建筑，匹配不到落入口 */
const npcsByBuilding = computed(() => {
  const map = new Map<string, string[]>();
  const place = props.regionMap.linkedLocationId;
  for (const [name, npc] of Object.entries((gs.relationships || {}) as Record<string, any>)) {
    const loc = npc?.当前位置;
    if (!loc) continue;
    let target: string | null = null;
    if (loc.regionId) {
      if (!matchesRegion(loc.regionId)) continue;
      target = loc.buildingId ?? entranceId.value;
    } else {
      const desc = String(loc.描述 ?? loc.description ?? '');
      if (!place || !desc.includes(place)) continue;
      const hint = desc.split('·').pop()?.trim();
      const hit = hint ? props.regionMap.buildings.find((b) => b.name === hint || b.name.includes(hint) || hint.includes(b.name)) : null;
      target = hit?.id ?? entranceId.value;
    }
    if (!target) continue;
    map.set(target, [...(map.get(target) || []), name]);
  }
  return map;
});
const npcsIn = (id: string) => npcsByBuilding.value.get(id) ?? [];
const allHere = computed(() =>
  [...npcsByBuilding.value.entries()].flatMap(([id, names]) =>
    names.map((name) => ({ name, building: props.regionMap.buildings.find((b) => b.id === id)?.name || '' })),
  ),
);

const selectedId = ref('');
const selected = computed(() => props.regionMap.buildings.find((b) => b.id === selectedId.value) || null);
const pick = (x: number, y: number) => {
  const b = at(x, y);
  selectedId.value = b && b.id !== selectedId.value ? b.id : '';
};

const cellClass = (x: number, y: number) => {
  const b = at(x, y);
  return {
    filled: !!b,
    [`t-${b?.type}`]: !!b,
    entrance: !!b?.isEntrance,
    active: !!b && b.id === selectedId.value,
    here: !!b && isPlayer(b.id),
  };
};
</script>

<style scoped>
.region {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  background: var(--gm-page-bg);
}

.region-head {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-shrink: 0;
  padding: 0.6rem 0.25rem 0.8rem;
  border-bottom: 1px solid var(--gm-line);
}

.region-name {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 26px;
  font-weight: 400;
  letter-spacing: 0.15em;
}

.region-scale {
  font-size: 13px;
  color: var(--cc-text-2);
}

.region-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  padding-top: 1rem;
}

.grid-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: auto;
}

.grid {
  display: grid;
  gap: 4px;
  width: min(100%, 78vh);
  aspect-ratio: 1;
  padding: 8px;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: repeating-linear-gradient(45deg, transparent 0 8px, rgba(var(--cc-gold-rgb), 0.025) 8px 16px), var(--gm-block);
}

.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  padding: 2px;
  border: 1px dashed transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--cc-text-3);
  cursor: default;
}

.cell.filled {
  border: 1px solid var(--cc-border);
  background: var(--gm-block-2);
  color: var(--cc-text);
  cursor: pointer;
}

.cell.filled:hover {
  border-color: rgba(var(--cc-gold-rgb), 0.55);
}

.cell.active {
  border-color: var(--cc-gold);
  box-shadow: 0 0 0 2px rgba(var(--cc-gold-rgb), 0.3);
}

.cell.here {
  background: rgba(var(--cc-gold-rgb), 0.16);
}

.cell.t-restricted { color: var(--cc-danger); }
.cell.t-wilderness { color: var(--gm-life); }
.cell.t-functional { color: var(--gm-mp); }
.cell.t-main { color: var(--cc-gold); }

.cell-icon {
  flex-shrink: 0;
}

.cell-name {
  max-width: 100%;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.2;
  color: var(--cc-text);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.me {
  position: absolute;
  top: 2px;
  left: 2px;
  padding: 0 3px;
  border-radius: 2px;
  background: var(--cc-seal);
  color: var(--cc-seal-text);
  font-family: var(--cc-calligraphy);
  font-size: 11px;
  line-height: 1.3;
}

.npc-count {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 15px;
  border-radius: 8px;
  background: var(--gm-mp);
  color: var(--cc-solid-bg);
  font-size: 10px;
  line-height: 15px;
  text-align: center;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--gm-block);
}

.side-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.side-type {
  margin: 0;
  font-size: 13px;
  color: var(--cc-text-2);
}

.side-me {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  font-size: 13px;
  color: var(--cc-gold);
}

.people,
.people-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.people-list {
  flex-direction: column;
}

.people-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.people-list small {
  font-size: 12px;
  color: var(--cc-text-3);
}

.legend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.3rem 0.8rem;
  margin: auto 0 0;
  padding: 0.8rem 0 0;
  border-top: 1px solid var(--gm-line);
  font-size: 12px;
  color: var(--cc-text-2);
  list-style: none;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

@media (max-width: 900px) {
  .region-body {
    grid-template-columns: minmax(0, 1fr);
    overflow-y: auto;
  }
}
</style>
