<template>
  <header class="top-bar">
    <div class="tb-left">
      <h1 v-if="t('仙途') === '仙途'" class="tb-logo" aria-label="仙途">
        <span class="logo-xian">仙</span><span>途</span>
      </h1>
      <h1 v-else class="tb-logo">{{ t('仙途') }}</h1>

      <button
        v-if="characterName"
        type="button"
        class="tb-name"
        :title="t('展开 / 收起角色状态')"
        @click="emit('toggle-status')"
      >
        <span class="gm-seal">{{ characterName.charAt(0) }}</span>
        <span class="tb-name-text">{{ characterName }}</span>
        <span class="tb-realm">{{ characterRealm }}</span>
      </button>
    </div>

    <div class="tb-center">
      <div class="tb-scroll">
        <span class="tb-item tb-place" :title="currentLocation">
          <MapPin :size="15" />
          <span class="tb-text tb-place-full">{{ currentLocation }}</span>
          <span class="tb-text tb-place-short">{{ locationTail }}</span>
        </span>

        <template v-if="spiritDensity > 0">
          <i class="tb-dot" aria-hidden="true"></i>
          <span class="tb-item tb-spirit" :class="spiritDensityClass" :title="spiritDensityTooltip">
            <span class="tb-spirit-label">{{ t('灵气') }}</span>
            <span class="beads" aria-hidden="true">
              <i v-for="n in 5" :key="n" :class="{ on: spiritDensity >= n * 20 - 10 }"></i>
            </span>
            <span class="tb-spirit-val">{{ spiritDensity }}</span>
            <span class="tb-spirit-word">{{ spiritWord }}</span>
          </span>
        </template>

        <i class="tb-dot" aria-hidden="true"></i>
        <span class="tb-item tb-time">
          <Clock :size="14" />
          <span class="tb-text">{{ gameTime }}</span>
        </span>
      </div>
    </div>

    <div class="tb-right">
      <button
        type="button"
        class="tb-btn"
        :title="isDark ? t('切换到宣纸（亮色）') : t('切换到夜山（暗色）')"
        :aria-label="isDark ? t('切换到宣纸（亮色）') : t('切换到夜山（暗色）')"
        @click="toggleTheme"
      >
        <Sun v-if="isDark" :size="16" />
        <Moon v-else :size="16" />
      </button>
      <button
        type="button"
        class="tb-btn"
        :title="isFullscreen ? t('退出全屏') : t('全屏')"
        :aria-label="isFullscreen ? t('退出全屏') : t('全屏')"
        @click="toggleFullscreen"
      >
        <Minimize v-if="isFullscreen" :size="16" />
        <Maximize v-else :size="16" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { Maximize, Minimize, MapPin, Sparkles, Clock, Sun, Moon } from 'lucide-vue-next'
import { useGameStateStore } from '@/stores/gameStateStore'
import { formatRealmWithStage } from '@/utils/realmUtils'
import { useI18n } from '@/i18n'
import { useTheme } from '@/composables/useTheme'
import { getFullscreenElement, requestFullscreen, exitFullscreen, explainFullscreenError } from '@/utils/fullscreen'
import type { GameTime } from '@/types/game'

const { t } = useI18n()
const emit = defineEmits<{ (e: 'toggle-status'): void }>()
const { isDark, toggleTheme } = useTheme()

/**
 * 从GameTime获取分钟数
 */
function getMinutes(gameTime: GameTime): number {
  return gameTime.分钟 ?? 0;
}

// 使用 gameStateStore 获取数据
const gameStateStore = useGameStateStore()
const isFullscreen = ref(false)

const characterName = computed(() => {
  try {
    return gameStateStore.character?.名字 || ''
  } catch (e) {
    console.error('[TopBar] Error getting characterName:', e)
    return ''
  }
})

const characterRealm = computed(() => {
  try {
    return formatRealmWithStage(gameStateStore.attributes?.境界)
  } catch (e) {
    console.error('[TopBar] Error getting characterRealm:', e)
    return t('凡人')
  }
})

const currentLocation = computed(() => {
  try {
    return gameStateStore.location?.描述 || t('初始地')
  } catch (e) {
    console.error('[TopBar] Error getting currentLocation:', e)
    return t('初始地')
  }
})

