<template>
  <div class="talent-tier-selection">
    <div v-if="store.isLoading" class="cc-state">{{ $t('感应天道，测算天资...') }}</div>
    <div v-else-if="store.error" class="cc-state error">{{ $t('天机混沌') }}：{{ store.error }}</div>

    <div v-else class="cc-split">
      <!-- 左侧：天资列表 -->
      <div class="cc-panel">
        <div class="cc-actions">
          <button v-if="store.isLocalCreation" type="button" class="cc-action" @click="isCustomModalVisible = true">
            <PenLine :size="14" />
            <span>{{ $t('自定义天资') }}</span>
          </button>
          <button type="button" class="cc-action" @click="handleAIGenerate">
            <Sparkles :size="14" />
            <span>{{ $t('AI推演') }}</span>
          </button>
        </div>

        <div class="cc-list" @mouseleave="activeTier = store.selectedTalentTier ?? activeTier">
          <div
            v-for="tier in filteredTalentTiers"
            :key="tier.id"
            class="cc-item tier-item"
            role="button"
            tabindex="0"
            :class="{ selected: store.characterPayload.talent_tier_id === tier.id }"
            :style="{ '--tier-color': tier.color || 'var(--cc-accent)' }"
            @click="handleSelectTalentTier(tier)"
            @keydown.enter.prevent="handleSelectTalentTier(tier)"
            @mouseover="activeTier = tier"
            @focus="activeTier = tier"
          >
            <div class="cc-item-main">
              <span class="tier-name-wrap">
                <span class="tier-gem" aria-hidden="true"></span>
                <span class="cc-item-name tier-name">{{ tier.name }}</span>
              </span>
              <span class="cc-item-meta">{{ tier.total_points }} {{ $t('点') }}</span>
            </div>
            <div v-if="tier.source === 'cloud' && store.isLocalCreation" class="cc-item-tools">
              <button type="button" class="cc-icon-btn" :title="$t('编辑此项')" @click.stop="openEditModal(tier)">
                <Edit :size="13" />
              </button>
              <button type="button" class="cc-icon-btn danger" :title="$t('删除此项')" @click.stop="handleDeleteTalentTier(tier.id)">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：天资详情 -->
      <div class="cc-panel cc-detail">
        <div
          v-if="activeTier"
          class="cc-detail-inner"
          :style="{ '--tier-color': activeTier.color || 'var(--cc-accent)' }"
        >
          <div class="cc-detail-head">
            <h2 class="cc-detail-title tier-title">{{ activeTier.name }}</h2>
          </div>
          <div class="cc-detail-rule"></div>
          <div class="cc-detail-body">
            <p>{{ activeTier.description }}</p>
          </div>
          <div class="cc-stat-row">
            <span class="cc-stat">{{ $t('天道点') }} <strong>{{ activeTier.total_points }}</strong></span>
          </div>
        </div>
        <div v-else class="cc-placeholder">{{ $t('请选择你的天资等级，这将决定你的起点。') }}</div>
      </div>
    </div>

    <CustomCreationModal
      :visible="isCustomModalVisible"
      :title="$t('自定义天资')"
      :fields="customTierFields"
      :validationFn="validateCustomTier"
      @close="isCustomModalVisible = false"
      @submit="handleCustomSubmit"
    />

    <!-- 编辑模态框 -->
    <CustomCreationModal
      :visible="isEditModalVisible"
      :title="$t('编辑天资')"
      :fields="customTierFields"
      :validationFn="validateCustomTier"
      :initialData="editInitialData"
      @close="isEditModalVisible = false; editingTier = null"
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
import { ref, computed, watch } from 'vue'
import { Trash2, Edit, PenLine, Sparkles } from 'lucide-vue-next'
import { useCharacterCreationStore } from '../../stores/characterCreationStore'
import type { TalentTier } from '../../types'
import CustomCreationModal from './CustomCreationModal.vue'
import AIPromptModal from './AIPromptModal.vue'
import { toast } from '../../utils/toast'
import { generateWithRawPrompt } from '../../utils/tavernCore'
import { TALENT_TIER_ITEM_GENERATION_PROMPT } from '../../utils/prompts/tasks/gameElementPrompts'
import { parseJsonFromText } from '@/utils/jsonExtract'

interface CustomTierData {
  name: string
  description: string
  total_points: string
  rarity: string
  color: string
}

