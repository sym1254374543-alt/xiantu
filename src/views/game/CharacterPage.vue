<template>
  <div v-if="sheet.ready.value" class="char-page">
    <!-- 左：名牒竖卷 -->
    <aside class="scroll-card" aria-label="名牒">
      <header class="id">
        <span class="gm-disc lg id-disc">{{ sheet.name.value.charAt(0) }}</span>
        <h2 class="id-name">{{ sheet.name.value }}</h2>
        <p class="id-sub">{{ sheet.identityLine.value }}</p>
        <button type="button" class="id-origin" :disabled="!sheet.origin.value.desc" @click="showOrigin">
          <span>出身</span>
          <b>{{ sheet.origin.value.name }}</b>
          <ChevronRight v-if="sheet.origin.value.desc" :size="14" />
        </button>
      </header>

      <section class="realm" :title="sheet.realm.value.desc || undefined">
        <ProgressRing
          v-if="sheet.realm.value.hasProgress"
          :percent="sheet.realm.value.percent"
          :size="68"
          :tone="sheet.realm.value.percent >= 100 ? 'hot' : sheet.realm.value.percent >= 90 ? 'warm' : ''"
        />
        <div class="realm-main">
          <span class="realm-label">境界</span>
          <strong class="realm-name">{{ sheet.realm.value.text }}</strong>
          <span v-if="sheet.realm.value.hasProgress" class="realm-num">
            修为 {{ sheet.realm.value.cur }} / {{ sheet.realm.value.need }}
          </span>
          <span v-else class="realm-wait">等待仙缘</span>
        </div>
        <SealBadge v-if="sheet.realm.value.flag" :tone="sheet.realm.value.percent >= 100 ? 'seal' : 'gold'" class="realm-flag">
          {{ sheet.realm.value.flag }}
        </SealBadge>
      </section>
      <p v-if="sheet.realm.value.desc" class="realm-desc">{{ sheet.realm.value.desc }}</p>

      <section class="vitals">
        <VitalRow v-for="v in sheet.vitals.value" :key="v.key" :info="v" />
      </section>

      <dl class="id-kv">
        <dt>
          <img class="kv-icon" :src="reputationIcon" alt="" aria-hidden="true" draggable="false" />
          声望
        </dt>
        <dd :style="{ color: REPUTATION_COLOR[sheet.reputation.value.tone] }">
          {{ sheet.reputation.value.title }}
          <i v-if="sheet.reputation.value.value !== null">{{ sheet.reputation.value.value }}</i>
        </dd>
        <dt><MapPin :size="16" />所在</dt>
        <dd>{{ sheet.location.value }}</dd>
      </dl>
    </aside>

    <!-- 右：正文 -->
    <div class="body-scroll">
      <div class="body-col">
        <!-- 六司 -->
        <section class="sec">
          <header class="gm-sec-head">
            <span class="gm-sec-seal">司</span>
            <h3>六司</h3>
            <span class="aside">最终 = 先天 + 后天（装备、天赋、功法）</span>
          </header>
          <div class="six">
            <RadarChart class="six-radar" :items="radarItems" :size="230" />
            <table class="six-table">
              <thead>
                <tr><th>属性</th><th>最终</th><th>先天</th><th>后天</th><th class="col-desc">评语</th></tr>
              </thead>
              <tbody>
                <tr v-for="row in sheet.sixSi.value" :key="row.key">
                  <th scope="row">{{ row.key }}</th>
                  <td class="num final">{{ row.final }}</td>
                  <td class="num">{{ row.innate }}</td>
                  <td class="num" :class="{ plus: row.acquired > 0, minus: row.acquired < 0 }">
                    {{ row.acquired > 0 ? '+' : '' }}{{ row.acquired }}
                  </td>
                  <td class="col-desc">{{ row.desc }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 灵根 -->
        <section class="sec">
          <header class="gm-sec-head">
            <span class="gm-sec-seal">根</span>
            <h3>灵根</h3>
            <span v-if="sheet.spiritRoot.value.speed" class="aside">{{ sheet.spiritRoot.value.speed }}</span>
          </header>
          <button
            type="button"
            class="root"
            :style="{ '--quality': qualityTone(sheet.spiritRoot.value.grade) }"
            @click="showSpiritRoot"
          >
            <span class="root-name">{{ sheet.spiritRoot.value.name }}</span>
            <span v-if="sheet.spiritRoot.value.grade" class="gm-quality">{{ sheet.spiritRoot.value.grade }}</span>
            <span v-for="el in sheet.spiritRoot.value.elements" :key="el" class="gm-chip gold">{{ el }}</span>
            <span class="root-desc">{{ sheet.spiritRoot.value.desc || '点开查看灵根详情' }}</span>
          </button>
        </section>

        <!-- 天资 · 天赋 -->
        <section class="sec">
          <header class="gm-sec-head">
            <span class="gm-sec-seal">赋</span>
            <h3>天资 · 天赋</h3>
            <span v-if="sheet.talentTier.value.name" class="aside">天资：{{ sheet.talentTier.value.name }}</span>
          </header>
          <ul v-if="sheet.talents.value.length" class="talents">
            <li v-for="tl in sheet.talents.value" :key="tl.name">
              <button type="button" class="talent" @click="showTalent(tl)">
                <b>{{ tl.name }}</b>
                <span>{{ tl.desc || '暂无描述' }}</span>
              </button>
            </li>
          </ul>
          <p v-else class="gm-muted">未身负天赋。</p>
        </section>

        <!-- 状态效果 -->
        <section class="sec">
          <header class="gm-sec-head">
            <span class="gm-sec-seal">状</span>
            <h3>状态效果</h3>
            <span class="aside">{{ sheet.effects.value.length ? `${sheet.effects.value.length} 项` : '' }}</span>
          </header>
          <ul v-if="sheet.effects.value.length" class="effects">
            <li v-for="(e, i) in sheet.effects.value" :key="e.状态名称 + i">
              <button type="button" class="effect" :class="isBuffEffect(e) ? 'buff' : 'debuff'" @click="showEffect(e)">
                <span class="effect-mark">{{ isBuffEffect(e) ? '增' : '减' }}</span>
                <b>{{ e.状态名称 }}</b>
                <span class="effect-desc">{{ e.状态描述 }}</span>
                <span v-if="formatEffectTime(e.剩余时间 ?? e.时间)" class="effect-time">{{ formatEffectTime(e.剩余时间 ?? e.时间) }}</span>
              </button>
            </li>
          </ul>
          <p v-else class="gm-muted">清净无为，身无异状。</p>
        </section>

        <!-- 法身（仅酒馆环境） -->
        <section v-if="inTavern" class="sec">
          <header class="gm-sec-head">
            <span class="gm-sec-seal">身</span>
            <h3>法身</h3>
          </header>
          <BodyProfile :body="sheet.body.value" :nsfw="nsfwMode" />
        </section>
      </div>
    </div>
  </div>

  <EmptyState v-else glyph="缘" title="无法探知角色数据" desc="存档可能尚未加载完成">
    <button type="button" class="cc-btn" :disabled="reloading" @click="reload">
      <RefreshCw :size="15" :class="{ 'cc-spin': reloading }" />
      <span>重新探查</span>
    </button>
  </EmptyState>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import { ChevronRight, MapPin, RefreshCw } from 'lucide-vue-next';
import reputationIcon from '@/assets/status-icons/reputation.png';
import { useCharacterSheet } from '@/composables/useCharacterSheet';
import { useCharacterStore } from '@/stores/characterStore';
import { useUIStore } from '@/stores/uiStore';
import { REPUTATION_COLOR, formatEffectTime, isBuffEffect } from '@/utils/gameDisplay';
import { qualityTone } from '@/utils/qualityTone';
import { isTavernEnv } from '@/utils/tavern';
import { getNsfwSettingsFromStorage } from '@/utils/nsfw';
import StatusDetailCard from '@/components/dashboard/components/StatusDetailCard.vue';
import EmptyState from '@/components/game/EmptyState.vue';
import VitalRow from '@/components/game/VitalRow.vue';
import SealBadge from '@/components/game/SealBadge.vue';
import RadarChart from '@/components/game/RadarChart.vue';
import ProgressRing from '@/components/game/ProgressRing.vue';
import BodyProfile from '@/components/game/BodyProfile.vue';

defineOptions({ name: 'CharacterPage' });

const sheet = useCharacterSheet();
const characterStore = useCharacterStore();
const uiStore = useUIStore();

const radarItems = computed(() => sheet.sixSi.value.map((r) => ({ label: r.key, value: r.final })));

const inTavern = ref(false);
const nsfwMode = ref(false);
const refreshEnv = () => {
  inTavern.value = isTavernEnv();
  nsfwMode.value = getNsfwSettingsFromStorage().nsfwMode;
};
onMounted(refreshEnv);
onActivated(refreshEnv);

const reloading = ref(false);
const reload = async () => {
  reloading.value = true;
  try {
    await characterStore.reloadFromStorage();
  } finally {
    reloading.value = false;
  }
};

const showOrigin = () => {
  uiStore.showDetailModal({ title: sheet.origin.value.name, content: sheet.origin.value.desc });
};

const showSpiritRoot = () => {
  const r = sheet.spiritRoot.value;
  const lines: string[] = [];
  if (r.grade) lines.push(`品阶：${r.grade}`);
  if (r.elements.length) lines.push(`五行：${r.elements.join('、')}`);
  if (r.speed) lines.push(`修炼速度：${r.speed.replace(/^修炼\s*/, '')}`);
  if (r.desc) lines.push('', r.desc);
  uiStore.showDetailModal({ title: r.name, content: lines.join('\n').trim() || '暂无描述' });
};

const showTalent = (tl: { name: string; desc: string }) => {
  uiStore.showDetailModal({ title: tl.name, content: tl.desc || '暂无描述' });
};

const showEffect = (effect: any) => {
  uiStore.showDetailModal({ title: effect.状态名称, component: StatusDetailCard, props: { effect } });
};
</script>

<style scoped>
.char-page {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 2rem;
  height: 100%;
  min-height: 0;
  padding-top: 1.25rem;
}

/* ---------- 名牒 ---------- */
.scroll-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  min-height: 0;
  overflow-y: auto;
  padding: 1.5rem 1.3rem 1.6rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(var(--cc-gold-rgb), 0.07), transparent 28%),
    var(--gm-block);
}

