<template>
  <div class="world-selection-container">
    <div v-if="store.isLoading" class="cc-state">{{ $t('正在推演诸天万界...') }}</div>
    <div v-else-if="store.error" class="cc-state error">{{ $t('天机紊乱') }}：{{ store.error }}</div>

    <div v-else class="cc-split">
      <!-- 左侧：世界列表 -->
      <div class="cc-panel">
        <div class="cc-actions">
          <button v-if="store.isLocalCreation" type="button" class="cc-action" @click="isCustomModalVisible = true">
            <PenLine :size="14" />
            <span>{{ $t('自定义世界') }}</span>
          </button>
          <button type="button" class="cc-action" @click="handleAIGenerate">
            <Sparkles :size="14" />
            <span>{{ $t('AI推演') }}</span>
          </button>
        </div>

        <div class="cc-list" @mouseleave="activeWorld = store.selectedWorld ?? activeWorld">
          <div v-if="worldsList.length === 0" class="empty-list">
            <Globe2 :size="36" :stroke-width="1.25" class="empty-icon" />
            <div class="empty-text">
              {{ store.isLocalCreation ? $t('暂无本地世界数据') : $t('暂无云端世界数据') }}
            </div>
            <div v-if="!store.isLocalCreation" class="empty-hint">
              {{ $t('请检查网络连接或联系管理员') }}
            </div>
          </div>
          <div
            v-else
            v-for="world in worldsList"
            :key="world.id"
            class="cc-item"
            role="button"
            tabindex="0"
            :class="{ selected: store.characterPayload.world_id === world.id }"
            @click="handleSelectWorld(world)"
            @keydown.enter.prevent="handleSelectWorld(world)"
            @mouseover="activeWorld = world"
            @focus="activeWorld = world"
          >
            <div class="cc-item-main">
              <div class="world-item-heading">
                <span class="cc-item-name">{{ world.name }}</span>
                <span class="cc-item-check" aria-hidden="true"><Check :size="11" :stroke-width="3" /></span>
              </div>
              <p class="world-item-summary">{{ getWorldSummary(world) }}</p>
              <div class="world-item-meta">
                <span class="world-item-era">{{ world.era || $t('时代未知') }}</span>
                <span class="world-item-type">{{ getWorldProfile(world).type }}</span>
                <span class="world-item-focus">{{ getWorldProfile(world).focus }}</span>
              </div>
            </div>
            <div v-if="world.source === 'cloud' && store.isLocalCreation" class="cc-item-tools">
              <button type="button" class="cc-icon-btn" :title="$t('编辑此项')" @click.stop="openEditModal(world)">
                <Edit :size="13" />
              </button>
              <button type="button" class="cc-icon-btn danger" :title="$t('删除此项')" @click.stop="handleDeleteWorld(world.id)">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：世界详情 + 世界规模配置 -->
      <div class="cc-panel cc-detail">
        <div v-if="activeWorld" class="cc-detail-inner">
          <div class="cc-detail-head">
            <div class="title-block">
              <h2 class="cc-detail-title">{{ activeWorld.name }}</h2>
              <p class="cc-detail-sub">【{{ activeWorld.era || $t('时代未知') }}】</p>
              <div class="world-detail-meta">
                <span>{{ getWorldProfile(activeWorld).type }}</span>
                <span>{{ getWorldProfile(activeWorld).focus }}</span>
                <span>{{ activeWorld.source === 'cloud' ? $t('云端数据') : $t('本地预设') }}</span>
              </div>
            </div>
            <button
              type="button"
              class="cc-btn small"
              :class="{ 'is-open': showMapOptions }"
              :title="$t('地图生成选项')"
              :aria-expanded="showMapOptions"
              @click="showMapOptions = !showMapOptions"
            >
              <component :is="showMapOptions ? BookOpen : SlidersHorizontal" :size="14" />
              <span>{{ showMapOptions ? $t('返回描述') : $t('世界规模') }}</span>
            </button>
          </div>
          <div class="cc-detail-rule"></div>

          <!-- 世界规模配置 -->
          <div class="map-options" v-show="showMapOptions">
            <section class="opt-section">
              <h3 class="cc-section-title">{{ $t('修仙难度') }}</h3>
              <div class="difficulty-options">
                <label
                  v-for="diff in difficultyOptions"
                  :key="diff.value"
                  class="difficulty-option"
                  :class="[`diff-${diff.tone}`, { selected: store.gameDifficulty === diff.value }]"
                >
                  <input type="radio" :value="diff.value" v-model="store.gameDifficulty" class="visually-hidden" />
                  <span class="difficulty-name">{{ $t(diff.label) }}</span>
                  <span class="difficulty-desc">{{ $t(diff.desc) }}</span>
                </label>
              </div>
            </section>

            <section class="opt-section">
              <label class="continents-toggle">
                <span class="toggle-text">
                  <span class="toggle-label">{{ $t('仅生成大陆（开局优化）') }}</span>
                  <span class="toggle-hint">
                    {{ worldConfig.generateOnlyContinents ? $t('开局只生成大陆，势力和地点可在游戏中动态生成，减少token消耗') : $t('开局生成完整世界（包括势力、地点和秘境）') }}
                  </span>
                </span>
                <span class="switch">
                  <input type="checkbox" v-model="worldConfig.generateOnlyContinents" />
                  <span class="switch-slider"></span>
                </span>
              </label>
            </section>

            <div class="config-warning" v-if="isConfigRisky">
              <TriangleAlert :size="18" class="warning-icon" />
              <div>
                <div class="warning-title">{{ $t('配置过高警告') }}</div>
                <div class="warning-desc">{{ $t('当前配置可能导致生成失败，建议调整至合理范围') }}</div>
              </div>
            </div>

            <section class="opt-section">
              <h3 class="cc-section-title">{{ $t('世界规模配置') }}</h3>
              <div class="map-options-grid">
                <label class="option-item">
                  <span class="option-label">{{ $t('主要势力') }}</span>
                  <input
                    type="number" min="1" max="20" step="1"
                    class="cc-input"
                    v-model.number="worldConfig.majorFactionsCount"
                    :class="{ 'config-risky': worldConfig.majorFactionsCount > 8 }"
                    :disabled="worldConfig.generateOnlyContinents"
                  />
                  <span class="config-hint">{{ $t('推荐: 3-8') }}</span>
                </label>
                <label class="option-item">
                  <span class="option-label">{{ $t('地点总数') }}</span>
                  <input
                    type="number" min="5" max="100" step="1"
                    class="cc-input"
                    v-model.number="worldConfig.totalLocations"
                    :class="{ 'config-risky': worldConfig.totalLocations > 15 }"
                    :disabled="worldConfig.generateOnlyContinents"
                  />
                  <span class="config-hint">{{ $t('推荐: 8-15') }}</span>
                </label>
                <label class="option-item">
                  <span class="option-label">{{ $t('秘境数量') }}</span>
                  <input
                    type="number" min="0" max="30" step="1"
                    class="cc-input"
                    v-model.number="worldConfig.secretRealmsCount"
                    :class="{ 'config-risky': worldConfig.secretRealmsCount > 10 }"
                    :disabled="worldConfig.generateOnlyContinents"
                  />
                  <span class="config-hint">{{ $t('推荐: 3-10') }}</span>
                </label>
                <label class="option-item">
                  <span class="option-label">{{ $t('大陆数量') }}</span>
                  <input
                    type="number" min="3" max="7" step="1"
                    class="cc-input"
                    v-model.number="worldConfig.continentCount"
                    :title="$t('大陆数量决定世界的宏观格局，3-7片大陆形成不同的地缘政治结构')"
                  />
                  <span class="config-hint">{{ $t('范围: 3-7') }}</span>
                </label>
              </div>
              <div class="map-options-actions">
                <button type="button" class="cc-btn small" @click="randomizeConfig">
                  <Dices :size="14" />
                  <span>{{ $t('随机') }}</span>
                </button>
                <button type="button" class="cc-btn small" @click="resetConfig">
                  <RotateCcw :size="14" />
                  <span>{{ $t('重置') }}</span>
                </button>
              </div>
            </section>
          </div>

          <div class="cc-detail-body" v-show="!showMapOptions">
            <p>{{ activeWorld.description || $t('此界一片混沌，尚无描述。') }}</p>
          </div>
        </div>
        <div v-else class="cc-placeholder">
          {{ $t('请择一方大千世界，以定道基。') }}
        </div>
      </div>
    </div>

    <CustomCreationModal
      :visible="isCustomModalVisible"
      :title="$t('自定义世界')"
      :fields="customWorldFields"
      :validationFn="validateCustomWorld"
      @close="isCustomModalVisible = false"
      @submit="handleCustomSubmit"
    />

    <!-- 编辑模态框 -->
    <CustomCreationModal
      :visible="isEditModalVisible"
      :title="$t('编辑世界')"
      :fields="customWorldFields"
      :validationFn="validateCustomWorld"
      :initialData="editInitialData"
      @close="isEditModalVisible = false; editingWorld = null"
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
import { ref, computed, watch } from 'vue';
import {
  Trash2, Edit, Check, PenLine, Sparkles, Globe2, SlidersHorizontal, BookOpen,
  TriangleAlert, Dices, RotateCcw,
} from 'lucide-vue-next';
import { useCharacterCreationStore } from '../../stores/characterCreationStore';
import type { World } from '../../types';
import CustomCreationModal from './CustomCreationModal.vue';
import AIPromptModal from './AIPromptModal.vue';
import { toast } from '../../utils/toast';
import { generateWithRawPrompt } from '../../utils/tavernCore';
import { WORLD_ITEM_GENERATION_PROMPT } from '../../utils/prompts/tasks/gameElementPrompts';
import { parseJsonFromText } from '@/utils/jsonExtract';

