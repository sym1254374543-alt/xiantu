<template>
  <div class="origin-selection-container">
    <div v-if="store.isLoading" class="cc-state">{{ $t('追溯过往，探寻出身...') }}</div>
    <div v-else-if="store.error" class="cc-state error">{{ $t('因果不明') }}：{{ store.error }}</div>

    <div v-else class="cc-split">
      <!-- 左侧：出身列表 -->
      <div class="cc-panel">
        <div class="cc-actions">
          <button v-if="store.isLocalCreation" type="button" class="cc-action" @click="isCustomModalVisible = true">
            <PenLine :size="14" />
            <span>{{ $t('自定义出身') }}</span>
          </button>
          <button type="button" class="cc-action" @click="handleAIGenerate">
            <Sparkles :size="14" />
            <span>{{ $t('AI推演') }}</span>
          </button>
        </div>

        <div class="cc-list" @mouseleave="resetActiveOrigin">
          <div
            class="cc-item random-item"
            role="button"
            tabindex="0"
            :class="{ selected: isRandomSelected }"
            @click="handleSelectRandom"
            @keydown.enter.prevent="handleSelectRandom"
            @mouseover="activeOrigin = 'random'"
            @focus="activeOrigin = 'random'"
          >
            <div class="cc-item-main">
              <span class="random-name">
                <Dices :size="15" class="random-icon" />
                <span class="cc-item-name">{{ $t('随机出身') }}</span>
              </span>
              <span class="cc-item-meta">{{ $t('0 点') }}</span>
            </div>
          </div>
          <div class="cc-divider"></div>
          <div
            v-for="origin in filteredOrigins"
            :key="origin.id"
            class="cc-item"
            role="button"
            :tabindex="canSelect(origin) ? 0 : -1"
            :aria-disabled="!canSelect(origin)"
            :class="{
              selected: store.characterPayload.origin_id === origin.id,
              disabled: !canSelect(origin),
            }"
            @click="handleSelectOrigin(origin)"
            @keydown.enter.prevent="handleSelectOrigin(origin)"
            @mouseover="activeOrigin = origin"
            @focus="activeOrigin = origin"
          >
            <div class="cc-item-main">
              <span class="cc-item-name">{{ origin.name }}</span>
              <span class="cc-item-meta">{{ origin.talent_cost }} {{ $t('点') }}</span>
            </div>
            <div v-if="origin.source === 'cloud' && store.isLocalCreation" class="cc-item-tools">
              <button type="button" class="cc-icon-btn" :title="$t('编辑此项')" @click.stop="openEditModal(origin)">
                <Edit :size="13" />
              </button>
              <button type="button" class="cc-icon-btn danger" :title="$t('删除此项')" @click.stop="handleDeleteOrigin(origin.id)">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：出身详情 -->
      <div class="cc-panel cc-detail">
        <div v-if="activeOrigin" class="cc-detail-inner">
          <div class="cc-detail-head">
            <h2 class="cc-detail-title">{{ activeDisplayName }}</h2>
          </div>
          <div class="cc-detail-rule"></div>
          <div class="cc-detail-body">
            <p>{{ activeDescription }}</p>
          </div>
          <div class="cc-stat-row">
            <span class="cc-stat">{{ $t('消耗天道点') }} <strong>{{ activeCost }}</strong></span>
          </div>
        </div>
        <div v-else class="cc-placeholder">{{ $t('请选择一处出身，或听天由命。') }}</div>
      </div>
    </div>

    <CustomCreationModal
      :visible="isCustomModalVisible"
      :title="$t('自定义出身')"
      :fields="customOriginFields"
      :validationFn="validateCustomOrigin"
      @close="isCustomModalVisible = false"
      @submit="handleCustomSubmit"
    />

    <!-- 编辑模态框 -->
    <CustomCreationModal
      :visible="isEditModalVisible"
      :title="$t('编辑出身')"
      :fields="customOriginFields"
      :validationFn="validateCustomOrigin"
      :initialData="editInitialData"
      @close="isEditModalVisible = false; editingOrigin = null"
      @submit="handleEditSubmit"
    />

    <!-- AI推演输入弹窗 -->
    <AIPromptModal
      :visible="isAIPromptModalVisible"
      @close="isAIPromptModalVisible = false"
      @submit="handleAIPromptSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Trash2, Edit, PenLine, Sparkles, Dices } from 'lucide-vue-next'
