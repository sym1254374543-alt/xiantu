<template>
  <div class="attribute-allocation-container">
    <div class="alloc-header">
      <div class="alloc-title">
        <h2>{{ $t('先天六命分配') }}</h2>
        <p>{{ $t('每项上限') }} {{ maxValue }} · {{ $t('天道点用尽即止') }}</p>
      </div>
      <div class="alloc-actions">
        <button type="button" class="cc-btn small" @click="resetPoints">
          <RotateCcw :size="14" />
          <span>{{ $t('重置') }}</span>
        </button>
        <button type="button" class="cc-btn small" @click="randomizePoints">
          <Dices :size="14" />
          <span>{{ $t('随机') }}</span>
        </button>
        <button type="button" class="cc-btn small" @click="balancePoints">
          <Scale :size="14" />
          <span>{{ $t('均衡') }}</span>
        </button>
      </div>
    </div>

    <div class="attributes-grid">
      <div
        v-for="(value, key) in store.attributes"
        :key="key"
        class="attribute-card"
        :class="{ maxed: value >= maxValue, active: value > minValue }"
      >
        <div class="attr-glyph" aria-hidden="true">
          <img
            class="attr-icon"
            :src="attributeIcons[key as AttributeKey]"
            alt=""
            draggable="false"
          />
        </div>
        <div class="attr-body">
          <div class="attr-head">
            <span class="attr-name">{{ $t(attributeNames[key as AttributeKey]) }}</span>
            <div class="attr-stepper">
              <button
                type="button"
                class="step-btn"
                :aria-label="$t('减少') + ' ' + attributeNames[key as AttributeKey]"
                :disabled="value <= minValue"
                @click="decrement(key as AttributeKey)"
              >
                <Minus :size="14" />
              </button>
              <span class="attr-value">{{ value }}</span>
              <button
                type="button"
                class="step-btn"
                :aria-label="$t('增加') + ' ' + attributeNames[key as AttributeKey]"
                :disabled="store.remainingTalentPoints <= 0 || value >= maxValue"
                @click="increment(key as AttributeKey)"
              >
                <Plus :size="14" />
              </button>
            </div>
          </div>
          <div class="attr-pips" aria-hidden="true">
            <span v-for="n in maxValue" :key="n" class="pip" :class="{ on: n <= value }"></span>
          </div>
          <p class="attr-desc">{{ $t(attributeDescriptions[key as AttributeKey]) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { Dices, Minus, Plus, RotateCcw, Scale } from 'lucide-vue-next'
import { useCharacterCreationStore } from '../../stores/characterCreationStore'
import rootBoneIcon from '../../assets/attribute-icons/root-bone.png'
import spiritualityIcon from '../../assets/attribute-icons/spirituality.png'
import comprehensionIcon from '../../assets/attribute-icons/comprehension.png'
import fortuneIcon from '../../assets/attribute-icons/fortune.png'
import charmIcon from '../../assets/attribute-icons/charm.png'
import temperamentIcon from '../../assets/attribute-icons/temperament.png'

const store = useCharacterCreationStore()

const minValue = 0 // 属性基础值
const maxValue = 10 // 属性最大值

const attributeNames = {
  root_bone: '根骨',
  spirituality: '灵性',
  comprehension: '悟性',
  fortune: '气运',
  charm: '魅力',
  temperament: '心性',
}

const attributeIcons = {
  root_bone: rootBoneIcon,
  spirituality: spiritualityIcon,
  comprehension: comprehensionIcon,
  fortune: fortuneIcon,
  charm: charmIcon,
  temperament: temperamentIcon,
}

const attributeDescriptions = {
  root_bone: '决定气血上限、恢复速度、寿命上限。影响炼体修行、抗打击能力。',
  spirituality: '决定灵气上限、吸收效率。影响修炼速度、法术威力。',
  comprehension: '决定神识上限、学习效率。影响功法领悟、技能掌握速度。',
  fortune: '决定各种概率、物品掉落品质。影响天材地宝获取、贵人相助。',
  charm: '决定初始好感度、社交加成。影响NPC互动、门派声望获取。',
  temperament: '决定心魔抗性、意志力。影响走火入魔抵抗、关键抉择。',
}

type AttributeKey = keyof typeof attributeNames

function increment(key: AttributeKey) {
  if (store.remainingTalentPoints > 0 && store.attributes[key] < maxValue) {
    store.setAttribute(key, store.attributes[key] + 1)
  }
}

function decrement(key: AttributeKey) {
  if (store.attributes[key] > minValue) {
    store.setAttribute(key, store.attributes[key] - 1)
  }
}

function resetPoints() {
  // 重置所有属性为最小值 0
  Object.keys(store.attributes).forEach((key) => {
    store.setAttribute(key as AttributeKey, 0)
  })
}

function randomizePoints() {
  // 先重置所有属性为基础值
  resetPoints()

  // 获取可用于分配的点数 (初始天道点)
  let pointsToAllocate = store.remainingTalentPoints
  const attributeKeys = Object.keys(store.attributes) as AttributeKey[]

  // 随机分配点数
  while (pointsToAllocate > 0) {
    const randomKey = attributeKeys[Math.floor(Math.random() * attributeKeys.length)]
    const currentValue = store.attributes[randomKey]
    
    if (currentValue < maxValue) {
      store.setAttribute(randomKey, currentValue + 1)
      pointsToAllocate--
    }

    // 防止死循环：如果所有属性都达到最大值则停止
    const allMaxed = attributeKeys.every((key) => store.attributes[key] >= maxValue)
    if (allMaxed) {
      break
    }
  }
}

function balancePoints() {
  // 先重置所有属性
  resetPoints()

  // 获取可用点数，如果为负数则不分配
  const availablePoints = Math.max(0, store.remainingTalentPoints)
  if (availablePoints <= 0) return

  // 计算每个属性应分配的基础点数
  const attributeCount = Object.keys(store.attributes).length
  const pointsPerAttribute = Math.floor(availablePoints / attributeCount)
  let extraPoints = availablePoints % attributeCount

  // 均衡分配点数
  const attributeKeys = Object.keys(store.attributes) as AttributeKey[]
  attributeKeys.forEach((key) => {
    // 基础分配
    let pointsToAdd = pointsPerAttribute
    // 如果有余数，前面几个属性多分配1点
    if (extraPoints > 0) {
      pointsToAdd++
      extraPoints--
    }
    // 确保不超过最大值
    const finalValue = Math.min(minValue + pointsToAdd, maxValue)
    store.setAttribute(key, finalValue)
  })
}

onMounted(() => {
  // 不再自动重置，保留用户之前的选择
  // 如果用户需要重置，可以手动点击"重置"按钮
})
</script>

<style scoped>
/* 先天六命：颜色令牌见 styles/creation-theme.css */
.attribute-allocation-container {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  max-width: 1080px;
  margin: 0 auto;
}

.alloc-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.alloc-title h2 {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 1.9rem;
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--cc-text);
}

.alloc-title p {
  margin: 0.2rem 0 0;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  color: var(--cc-text-3);
}

.alloc-actions {
  display: flex;
  gap: 0.5rem;
}

.attributes-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem 0.85rem;
}