/** 路径末级，如「赤煌洲·青云山·落霞镇」→「落霞镇」 */
const locationTail = computed(() => {
  const parts = currentLocation.value.split(/\s*[·・•]\s*/).map((s) => s.trim()).filter(Boolean)
  return parts[parts.length - 1] || currentLocation.value
})

const spiritDensity = computed(() => {
  try {
    return gameStateStore.location?.灵气浓度 || 0
  } catch (e) {
    return 0
  }
})

const spiritDensityClass = computed(() => {
  const density = spiritDensity.value
  if (density >= 80) return 'density-very-high'
  if (density >= 60) return 'density-high'
  if (density >= 40) return 'density-medium'
  if (density >= 20) return 'density-low'
  return 'density-very-low'
})

const spiritWord = computed(() => {
  const density = spiritDensity.value
  if (density >= 80) return t('充沛')
  if (density >= 60) return t('浓郁')
  if (density >= 40) return t('适中')
  if (density >= 20) return t('稀薄')
  return t('枯竭')
})

const spiritDensityTooltip = computed(() => {
  const density = spiritDensity.value
  if (density >= 80) return t('灵气充沛 - 极佳修炼环境')
  if (density >= 60) return t('灵气浓郁 - 良好修炼环境')
  if (density >= 40) return t('灵气适中 - 普通修炼环境')
  if (density >= 20) return t('灵气稀薄 - 修炼困难')
  return t('灵气枯竭 - 难以修炼')
})

const gameTime = computed(() => {
  try {
    const time = gameStateStore.gameTime
    if (time) {
      const minutes = getMinutes(time)
      const formattedMinutes = minutes.toString().padStart(2, '0')
      const formattedHours = time.小时.toString().padStart(2, '0')
      return `${t('仙道')}${time.年}${t('年')}${time.月}${t('月')}${time.日}${t('日')} ${formattedHours}:${formattedMinutes}`
    }
    return `${t('仙道')}${t('元年')}1${t('月')}1${t('日')} 00:00`
  } catch (e) {
    console.error('[TopBar] Error getting gameTime:', e)
    return `${t('仙道')}${t('元年')}1${t('月')}1${t('日')} 00:00`
  }
})

const toggleFullscreen = () => {
  if (!getFullscreenElement()) {
    requestFullscreen(document.documentElement as any).catch(err => {
      console.error(explainFullscreenError(err))
    })
  } else {
    exitFullscreen().catch(err => {
      console.error(explainFullscreenError(err))
    })
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = !!getFullscreenElement()
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
})
</script>

<style scoped>
.top-bar {
  position: relative;
  z-index: 30;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  height: 56px;
  padding: 0 1rem 0 1.25rem;
  background: var(--gm-bar);
  border-bottom: 1px solid var(--gm-rail-line);
}

/* ---------- 左 ---------- */
.tb-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.tb-logo {
  margin: 0;
  flex-shrink: 0;
  font-family: var(--cc-calligraphy);
  font-size: 30px;
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.06em;
  color: var(--cc-text);
}