import { useCharacterCreationStore } from '../../stores/characterCreationStore'
import type { Origin } from '../../types'
import CustomCreationModal, { type ModalField } from './CustomCreationModal.vue'
import AIPromptModal from './AIPromptModal.vue'
import { toast } from '../../utils/toast'
import { generateWithRawPrompt } from '../../utils/tavernCore'
import { ORIGIN_ITEM_GENERATION_PROMPT } from '../../utils/prompts/tasks/gameElementPrompts'
import { parseJsonFromText } from '@/utils/jsonExtract'

const emit = defineEmits(['ai-generate'])
const store = useCharacterCreationStore()
// 详情区显示的出身：默认为当前选择（未选具体出身即为随机），悬停时预览
const currentOriginChoice = (): Origin | 'random' | null =>
  store.selectedOrigin ?? (store.characterPayload.origin_id === null ? 'random' : null)
const activeOrigin = ref<Origin | 'random' | null>(currentOriginChoice())
const resetActiveOrigin = () => {
  activeOrigin.value = currentOriginChoice() ?? activeOrigin.value
}
const isCustomModalVisible = ref(false)
const isEditModalVisible = ref(false)
const isAIPromptModalVisible = ref(false)
const editingOrigin = ref<Origin | null>(null)

const filteredOrigins = computed(() => {
  const allOrigins = store.creationData.origins;
  console.log("【出身选择】所有出身数据:", allOrigins);
  console.log("【出身选择】当前模式:", store.isLocalCreation ? '本地' : '联机');

  if (store.isLocalCreation) {
    // 单机模式显示本地数据和云端同步的数据
    const availableOrigins = allOrigins.filter(origin =>
      origin.source === 'local' || origin.source === 'cloud'
    );
    console.log("【出身选择】单机模式可用出身列表:", availableOrigins);
    return availableOrigins;
  } else {
    const cloudOrigins = allOrigins.filter(origin =>
      origin.source === 'cloud'
    );
    console.log("【出身选择】联机模式出身列表:", cloudOrigins);
    console.log("【出身选择】云端出身数量:", cloudOrigins.length);

    if (cloudOrigins.length === 0) {
      console.warn("【出身选择】警告：联机模式下没有找到云端出身数据！");
      console.log("【出身选择】所有出身的source分布:", allOrigins.reduce((acc: Record<string, number>, o) => {
        acc[o.source] = (acc[o.source] || 0) + 1;
        return acc;
      }, {}));
    }

    return cloudOrigins;
  }
});

// 先天属性选项 - 出身影响的是先天属性
const _attributeOptions = [
  { value: 'root_bone', label: '先天根骨' },
  { value: 'spirit', label: '先天灵性' },
  { value: 'comprehension', label: '先天悟性' },
  { value: 'luck', label: '先天气运' },
  { value: 'charm', label: '先天魅力' },
  { value: 'temperament', label: '先天心性' }
] as const

// 调整数值选项
const _modifierOptions = [
  { value: '-3', label: '-3' },
  { value: '-2', label: '-2' },
  { value: '-1', label: '-1' },
  { value: '0', label: '0' },
  { value: '1', label: '+1' },
  { value: '2', label: '+2' },
  { value: '3', label: '+3' },
  { value: '4', label: '+4' },
  { value: '5', label: '+5' }
] as const