.attribute-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-height: 112px;
  padding: 0.8rem 1.05rem;
  border: 1px solid var(--cc-border);
  border-radius: 10px;
  background: var(--cc-surface);
  transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
}

.attribute-card:hover {
  background: var(--cc-surface-2);
}

.attribute-card.active {
  border-color: rgba(var(--cc-gold-rgb), 0.35);
}

.attribute-card.maxed {
  border-color: rgba(var(--cc-gold-rgb), 0.7);
  box-shadow: 0 0 20px -8px rgba(var(--cc-gold-rgb), 0.7);
}

/* 玉璧图标 */
.attr-glyph {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 66px;
  height: 66px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(var(--cc-accent-rgb), 0.22) 0%, rgba(var(--cc-accent-rgb), 0.05) 75%);
  box-shadow: 0 0 0 1px rgba(var(--cc-gold-rgb), 0.45);
  color: var(--cc-accent);
}

.attr-icon {
  display: block;
  width: 60px;
  height: 60px;
  object-fit: contain;
  filter: drop-shadow(0 1px 1px rgba(var(--cc-accent-rgb), 0.18));
  transition: transform 0.25s ease, filter 0.25s ease;
}

.attribute-card:hover .attr-icon {
  transform: scale(1.08) rotate(-4deg);
  filter: drop-shadow(0 2px 3px rgba(var(--cc-accent-rgb), 0.3));
}

.attr-glyph::before {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.35);
  transition: transform 0.6s ease;
}

.attribute-card:hover .attr-glyph::before {
  transform: rotate(90deg);
}

.attr-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.attr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.attr-name {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: var(--cc-text);
}

.attr-stepper {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 2px;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-inset);
}

.step-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--cc-text-2);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.step-btn:hover:not(:disabled) {
  background: var(--cc-surface-hover);
  color: var(--cc-accent);
}

.step-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.step-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(var(--cc-accent-rgb), 0.45);
}

.attr-value {
  min-width: 1.8rem;
  text-align: center;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--cc-gold);
  font-variant-numeric: tabular-nums;
}

.attr-pips {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 3px;
}

.pip {
  height: 4px;
  border-radius: 1px;
  background: var(--cc-divider);
  transition: background 0.25s ease, box-shadow 0.25s ease;
}

.pip.on {
  background: linear-gradient(90deg, rgba(var(--cc-gold-rgb), 0.7), var(--cc-gold));
  box-shadow: 0 0 6px rgba(var(--cc-gold-rgb), 0.45);
}

.attr-desc {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.45;
  color: var(--cc-text-2);
}

@media (max-width: 720px) {
  .attributes-grid {
    grid-template-columns: 1fr;
  }

  .alloc-title h2 {
    font-size: 1.5rem;
  }

  .alloc-actions {
    width: 100%;
  }

  .alloc-actions .cc-btn {
    flex: 1;
  }

  .attr-glyph {
    width: 52px;
    height: 52px;
  }

  .attr-icon {
    width: 46px;
    height: 46px;
  }
}
</style>
