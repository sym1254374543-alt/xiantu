<template>
  <div class="preview-container">
    <header class="preview-header">
      <h2 class="title">{{ $t('最终预览') }}</h2>
      <p class="subtitle">{{ $t('请确认你的选择，此为踏入仙途的最后一步。') }}</p>
    </header>

    <!-- 法身：可编辑信息 -->
    <section class="preview-section">
      <h3 class="cc-section-title">{{ $t('法身') }}</h3>
      <div class="form-grid">
        <label class="field" for="characterName">
          <span class="field-label">{{ $t('道号') }} <em>{{ $t('可自定义修改') }}</em></span>
          <input
            id="characterName"
            v-model="store.characterPayload.character_name"
            type="text"
            class="cc-input name-input"
            :placeholder="$t('请输入道号')"
          />
        </label>

        <label class="field" for="characterRace">
          <span class="field-label">{{ $t('种族') }}</span>
          <input
            id="characterRace"
            v-model="store.characterPayload.race"
            type="text"
            class="cc-input"
            :placeholder="$t('人族')"
            @mousedown.stop
            @click.stop
            @select.stop
          />
        </label>

        <div class="field">
          <span class="field-label">{{ $t('性别') }}</span>
          <div class="cc-segmented" role="radiogroup" :aria-label="$t('性别')">
            <label v-for="g in genderOptions" :key="g">
              <input v-model="store.characterPayload.gender" type="radio" name="gender" :value="g" />
              <span>{{ $t(g) }}</span>
            </label>
          </div>
        </div>

        <div class="field">
          <span class="field-label">{{ $t('初始年龄') }}</span>
          <div class="age-control">
            <button
              type="button"
              class="age-btn"
              :aria-label="$t('减少')"
              :disabled="store.characterPayload.current_age <= 0"
              @click="decrementAge"
            >
              <Minus :size="14" />
            </button>
            <input
              v-model.number="store.characterPayload.current_age"
              type="number"
              class="age-input"
              min="0"
              :aria-label="$t('初始年龄')"
              @input="validateAge"
            />
            <span class="age-unit">{{ $t('岁') }}</span>
            <button type="button" class="age-btn" :aria-label="$t('增加')" @click="incrementAge">
              <Plus :size="14" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 开局设定 -->
    <section class="preview-section">
      <h3 class="cc-section-title">{{ $t('开局设定') }}</h3>
      <div class="form-grid">
        <div class="field">
          <span class="field-label">{{ $t('开局模式') }}</span>
          <div class="cc-segmented" role="radiogroup" :aria-label="$t('开局模式')">
            <label>
              <input v-model="store.useStreamingStart" type="radio" name="startMode" :value="true" />
              <span>{{ $t('流式开局') }}</span>
            </label>
            <label>
              <input v-model="store.useStreamingStart" type="radio" name="startMode" :value="false" />
              <span>{{ $t('非流式开局') }}</span>
            </label>
          </div>
          <p class="field-hint">
            {{ store.useStreamingStart ? $t('流式开局：更快，可能被中断') : $t('非流式开局：一次性生成完整内容，更稳定可靠') }}
          </p>
        </div>

        <div class="field">
          <span class="field-label">{{ $t('生成方式') }}</span>
          <div class="cc-segmented" role="radiogroup" :aria-label="$t('生成方式')">
            <label>
              <input v-model="store.splitResponseGeneration" type="radio" name="splitMode" :value="false" />
              <span>{{ $t('一次性生成') }}</span>
            </label>
            <label>
              <input v-model="store.splitResponseGeneration" type="radio" name="splitMode" :value="true" />
              <span>{{ $t('分步生成') }}</span>
            </label>
          </div>
          <p class="field-hint">
            {{ store.splitResponseGeneration ? $t('分步生成：先写正文，再单独生成指令；多一次调用，但指令更不易出错，适合常输出格式错误的模型') : $t('一次性生成：一次调用同时写出正文与指令，更快、更省额度') }}
          </p>
        </div>
      </div>
    </section>

    <!-- 命格总览 -->
    <section class="preview-section">
      <h3 class="cc-section-title">{{ $t('命格总览') }}</h3>
      <div class="fate-grid">
        <article class="fate-card">
          <span class="fate-label">{{ $t('所选世界') }}</span>
          <h4 class="fate-name">{{ store.selectedWorld?.name || $t('未选择') }}</h4>
          <p class="fate-desc">{{ store.selectedWorld?.description || $t('暂无描述') }}</p>
        </article>

        <article
          class="fate-card tier-card"
          :style="{ '--tier-color': store.selectedTalentTier?.color || 'var(--cc-text)' }"
        >
          <span class="fate-label">{{ $t('天资') }}</span>
          <h4 class="fate-name">{{ store.selectedTalentTier?.name || $t('未选择') }}</h4>
          <p class="fate-desc">{{ store.selectedTalentTier?.description || $t('暂无描述') }}</p>
        </article>

        <article class="fate-card">
          <span class="fate-label">{{ $t('出身') }}</span>
          <h4 class="fate-name">{{ store.selectedOrigin?.name || $t('随机出身') }}</h4>
          <p class="fate-desc">{{ store.selectedOrigin?.description || $t('暂无描述') }}</p>
        </article>

        <article class="fate-card">
          <span class="fate-label">{{ $t('灵根') }}</span>
          <h4 class="fate-name">{{ store.selectedSpiritRoot?.name || $t('随机灵根') }}</h4>
          <p class="fate-desc">{{ store.selectedSpiritRoot?.description || $t('暂无描述') }}</p>
        </article>

        <article class="fate-card wide">
          <span class="fate-label">{{ $t('天赋') }}</span>
          <ul v-if="store.selectedTalents.length" class="talent-list">
            <li v-for="talent in store.selectedTalents" :key="talent.id">
              <strong>{{ talent.name }}</strong>
              <span>{{ talent.description }}</span>
            </li>
          </ul>
          <p v-else class="fate-desc">{{ $t('未选择任何天赋') }}</p>
        </article>

        <article v-if="props.isLocalCreation" class="fate-card wide">
          <span class="fate-label">{{ $t('先天六司') }}</span>
          <div class="attr-row">
            <div v-for="attr in attributeSummary" :key="attr.key" class="attr-cell">
              <span class="attr-cell-name">{{ $t(attr.label) }}</span>
              <span class="attr-cell-value">{{ store.attributes[attr.key] }}</span>
            </div>
          </div>
        </article>

        <article v-else class="fate-card wide">
          <span class="fate-label">{{ $t('命格天定') }}</span>
          <p class="fate-desc">
            {{ $t('联机模式下，角色的初始命格将由所选世界的天道法则在云端生成，以确保公平与平衡。') }}
          </p>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'
