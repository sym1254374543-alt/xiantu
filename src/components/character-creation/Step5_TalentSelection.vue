<template>
  <div class="talent-selection-container">
    <div v-if="store.isLoading" class="cc-state">{{ $t('于时光长河中搜寻天赋...') }}</div>
    <div v-else-if="store.error" class="cc-state error">{{ $t('天机紊乱') }}：{{ store.error }}</div>

    <div v-else class="cc-split">
      <!-- 左侧：天赋列表（可多选） -->
      <div class="cc-panel">
        <div class="cc-actions">
          <button v-if="store.isLocalCreation" type="button" class="cc-action" @click="isCustomModalVisible = true">
            <PenLine :size="14" />
            <span>{{ $t('自定义天赋') }}</span>
          </button>
          <button type="button" class="cc-action" @click="handleAIGenerate">
            <Sparkles :size="14" />
            <span>{{ $t('AI推演') }}</span>
          </button>
        </div>

        <div class="list-summary">
          <span>{{ $t('已选天赋') }}</span>
          <strong>{{ store.selectedTalents.length }}</strong>
        </div>

        <div class="cc-list">
          <div
            v-for="talent in filteredTalents"
            :key="talent.id"
            class="cc-item talent-item"
            role="checkbox"
            tabindex="0"
            :aria-checked="isSelected(talent)"
            :class="{ selected: isSelected(talent) }"
            @click="handleToggleTalent(talent)"
            @keydown.enter.prevent="handleToggleTalent(talent)"
            @keydown.space.prevent="handleToggleTalent(talent)"
            @mouseover="activeTalent = talent"
            @focus="activeTalent = talent"
          >
            <span class="check-box" aria-hidden="true">
              <Check :size="11" :stroke-width="3.5" />
            </span>
            <div class="cc-item-main">
              <span class="cc-item-name">{{ talent.name }}</span>
              <span class="cc-item-meta">{{ talent.talent_cost || 0 }} {{ $t('点') }}</span>
            </div>
            <div v-if="(talent.source === 'cloud' || talent.source === 'local') && store.isLocalCreation" class="cc-item-tools">
              <button type="button" class="cc-icon-btn" :title="$t('编辑此项')" @click.stop="openEditModal(talent)">
                <Edit :size="13" />
              </button>
              <button type="button" class="cc-icon-btn danger" :title="$t('删除此项')" @click.stop="handleDeleteTalent(talent.id)">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：天赋详情 -->
      <div class="cc-panel cc-detail">
        <div v-if="activeTalent" class="cc-detail-inner">
          <div class="cc-detail-head">
            <h2 class="cc-detail-title">{{ activeTalent.name }}</h2>
            <span v-if="isSelected(activeTalent)" class="picked-seal">{{ $t('已选') }}</span>
          </div>
          <div class="cc-detail-rule"></div>
          <div class="cc-detail-body">
            <p>{{ activeTalent.description || $t('此天赋之玄妙，需自行领悟。') }}</p>
          </div>
          <div class="cc-stat-row">
            <span class="cc-stat">{{ $t('消耗天道点') }} <strong>{{ activeTalent.talent_cost || 0 }}</strong></span>
          </div>
        </div>
        <div v-else class="cc-placeholder">{{ $t('请选择天赋。') }}</div>
      </div>
    </div>

    <CustomCreationModal
      :visible="isCustomModalVisible"
      :title="$t('自定义天赋')"
      :fields="customTalentFields"
      :validationFn="validateCustomTalent"
      @close="isCustomModalVisible = false"
      @submit="handleCustomSubmit"
    />

    <!-- 编辑模态框 -->
    <CustomCreationModal
      :visible="isEditModalVisible"
      :title="$t('编辑天赋')"
      :fields="customTalentFields"
      :validationFn="validateCustomTalent"
      :initialData="editInitialData"
      @close="isEditModalVisible = false; editingTalent = null"
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
import { Trash2, Edit, PenLine, Sparkles, Check } from 'lucide-vue-next'
import { useCharacterCreationStore } from '../../stores/characterCreationStore'
import type { Talent } from '../../types'
import CustomCreationModal, { type ModalField } from './CustomCreationModal.vue'
import AIPromptModal from './AIPromptModal.vue'
import { toast } from '../../utils/toast'
import { generateWithRawPrompt } from '../../utils/tavernCore'
import { TALENT_ITEM_GENERATION_PROMPT } from '../../utils/prompts/tasks/gameElementPrompts'
import { parseJsonFromText } from '@/utils/jsonExtract'

const emit = defineEmits(['ai-generate'])
const store = useCharacterCreationStore()
// 详情区显示的天赋：默认为第一个已选天赋，悬停时预览
const activeTalent = ref<Talent | null>(store.selectedTalents[0] ?? null)
const isCustomModalVisible = ref(false)
const isEditModalVisible = ref(false)
const isAIPromptModalVisible = ref(false)
const editingTalent = ref<Talent | null>(null)

