<template>
  <div class="spirit-root-selection-container">
    <div v-if="store.isLoading" class="cc-state">{{ $t('天地玄黄，探查灵根...') }}</div>
    <div v-else-if="store.error" class="cc-state error">{{ $t('天机混沌：') }}{{ store.error }}</div>

    <div v-else class="cc-split">
      <!-- 左侧：选择与操作 -->
      <div class="cc-panel">
        <div class="cc-actions">
          <button v-if="store.isLocalCreation" type="button" class="cc-action" @click="isAdvancedCustomVisible = true">
            <PenLine :size="14" />
            <span>{{ $t('高级自定义') }}</span>
          </button>
          <button type="button" class="cc-action" @click="handleAIGenerate">
            <Sparkles :size="14" />
            <span>{{ $t('AI推演') }}</span>
          </button>
        </div>

        <!-- 选择模式切换 -->
        <div class="mode-switch">
          <div class="cc-segmented" role="tablist">
            <button
              type="button"
              role="tab"
              :aria-selected="selectionMode === 'preset'"
              :class="{ active: selectionMode === 'preset' }"
              @click="selectionMode = 'preset'"
            >
              {{ $t('预设灵根') }}
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="selectionMode === 'custom'"
              :class="{ active: selectionMode === 'custom' }"
              @click="selectionMode = 'custom'"
            >
              {{ $t('组合选择') }}
            </button>
          </div>
        </div>

        <!-- 预设灵根 -->
        <div v-if="selectionMode === 'preset'" class="cc-list" @mouseleave="resetActiveSpiritRoot">
          <div
            class="cc-item"
            role="button"
            tabindex="0"
            :class="{ selected: isRandomSelected }"
            @click="handleSelectRandom"
            @keydown.enter.prevent="handleSelectRandom"
            @mouseover="activeSpiritRoot = 'random'"
            @focus="activeSpiritRoot = 'random'"
          >
            <div class="cc-item-main">
              <span class="random-name">
                <Dices :size="15" class="random-icon" />
                <span class="cc-item-name">{{ $t('随机灵根') }}</span>
              </span>
              <span class="cc-item-meta">{{ $t('0 点') }}</span>
            </div>
          </div>
          <div class="cc-divider"></div>
          <div
            v-for="root in filteredSpiritRoots"
            :key="root.id"
            class="cc-item"
            role="button"
            :tabindex="canSelect(root) ? 0 : -1"
            :aria-disabled="!canSelect(root)"
            :class="{
              selected: store.characterPayload.spirit_root_id === root.id,
              disabled: !canSelect(root),
            }"
            @click="handleSelectSpiritRoot(root)"
            @keydown.enter.prevent="handleSelectSpiritRoot(root)"
            @mouseover="activeSpiritRoot = root"
            @focus="activeSpiritRoot = root"
          >
            <div class="cc-item-main">
              <span class="root-name-wrap">
                <span class="cc-item-name">{{ getSpiritRootBaseName(root.name) }}</span>
                <span
                  v-if="getSpiritRootTier(root)"
                  class="grade-chip"
                  :style="{ '--grade': gradeColor(getSpiritRootTier(root)) }"
                >
                  {{ getSpiritRootTier(root) }}
                </span>
              </span>
              <span class="cc-item-meta">{{ root.talent_cost }} {{ $t('点') }}</span>
            </div>
            <div v-if="root.source === 'cloud' && store.isLocalCreation" class="cc-item-tools">
              <button type="button" class="cc-icon-btn" :title="$t('编辑此项')" @click.stop="openEditModal(root)">
                <Edit :size="13" />
              </button>
              <button type="button" class="cc-icon-btn danger" :title="$t('删除此项')" @click.stop="handleDeleteSpiritRoot(root.id)">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </div>

        <!-- 组合选择 -->
        <div v-if="selectionMode === 'custom'" class="custom-mode">
          <section class="selection-group">
            <h3 class="cc-section-title">{{ $t('灵根类型') }}</h3>
            <div class="element-grid">
              <button
                v-for="type in spiritRootTypes"
                :key="type.key"
                type="button"
                class="element-btn"
                :class="{ selected: customSpirit.type === type.key }"
                :style="{ '--element': type.color }"
                :title="`${type.name}：${type.desc}`"
                :aria-pressed="customSpirit.type === type.key"
                @click="customSpirit.type = type.key"
              >
                <span class="element-glyph">{{ type.name.charAt(0) }}</span>
                <span v-if="type.name.length > 1" class="element-name">{{ type.name }}</span>
              </button>
            </div>
          </section>

          <section class="selection-group">
            <h3 class="cc-section-title">{{ $t('灵根品级') }}</h3>
            <div class="grade-grid">
              <button
                v-for="tier in spiritRootTiers"
                :key="tier.key"
                type="button"
                class="grade-btn"
                :class="{ selected: customSpirit.tier === tier.key }"
                :style="{ '--grade': gradeColor(tier.key) }"
                :aria-pressed="customSpirit.tier === tier.key"
                @click="customSpirit.tier = tier.key"
              >
                <span class="grade-name">{{ tier.name }}</span>
                <span class="grade-meta">{{ tier.multiplier }}x · {{ tier.cost }}{{ $t('点') }}</span>
              </button>
            </div>
          </section>

          <section class="custom-preview">
            <div class="preview-head">
              <span class="preview-name">{{ getCustomSpiritName() }}</span>
              <span
                v-if="customSpirit.tier !== 'none'"
                class="grade-chip"
                :style="{ '--grade': gradeColor(customSpirit.tier) }"
              >
                {{ getSpiritTierName(customSpirit.tier) }}
              </span>
            </div>
            <div class="preview-stats">
              <span>{{ $t('修炼倍率:') }} <strong>{{ getCustomSpiritMultiplier() }}x</strong></span>
              <span>{{ $t('消耗点数:') }} <strong>{{ getCustomSpiritCost() }}{{ $t('点') }}</strong></span>
            </div>
            <button
              type="button"
              class="cc-btn primary confirm-btn"
              :disabled="!isCustomSpiritValid()"
              @click="confirmCustomSpirit"
            >
              <Check :size="15" />
              <span>{{ $t('确认选择') }}</span>
            </button>
          </section>
        </div>
      </div>

      <!-- 右侧：灵根详情 -->
      <div class="cc-panel cc-detail">
        <div
          v-if="activeSpiritRoot || (selectionMode === 'custom' && customSpirit.type !== 'none')"
          class="cc-detail-inner"
        >
          <div class="cc-detail-head">
            <h2 class="cc-detail-title">{{ getActiveDisplayName() }}</h2>
          </div>
          <div class="cc-detail-rule"></div>
          <div class="cc-detail-body">
            <p>{{ getActiveDescription() }}</p>
          </div>
          <div class="cc-stat-row">
            <span class="cc-stat">{{ $t('修炼倍率') }} <strong>{{ getActiveMultiplier() }}x</strong></span>
            <span class="cc-stat">{{ $t('消耗天道点') }} <strong>{{ getActiveCost() }}</strong></span>
          </div>
        </div>
        <div v-else class="cc-placeholder">{{ $t('请选择一种灵根，或听天由命。') }}</div>
      </div>
    </div>

    <!-- 高级自定义模态框 -->
    <CustomCreationModal
      :visible="isAdvancedCustomVisible"
      :title="$t('高级自定义灵根')"
      :fields="advancedCustomFields"
      :validationFn="validateAdvancedCustom"
      @close="isAdvancedCustomVisible = false"
      @submit="handleAdvancedCustomSubmit"
    />

    <!-- 编辑模态框 -->
    <CustomCreationModal
      :visible="isEditModalVisible"
      :title="$t('编辑灵根')"
      :fields="advancedCustomFields"
      :validationFn="validateAdvancedCustom"
      :initialData="editInitialData"
      @close="isEditModalVisible = false; editingSpiritRoot = null"
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
import { ref, computed, reactive } from 'vue'
import { Trash2, Edit, PenLine, Sparkles, Dices, Check } from 'lucide-vue-next'
import { useCharacterCreationStore } from '../../stores/characterCreationStore'
import type { SpiritRoot } from '../../types'
import CustomCreationModal, { type ModalField } from './CustomCreationModal.vue'
import AIPromptModal from './AIPromptModal.vue'
import { toast } from '../../utils/toast'
import { generateWithRawPrompt } from '../../utils/tavernCore'
import { SPIRIT_ROOT_ITEM_GENERATION_PROMPT } from '../../utils/prompts/tasks/gameElementPrompts'
import { parseJsonFromText } from '@/utils/jsonExtract'