.scroll-card > * {
  flex-shrink: 0;
}

.id {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  text-align: center;
}

.id-disc {
  width: 72px;
  height: 72px;
  margin-bottom: 0.6rem;
  font-size: 36px;
}

.id-name {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 34px;
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: 0.15em;
  color: var(--cc-text);
}

.id-sub {
  margin: 0;
  font-size: 14px;
  letter-spacing: 0.12em;
  color: var(--cc-text-2);
}

.id-origin {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  max-width: 100%;
  margin-top: 0.35rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--cc-border);
  border-radius: 4px;
  background: var(--gm-block-2);
  color: var(--cc-text);
  font-size: 13px;
  cursor: pointer;
}

.id-origin:disabled {
  cursor: default;
}

.id-origin span {
  flex-shrink: 0;
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

.id-origin b {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.id-origin:not(:disabled):hover {
  border-color: rgba(var(--cc-gold-rgb), 0.55);
}

.realm {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.9rem 0 0.2rem;
  border-top: 1px solid var(--gm-line);
}

.realm-main {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}

.realm-label {
  font-size: 13px;
  letter-spacing: 0.3em;
  color: var(--cc-gold);
}

.realm-name {
  font-family: var(--cc-calligraphy);
  font-size: 26px;
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: 0.1em;
  color: var(--cc-text);
}

.realm-num,
.realm-wait {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--cc-text-2);
}

.realm-flag {
  align-self: flex-start;
}

.realm-desc {
  margin: -0.5rem 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--cc-text-2);
}

