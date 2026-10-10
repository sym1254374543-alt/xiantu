<template>
  <div class="status">
    <div v-if="isDataLoaded && characterInfo" class="status-scroll">
      <!-- 名牒 -->
      <header class="id-card">
        <span class="gm-disc lg">{{ (characterInfo.名字 || '?').charAt(0) }}</span>
        <div class="id-main">
          <h2 class="id-name">{{ characterInfo.名字 }}</h2>
          <p v-if="identityLine" class="id-sub">{{ identityLine }}</p>
        </div>
      </header>

      <!-- 境界 -->
      <section class="realm" :title="playerStatus?.境界?.突破描述 || undefined">
        <svg v-if="isRealmProgressAvailable" class="realm-ring" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="27" class="ring-track" />
          <circle
            cx="32"
            cy="32"
            r="27"
            class="ring-fill"
            :class="getRealmProgressClass()"
            :stroke-dasharray="`${(realmProgressPercent / 100) * 169.6} 169.6`"
          />
          <text x="32" y="36" text-anchor="middle" class="ring-text">{{ realmProgressPercent }}%</text>
        </svg>
        <div class="realm-main">
          <span class="realm-label">{{ t('境界') }}</span>
          <strong class="realm-name">{{ formatRealmDisplay(playerStatus?.境界) }}</strong>
          <span v-if="isRealmProgressAvailable && realmProgressPercent >= 100" class="realm-flag hot">{{ t('可突破') }}</span>
          <span v-else-if="isRealmProgressAvailable && realmProgressPercent >= 90" class="realm-flag warm">{{ t('可冲刺') }}</span>
          <span v-else-if="!isRealmProgressAvailable" class="realm-wait">{{ t('等待仙缘') }}</span>
        </div>
      </section>

      <!-- 四维 + 声望 -->
      <section class="block">
        <div class="vitals">
          <div v-for="v in vitalRows" :key="v.key" class="gm-meter" :style="{ '--meter': v.tone }">
            <div class="gm-meter-row">
              <span>
                <img class="status-icon-image" :src="v.icon" alt="" aria-hidden="true" draggable="false" />
                {{ t(v.key) }}
              </span>
              <b :class="{ low: v.low }">{{ v.cur }}<i v-if="v.max"> / {{ v.max }}</i></b>
            </div>
            <div v-if="v.showBar" class="gm-meter-track"><span :style="{ width: v.percent + '%' }"></span></div>
          </div>
        </div>
        <div class="reputation">
          <span class="reputation-label">
            <img class="status-icon-image reputation-icon" :src="reputationIcon" alt="" aria-hidden="true" draggable="false" />
            {{ t('声望') }}
          </span>
          <strong :class="getReputationClass()">{{ reputationTitle }}</strong>
          <i v-if="reputationValue !== null">{{ reputationValue }}</i>
        </div>
      </section>

      <!-- 天赋神通 -->
      <section class="block trait">
        <button
          type="button"
          class="trait-head"
          :disabled="talentNames.length === 0"
          :aria-expanded="talentNames.length > 0 ? !talentsCollapsed : undefined"
          @click="talentsCollapsed = !talentsCollapsed"
        >
          <span class="trait-seal">{{ t('赋') }}</span>
          <h3 class="trait-title">{{ t('天赋神通') }}</h3>
          <span v-if="talentNames.length" class="trait-count">{{ talentNames.length }}</span>
          <span v-else class="trait-empty">{{ t('暂无') }}</span>
          <ChevronDown v-if="talentNames.length" :size="14" class="fold-caret" :class="{ shut: talentsCollapsed }" />
        </button>
        <div v-if="talentNames.length" v-show="!talentsCollapsed" class="talents">
          <button
            v-for="name in talentNames"
            :key="name"
            type="button"
            class="talent"
            :title="name"
            @click="showTalentDetail(name)"
          >
            {{ name }}
          </button>
        </div>
      </section>

      <!-- 状态效果 -->
      <section class="block trait">
        <button
          type="button"
          class="trait-head"
          :disabled="statusEffects.length === 0"
          :aria-expanded="statusEffects.length > 0 ? !statusCollapsed : undefined"
          @click="statusCollapsed = !statusCollapsed"
        >
          <span class="trait-seal">{{ t('状') }}</span>
          <h3 class="trait-title">{{ t('状态效果') }}</h3>
          <template v-if="statusEffects.length">
            <span v-if="buffCount" class="trait-count buff">{{ t('增') }} {{ buffCount }}</span>
            <span v-if="statusEffects.length - buffCount" class="trait-count debuff">{{ t('减') }} {{ statusEffects.length - buffCount }}</span>
          </template>
          <span v-else class="trait-empty">{{ t('清净无为') }}</span>
          <ChevronDown v-if="statusEffects.length" :size="14" class="fold-caret" :class="{ shut: statusCollapsed }" />
        </button>
        <div v-if="statusEffects.length" v-show="!statusCollapsed" class="effects">
          <div
            v-for="(effect, index) in statusEffects"
            :key="effect.状态名称 || `effect-${index}`"
            class="effect-row"
          >
            <button
              type="button"
              class="effect"
              :class="isBuff(effect) ? 'buff' : 'debuff'"
              :title="effect.状态描述 || ''"
              @click="showStatusDetail(effect)"
            >
              <span class="effect-mark">{{ isBuff(effect) ? t('增') : t('减') }}</span>
              <span class="effect-name">{{ effect.状态名称 || '未知状态' }}</span>
              <span v-if="formatTimeDisplay(effect.时间)" class="effect-time">{{ formatTimeDisplay(effect.时间) }}</span>
            </button>
            <button
              type="button"
              class="effect-clear"
              :title="`解除「${effect.状态名称 || '未知状态'}」`"
              @click="removeEffect(effect)"
            >解除</button>
          </div>
        </div>
      </section>
    </div>

    <div v-else class="gm-empty" data-glyph="缘">
      <p>{{ t('请选择角色开启修仙之旅') }}</p>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import bloodIcon from '@/assets/status-icons/blood.png';