const emit = defineEmits(['ai-generate'])
const store = useCharacterCreationStore()
// UI状态
// 详情区显示的灵根：默认为当前选择（未选具体灵根即为随机），悬停时预览
const currentSpiritRootChoice = (): SpiritRoot | 'random' | null =>
  store.selectedSpiritRoot ?? (store.characterPayload.spirit_root_id === null ? 'random' : null)
const activeSpiritRoot = ref<SpiritRoot | 'random' | null>(currentSpiritRootChoice())
const resetActiveSpiritRoot = () => {
  activeSpiritRoot.value = currentSpiritRootChoice() ?? activeSpiritRoot.value
}

// 品级配色：同时支持中文品级名与组合选择中的 key
const GRADE_COLORS: Record<string, string> = {
  凡品: '#9ca3af', common: '#9ca3af',
  下品: '#8b5cf6', low: '#8b5cf6',
  中品: '#3b82f6', middle: '#3b82f6',
  上品: '#10b981', high: '#10b981',
  极品: '#f59e0b', supreme: '#f59e0b',
  仙品: '#f97316', 天品: '#f97316', heaven: '#f97316',
  神品: '#dc2626', divine: '#dc2626',
  特殊: '#7c3aed', special: '#7c3aed',
}
const gradeColor = (tier: string) => GRADE_COLORS[tier] ?? '#9ca3af'
const selectionMode = ref<'preset' | 'custom'>('preset')
const isAdvancedCustomVisible = ref(false)
const isEditModalVisible = ref(false)
const isAIPromptModalVisible = ref(false)
const editingSpiritRoot = ref<SpiritRoot | null>(null)