const emit = defineEmits(['ai-generate']);
const store = useCharacterCreationStore();
// 详情区显示的世界：默认为已选世界，悬停时预览
const activeWorld = ref<World | null>(store.selectedWorld);
watch(() => store.selectedWorld, (world) => {
  if (!activeWorld.value && world) activeWorld.value = world;
});
const isCustomModalVisible = ref(false);
const showMapOptions = ref(false);
const isEditModalVisible = ref(false);
const isAIPromptModalVisible = ref(false);
const editingWorld = ref<World | null>(null);

// 难度选项配置
const difficultyOptions = [
  { value: '简单', label: '简单', desc: '机缘频繁，敌人较弱', tone: 'easy' },
  { value: '普通', label: '普通', desc: '机缘与危险并存', tone: 'normal' },
  { value: '困难', label: '困难', desc: '机缘稀少，敌人较强', tone: 'hard' },
  { value: '噩梦', label: '噩梦', desc: '九死一生，举步维艰', tone: 'nightmare' }
];

// --- 世界生成配置 ---

// 创建一个稳定的默认配置
const createDefaultWorldConfig = () => ({
  majorFactionsCount: 5,
  totalLocations: 12,
  secretRealmsCount: 5,
  continentCount: 4,
  generateOnlyContinents: true // 默认开启仅生成大陆
});

