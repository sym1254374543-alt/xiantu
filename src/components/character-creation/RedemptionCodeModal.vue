<template>
  <div v-if="visible" class="cc-modal-overlay" @click.self="handleClose">
    <div class="cc-modal" role="dialog" aria-modal="true">
      <!-- 第一步：输入兑换码 -->
      <template v-if="currentStep === 'code'">
        <div class="cc-modal-head">
          <h2 class="cc-modal-title">{{ title }}</h2>
          <button type="button" class="cc-modal-close" :aria-label="$t('关闭')" @click="handleClose">
            <X :size="18" />
          </button>
        </div>
        <form class="code-form" @submit.prevent="submitCode">
          <div class="cc-modal-body">
            <p class="cc-hint">{{ $t('请输入兑换码以接引天机进行AI推演。') }}</p>
            <input
              ref="inputRef"
              v-model="code"
              type="text"
              class="cc-input code-input"
              :placeholder="$t('请输入兑换码')"
            />
            <div v-if="error" class="cc-errors">{{ error }}</div>
          </div>
          <div class="cc-modal-foot">
            <button type="button" class="cc-btn" @click="handleClose">{{ $t('取消') }}</button>
            <button type="submit" class="cc-btn primary" :disabled="!code.trim() || isValidating">
              <Loader2 v-if="isValidating" :size="15" class="cc-spin" />
              <span>{{ isValidating ? $t('验证中...') : $t('下一步') }}</span>
            </button>
          </div>
        </form>
      </template>

      <!-- 第二步：输入提示词 -->
      <template v-else-if="currentStep === 'prompt'">
        <div class="cc-modal-head">
          <h2 class="cc-modal-title">{{ $t('自定义AI推演') }}</h2>
          <button type="button" class="cc-modal-close" :aria-label="$t('关闭')" @click="handleClose">
            <X :size="18" />
          </button>
        </div>
        <div class="cc-modal-body">
          <p class="cc-hint">{{ getPromptHint() }}</p>
          <div class="cc-field">
            <label for="redemption-prompt">{{ $t('提示词 (可选)') }}</label>
            <textarea
              id="redemption-prompt"
              v-model="userPrompt"
              class="cc-input"
              :placeholder="getPlaceholderText()"
              rows="4"
              maxlength="500"
              @keyup.ctrl.enter="submitPrompt"
            />
            <div class="char-count">{{ userPrompt.length }}/500</div>
          </div>

          <div v-if="getSuggestedPrompts().length > 0" class="suggestions">
            <h4 class="cc-section-title">{{ $t('建议提示词') }}</h4>
            <div class="suggestions-grid">
              <button
                v-for="suggestion in getSuggestedPrompts()"
                :key="suggestion"
                type="button"
                class="suggestion-chip"
                :class="{ active: userPrompt === suggestion }"
                @click="userPrompt = suggestion"
              >
                {{ suggestion }}
              </button>
            </div>
          </div>
        </div>
        <div class="cc-modal-foot">
          <button type="button" class="cc-btn" @click="goBack">{{ $t('返回') }}</button>
          <button type="button" class="cc-btn primary" @click="submitPrompt">
            <Sparkles :size="15" />
            <span>{{ $t('开始推演') }}</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { Loader2, Sparkles, X } from 'lucide-vue-next';

const props = defineProps<{
  visible: boolean;
  title: string;
  type?: 'world' | 'talent_tier' | 'origin' | 'spirit_root' | 'talent';
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', data: { code: string; prompt?: string }): void;
}>();

const code = ref('');
const userPrompt = ref('');
const error = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const currentStep = ref<'code' | 'prompt'>('code');
const isValidating = ref(false);