// 自定义出身字段 - 重新设计为背景设定
// 根据 types/index.ts 中的 Origin 接口定义字段
const customOriginFields: ModalField[] = [
  { key: 'name', label: '出身名称', type: 'text', placeholder: '例如：山野遗孤' },
  { key: 'description', label: '出身描述', type: 'textarea', placeholder: '描述此出身的背景故事和成长经历...' },
  { key: 'talent_cost', label: '天道点消耗', type: 'number', placeholder: '选择此出身需要消耗的天道点，可为负数表示奖励' },
  { key: 'rarity', label: '稀有度', type: 'number', placeholder: '1-10，数值越高越稀有' },
  {
    key: 'attribute_modifiers',
    label: '属性修正',
    type: 'dynamic-list',
    columns: [
      {
        key: 'attribute',
        placeholder: '属性名称',
        type: 'select',
        options: [
          { value: '根骨', label: '根骨' },
          { value: '灵性', label: '灵性' },
          { value: '悟性', label: '悟性' },
          { value: '气运', label: '气运' },
          { value: '魅力', label: '魅力' },
          { value: '心性', label: '心性' }
        ]
      },
      { key: 'value', placeholder: '修正值（可为负数）', type: 'text' }
    ]
  },
  {
    key: 'background_effects',
    label: '背景效果',
    type: 'dynamic-list',
    columns: [
      { key: 'type', placeholder: '效果类型（如：技能、资源、关系）' },
      { key: 'description', placeholder: '效果描述' }
    ]
  }
] as const

// 为自定义出身数据定义完整类型
type CustomOriginData = {
  name: string;
  description: string;
  talent_cost: string | number;
  rarity: string | number;
  attribute_modifiers: Array<{ attribute: string; value: string }>;
  background_effects: Array<{ type: string; description: string }>;
};

function validateCustomOrigin(data: Partial<CustomOriginData>) {
    const errors: Record<string, string> = {};

    // 必填字段验证
    if (!data.name?.trim()) errors.name = '出身名称不可为空';
    if (!data.description?.trim()) errors.description = '出身描述不可为空';

    // 数值字段验证
    const talentCost = Number(data.talent_cost);
    if (data.talent_cost !== undefined && data.talent_cost !== '' && isNaN(talentCost)) {
      errors.talent_cost = '天道点消耗必须是数字';
    }

    const rarity = Number(data.rarity);
    if (data.rarity !== undefined && data.rarity !== '' && (isNaN(rarity) || rarity < 1 || rarity > 10)) {
      errors.rarity = '稀有度必须在1-10之间';
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors: Object.values(errors),
    };
}

async function handleCustomSubmit(data: CustomOriginData) {
  // 处理属性修正：将数组转换为对象格式
  const attributeModifiers: Record<string, number> = {};
  if (Array.isArray(data.attribute_modifiers)) {
    data.attribute_modifiers.forEach(mod => {
      if (mod.attribute && mod.value) {
        attributeModifiers[mod.attribute] = Number(mod.value) || 0;
      }
    });
  }

  // 处理背景效果
  const backgroundEffects = Array.isArray(data.background_effects)
    ? data.background_effects.filter(effect => effect.type && effect.description)
    : [];

  // 创建完整的标准化出身对象
  const newOrigin: Origin = {
    id: Date.now(),
    name: data.name,
    description: data.description,
    talent_cost: Number(data.talent_cost) || 0,
    attribute_modifiers: attributeModifiers,
    background_effects: backgroundEffects,
    rarity: Number(data.rarity) || 1,
    source: 'local' as const,
  }

  try {
    store.addOrigin(newOrigin);
    handleSelectOrigin(newOrigin);
    isCustomModalVisible.value = false;
    toast.success(`自定义出身 "${newOrigin.name}" 已保存！`);
  } catch (e) {
    console.error('保存自定义出身失败:', e);
    toast.error('保存自定义出身失败！');
  }
}

function handleAIGenerate() {
  if (store.isLocalCreation) {
    if (!store.selectedWorld) {
      toast.error('请先选择一方大千世界，方可推演出身。');
      return;
    }
    isAIPromptModalVisible.value = true;
  } else {
    emit('ai-generate')
  }
}