// 从 store 读取已保存的配置，如果没有则使用默认配置
const getInitialConfig = () => {
  const savedConfig = store.worldGenerationConfig;
  if (savedConfig && savedConfig.majorFactionsCount) {
    console.log('[世界配置] 从store恢复已保存的配置:', savedConfig);
    return {
      majorFactionsCount: savedConfig.majorFactionsCount,
      totalLocations: savedConfig.totalLocations,
      secretRealmsCount: savedConfig.secretRealmsCount,
      continentCount: savedConfig.continentCount,
      generateOnlyContinents: savedConfig.generateOnlyContinents !== undefined ? savedConfig.generateOnlyContinents : true
    };
  }
  // 如果没有保存的配置，使用默认值（不是随机值）
  console.log('[世界配置] 使用默认配置');
  return createDefaultWorldConfig();
};

const worldConfig = ref(getInitialConfig());

// 监听配置变化并自动保存到store
watch(worldConfig, (newConfig) => {
  store.setWorldGenerationConfig(newConfig);
  console.log('[世界配置] 配置已更新并保存:', newConfig);
}, { deep: true });

const worldsList = computed(() => {
  const allWorlds = store.creationData.worlds;
  console.log("【世界选择】所有世界数据:", allWorlds);
  console.log("【世界选择】当前模式:", store.isLocalCreation ? '本地' : '联机');

  if (store.isLocalCreation) {
    // 单机模式显示本地数据和云端同步的数据
    const availableWorlds = allWorlds.filter(world =>
      world.source === 'local' || world.source === 'cloud'
    );
    console.log("【世界选择】单机模式可用世界列表:", availableWorlds);
    return availableWorlds;
  } else {
    // 联机模式：优先显示云端数据，如果没有则回退到本地数据
    const cloudWorlds = allWorlds.filter(world =>
      world.source === 'cloud'
    );
    console.log("【世界选择】联机模式云端世界列表:", cloudWorlds);
    console.log("【世界选择】云端世界数量:", cloudWorlds.length);

    if (cloudWorlds.length === 0) {
      console.warn("【世界选择】警告：联机模式下没有云端世界数据，回退到本地数据！");
      // 回退显示本地数据
      const localWorlds = allWorlds.filter(world => world.source === 'local');
      console.log("【世界选择】回退使用本地世界:", localWorlds);
      return localWorlds;
    }

    return cloudWorlds;
  }
});