import spiritIcon from '@/assets/status-icons/spirit.png';
import senseIcon from '@/assets/status-icons/sense.png';
import lifespanIcon from '@/assets/status-icons/lifespan.png';
import reputationIcon from '@/assets/status-icons/reputation.png';
import { LOCAL_TALENTS } from '@/data/creationData';
import StatusDetailCard from './components/StatusDetailCard.vue';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useUIStore } from '@/stores/uiStore';
import type { StatusEffect } from '@/types/game.d.ts';
import { formatRealmWithStage } from '@/utils/realmUtils';
import { calculateAgeFromBirthdate } from '@/utils/lifespanCalculator';
import { useI18n } from '@/i18n';
import { useStatusEffects } from '@/composables/useStatusEffects';
import { toast } from '@/utils/toast';

const { t } = useI18n();


const gameStateStore = useGameStateStore();
const uiStore = useUIStore();
const { removeByName } = useStatusEffects();

/** 手动解除一条状态（AI 忘了解除时的兜底） */
const removeEffect = async (effect: StatusEffect) => {
  const name = String(effect?.状态名称 || '').trim();
  if (!name) return;
  try {
    await removeByName(name);
    toast.success(`已解除「${name}」`);
  } catch (e) {
    toast.error(`解除失败：${e instanceof Error ? e.message : '未知错误'}`);
  }
};

// 数据加载状态
const isDataLoaded = computed(() => gameStateStore.isGameLoaded && !!gameStateStore.character);

// 直接使用中文字段访问数据
const characterInfo = computed(() => gameStateStore.character);
const playerStatus = computed(() => gameStateStore.attributes);
const statusEffects = computed(() => {
  const effects = gameStateStore.effects || [];
  // 🔥 过滤掉无效的状态效果（undefined、null或缺少状态名称）
  return effects.filter((effect): effect is StatusEffect =>
    effect != null && typeof effect === 'object' && '状态名称' in effect
  );
});