const emit = defineEmits(['ai-generate'])
const store = useCharacterCreationStore()
// 详情区显示的天资：默认为已选天资，悬停时预览
const activeTier = ref<TalentTier | null>(store.selectedTalentTier)
watch(() => store.selectedTalentTier, (tier) => {
  if (!activeTier.value && tier) activeTier.value = tier
})
const isCustomModalVisible = ref(false)
const isEditModalVisible = ref(false)
const isAIPromptModalVisible = ref(false)
const editingTier = ref<TalentTier | null>(null)

const filteredTalentTiers = computed(() => {
  const allTiers = store.creationData.talentTiers;
  console.log("【天资选择】所有天资数据:", allTiers);
  console.log("【天资选择】当前模式:", store.isLocalCreation ? '本地' : '联机');
  console.log("【天资选择】数据明细:", allTiers.map(t => ({ name: t.name, source: t.source, id: t.id })));
  
  if (store.isLocalCreation) {
    // 单机模式显示本地数据和云端同步的数据
    const availableTiers = allTiers.filter(tier =>
      tier.source === 'local' || tier.source === 'cloud'
    );
    console.log("【天资选择】单机模式可用天资列表:", availableTiers);
    return availableTiers.sort((a, b) => a.total_points - b.total_points);
  } else {
    // 联机模式显示所有数据，包括本地数据作为后备
    const availableTiers = allTiers.length > 0 ? allTiers : [];
    console.log("【天资选择】联机模式天资列表:", availableTiers);
    console.log("【天资选择】联机模式天资数量:", availableTiers.length);
    
    if (availableTiers.length === 0) {
      console.warn("【天资选择】警告：联机模式下没有找到任何天资数据！");
    }
    
    return availableTiers.sort((a, b) => a.total_points - b.total_points);
  }
});

// 根据 types/index.ts 中的 TalentTier 接口定义字段
const customTierFields = [
  { key: 'name', label: '天资名称', type: 'text', placeholder: '例如：凡人' },
  { key: 'description', label: '天资描述', type: 'textarea', placeholder: '描述此天资的特点...' },
  { key: 'total_points', label: '天道点', type: 'number', placeholder: '例如：20' },
  { key: 'rarity', label: '稀有度', type: 'number', placeholder: '1-10，数值越高越稀有' },
  { key: 'color', label: '辉光颜色', type: 'color', placeholder: '例如：#808080' },
] as const

function validateCustomTier(data: Partial<CustomTierData>) {
    const errors: Record<string, string> = {};
    if (!data.name?.trim()) errors.name = '天资名称不可为空';
    const points = Number(data.total_points);
    if (isNaN(points) || points < 0) errors.total_points = '天道点必须是非负数';
    const rarity = Number(data.rarity);
    if (isNaN(rarity) || rarity < 1 || rarity > 10) errors.rarity = '稀有度必须在1-10之间';
    return {
        valid: Object.keys(errors).length === 0,
        errors: Object.values(errors),
    };
}

async function handleCustomSubmit(data: CustomTierData) {
  const newTier: TalentTier = {
    id: Date.now(),
    name: data.name,
    description: data.description,
    total_points: parseInt(data.total_points, 10) || 10,
    rarity: parseInt(data.rarity, 10) || 1,
    color: data.color || '#808080',
  }
  
  try {
    store.addTalentTier(newTier);
    // await saveGameData(store.creationData); // NOTE: 持久化由Pinia插件自动处理
    handleSelectTalentTier(newTier);
    isCustomModalVisible.value = false;
    toast.success(`自定义天资 "${newTier.name}" 已保存！`);
  } catch (e) {
    console.error('保存自定义天资失败:', e);
    toast.error('保存自定义天资失败！');
  }
}

function handleAIGenerate() {
  if (store.isLocalCreation) {
    isAIPromptModalVisible.value = true;
  } else {
    emit('ai-generate')
  }
}