const worldProfiles: Record<string, { type: string; focus: string; summary: string }> = {
  朝天大陆: { type: '正统修仙', focus: '宗门 · 百艺', summary: '灵气充沛、天道完整，适合从零开始问道求长生。' },
  地球: { type: '现代修真', focus: '科技 · 灵气', summary: '灵气复苏降临现代都市，科学与修真体系正面碰撞。' },
  赛博修真: { type: '未来修真', focus: '义体 · 灵能', summary: '以数据为灵气、以神经为经脉，探索机械飞升之路。' },
  魔法纪元: { type: '融合修行', focus: '魔法 · 符箓', summary: '修真宗门与魔法学院并存，寻找两种体系的平衡。' },
  洪荒末世: { type: '末法修行', focus: '苦修 · 传承', summary: '灵脉枯竭、仙门凋零，在末法时代守住最后的道统。' },
  星海修仙: { type: '星际修仙', focus: '星海 · 飞舟', summary: '修真文明驶入星海，跨越星球寻找传说中的道源。' },
  诡异世界: { type: '诡异修行', focus: '污染 · 意志', summary: '在诡异侵蚀与理智崩坏之间，走出一条危险的修行路。' },
};

function getWorldProfile(world: World) {
  return worldProfiles[world.name] || {
    type: '自定义世界',
    focus: '自由设定',
    summary: (world.description || '由你定义规则与修行道路。').replace(/\s+/g, ' ').slice(0, 42),
  };
}

function getWorldSummary(world: World) {
  return getWorldProfile(world).summary;
}

// 根据 types/index.ts 中的 World 接口定义字段
const customWorldFields = [
  { key: 'name', label: '世界名称', type: 'text', placeholder: '例如：九霄界' },
  { key: 'era', label: '时代背景', type: 'text', placeholder: '例如：仙道昌隆' },
  { key: 'description', label: '世界描述', type: 'textarea', placeholder: '描述这个世界的背景故事、修炼体系特点等...' }
] as const;

function validateCustomWorld(data: any) {
  const errors: Record<string, string> = {};
  if (!data.name?.trim()) {
    errors.name = '世界名称不可为空';
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.values(errors), // Return an array of strings
  };
}