// 自动计算当前年龄（基于出生日期）
const currentAge = computed(() => {
  const birthdate = characterInfo.value?.出生日期;
  const gameTime = gameStateStore.gameTime;

  if (birthdate && gameTime) {
    return calculateAgeFromBirthdate(birthdate, gameTime);
  }

  // 兜底：返回寿命当前值
  return gameStateStore.attributes?.寿命?.当前 || 0;
});

// 名牒副行：灵根 · 天资（兼容字符串 / 对象两种存法）
const nameOf = (v: unknown): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  const o = v as Record<string, unknown>;
  return String(o.名称 ?? o.name ?? '');
};

const identityLine = computed(() => {
  const info = characterInfo.value as any;
  if (!info) return '';
  return [nameOf(info.灵根), nameOf(info.天资)].filter(Boolean).join(' · ');
});

const isBuff = (effect: StatusEffect) => String(effect.类型 || '').toLowerCase() === 'buff';
const buffCount = computed(() => statusEffects.value.filter(isBuff).length);

// 天赋名列表：兼容字符串 / { name } / { 名称 } 三种存法
const talentNames = computed(() => {
  const list = (characterInfo.value as any)?.天赋;
  if (!Array.isArray(list)) return [];
  return list.map(nameOf).filter(Boolean);
});

// 四维数值行：上限缺失或 ≤1 时只显示数值不画条；低于 30% 标红
const vitalRows = computed(() => {
  const s = playerStatus.value as any;
  const rows = [
    { key: '气血', icon: bloodIcon, tone: 'var(--gm-hp)', cur: Number(s?.气血?.当前 ?? 0), max: Number(s?.气血?.上限 ?? 0) },
    { key: '灵气', icon: spiritIcon, tone: 'var(--gm-mp)', cur: Number(s?.灵气?.当前 ?? 0), max: Number(s?.灵气?.上限 ?? 0) },
    { key: '神识', icon: senseIcon, tone: 'var(--gm-sense)', cur: Number(s?.神识?.当前 ?? 0), max: Number(s?.神识?.上限 ?? 0) },
    { key: '寿元', icon: lifespanIcon, tone: 'var(--gm-life)', cur: Number(currentAge.value ?? 0), max: Number(s?.寿命?.上限 ?? 0) },
  ];
  return rows.map((r) => {
    const showBar = r.max > 1;
    const percent = showBar ? Math.max(0, Math.min(100, Math.round((r.cur / r.max) * 100))) : 0;
    return { ...r, showBar, percent, low: showBar && r.key !== '寿元' && percent < 30 };
  });
});

// 收缩状态
const talentsCollapsed = ref(false);
const statusCollapsed = ref(false);

// 模态框状态（通过 uiStore 管理，不再需要本地状态）