import { useCharacterCreationStore } from '../../stores/characterCreationStore'

const store = useCharacterCreationStore()

const props = defineProps<{
  isLocalCreation: boolean
}>()

const genderOptions = ['男', '女', '双性'] as const

const attributeSummary = [
  { key: 'root_bone', label: '根骨' },
  { key: 'spirituality', label: '灵性' },
  { key: 'comprehension', label: '悟性' },
  { key: 'fortune', label: '气运' },
  { key: 'charm', label: '魅力' },
  { key: 'temperament', label: '心性' },
] as const

// 从酒馆获取当前Persona名字（只在名字为空时获取，避免重试时覆盖）
onMounted(async () => {
  // 如果已经有名字了，不要重新获取（避免重试时覆盖）
  if (store.characterPayload.character_name && store.characterPayload.character_name !== '无名者' && store.characterPayload.character_name.trim() !== '') {
    console.log('[Step7_Preview] 已有角色名字，跳过获取:', store.characterPayload.character_name)
    return
  }

  // 尝试从酒馆获取名字
  let nameObtained = false

  try {
    // 直接检查原生 TavernHelper 是否存在
    const nativeTavernHelper = typeof window !== 'undefined' ? (window as any).TavernHelper : null

    if (nativeTavernHelper) {
      // 方法1: 使用 substitudeMacros 解析 {{user}} 宏
      if (!nameObtained && typeof nativeTavernHelper.substitudeMacros === 'function') {
        try {
          const personaName = await nativeTavernHelper.substitudeMacros('{{user}}')
          console.log('[Step7_Preview] substitudeMacros {{user}} ->', personaName)

          if (personaName && personaName !== '{{user}}' && typeof personaName === 'string' && personaName.trim()) {
            store.characterPayload.character_name = personaName.trim()
            console.log('[Step7_Preview] ✅ 从酒馆宏获取用户名字:', personaName)
            nameObtained = true
          }
        } catch (e) {
          console.warn('[Step7_Preview] ⚠️ substitudeMacros 失败:', e)
        }
      }

      // 方法2: 从全局变量获取
      if (!nameObtained && typeof nativeTavernHelper.getVariables === 'function') {
        try {
          const vars = await nativeTavernHelper.getVariables({ type: 'global' })
          const fallbackName = vars['persona.name'] || vars['name'] || vars['user_name'] || vars['user']
          console.log('[Step7_Preview] 全局变量中的名字:', fallbackName)

          if (fallbackName && typeof fallbackName === 'string' && fallbackName.trim()) {
            store.characterPayload.character_name = fallbackName.trim()
            console.log('[Step7_Preview] ✅ 从全局变量获取名字:', fallbackName)
            nameObtained = true
          }
        } catch (e) {
          console.warn('[Step7_Preview] ⚠️ getVariables 失败:', e)
        }
      }

      // 方法3: 从角色数据获取
      if (!nameObtained && typeof nativeTavernHelper.getCharData === 'function') {
        try {
          const charData = await nativeTavernHelper.getCharData()
          if (charData?.name && typeof charData.name === 'string' && charData.name.trim()) {
            store.characterPayload.character_name = charData.name.trim()
            console.log('[Step7_Preview] ✅ 从角色数据获取名字:', charData.name)
            nameObtained = true
          }
        } catch (e) {
          console.warn('[Step7_Preview] ⚠️ getCharData 失败:', e)
        }
      }
    } else {
      console.log('[Step7_Preview] 非酒馆模式，跳过名字获取')
    }
  } catch (error) {
    console.error('[Step7_Preview] ❌ 无法从酒馆获取Persona名字:', error)
  }

  // 如果未能获取到名字，清空默认值让用户自行输入
  if (!nameObtained) {
    store.characterPayload.character_name = ''
    console.log('[Step7_Preview] 📝 未获取到名字，请用户自行输入道号')
  }
})