async function handleAIPromptSubmit(userPrompt: string) {
  const toastId = 'ai-generate-origin';
  toast.loading('天机推演中，请稍候...', { id: toastId });

  try {
    const aiResponse = await generateWithRawPrompt(userPrompt, ORIGIN_ITEM_GENERATION_PROMPT, false);

    if (!aiResponse) {
      toast.error('AI推演失败', { id: toastId });
      return;
    }

    console.log('【AI推演-出身】完整响应:', aiResponse);

    // 解析AI返回的JSON
    let parsedOrigin: any;
    try {
      parsedOrigin = parseJsonFromText(aiResponse);
    } catch (parseError) {
      console.error('【AI推演-出身】JSON解析失败:', parseError);
      toast.error('AI推演结果格式错误，无法解析', { id: toastId });
      return;
    }

    // 验证必需字段
    if (!parsedOrigin.name && !parsedOrigin.名称) {
      toast.error('AI推演结果缺少出身名称', { id: toastId });
      return;
    }

    // 解析天道点消耗（支持多种字段名）
    let talentCost = parsedOrigin.talent_cost || parsedOrigin.天道点消耗 || parsedOrigin.消耗天道点;

    // 如果AI没有提供天道点，给予警告并设置默认值
    if (talentCost === undefined || talentCost === null) {
      console.warn('【AI推演-出身】AI未返回天道点消耗字段，使用默认值3');
      toast.warning('AI未设置天道点消耗，已自动设为3点', { id: toastId, duration: 2000 });
      talentCost = 3; // 默认消耗3点，较为合理
    } else {
      // 确保是数字类型
      talentCost = Number(talentCost);
      if (isNaN(talentCost)) {
        console.warn('【AI推演-出身】天道点消耗不是有效数字，使用默认值3');
        talentCost = 3;
      }
    }

    // 创建出身对象
    const newOrigin: Origin = {
      id: Date.now(),
      name: parsedOrigin.name || parsedOrigin.名称 || '未命名出身',
      description: parsedOrigin.description || parsedOrigin.描述 || parsedOrigin.说明 || '',
      talent_cost: talentCost,
      attribute_modifiers: parsedOrigin.attribute_modifiers || parsedOrigin.属性修正 || {},
      background_effects: parsedOrigin.background_effects || parsedOrigin.背景效果 || [],
      rarity: parsedOrigin.rarity || parsedOrigin.稀有度 || 1,
      source: 'local'
    };

    // 保存并选择出身
    store.addOrigin(newOrigin);
    handleSelectOrigin(newOrigin);
    isAIPromptModalVisible.value = false;

    toast.success(`AI推演完成！出身 "${newOrigin.name}" 已生成`, { id: toastId });

  } catch (e: any) {
    console.error('【AI推演-出身】失败:', e);
    toast.error(`AI推演失败: ${e.message}`, { id: toastId });
  }
}

const canSelect = (origin: Origin): boolean => {
  // If it's already selected, we can always deselect it
  if (store.characterPayload.origin_id === origin.id) {
    return true;
  }
  const currentCost = store.selectedOrigin?.talent_cost ?? 0;
  const availablePoints = store.remainingTalentPoints + currentCost;
  return availablePoints >= origin.talent_cost;
}

// 编辑功能
function openEditModal(origin: Origin) {
  editingOrigin.value = origin;
  isEditModalVisible.value = true;
}

// 删除功能
async function handleDeleteOrigin(id: number) {
  try {
    await store.removeOrigin(id);
    console.log(`【出身选择】成功删除出身 ID: ${id}`);
  } catch (error) {
    console.error(`【出身选择】删除出身失败 ID: ${id}`, error);
  }
}