async function handleCustomSubmit(data: any) {
  const newWorld: World = {
    id: Date.now(),
    name: data.name,
    era: data.era,
    description: data.description,
    source: 'local',
  };

  try {
    store.addWorld(newWorld);
    // await saveGameData(store.creationData); // NOTE: 持久化由Pinia插件自动处理
    handleSelectWorld(newWorld); // Auto-select the newly created world
    isCustomModalVisible.value = false;
    toast.success(`自定义世界 "${newWorld.name}" 已成功保存！`);
  } catch (e) {
    console.error('保存自定义世界失败:', e);
    toast.error('保存自定义世界失败！');
  }
}

function handleAIGenerate() {
  if (store.isLocalCreation) {
    isAIPromptModalVisible.value = true;
  } else {
    emit('ai-generate');
  }
}

async function handleAIPromptSubmit(userPrompt: string) {
  const toastId = 'ai-generate-world';
  toast.loading('天机推演中，请稍候...', { id: toastId });

  try {
    const aiResponse = await generateWithRawPrompt(userPrompt, WORLD_ITEM_GENERATION_PROMPT, false, 'world_generation');

    if (!aiResponse) {
      toast.error('AI推演失败', { id: toastId });
      return;
    }

    console.log('【AI推演-世界】完整响应:', aiResponse);

    // 解析AI返回的JSON
    let parsedWorld: any;
    try {
      parsedWorld = parseJsonFromText(aiResponse);
    } catch (parseError) {
      console.error('【AI推演-世界】JSON解析失败:', parseError);
      toast.error('AI推演结果格式错误，无法解析', { id: toastId });
      return;
    }

    // 验证必需字段
    if (!parsedWorld.name) {
      toast.error('AI推演结果缺少世界名称', { id: toastId });
      return;
    }

    // 创建世界对象
    const newWorld: World = {
      id: Date.now(),
      name: parsedWorld.name || parsedWorld.名称 || '未命名世界',
      era: parsedWorld.era || parsedWorld.时代背景 || '',
      description: parsedWorld.description || parsedWorld.描述 || parsedWorld.世界描述 || '',
      source: 'local'
    };

    // 保存并选择世界
    store.addWorld(newWorld);
    handleSelectWorld(newWorld);
    isAIPromptModalVisible.value = false;

    toast.success(`AI推演完成！世界 "${newWorld.name}" 已生成`, { id: toastId });

  } catch (e: any) {
    console.error('【AI推演-世界】失败:', e);
    toast.error(`AI推演失败: ${e.message}`, { id: toastId });
  }
}

function handleSelectWorld(world: World) {
  store.selectWorld(world.id);
  // 保存世界生成配置到store，供后续使用
  store.setWorldGenerationConfig(worldConfig.value);
}

// 随机配置功能
function randomizeConfig() {
  const factionOptions = [3, 4, 5, 6, 7];
  const locationOptions = [8, 10, 12, 15, 18];
  const realmOptions = [3, 4, 5, 6, 8];
  const continentOptions = [3, 4, 5, 6];

  worldConfig.value = {
    majorFactionsCount: factionOptions[Math.floor(Math.random() * factionOptions.length)],
    totalLocations: locationOptions[Math.floor(Math.random() * locationOptions.length)],
    secretRealmsCount: realmOptions[Math.floor(Math.random() * realmOptions.length)],
    continentCount: continentOptions[Math.floor(Math.random() * continentOptions.length)],
    generateOnlyContinents: worldConfig.value.generateOnlyContinents
  };

  store.setWorldGenerationConfig(worldConfig.value);
  toast.info('已随机生成世界配置');
}

// 重置为稳定的默认配置
function resetConfig() {
  worldConfig.value = createDefaultWorldConfig();
  store.setWorldGenerationConfig(worldConfig.value);
  toast.info('已重置为默认配置');
}