// 根据类型提供不同的提示和建议
const getPromptHint = () => {
  const hints = {
    world: '描述你希望的世界风格、时代背景或特色设定（可含对话，使用中文引号“”，每句仅一对）',
    talent_tier: '描述你希望的天资类型、特点或能力倾向（可含对话，使用中文引号“”，每句仅一对）',  
    origin: '描述你希望的出身背景、家族或成长环境（可含对话，使用中文引号“”，每句仅一对）',
    spirit_root: '描述你希望的灵根属性、特色或修炼倾向（可含对话，使用中文引号“”，每句仅一对）',
    talent: '描述你希望的天赋能力、特殊技能或神通（可含对话，使用中文引号“”，每句仅一对）'
  };
  return hints[props.type || 'world'] || '请输入自定义提示词';
};

const getPlaceholderText = () => {
  const placeholders = {
    world: '例如：现代都市修仙世界，灵气复苏，科技与修真并存...',
    talent_tier: '例如：擅长炼丹制器的天才，拥有超强的感知能力...',
    origin: '例如：修仙世家的没落子弟，身负血海深仇...',
    spirit_root: '例如：罕见的雷属性变异灵根，天生引雷...',
    talent: '例如：能够看透事物本质的天眼神通...'
  };
  return placeholders[props.type || 'world'] || '请输入提示词...';
};

const getSuggestedPrompts = () => {
  const suggestions = {
    world: [
      '现代都市修仙，灵气复苏',
      '古代仙侠世界，门派林立', 
      '末法时代，修真没落',
      '星际修仙，宇宙征途'
    ],
    talent_tier: [
      '天生剑心，剑道天才',
      '丹道奇才，炼丹天赋',
      '阵法大师，天机推算',
      '体修霸体，肉身无双'
    ],
    origin: [
      '修仙世家的没落子弟',
      '凡人出身的天选之子',
      '魔门弟子改邪归正',
      '上古传承的最后血脉'
    ],
    spirit_root: [
      '雷属性变异灵根',
      '罕见的时间属性',
      '混沌属性至尊灵根',
      '五行俱全的废柴灵根'
    ],
    talent: [
      '透视本质的天眼神通',
      '预知未来的天机术',
      '不死不灭的重生能力',
      '操控时空的神级天赋'
    ]
  };
  return suggestions[props.type || 'world'] || [];
};

watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    resetModal();
    nextTick(() => {
      inputRef.value?.focus();
    });
  }
});

const resetModal = () => {
  error.value = '';
  code.value = '';
  userPrompt.value = '';
  currentStep.value = 'code';
  isValidating.value = false;
};

const handleClose = () => {
  resetModal();
  emit('close');
};

const goBack = () => {
  currentStep.value = 'code';
  error.value = '';
};

const submitCode = async () => {
  if (!code.value.trim()) {
    error.value = '兑换码不可为空。';
    return;
  }
  
  // 这里可以添加兑换码预验证逻辑
  isValidating.value = true;
  error.value = '';
  
  try {
    // 模拟验证过程
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 验证通过，进入提示词输入步骤
    currentStep.value = 'prompt';
  } catch {
    error.value = '兑换码验证失败，请检查后重试。';
  } finally {
    isValidating.value = false;
  }
};

const submitPrompt = () => {
  // 提交兑换码和提示词
  emit('submit', { 
    code: code.value.trim(), 
    prompt: userPrompt.value.trim() || undefined 
  });
  resetModal();
};
</script>

<style scoped>
/* 外观见 styles/creation-theme.css 的 cc-modal */
.code-form {
  display: contents;
}

.code-input {
  font-size: 1.05rem;
  letter-spacing: 0.2em;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.char-count {
  font-size: 0.72rem;
  text-align: right;
  color: var(--cc-text-3);
}

.suggestions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.suggestion-chip {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--cc-border-strong);
  border-radius: 999px;
  background: var(--cc-surface-2);
  color: var(--cc-text-2);
  font-family: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.suggestion-chip:hover,
.suggestion-chip.active {
  color: var(--cc-accent);
  border-color: rgba(var(--cc-gold-rgb), 0.65);
  background: var(--cc-surface-hover);
}
</style>