// 自定义灵根状态
const customSpirit = reactive({
  type: 'none' as string,
  tier: 'none' as string
})

// 灵根类型配置
const spiritRootTypes = [
  { key: 'fire', name: '火', icon: '🔥', color: '#ef4444', desc: '烈火焚天，爆发力强' },
  { key: 'water', name: '水', icon: '💧', color: '#3b82f6', desc: '水流不息，绵延悠长' },
  { key: 'wood', name: '木', icon: '🌿', color: '#10b981', desc: '生机盎然，治愈修复' },
  { key: 'metal', name: '金', icon: '⚔️', color: '#f59e0b', desc: '锋锐无匹，切金断玉' },
  { key: 'earth', name: '土', icon: '🗿', color: '#8b5cf6', desc: '厚德载物，防御超群' },
  { key: 'wind', name: '风', icon: '💨', color: '#06b6d4', desc: '风驰电掣，身法如神' },
  { key: 'thunder', name: '雷', icon: '⚡', color: '#eab308', desc: '雷霆万钧，毁天灭地' },
  { key: 'ice', name: '冰', icon: '❄️', color: '#0ea5e9', desc: '冰霜刺骨，万物凋零' },
  { key: 'light', name: '光', icon: '☀️', color: '#f97316', desc: '光明普照，净化邪恶' },
  { key: 'dark', name: '暗', icon: '🌑', color: '#6b7280', desc: '幽暗深邃，诡异莫测' },
  { key: 'space', name: '空间', icon: '🌀', color: '#7c3aed', desc: '虚空挪移，空间掌控' },
  { key: 'time', name: '时间', icon: '⏰', color: '#ec4899', desc: '时光流转，逆转乾坤' }
]