.logo-xian {
  background: linear-gradient(170deg, #d0fff0 0%, #73d6c7 45%, #78a8ee 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

:root[data-theme='light'] .logo-xian {
  background-image: linear-gradient(170deg, #1d696d 0%, #2f9d93 55%, #416ca5 100%);
}

.tb-name {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.3rem 0.8rem 0.3rem 0.35rem;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--gm-block);
  color: var(--cc-text);
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.tb-name:hover {
  border-color: rgba(var(--cc-gold-rgb), 0.5);
}

.tb-name .gm-seal {
  font-size: 15px;
}

.tb-name-text {
  font-size: 15px;
  letter-spacing: 0.15em;
  white-space: nowrap;
}

.tb-realm {
  padding-left: 0.55rem;
  border-left: 1px solid var(--gm-line);
  font-size: 13px;
  letter-spacing: 0.1em;
  color: var(--cc-gold);
  white-space: nowrap;
}

/* ---------- 中：卷轴签 ---------- */
.tb-center {
  display: flex;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
}

.tb-scroll {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
  max-width: 100%;
  height: 36px;
  padding: 0 1.4rem;
  border-top: 1px solid rgba(var(--cc-gold-rgb), 0.3);
  border-bottom: 1px solid rgba(var(--cc-gold-rgb), 0.3);
  background: var(--gm-block);
  font-size: 14px;
  color: var(--cc-text-2);
  white-space: nowrap;
}

/* 两端轴头 */
.tb-scroll::before,
.tb-scroll::after {
  content: '';
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 5px;
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(var(--cc-gold-rgb), 0.75), rgba(var(--cc-gold-rgb), 0.3));
}

.tb-scroll::before {
  left: -2px;
}

.tb-scroll::after {
  right: -2px;
}

.tb-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.tb-item svg {
  flex-shrink: 0;
  color: var(--cc-gold);
}

.tb-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tb-place {
  flex: 0 1 auto;
  min-width: 0;
  color: var(--cc-text);
  letter-spacing: 0.1em;
}

.tb-place .tb-text {
  max-width: 20em;
}

.tb-place-short {
  display: none;
}

.tb-dot {
  width: 4px;
  height: 4px;
  flex-shrink: 0;
  background: rgba(var(--cc-gold-rgb), 0.6);
  transform: rotate(45deg);
}

.tb-time {
  font-variant-numeric: tabular-nums;
}

/* 灵气：五颗玉珠 */
.tb-spirit {
  --density: var(--gm-mp);
  gap: 0.5rem;
  cursor: help;
}

.tb-spirit-label {
  letter-spacing: 0.15em;
}

.beads {
  display: inline-flex;
  gap: 3px;
}

.beads i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--density) 55%, transparent);
}

.beads i.on {
  background: radial-gradient(circle at 35% 30%, #fff 0%, var(--density) 55%);
  box-shadow: 0 0 6px color-mix(in srgb, var(--density) 70%, transparent);
}

.tb-spirit-val {
  font-variant-numeric: tabular-nums;
  color: var(--cc-text);
}

.tb-spirit-word {
  color: var(--density);
}

.density-very-high { --density: var(--gm-sense); }
.density-high { --density: var(--gm-life); }
.density-medium { --density: var(--gm-mp); }
.density-low { --density: var(--cc-text-2); }
.density-very-low { --density: var(--cc-text-3); }

/* ---------- 右 ---------- */
.tb-right {
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
}

.tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--gm-block);
  color: var(--cc-text-2);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.tb-btn:hover {
  color: var(--cc-gold);
  border-color: rgba(var(--cc-gold-rgb), 0.55);
}

/* ---------- 窄屏 ---------- */
@media (max-width: 1280px) {
  .tb-realm {
    display: none;
  }

  .tb-place .tb-text {
    max-width: 12em;
  }
}

@media (max-width: 1024px) {
  .tb-spirit-word,
  .tb-spirit-label {
    display: none;
  }
}

@media (max-width: 768px) {
  .top-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 0.5rem;
    row-gap: 0.3rem;
    height: auto;
    padding: 0.4rem 0.7rem 0.45rem;
  }

  .tb-left {
    order: 1;
    flex: 0 0 auto;
  }

  .tb-logo {
    font-size: 22px;
  }

  .tb-name {
    display: none;
  }

  .tb-right {
    order: 2;
    margin-left: auto;
    gap: 0.35rem;
  }

  .tb-btn {
    width: 30px;
    height: 30px;
  }

  .tb-center {
    order: 3;
    flex: 1 1 100%;
    justify-content: center;
    padding: 0 2px;
  }

  .tb-scroll {
    width: auto;
    max-width: 100%;
    justify-content: center;
    gap: 0.55rem;
    height: 30px;
    padding: 0 0.85rem;
    font-size: 13px;
  }

  .tb-place-full {
    display: none;
  }

  .tb-place-short {
    display: inline;
  }

  .tb-place .tb-text {
    max-width: 9em;
  }

  .tb-time {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 68%;
  }

  .tb-time .tb-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

@media (max-width: 480px) {
  .tb-spirit,
  .tb-spirit + .tb-dot,
  .tb-time svg {
    display: none;
  }
}
</style>