// 检查配置是否存在风险
const isConfigRisky = computed(() => {
  return worldConfig.value.majorFactionsCount > 8 ||
         worldConfig.value.totalLocations > 15 ||
         worldConfig.value.secretRealmsCount > 10;
});

// 编辑功能
function openEditModal(world: World) {
  editingWorld.value = world;
  isEditModalVisible.value = true;
}

// 删除功能
async function handleDeleteWorld(id: number) {
  try {
    await store.removeWorld(id);
    console.log(`【世界选择】成功删除世界 ID: ${id}`);
  } catch (error) {
    console.error(`【世界选择】删除世界失败 ID: ${id}`, error);
  }
}

async function handleEditSubmit(data: any) {
  if (!editingWorld.value) return;

  // 创建更新数据对象
  const updateData: Partial<World> = {
    name: data.name,
    era: data.era,
    description: data.description
  };

  try {
    const success = store.updateWorld(editingWorld.value.id, updateData);
    if (success) {
      isEditModalVisible.value = false;
      editingWorld.value = null;
      toast.success(`世界 "${updateData.name}" 已更新！`);
    } else {
      toast.error('更新世界失败！');
    }
  } catch (e) {
    console.error('更新世界失败:', e);
    toast.error('更新世界失败！');
  }
}

// 编辑模态框的初始数据
const editInitialData = computed(() => {
  if (!editingWorld.value) return {};

  return {
    name: editingWorld.value.name,
    era: editingWorld.value.era,
    description: editingWorld.value.description
  };
});

// fetchData 方法已不再需要，组件现在通过计算属性自动响应store的变化
</script>

<style scoped>
/* 通用外观见 styles/creation-theme.css，这里只保留世界选择特有的部分 */
.world-selection-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 世界名称需要更充足的横向空间，方便浏览和选择 */
.world-selection-container :deep(.cc-split) {
  grid-template-columns: minmax(300px, 1.25fr) 1.75fr;
}

.world-selection-container :deep(.cc-item) {
  min-height: 58px;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.world-selection-container :deep(.cc-item-name) {
  font-size: 1rem;
}

.world-selection-container :deep(.cc-item-main) {
  display: block;
}

.world-selection-container :deep(.world-item-heading) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.world-selection-container :deep(.world-item-summary) {
  margin: 0.45rem 0 0.55rem;
  overflow: hidden;
  color: var(--cc-text-3);
  font-size: 0.78rem;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.world-selection-container :deep(.world-item-meta) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  color: var(--cc-text-3);
  font-size: 0.68rem;
  letter-spacing: 0.04em;
}

.world-selection-container :deep(.world-item-meta > span) {
  padding: 0.16rem 0.42rem;
  border: 1px solid var(--cc-border);
  border-radius: 999px;
  background: var(--cc-surface-2);
}

.world-selection-container :deep(.world-item-era) {
  color: var(--cc-gold);
}

.world-selection-container :deep(.world-item-type) {
  color: var(--cc-accent);
}

.world-selection-container :deep(.cc-item.selected .world-item-summary) {
  color: var(--cc-text-2);
}

.world-selection-container :deep(.cc-item.selected .world-item-meta > span) {
  border-color: rgba(var(--cc-gold-rgb), 0.38);
}

@media (max-width: 1024px) and (min-width: 641px) {
  .world-selection-container :deep(.cc-split) {
    grid-template-columns: minmax(260px, 1.15fr) 1.35fr;
  }
}

.title-block {
  min-width: 0;
}

.world-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.65rem;
}

.world-detail-meta span {
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--cc-border);
  border-radius: 999px;
  color: var(--cc-text-3);
  background: var(--cc-surface-2);
  font-size: 0.68rem;
  letter-spacing: 0.05em;
}

.world-detail-meta span:first-child {
  color: var(--cc-accent);
  border-color: rgba(var(--cc-accent-rgb), 0.35);
}

.cc-btn.is-open {
  color: var(--cc-accent);
  border-color: rgba(var(--cc-gold-rgb), 0.65);
}