.vitals {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--gm-line);
}

.id-kv {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.6rem 1rem;
  margin: 0;
  padding-top: 0.9rem;
  border-top: 1px solid var(--gm-line);
  font-size: 14px;
}

.id-kv dt {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

.id-kv dt svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--cc-gold);
}

.id-kv dd {
  margin: 0;
  text-align: right;
  word-break: break-word;
}

.id-kv dd i {
  margin-left: 0.35rem;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  color: var(--cc-text-3);
}

.kv-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
}

/* ---------- 正文 ---------- */
.body-scroll {
  min-height: 0;
  overflow-y: auto;
}

.body-col {
  display: flex;
  flex-direction: column;
  gap: 2.25rem;
  max-width: 880px;
  padding: 0.25rem 0.5rem 2rem 0;
}

.six {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  align-items: center;
  gap: 1.5rem;
}

.six-radar {
  justify-self: center;
}

.six-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
}

.six-table th,
.six-table td {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--gm-line);
  text-align: left;
}

.six-table thead th {
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.2em;
  color: var(--cc-text-3);
}

.six-table tbody th {
  font-weight: 500;
  letter-spacing: 0.2em;
}

.six-table .num {
  font-variant-numeric: tabular-nums;
  color: var(--cc-text-2);
}

.six-table .final {
  font-size: 18px;
  color: var(--cc-gold);
}