const incrementAge = () => {
  store.characterPayload.current_age++
}

const decrementAge = () => {
  if (store.characterPayload.current_age > 0) {
    store.characterPayload.current_age--
  }
}

const validateAge = () => {
  // 确保年龄不为负数
  if (store.characterPayload.current_age < 0) {
    store.characterPayload.current_age = 0
  }
  // 确保年龄是整数
  store.characterPayload.current_age = Math.floor(store.characterPayload.current_age)
}
</script>

<style scoped>
/* 最终预览：颜色令牌见 styles/creation-theme.css */
.preview-container {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  max-width: 1000px;
  margin: 0 auto;
}

.preview-header {
  text-align: center;
}

.title {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 2.2rem;
  font-weight: 400;
  letter-spacing: 0.2em;
  color: var(--cc-text);
}

.subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  color: var(--cc-text-3);
}

.preview-section {
  margin: 0;
}

/* ---------- 表单 ---------- */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.field-label {
  font-size: 0.8rem;
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

.field-label em {
  margin-left: 0.4rem;
  font-style: normal;
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  color: var(--cc-text-3);
}

.name-input {
  font-family: var(--cc-calligraphy);
  font-size: 1.2rem;
  letter-spacing: 0.1em;
}

.field-hint {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--cc-text-3);
}

/* 年龄 */
.age-control {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 3px;
  border: 1px solid var(--cc-border-strong);
  border-radius: 6px;
  background: var(--cc-inset);
}

.age-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--cc-text-2);
  cursor: pointer;
}

.age-btn:hover:not(:disabled) {
  background: var(--cc-surface-hover);
  color: var(--cc-accent);
}

.age-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.age-input {
  flex: 1;
  min-width: 0;
  padding: 0.25rem;
  border: none;
  background: transparent;
  color: var(--cc-gold);
  font-family: inherit;
  font-size: 1.05rem;
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
  appearance: textfield;
  -moz-appearance: textfield;
}

.age-input::-webkit-outer-spin-button,
.age-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.age-input:focus {
  outline: none;
}

.age-unit {
  font-size: 0.8rem;
  color: var(--cc-text-3);
  padding-right: 0.25rem;
}

/* ---------- 命格总览 ---------- */
.fate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.fate-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  padding: 0.95rem 1.1rem;
  border: 1px solid var(--cc-border);
  border-radius: 10px;
  background: var(--cc-surface);
}

.fate-card::before {
  content: '';
  position: absolute;
  top: 0.95rem;
  bottom: 0.95rem;
  left: 0;
  width: 2px;
  background: linear-gradient(180deg, var(--cc-gold), transparent);
  opacity: 0.7;
}

.fate-card.wide {
  grid-column: 1 / -1;
}

.fate-label {
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  color: var(--cc-gold);
}

.fate-name {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 1.45rem;
  font-weight: 400;
  letter-spacing: 0.08em;
  color: var(--cc-text);
}

.tier-card .fate-name {
  color: var(--tier-color);
}

[data-theme='light'] .tier-card .fate-name {
  color: color-mix(in srgb, var(--tier-color) 55%, #221d16);
}

.fate-desc {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.7;
  color: var(--cc-text-2);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fate-card.wide .fate-desc {
  -webkit-line-clamp: unset;
  display: block;
}

.talent-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 1rem;
  margin: 0.25rem 0 0;
  padding: 0;
  list-style: none;
}

.talent-list li {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--cc-divider);
  border-radius: 6px;
  background: var(--cc-surface-2);
}

.talent-list strong {
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  color: var(--cc-accent);
}

.talent-list span {
  font-size: 0.76rem;
  line-height: 1.55;
  color: var(--cc-text-3);
}

.attr-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.attr-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.55rem 0.25rem;
  border: 1px solid var(--cc-divider);
  border-radius: 6px;
  background: var(--cc-surface-2);
}

.attr-cell-name {
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  color: var(--cc-text-3);
}

.attr-cell-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--cc-gold);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 720px) {
  .form-grid,
  .fate-grid,
  .talent-list {
    grid-template-columns: 1fr;
  }

  .attr-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .title {
    font-size: 1.7rem;
  }
}
</style>