const filteredTalents = computed(() => {
  const allTalents = store.creationData.talents;
  console.log("【天赋选择】所有天赋数据:", allTalents.length, "个");
  console.log("【天赋选择】当前模式:", store.isLocalCreation ? '本地' : '联机');
  
  if (store.isLocalCreation) {
    // 单机模式显示本地数据和云端同步的数据
    const availableTalents = allTalents.filter(talent => 
      talent.source === 'local' || talent.source === 'cloud'
    );
    console.log("【天赋选择】单机模式可用天赋数量:", availableTalents.length);
    return availableTalents;
  } else {
    // 联机模式显示所有数据，包括本地数据作为后备
    const availableTalents = allTalents.length > 0 ? allTalents : [];
    console.log("【天赋选择】联机模式天赋数量:", availableTalents.length);
    
    if (availableTalents.length === 0) {
      console.warn("【天赋选择】警告：联机模式下没有找到任何天赋数据！");
    }
    
    return availableTalents;
  }
});

// 自定义天赋字段 - 支持简单描述和结构化格式
// 根据 types/index.ts 中的 Talent 接口定义字段
const customTalentFields: ModalField[] = [
  { key: 'name', label: '天赋名称', type: 'text', placeholder: '例如：道心天成' },
  { key: 'description', label: '天赋描述', type: 'textarea', placeholder: '描述此天赋的本质...' },
  { key: 'talent_cost', label: '天道点消耗', type: 'number', placeholder: '例如：3' },
  { key: 'rarity', label: '稀有度', type: 'number', placeholder: '1-10，数值越高越稀有' },
  {
    key: 'effects',
    label: '天赋效果',
    type: 'dynamic-list',
    columns: [
      {
        key: '类型',
        placeholder: '效果类型',
        type: 'select',
        options: [
          { value: '属性加成', label: '属性加成' },
          { value: '技能解锁', label: '技能解锁' },
          { value: '特殊能力', label: '特殊能力' },
          { value: '修炼加成', label: '修炼加成' }
        ]
      },
      { key: '目标', placeholder: '目标（如：根骨、悟性）' },
      { key: '数值', placeholder: '数值（如：+2、+10%）' }
    ]
  }
]

// 自定义天赋数据类型 - 与标准数据格式保持一致
type CustomTalentData = {
  name: string;
  description: string;
  talent_cost: number | string;
  rarity: number | string;
  effects: Array<{
    类型: string;
    目标?: string;
    数值: number | string;
  }>;
};