.six-table .plus {
  color: var(--cc-success);
}

.six-table .minus {
  color: var(--cc-danger);
}

.six-table .col-desc {
  font-size: 13px;
  color: var(--cc-text-2);
}

.root {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.6rem;
  width: 100%;
  padding: 1rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--quality) 35%, var(--cc-border));
  border-radius: 6px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--quality) 10%, transparent), transparent 70%);
  color: var(--cc-text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.root:hover {
  border-color: color-mix(in srgb, var(--quality) 65%, transparent);
}

.root-name {
  font-family: var(--cc-calligraphy);
  font-size: 26px;
  line-height: 1.2;
  letter-spacing: 0.12em;
  color: var(--quality);
}

.root-desc {
  flex-basis: 100%;
  font-size: 15px;
  line-height: 1.8;
  color: var(--cc-text-2);
}

.talents,
.effects {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.talent {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
  height: 100%;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--gm-block);
  color: var(--cc-text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.talent:hover {
  border-color: rgba(var(--cc-gold-rgb), 0.5);
  background: var(--gm-block-hover);
}

.talent b {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--cc-gold);
}

.talent span {
  display: -webkit-box;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.65;
  color: var(--cc-text-2);
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.effect {
  --tone: var(--cc-success);

  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas: 'mark name time' 'mark desc desc';
  align-items: center;
  gap: 0.15rem 0.6rem;
  width: 100%;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--gm-block);
  color: var(--cc-text);
  text-align: left;
  cursor: pointer;
}

.effect.debuff {
  --tone: var(--cc-danger);
}

.effect:hover {
  border-color: color-mix(in srgb, var(--tone) 50%, transparent);
}

.effect-mark {
  grid-area: mark;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--tone) 18%, transparent);
  color: var(--tone);
  font-family: var(--cc-calligraphy);
  font-size: 15px;
}

.effect b {
  grid-area: name;
  font-size: 15px;
  font-weight: 500;
}

.effect-desc {
  grid-area: desc;
  overflow: hidden;
  font-size: 13px;
  color: var(--cc-text-2);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.effect-time {
  grid-area: time;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--cc-text-2);
}

/* ---------- 窄屏 ---------- */
@media (max-width: 1100px) {
  .char-page {
    grid-template-columns: 290px minmax(0, 1fr);
    gap: 1.25rem;
  }

  .six {
    grid-template-columns: minmax(0, 1fr);
  }

  .six-table .col-desc {
    display: none;
  }
}

@media (max-width: 768px) {
  .char-page {
    display: block;
    overflow-y: auto;
    padding-top: 0.75rem;
  }

  .scroll-card {
    overflow: visible;
    margin-bottom: 1.5rem;
  }

  .body-scroll {
    overflow: visible;
  }

  .body-col {
    gap: 1.75rem;
    padding-right: 0;
  }

  .talents,
  .effects {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