async function handleAIPromptSubmit(userPrompt: string) {
  const toastId = 'ai-generate-talent-tier';
  toast.loading('天机推演中，请稍候...', { id: toastId });

  try {
    const aiResponse = await generateWithRawPrompt(userPrompt, TALENT_TIER_ITEM_GENERATION_PROMPT, false);

    if (!aiResponse) {
      toast.error('AI推演失败', { id: toastId });
      return;
    }

    console.log('【AI推演-天资】完整响应:', aiResponse);

    // 解析AI返回的JSON
    let parsedTier: any;
    try {
      parsedTier = parseJsonFromText(aiResponse);
    } catch (parseError) {
      console.error('【AI推演-天资】JSON解析失败:', parseError);
      toast.error('AI推演结果格式错误，无法解析', { id: toastId });
      return;
    }

    // 验证必需字段
    if (!parsedTier.name && !parsedTier.名称) {
      toast.error('AI推演结果缺少天资名称', { id: toastId });
      return;
    }

    // 创建天资对象
    const newTier: TalentTier = {
      id: Date.now(),
      name: parsedTier.name || parsedTier.名称 || '未命名天资',
      description: parsedTier.description || parsedTier.描述 || parsedTier.说明 || '',
      total_points: parsedTier.total_points || parsedTier.总点数 || parsedTier.点数 || 10,
      color: parsedTier.color || parsedTier.颜色 || '#808080',
      rarity: parsedTier.rarity || parsedTier.稀有度 || 1,
      source: 'local'
    };

    // 保存并选择天资
    store.addTalentTier(newTier);
    handleSelectTalentTier(newTier);
    isAIPromptModalVisible.value = false;

    toast.success(`AI推演完成！天资 "${newTier.name}" 已生成`, { id: toastId });

  } catch (e: any) {
    console.error('【AI推演-天资】失败:', e);
    toast.error(`AI推演失败: ${e.message}`, { id: toastId });
  }
}

function handleSelectTalentTier(tier: TalentTier) {
  store.selectTalentTier(tier.id)
}

// 编辑功能
function openEditModal(tier: TalentTier) {
  editingTier.value = tier;
  isEditModalVisible.value = true;
}

// 删除功能
async function handleDeleteTalentTier(id: number) {
  console.log(`🔥 点击删除按钮，准备删除天资 ID: ${id}`);
  try {
    await store.removeTalentTier(id);
    console.log(`【天资选择】成功删除天资 ID: ${id}`);
  } catch (error) {
    console.error(`【天资选择】删除天资失败 ID: ${id}`, error);
  }
}

async function handleEditSubmit(data: CustomTierData) {
  if (!editingTier.value) return;
  
  // 创建更新数据对象
  const updateData: Partial<TalentTier> = {
    name: data.name,
    description: data.description,
    total_points: parseInt(data.total_points, 10) || 10,
    rarity: parseInt(data.rarity, 10) || 1,
    color: data.color || '#808080'
  };

  try {
    const success = store.updateTalentTier(editingTier.value.id, updateData);
    if (success) {
      isEditModalVisible.value = false;
      editingTier.value = null;
      toast.success(`天资 "${updateData.name}" 已更新！`);
    } else {
      toast.error('更新天资失败！');
    }
  } catch (e) {
    console.error('更新天资失败:', e);
    toast.error('更新天资失败！');
  }
}

// 编辑模态框的初始数据
const editInitialData = computed(() => {
  if (!editingTier.value) return {};

  return {
    name: editingTier.value.name,
    description: editingTier.value.description,
    total_points: editingTier.value.total_points.toString(),
    rarity: editingTier.value.rarity?.toString() || '1',
    color: editingTier.value.color
  };
});

// fetchData 和 defineExpose 不再需要，因为父组件会处理初始化
</script>

<style scoped>
/* 通用外观见 styles/creation-theme.css，这里只保留天资品阶配色 */
.talent-tier-selection {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 品阶色：亮色主题下与墨色混合，保证在宣纸底上可读 */
.tier-item,
.cc-detail-inner {
  --tier-ink: var(--tier-color);
}

[data-theme='light'] .tier-item,
[data-theme='light'] .cc-detail-inner {
  --tier-ink: color-mix(in srgb, var(--tier-color) 55%, #221d16);
}

.tier-name-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.tier-gem {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  background: var(--tier-ink);
  transform: rotate(45deg);
  box-shadow: 0 0 8px color-mix(in srgb, var(--tier-color) 60%, transparent);
}

.tier-item .tier-name {
  color: var(--tier-ink);
}

.tier-item::before {
  background: linear-gradient(180deg, var(--tier-ink), color-mix(in srgb, var(--tier-ink) 30%, transparent));
}

.tier-item.selected {
  border-color: color-mix(in srgb, var(--tier-ink) 55%, transparent);
  box-shadow: 0 0 22px -8px color-mix(in srgb, var(--tier-color) 70%, transparent);
}

.tier-item.selected .cc-item-name {
  color: var(--tier-ink);
}

.tier-title {
  color: var(--tier-ink);
}

[data-theme='dark'] .tier-title {
  text-shadow: 0 0 22px color-mix(in srgb, var(--tier-color) 45%, transparent);
}
</style>