// 时间显示格式化
const formatTimeDisplay = (time: string | undefined): string => {
  if (!time || time === '未指定') return '';
  if (time === '永久') return '永久';

  // 处理数字形式的时间（分钟）
  if (/^\d+$/.test(time)) {
    const minutes = parseInt(time);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}时${mins}分` : `${hours}时`;
    }
    return `${minutes}分钟`;
  }

  return time;
};



// 计算百分比的工具方法
const realmProgressPercent = computed(() => {
  if (!gameStateStore.attributes?.境界) return 0;
  const progress = gameStateStore.attributes.境界.当前进度;
  const maxProgress = gameStateStore.attributes.境界.下一级所需;
  if (!maxProgress || maxProgress <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress / maxProgress) * 100)));
});

const isRealmProgressAvailable = computed(() => {
  const maxProgress = gameStateStore.attributes?.境界?.下一级所需;
  return typeof maxProgress === 'number' && maxProgress > 0;
});

const realmWaitingText = computed(() => {
  const desc = playerStatus.value?.境界?.突破描述;
  if (desc) return `${t('等待仙缘')} · ${desc}`;
  return t('等待仙缘');
});

// 根据进度百分比返回CSS类名
const getRealmProgressClass = (): string => {
  const percent = realmProgressPercent.value;
  if (percent >= 100) return 'realm-breakthrough';  // 红色 - 可突破
  if (percent >= 90) return 'realm-sprint';         // 黄色 - 可冲刺
  return '';                                         // 紫色 - 默认
};

// 计算生命体征百分比
const getVitalPercent = (type: '气血' | '灵气' | '神识') => {
  if (!gameStateStore.attributes) return 0;
  const vital = (gameStateStore.attributes as any)[type];
  if (!vital?.当前 || !vital?.上限) return 0;
  return Math.round((vital.当前 / vital.上限) * 100);
};

// 计算寿命百分比（使用计算后的年龄）
const getLifespanPercent = () => {
  const maxLifespan = gameStateStore.attributes?.寿命?.上限;
  if (!maxLifespan) return 0;
  return Math.round((currentAge.value / maxLifespan) * 100);
};

// 获取天赋数据
const getTalentData = (talent: string): any => {
  // 从角色身份信息（V3：gameStateStore.character）的天赋列表中查找
  const baseInfoValue = gameStateStore.character;
  if (baseInfoValue?.天赋 && Array.isArray(baseInfoValue.天赋)) {
    const talentDetail = baseInfoValue.天赋.find((t: any) => t.名称 === talent);
    if (talentDetail) {
      return talentDetail;
    }
  }

  // 向后兼容：从三千大道系统中查找
  const daoDataValue = gameStateStore.thousandDao;
  const daoProgress = daoDataValue?.大道列表?.[talent];
  return daoProgress;
};

// 显示天赋详情
const showTalentDetail = (talent: string) => {
  // 首先尝试从角色的天赋列表中查找(AI生成的自定义天赋)
  const baseInfoValue = characterInfo.value;
  const customTalent: any = baseInfoValue?.天赋?.find((t: any) => nameOf(t) === talent);

  // 然后从LOCAL_TALENTS中查找天赋信息(前端内嵌天赋)
  const localTalent = LOCAL_TALENTS.find(t => t.name === talent);

  // 优先使用自定义天赋数据,其次使用内嵌天赋数据
  const talentInfo = customTalent ? {
    description: customTalent.description || customTalent.描述 || '自定义天赋'
  } : localTalent ? {
    description: localTalent.description || ''
  } : {
    description: `天赋《${talent}》的详细描述暂未开放，请期待后续更新。`
  };

  // 构建详情内容文本（只显示描述）
  const contentText = talentInfo.description;

  uiStore.showDetailModal({
    title: talent,
    content: contentText
  });
};

// 显示状态效果详情
const showStatusDetail = (effect: StatusEffect) => {
  if (!effect || !effect.状态名称) {
    console.warn('[RightSidebar] 状态效果数据异常，无法显示详情', effect);
    return;
  }
  uiStore.showDetailModal({
    title: effect.状态名称,
    component: StatusDetailCard,
    props: { effect, onRemove: () => { uiStore.hideDetailModal(); void removeEffect(effect); } }
  });
};

const formatRealmDisplay = (realm?: unknown): string => {
  return formatRealmWithStage(realm);
};

const reputationValue = computed(() => {
  const reputation = playerStatus.value?.声望;
  if (reputation === undefined || reputation === null) return null;
  const value = Number(reputation);
  return Number.isNaN(value) ? null : value;
});

const reputationTitle = computed(() => {
  const repValue = reputationValue.value;
  if (repValue === null) return '籍籍无名';
  if (repValue <= -5000) return '恶名昭彰';
  if (repValue <= -1000) return '臭名远扬';
  if (repValue <= -500) return '声名狼藉';
  if (repValue <= -100) return '恶名在外';
  if (repValue < 0) return '小有恶名';
  if (repValue >= 10000) return '传说人物';
  if (repValue >= 5000) return '名满天下';
  if (repValue >= 3000) return '威震四方';
  if (repValue >= 1000) return '名动一方';
  if (repValue >= 500) return '声名远播';
  if (repValue >= 100) return '小有名气';
  return '籍籍无名';
});

// 获取声望CSS类名
const getReputationClass = (): string => {
  const reputation = playerStatus.value?.声望;
  if (reputation === undefined || reputation === null) {
    return 'reputation-neutral';
  }

  const repValue = Number(reputation);

  if (repValue < 0) {
    if (repValue <= -5000) return 'reputation-evil-legendary';
    if (repValue <= -1000) return 'reputation-evil-high';
    if (repValue <= -500) return 'reputation-evil-medium';
    if (repValue <= -100) return 'reputation-evil-low';
    return 'reputation-evil-minor';
  }

  if (repValue >= 10000) return 'reputation-legendary';
  if (repValue >= 5000) return 'reputation-famous';
  if (repValue >= 3000) return 'reputation-renowned';
  if (repValue >= 1000) return 'reputation-notable';
  if (repValue >= 500) return 'reputation-known';
  if (repValue >= 100) return 'reputation-minor';

  return 'reputation-neutral';
};
</script>

<style scoped>
.status {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.status-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.1rem 1rem 1.25rem 1.15rem;
}

/* ---------- 名牒 ---------- */
.id-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.35rem 0.25rem 1.1rem 0.45rem;
  border-bottom: 1px solid var(--gm-rail-line);
}

.id-main {
  min-width: 0;
}

.id-name {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 30px;
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: 0.12em;
  color: var(--cc-text);
}

.id-sub {
  margin: 0.3rem 0 0;
  font-size: 13px;
  letter-spacing: 0.05em;
  color: var(--cc-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------- 境界 ---------- */
.realm {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem 0.25rem 0.5rem;
}

.realm-ring {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  transform: rotate(-90deg);
}

.ring-track {
  fill: none;
  stroke: var(--cc-inset);
  stroke-width: 5;
}

.ring-fill {
  fill: none;
  stroke: var(--gm-cultivation);
  stroke-width: 5;
  stroke-linecap: round;
  transition: stroke-dasharray 0.6s ease;
}

.ring-fill.realm-sprint {
  stroke: var(--cc-warning);
}

.ring-fill.realm-breakthrough {
  stroke: var(--cc-seal);
}

.ring-text {
  fill: var(--cc-text);
  font-size: 13px;
  transform: rotate(90deg);
  transform-origin: 32px 32px;
}

.realm-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  min-width: 0;
}

.realm-label {
  font-size: 12px;
  letter-spacing: 0.3em;
  color: var(--cc-text-3);
}

.realm-name {
  font-family: var(--cc-calligraphy);
  font-size: 24px;
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: 0.1em;
  color: var(--cc-gold);
}

.realm-flag {
  padding: 0.05rem 0.5rem;
  border-radius: 3px;
  font-size: 12px;
  letter-spacing: 0.15em;
}

.realm-flag.hot {
  background: var(--cc-seal);
  color: var(--cc-seal-text);
}

.realm-flag.warm {
  border: 1px solid rgba(var(--cc-warning-rgb), 0.5);
  color: var(--cc-warning);
}

.realm-wait {
  font-size: 13px;
  color: var(--cc-text-2);
}

/* ---------- 分块 ---------- */
.block {
  padding: 1rem 0.25rem 0;
  margin-top: 0.75rem;
  border-top: 1px solid var(--gm-rail-line);
}

.block > .gm-label {
  margin-bottom: 0.75rem;
}

.vitals {
  --icon-slot: calc(28px + 0.45rem);

  display: flex;
  flex-direction: column;
  gap: 0.72rem;
}

.vitals .gm-meter-row {
  align-items: center;
  margin-bottom: 0.28rem;
}

.vitals .gm-meter-row > span {
  gap: 0.45rem;
}

.vitals .gm-meter-track {
  height: 4px;
  margin-left: var(--icon-slot);
  border-radius: 2px;
  background: color-mix(in srgb, var(--cc-text) 14%, transparent);
}

.reputation {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem 0.55rem;
  margin-top: 0.85rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--gm-rail-line);
  font-size: 14px;
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

.reputation-label {
  gap: 0.45rem;
}

.reputation strong {
  justify-self: end;
  min-width: 0;
  overflow: hidden;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--cc-text);
}

.reputation i {
  font-style: normal;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  color: var(--cc-text-3);
}

.reputation-neutral { color: var(--cc-text-2) !important; }
.reputation-minor,
.reputation-known { color: var(--gm-life) !important; }
.reputation-notable,
.reputation-renowned { color: var(--gm-mp) !important; }
.reputation-famous,
.reputation-legendary { color: var(--cc-gold) !important; }
.reputation-evil-minor,
.reputation-evil-low,
.reputation-evil-medium,
.reputation-evil-high,
.reputation-evil-legendary { color: var(--cc-danger) !important; }

/* ---------- 天赋神通 / 状态效果：印签标题行 + 签条 ---------- */
.trait-head {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: var(--cc-text-2);
  text-align: left;
  cursor: pointer;
}

.trait-head:disabled {
  cursor: default;
}

.trait-seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.45);
  border-radius: 4px;
  background: rgba(var(--cc-gold-rgb), 0.08);
  color: var(--cc-gold);
  font-family: var(--cc-calligraphy);
  font-size: 13px;
  line-height: 1;
}

.trait-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.25em;
  color: color-mix(in srgb, var(--cc-gold) 78%, var(--cc-text-2));
  white-space: nowrap;
}

.trait-head:not(:disabled):hover .trait-title {
  color: var(--cc-gold);
}

.trait-count {
  flex-shrink: 0;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--gm-block);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  color: var(--cc-text-2);
}

.trait-count.buff {
  background: color-mix(in srgb, var(--cc-success) 14%, transparent);
  color: var(--cc-success);
}

.trait-count.debuff {
  background: color-mix(in srgb, var(--cc-danger) 14%, transparent);
  color: var(--cc-danger);
}

.trait-empty {
  flex-shrink: 0;
  font-size: 12px;
  letter-spacing: 0.15em;
  color: var(--cc-text-3);
}

.fold-caret {
  flex-shrink: 0;
  color: var(--cc-text-3);
  transition: transform 0.25s ease;
}

.fold-caret.shut {
  transform: rotate(-90deg);
}

/* 天赋：两列签条 */
.talents {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.talent {
  position: relative;
  height: 30px;
  padding: 0 0.5rem 0 0.75rem;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.22);
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--cc-gold-rgb), 0.1), rgba(var(--cc-gold-rgb), 0.02));
  color: color-mix(in srgb, var(--cc-gold) 70%, var(--cc-text));
  font-size: 13px;
  letter-spacing: 0.06em;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.talent::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  bottom: 7px;
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--cc-gold);
}

.talent:hover {
  border-color: rgba(var(--cc-gold-rgb), 0.55);
  color: var(--cc-text);
}

/* 状态：单列签条，左方印标增减，右侧剩余时间 */
.effects {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.75rem;
}

.effect {
  --tone: var(--cc-success);

  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  height: 32px;
  padding: 0 0.55rem 0 0.3rem;
  border: 1px solid color-mix(in srgb, var(--tone) 20%, transparent);
  border-radius: 4px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--tone) 10%, transparent), transparent);
  color: var(--cc-text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.effect.debuff {
  --tone: var(--cc-danger);
}

.effect:hover {
  border-color: color-mix(in srgb, var(--tone) 50%, transparent);
}

.effect-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--tone) 22%, transparent);
  color: var(--tone);
  font-family: var(--cc-calligraphy);
  font-size: 14px;
  line-height: 1;
}

.effect-name {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  letter-spacing: 0.05em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.effect-time {
  flex-shrink: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--cc-text-3);
}

/* 一条状态 = 可点开详情的签条 + 手动「解除」（AI 忘了解除时的兜底） */
.effect-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.effect-row .effect {
  flex: 1;
  min-width: 0;
}

.effect-clear {
  flex-shrink: 0;
  height: 32px;
  padding: 0 0.5rem;
  border: 1px solid color-mix(in srgb, var(--cc-text-3) 30%, transparent);
  border-radius: 4px;
  background: transparent;
  color: var(--cc-text-3);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.effect-clear:hover {
  color: var(--cc-danger);
  border-color: color-mix(in srgb, var(--cc-danger) 50%, transparent);
}
</style>