async function handleEditSubmit(data: CustomOriginData) {
  if (!editingOrigin.value) return;

  // 处理属性修正
  const attributeModifiers: Record<string, number> = {};
  if (Array.isArray(data.attribute_modifiers)) {
    data.attribute_modifiers.forEach(mod => {
      if (mod.attribute && mod.value) {
        attributeModifiers[mod.attribute] = Number(mod.value) || 0;
      }
    });
  }

  // 处理背景效果
  const backgroundEffects = Array.isArray(data.background_effects)
    ? data.background_effects.filter(effect => effect.type && effect.description)
    : [];

  // 创建更新数据对象
  const updateData: Partial<Origin> = {
    name: data.name,
    description: data.description,
    talent_cost: Number(data.talent_cost) || 0,
    rarity: Number(data.rarity) || 1,
    attribute_modifiers: attributeModifiers,
    background_effects: backgroundEffects
  };

  try {
    const success = store.updateOrigin(editingOrigin.value.id, updateData);
    if (success) {
      isEditModalVisible.value = false;
      editingOrigin.value = null;
      toast.success(`出身 "${updateData.name}" 已更新！`);
    } else {
      toast.error('更新出身失败！');
    }
  } catch (e) {
    console.error('更新出身失败:', e);
    toast.error('更新出身失败！');
  }
}

// 编辑模态框的初始数据
const editInitialData = computed(() => {
  if (!editingOrigin.value) return {};

  // 转换属性修正对象为数组格式
  const attributeModifiers = editingOrigin.value.attribute_modifiers
    ? Object.entries(editingOrigin.value.attribute_modifiers).map(([attribute, value]) => ({
        attribute,
        value: String(value)
      }))
    : [];

  return {
    name: editingOrigin.value.name,
    description: editingOrigin.value.description,
    talent_cost: editingOrigin.value.talent_cost.toString(),
    rarity: editingOrigin.value.rarity.toString(),
    attribute_modifiers: attributeModifiers,
    background_effects: editingOrigin.value.background_effects || []
  };
});

function handleSelectOrigin(origin: Origin) {
  if (!canSelect(origin)) {
    toast.warning('天道点不足，无法选择此出身。')
    return
  }
  // Toggle selection
  const newOriginId = store.characterPayload.origin_id === origin.id ? null : origin.id;
  store.selectOrigin(newOriginId);
}

function handleSelectRandom() {
 store.selectOrigin(null);
}

const isRandomSelected = computed(() => store.characterPayload.origin_id === null);

const _selectedDisplayName = computed(() => {
 if (isRandomSelected.value) return '随机出身'
 return store.selectedOrigin?.name || ''
});

const _selectedDescription = computed(() => {
 if (isRandomSelected.value)
   return '天道无常，造化弄人。选择此项，你的出身将完全随机生成。是生于帝王之家，或为山野遗孤，皆在天道一念之间。'
 return store.selectedOrigin?.description || '身世如谜，过往一片空白。'
});

const _selectedCost = computed(() => {
 if (isRandomSelected.value) return 0
 return store.selectedOrigin?.talent_cost || 0
});

// New computed properties for hover display
const activeDisplayName = computed(() => {
 if (activeOrigin.value === 'random') return '随机出身'
 if (activeOrigin.value && typeof activeOrigin.value === 'object') return activeOrigin.value.name
 return ''
});

const activeDescription = computed(() => {
 if (activeOrigin.value === 'random')
   return '天道无常，造化弄人。选择此项，你的出身将完全随机生成。是生于帝王之家，或为山野遗孤，皆在天道一念之间。'
 if (activeOrigin.value && typeof activeOrigin.value === 'object') return activeOrigin.value.description || '身世如谜，过往一片空白。'
 return '身世如谜，过往一片空白。'
});

const activeCost = computed(() => {
 if (activeOrigin.value === 'random') return 0
 if (activeOrigin.value && typeof activeOrigin.value === 'object') return activeOrigin.value.talent_cost || 0
 return 0
});

// fetchData 和 defineExpose 不再需要
</script>

<style scoped>
/* 通用外观见 styles/creation-theme.css */
.origin-selection-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.random-name {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}

.random-icon {
  flex-shrink: 0;
  color: var(--cc-gold);
}
</style>