/* ---------- 空列表 ---------- */
.empty-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 200px;
  text-align: center;
  color: var(--cc-text-3);
}

.empty-icon {
  color: var(--cc-gold);
  opacity: 0.6;
  margin-bottom: 0.5rem;
}

.empty-text {
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  color: var(--cc-text-2);
}

.empty-hint {
  font-size: 0.8rem;
}

/* ---------- 世界规模配置 ---------- */
.map-options {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.opt-section {
  margin: 0;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

/* 难度 */
.difficulty-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.difficulty-option {
  --tone: var(--cc-accent);
  --tone-rgb: var(--cc-accent-rgb);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface-2);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.difficulty-option.diff-easy { --tone: #4ade80; --tone-rgb: 74, 222, 128; }
.difficulty-option.diff-normal { --tone: var(--cc-accent); --tone-rgb: var(--cc-accent-rgb); }
.difficulty-option.diff-hard { --tone: #f59e0b; --tone-rgb: 245, 158, 11; }
.difficulty-option.diff-nightmare { --tone: #ef4444; --tone-rgb: 239, 68, 68; }

[data-theme='light'] .difficulty-option.diff-easy { --tone: #15803d; --tone-rgb: 21, 128, 61; }
[data-theme='light'] .difficulty-option.diff-hard { --tone: #b45309; --tone-rgb: 180, 83, 9; }
[data-theme='light'] .difficulty-option.diff-nightmare { --tone: #b91c1c; --tone-rgb: 185, 28, 28; }

.difficulty-option:hover {
  background: var(--cc-surface-hover);
  border-color: rgba(var(--tone-rgb), 0.45);
}

.difficulty-option.selected {
  background: rgba(var(--tone-rgb), 0.12);
  border-color: rgba(var(--tone-rgb), 0.7);
  box-shadow: 0 0 16px -6px rgba(var(--tone-rgb), 0.6);
}

.difficulty-option:focus-within {
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.25);
}

.difficulty-name {
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: var(--cc-text);
}

.difficulty-option.selected .difficulty-name {
  color: var(--tone);
}

.difficulty-desc {
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--cc-text-3);
}

/* 仅生成大陆 */
.continents-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface-2);
  cursor: pointer;
}

.toggle-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.toggle-label {
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--cc-text);
}

.toggle-hint {
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--cc-text-3);
}

.switch {
  position: relative;
  flex-shrink: 0;
  width: 42px;
  height: 22px;
}

.switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  inset: 0;
  border-radius: 22px;
  background: var(--cc-inset);
  border: 1px solid var(--cc-border-strong);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.switch-slider::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f5f2ea;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.22s cubic-bezier(0.3, 1.4, 0.5, 1);
}

.switch input:checked + .switch-slider {
  background: var(--cc-primary-bg);
  border-color: rgba(var(--cc-gold-rgb), 0.6);
}

.switch input:checked + .switch-slider::before {
  transform: translateX(20px);
}

.switch input:focus-visible + .switch-slider {
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

/* 警告 */
.config-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid rgba(var(--cc-warning-rgb), 0.4);
  border-left-width: 3px;
  border-radius: 8px;
  background: rgba(var(--cc-warning-rgb), 0.08);
}

.warning-icon {
  flex-shrink: 0;
  margin-top: 0.1rem;
  color: var(--cc-warning);
}

.warning-title {
  margin-bottom: 0.2rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--cc-warning);
}

.warning-desc {
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--cc-text-2);
}

/* 数值配置 */
.map-options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.85rem;
}

.option-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.option-label {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  color: var(--cc-text-2);
}

.cc-input.config-risky {
  border-color: rgba(var(--cc-warning-rgb), 0.7);
  background: rgba(var(--cc-warning-rgb), 0.08);
}

.config-hint {
  font-size: 0.72rem;
  color: var(--cc-text-3);
}

.map-options-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

@media (max-width: 900px) {
  .difficulty-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .map-options-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cc-detail-head {
    align-items: flex-start;
  }
}
</style>