// 灵根品级配置 - 完整的修仙品级体系
const spiritRootTiers = [
  { key: 'common', name: '凡品', multiplier: 1.0, cost: 0, desc: '平平无奇的普通灵根' },
  { key: 'low', name: '下品', multiplier: 1.1, cost: 3, desc: '略有天赋，勉强可用' },
  { key: 'middle', name: '中品', multiplier: 1.3, cost: 6, desc: '资质尚可，小有成就' },
  { key: 'high', name: '上品', multiplier: 1.6, cost: 10, desc: '天赋卓越，前途无量' },
  { key: 'supreme', name: '极品', multiplier: 2.0, cost: 15, desc: '万中无一，天之骄子' },
  { key: 'heaven', name: '仙品', multiplier: 2.4, cost: 20, desc: '天降异象，举世罕见' },
  { key: 'divine', name: '神品', multiplier: 2.8, cost: 25, desc: '神鬼莫测，逆天改命' },
  { key: 'special', name: '特殊', multiplier: 0, cost: 0, desc: '特殊体质，另有奥妙' }
]

const filteredSpiritRoots = computed(() => {
  if (store.isLocalCreation) {
    return store.creationData.spiritRoots.filter(root => 
      root.source === 'local' || root.source === 'cloud'
    );
  } else {
    return store.creationData.spiritRoots.filter(root => 
      root.source === 'cloud'
    );
  }
});

// 高级自定义字段 - 使用动态列表格式
// 根据 types/index.ts 中的 SpiritRoot 接口定义字段
const advancedCustomFields: readonly ModalField[] = [
  { key: 'name', label: '灵根名称', type: 'text', placeholder: '例如：混沌灵根' },
  { key: 'tier', label: '品级', type: 'select', options: spiritRootTiers.map(t => ({ value: t.key, label: t.name })) },
  { key: 'description', label: '灵根描述', type: 'textarea', placeholder: '描述这个灵根的特性和背景故事...' },
  { key: 'cultivation_speed', label: '修炼速度', type: 'text', placeholder: '例如：极快、快速、普通、缓慢' },
  { key: 'base_multiplier', label: '修炼倍率', type: 'number', placeholder: '例如：1.5' },
  { key: 'talent_cost', label: '消耗天道点', type: 'number', placeholder: '例如：10' },
  { key: 'rarity', label: '稀有度', type: 'number', placeholder: '1-10，数值越高越稀有' },
  {
    key: 'special_effects',
    label: '特殊效果',
    type: 'dynamic-list',
    columns: [
      {
        key: 'effect',
        placeholder: '效果描述，如：雷系法术威力+80%'
      }
    ]
  }
]

// 为自定义灵根数据定义完整类型 - 与标准数据格式保持一致
type CustomSpiritRootData = {
  name: string;
  tier: string;
  description: string;
  cultivation_speed: string;
  base_multiplier: string | number;
  talent_cost: string | number;
  rarity: string | number;
  special_effects: { effect: string }[];
};