function validateCustomTalent(data: Partial<CustomTalentData>) {
    const errors: Record<string, string> = {};

    // 必填字段验证
    if (!data.name?.trim()) errors.name = '天赋名称不可为空';
    if (!data.description?.trim()) errors.description = '天赋描述不可为空';

    // 数值字段验证
    const talentCost = Number(data.talent_cost);
    if (data.talent_cost === undefined || data.talent_cost === null || data.talent_cost === '' || isNaN(talentCost)) {
        errors.talent_cost = '天道点消耗必须填写';
    } else if (talentCost < 0) {
        errors.talent_cost = '天道点消耗不能为负数';
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

async function handleCustomSubmit(data: CustomTalentData) {
  // 处理天赋效果数组
  const effects = Array.isArray(data.effects)
    ? data.effects
        .filter(effect => effect.类型 && effect.数值)
        .map(effect => ({
          类型: effect.类型,
          目标: effect.目标 || undefined,
          数值: Number(effect.数值) || 0
        }))
    : [];

  // 创建完整的天赋对象
  const newTalent: Talent = {
    id: Date.now(),
    name: data.name,
    description: data.description,
    talent_cost: Number(data.talent_cost) || 0,
    rarity: Number(data.rarity) || 1,
    effects: effects.length > 0 ? effects : undefined,
    source: 'local' as const,
  }

  try {
    store.addTalent(newTalent);
    isCustomModalVisible.value = false;
    toast.success(`自定义天赋 "${newTalent.name}" 已保存！`);
  } catch (e) {
    console.error('保存自定义天赋失败:', e);
    toast.error('保存自定义天赋失败！');
  }
}

const isSelected = (talent: Talent): boolean => {
  return store.characterPayload.selected_talent_ids.includes(talent.id);
}

function handleToggleTalent(talent: Talent) {
  activeTalent.value = talent;
  store.toggleTalent(talent.id);
}

function handleAIGenerate() {
  if (store.isLocalCreation) {
    // 打开AI推演输入弹窗
    isAIPromptModalVisible.value = true;
  } else {
    emit('ai-generate');
  }
}

async function handleAIPromptSubmit(userPrompt: string) {
  const toastId = 'ai-generate-talent';
  toast.loading('天机推演中，请稍候...', { id: toastId });

  try {
    const aiResponse = await generateWithRawPrompt(userPrompt, TALENT_ITEM_GENERATION_PROMPT, false);

    if (!aiResponse) {
      toast.error('AI推演失败', { id: toastId });
      return;
    }

    console.log('【AI推演-天赋】完整响应:', aiResponse);

    // 解析AI返回的JSON
    let parsedTalent: any;
    try {
      parsedTalent = parseJsonFromText(aiResponse);
    } catch (parseError) {
      console.error('【AI推演-天赋】JSON解析失败:', parseError);
      toast.error('AI推演结果格式错误，无法解析', { id: toastId });
      return;
    }

    // 验证必需字段
    if (!parsedTalent.name && !parsedTalent.名称) {
      toast.error('AI推演结果缺少天赋名称', { id: toastId });
      return;
    }

    // 创建天赋对象
    const newTalent: Talent = {
      id: Date.now(),
      name: parsedTalent.name || parsedTalent.名称 || '未命名天赋',
      description: parsedTalent.description || parsedTalent.描述 || parsedTalent.说明 || '',
      talent_cost: parsedTalent.talent_cost || parsedTalent.点数消耗 || 1,
      rarity: parsedTalent.rarity || parsedTalent.稀有度 || 1,
      source: 'local'
    };

    // 保存并选择天赋
    store.addTalent(newTalent);
    handleToggleTalent(newTalent);
    isAIPromptModalVisible.value = false;

    toast.success(`AI推演完成！天赋 "${newTalent.name}" 已生成`, { id: toastId });

  } catch (e: any) {
    console.error('【AI推演-天赋】失败:', e);
    toast.error(`AI推演失败: ${e.message}`, { id: toastId });
  }
}

// 编辑功能
function openEditModal(talent: Talent) {
  editingTalent.value = talent;
  isEditModalVisible.value = true;
}

// 删除功能
async function handleDeleteTalent(id: number) {
  try {
    await store.removeTalent(id);
    console.log(`【天赋选择】成功删除天赋 ID: ${id}`);
  } catch (error) {
    console.error(`【天赋选择】删除天赋失败 ID: ${id}`, error);
  }
}

async function handleEditSubmit(data: CustomTalentData) {
  if (!editingTalent.value) return;

  // 处理天赋效果数组
  const effects = Array.isArray(data.effects)
    ? data.effects
        .filter(effect => effect.类型 && effect.数值)
        .map(effect => ({
          类型: effect.类型,
          目标: effect.目标 || undefined,
          数值: Number(effect.数值) || 0
        }))
    : [];

  // 创建更新数据对象
  const updateData: Partial<Talent> = {
    name: data.name,
    description: data.description,
    talent_cost: Number(data.talent_cost) || 0,
    rarity: Number(data.rarity) || 1,
    effects: effects.length > 0 ? effects : undefined
  };

  try {
    const success = store.updateTalent(editingTalent.value.id, updateData);
    if (success) {
      isEditModalVisible.value = false;
      editingTalent.value = null;
      toast.success(`天赋 "${updateData.name}" 已更新！`);
    } else {
      toast.error('更新天赋失败！');
    }
  } catch (e) {
    console.error('更新天赋失败:', e);
    toast.error('更新天赋失败！');
  }
}

// 编辑模态框的初始数据
const editInitialData = computed(() => {
  if (!editingTalent.value) return {};
  return {
    name: editingTalent.value.name,
    description: editingTalent.value.description,
    talent_cost: editingTalent.value.talent_cost || 0,
    rarity: editingTalent.value.rarity || 1,
    effects: editingTalent.value.effects || []
  };
});

// fetchData 和 defineExpose 不再需要
</script>

<style scoped>
/* 通用外观见 styles/creation-theme.css，这里只保留多选相关样式 */
.talent-selection-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.list-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--cc-divider);
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  color: var(--cc-text-3);
  flex-shrink: 0;
}

.list-summary strong {
  min-width: 1.6rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: rgba(var(--cc-gold-rgb), 0.15);
  color: var(--cc-gold);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* 多选框 */
.check-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border: 1px solid var(--cc-border-strong);
  border-radius: 4px;
  background: var(--cc-inset);
  color: transparent;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.talent-item.selected .check-box {
  background: var(--cc-seal);
  border-color: var(--cc-seal);
  color: var(--cc-seal-text);
}

.picked-seal {
  flex-shrink: 0;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  background: var(--cc-seal);
  color: var(--cc-seal-text);
  font-family: var(--cc-calligraphy);
  font-size: 0.95rem;
  letter-spacing: 0.1em;
  transform: rotate(-4deg);
  box-shadow: inset 0 0 0 1.5px rgba(255, 240, 230, 0.5);
}
</style>