function validateCustomSpiritRoot(data: Partial<CustomSpiritRootData>) {
    const errors: Record<string, string> = {};

    // 必填字段验证
    if (!data.name?.trim()) errors.name = '灵根名称不可为空';
    if (!data.tier) errors.tier = '请选择品级';
    if (!data.description?.trim()) errors.description = '灵根描述不可为空';

    // 数值字段验证
    const baseMultiplier = Number(data.base_multiplier);
    if (data.base_multiplier !== undefined && data.base_multiplier !== '' && isNaN(baseMultiplier)) {
      errors.base_multiplier = '修炼倍率必须为数字';
    }

    const talentCost = Number(data.talent_cost);
    if (data.talent_cost !== undefined && data.talent_cost !== '' && isNaN(talentCost)) {
      errors.talent_cost = '消耗点数必须为数字';
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

async function handleCustomSubmit(data: CustomSpiritRootData) {
  // 处理特殊效果数组 - 处理动态列表格式
  const specialEffects = data.special_effects?.length
    ? data.special_effects
        .filter(item => item.effect?.trim())
        .map(item => item.effect.trim())
    : [];

  // 创建完整的标准化灵根对象
  const newRoot: SpiritRoot = {
    id: Date.now(),
    name: data.name,
    tier: spiritRootTiers.find(t => t.key === data.tier)?.name || data.tier,
    description: data.description,
    cultivation_speed: data.cultivation_speed || '普通',
    special_effects: specialEffects,
    base_multiplier: Number(data.base_multiplier) || 1.0,
    talent_cost: Number(data.talent_cost) || 0,
    rarity: Number(data.rarity) || 1,
    source: 'cloud' as const // 自定义的都算作cloud
  }

  try {
    store.addSpiritRoot(newRoot);
    handleSelectSpiritRoot(newRoot);
    isAdvancedCustomVisible.value = false;
    toast.success(`自定义灵根 "${newRoot.name}" 已保存！`);
  } catch (e) {
    console.error('保存自定义灵根失败:', e);
    toast.error('保存自定义灵根失败！');
  }
}

const isRandomSelected = computed(() => store.characterPayload.spirit_root_id === null);

// New computed properties for hover display
const activeDisplayName = computed(() => {
 if (activeSpiritRoot.value === 'random') return '随机灵根'
 if (activeSpiritRoot.value && typeof activeSpiritRoot.value === 'object') return activeSpiritRoot.value.name
 return ''
});

const activeDescription = computed(() => {
 if (activeSpiritRoot.value === 'random')
   return '大道五十，天衍四九，人遁其一。选择此项，你的灵根将完全随机生成，可能一步登天，亦可能平庸无奇。'
 if (activeSpiritRoot.value && typeof activeSpiritRoot.value === 'object') return activeSpiritRoot.value.description || '灵根信息不明。'
 return '灵根信息不明。'
});

const activeCost = computed(() => {
 if (activeSpiritRoot.value === 'random') return 0
 if (activeSpiritRoot.value && typeof activeSpiritRoot.value === 'object') return activeSpiritRoot.value.talent_cost || 0
 return 0
});

const canSelect = (root: SpiritRoot): boolean => {
  if (store.characterPayload.spirit_root_id === root.id) {
    return true;
  }
  const currentCost = store.selectedSpiritRoot?.talent_cost ?? 0;
  const availablePoints = store.remainingTalentPoints + currentCost;
  return availablePoints >= root.talent_cost;
}

function handleSelectSpiritRoot(root: SpiritRoot) {
  if (!canSelect(root)) {
    toast.warning('天道点不足，无法选择此灵根。')
    return
  }
  const newRootId = store.characterPayload.spirit_root_id === root.id ? null : root.id;
  store.selectSpiritRoot(newRootId);
}

function handleSelectRandom() {
  store.selectSpiritRoot(null);
}

function handleAIGenerate() {
  if (store.isLocalCreation) {
    isAIPromptModalVisible.value = true;
  } else {
    emit('ai-generate')
  }
}

async function handleAIPromptSubmit(userPrompt: string) {
  const toastId = 'ai-generate-spirit-root';
  toast.loading('天机推演中，请稍候...', { id: toastId });

  try {
    const aiResponse = await generateWithRawPrompt(userPrompt, SPIRIT_ROOT_ITEM_GENERATION_PROMPT, false);

    if (!aiResponse) {
      toast.error('AI推演失败', { id: toastId });
      return;
    }

    console.log('【AI推演-灵根】完整响应:', aiResponse);

    // 解析AI返回的JSON
    let parsedRoot: Record<string, unknown>;
    try {
      parsedRoot = parseJsonFromText(aiResponse);
    } catch (parseError) {
      console.error('【AI推演-灵根】JSON解析失败:', parseError);
      toast.error('AI推演结果格式错误，无法解析', { id: toastId });
      return;
    }

    // 验证必需字段
    if (!parsedRoot.name && !parsedRoot.名称) {
      toast.error('AI推演结果缺少灵根名称', { id: toastId });
      return;
    }

    // 创建灵根对象
    const newRoot: SpiritRoot = {
      id: Date.now(),
      name: String(parsedRoot.name || parsedRoot['名称'] || '未命名灵根'),
      tier: String(parsedRoot.tier || parsedRoot['品级'] || parsedRoot['等级'] || ''),
      description: String(parsedRoot.description || parsedRoot['描述'] || parsedRoot['说明'] || ''),
      base_multiplier: Number(parsedRoot.base_multiplier || parsedRoot['修炼倍率']) || 1.0,
      talent_cost: Number(parsedRoot.talent_cost || parsedRoot['天道点消耗'] || parsedRoot['点数消耗']) || 5,
      rarity: Number(parsedRoot.rarity || parsedRoot['稀有度']) || 3,
      source: 'local'
    };

    // 保存并选择灵根
    store.addSpiritRoot(newRoot);
    handleSelectSpiritRoot(newRoot);
    isAIPromptModalVisible.value = false;

    toast.success(`AI推演完成！灵根 "${newRoot.name}" 已生成`, { id: toastId });

  } catch (e: unknown) {
    console.error('【AI推演-灵根】失败:', e);
    const errorMessage = e instanceof Error ? e.message : '未知错误';
    toast.error(`AI推演失败: ${errorMessage}`, { id: toastId });
  }
}

// 解析灵根名称和等级
function getSpiritRootBaseName(name: string): string {
  // 现在名称中不再包含品级前缀，直接返回名称
  return name;
}

function getSpiritRootTier(root: SpiritRoot): string {
  // 直接使用tier字段
  return root.tier || '';
}

// 自定义灵根相关函数
function getCustomSpiritName(): string {
  if (customSpirit.type === 'none') return '请选择灵根类型';
  const typeInfo = spiritRootTypes.find(t => t.key === customSpirit.type);
  return typeInfo ? `${typeInfo.name}灵根` : '未知灵根';
}

function getCustomSpiritMultiplier(): number {
  if (customSpirit.tier === 'none') return 1.0;
  const tierInfo = spiritRootTiers.find(t => t.key === customSpirit.tier);
  return tierInfo ? tierInfo.multiplier : 1.0;
}

function getCustomSpiritCost(): number {
  if (customSpirit.tier === 'none') return 0;
  const tierInfo = spiritRootTiers.find(t => t.key === customSpirit.tier);
  return tierInfo ? tierInfo.cost : 0;
}

function getSpiritTierName(tierKey: string): string {
  const tierInfo = spiritRootTiers.find(t => t.key === tierKey);
  return tierInfo ? tierInfo.name : '';
}

function isCustomSpiritValid(): boolean {
  return customSpirit.type !== 'none' && customSpirit.tier !== 'none';
}

function confirmCustomSpirit() {
  if (!isCustomSpiritValid()) {
    toast.warning('请完整选择灵根类型和品级');
    return;
  }
  
  const typeInfo = spiritRootTypes.find(t => t.key === customSpirit.type);
  const tierInfo = spiritRootTiers.find(t => t.key === customSpirit.tier);
  
  if (!typeInfo || !tierInfo) {
    toast.error('选择的灵根配置无效');
    return;
  }
  
  const newRoot: SpiritRoot = {
    id: Date.now(),
    name: `${typeInfo.name}灵根`,
    description: `${tierInfo.desc}的${typeInfo.desc}`,
    base_multiplier: tierInfo.multiplier,
    talent_cost: tierInfo.cost,
    tier: tierInfo.name,
    source: 'cloud' as const
  };
  
  store.addSpiritRoot(newRoot);
  handleSelectSpiritRoot(newRoot);
  toast.success(`自定义灵根 "${newRoot.name}" 已创建！`);
  
  // 重置选择
  customSpirit.type = 'none';
  customSpirit.tier = 'none';
}

// 活跃显示相关函数
function getActiveDisplayName(): string {
  if (selectionMode.value === 'custom' && customSpirit.type !== 'none') {
    return getCustomSpiritName();
  }
  return activeDisplayName.value;
}

function getActiveDescription(): string {
  if (selectionMode.value === 'custom' && customSpirit.type !== 'none') {
    const typeInfo = spiritRootTypes.find(t => t.key === customSpirit.type);
    const tierInfo = spiritRootTiers.find(t => t.key === customSpirit.tier);
    if (typeInfo && tierInfo && customSpirit.tier !== 'none') {
      return `${tierInfo.desc}的${typeInfo.desc}`;
    } else if (typeInfo) {
      return typeInfo.desc;
    }
    return '请选择灵根品级';
  }
  return activeDescription.value;
}

function getActiveMultiplier(): string {
  if (selectionMode.value === 'custom' && customSpirit.type !== 'none') {
    return getCustomSpiritMultiplier().toString();
  }
  if (activeSpiritRoot.value === 'random') return '随机'
  if (activeSpiritRoot.value && typeof activeSpiritRoot.value === 'object') return (activeSpiritRoot.value.base_multiplier || 1.0).toString()
  return '1.0'
}

function getActiveCost(): string {
  if (selectionMode.value === 'custom' && customSpirit.type !== 'none') {
    return getCustomSpiritCost().toString();
  }
  return activeCost.value.toString();
}

// 高级自定义相关
function validateAdvancedCustom(data: Partial<CustomSpiritRootData>) {
  return validateCustomSpiritRoot(data);
}

function handleAdvancedCustomSubmit(data: CustomSpiritRootData) {
  handleCustomSubmit(data);
}

// 编辑功能
function openEditModal(root: SpiritRoot) {
  editingSpiritRoot.value = root;
  isEditModalVisible.value = true;
}

// 删除功能
async function handleDeleteSpiritRoot(id: number) {
  try {
    await store.removeSpiritRoot(id);
    console.log(`【灵根选择】成功删除灵根 ID: ${id}`);
  } catch (error) {
    console.error(`【灵根选择】删除灵根失败 ID: ${id}`, error);
  }
}

async function handleEditSubmit(data: CustomSpiritRootData) {
  if (!editingSpiritRoot.value) return;
  
  // 处理特殊效果数组
  const specialEffects = data.special_effects?.length
    ? data.special_effects
        .filter(item => item.effect?.trim())
        .map(item => item.effect.trim())
    : [];

  // 创建更新数据对象
  const updateData: Partial<SpiritRoot> = {
    name: data.name,
    tier: spiritRootTiers.find(t => t.key === data.tier)?.name || data.tier,
    description: data.description,
    cultivation_speed: `${data.base_multiplier}x`,
    special_effects: specialEffects,
    base_multiplier: parseFloat(String(data.base_multiplier)) || 1.0,
    talent_cost: parseInt(String(data.talent_cost), 10) || 0
  };

  try {
    const success = store.updateSpiritRoot(editingSpiritRoot.value.id, updateData);
    if (success) {
      isEditModalVisible.value = false;
      editingSpiritRoot.value = null;
      toast.success(`灵根 "${updateData.name}" 已更新！`);
    } else {
      toast.error('更新灵根失败！');
    }
  } catch (e) {
    console.error('更新灵根失败:', e);
    toast.error('更新灵根失败！');
  }
}

// 编辑模态框的初始数据
const editInitialData = computed(() => {
  if (!editingSpiritRoot.value) return {};

  return {
    name: editingSpiritRoot.value.name,
    tier: spiritRootTiers.find(t => t.name === editingSpiritRoot.value!.tier)?.key || 'common',
    description: editingSpiritRoot.value.description,
    base_multiplier: editingSpiritRoot.value.base_multiplier?.toString() || '1.0',
    talent_cost: editingSpiritRoot.value.talent_cost.toString(),
    special_effects: editingSpiritRoot.value.special_effects?.map(effect => ({ effect })) || []
  };
});

// fetchData 和 defineExpose 不再需要
</script>

<style scoped>
/* 通用外观见 styles/creation-theme.css，这里只保留灵根特有的组合选择与品级配色 */
.spirit-root-selection-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.mode-switch {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--cc-divider);
  flex-shrink: 0;
}

.random-name,
.root-name-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.random-icon {
  flex-shrink: 0;
  color: var(--cc-gold);
}

/* 品级徽记：颜色由 --grade 决定 */
.grade-chip {
  --grade-ink: var(--grade);
  flex-shrink: 0;
  padding: 0.05rem 0.4rem;
  border: 1px solid color-mix(in srgb, var(--grade) 55%, transparent);
  border-radius: 3px;
  background: color-mix(in srgb, var(--grade) 16%, transparent);
  color: var(--grade-ink);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

[data-theme='light'] .grade-chip,
[data-theme='light'] .grade-btn {
  --grade-ink: color-mix(in srgb, var(--grade) 65%, #221d16);
}

/* ---------- 组合选择 ---------- */
.custom-mode {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.85rem 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.selection-group {
  margin: 0;
}

/* 五行符牌 */
.element-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
}

.element-btn {
  --element-ink: var(--element);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  aspect-ratio: 1;
  max-height: 64px;
  padding: 0.25rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface-2);
  color: var(--element-ink);
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.25s ease, transform 0.2s ease;
}

[data-theme='light'] .element-btn {
  --element-ink: color-mix(in srgb, var(--element) 70%, #221d16);
}

.element-btn:hover {
  border-color: color-mix(in srgb, var(--element) 55%, transparent);
  transform: translateY(-1px);
}

.element-btn.selected {
  background: color-mix(in srgb, var(--element) 16%, transparent);
  border-color: var(--element);
  box-shadow: 0 0 16px -4px color-mix(in srgb, var(--element) 70%, transparent);
}

.element-glyph {
  font-family: var(--cc-calligraphy);
  font-size: 1.55rem;
  line-height: 1;
}

.element-name {
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: var(--cc-text-3);
}

/* 品级 */
.grade-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
}

.grade-btn {
  --grade-ink: var(--grade);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--cc-border);
  border-left: 3px solid var(--grade);
  border-radius: 6px;
  background: var(--cc-surface-2);
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.grade-btn:hover {
  background: var(--cc-surface-hover);
}

.grade-btn.selected {
  background: color-mix(in srgb, var(--grade) 14%, transparent);
  border-color: color-mix(in srgb, var(--grade) 70%, transparent);
  border-left-color: var(--grade);
  box-shadow: 0 0 14px -6px color-mix(in srgb, var(--grade) 80%, transparent);
}

.grade-name {
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--grade-ink);
}

.grade-meta {
  font-size: 0.7rem;
  color: var(--cc-text-3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* 预览 */
.custom-preview {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.45);
  border-radius: 8px;
  background: rgba(var(--cc-gold-rgb), 0.05);
}

.preview-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preview-name {
  font-family: var(--cc-calligraphy);
  font-size: 1.35rem;
  color: var(--cc-text);
}

.preview-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  font-size: 0.8rem;
  color: var(--cc-text-2);
}

.preview-stats strong {
  color: var(--cc-gold);
  font-variant-numeric: tabular-nums;
}

.confirm-btn {
  width: 100%;
}

@media (max-width: 640px) {
  .element-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .element-glyph {
    font-size: 1.25rem;
  }
}
</style>
