<template>
  <div class="creation-container">
    <VideoBackground />
    <div class="creation-stage" :class="{ 'with-board': !store.isLocalCreation }">
    <div class="creation-scroll">
      <span class="frame-corner tl" aria-hidden="true"></span>
      <span class="frame-corner tr" aria-hidden="true"></span>
      <span class="frame-corner bl" aria-hidden="true"></span>
      <span class="frame-corner br" aria-hidden="true"></span>

      <!-- 头部 -->
      <header class="header-container">
        <div class="header-top">
          <div class="header-title">
            <span class="mode-seal" :class="{ cloud: !store.isLocalCreation }">
              {{ store.isLocalCreation ? $t('单机') : $t('云端') }}
            </span>
            <div class="title-text">
              <h1 class="page-title">{{ stepLabels[store.currentStep - 1] }}</h1>
              <span class="page-sub">{{ stepCounter }}</span>
            </div>
          </div>

          <!-- 右侧：云端同步 / 预设（仅单机模式显示） -->
          <div v-if="store.isLocalCreation" class="cloud-sync-container">
            <CloudDataSync @sync-completed="onSyncCompleted" variant="compact" size="small" />
            <StorePreSeting
              variant="compact"
              size="small"
              :current-step="store.currentStep"
              :total-steps="store.totalSteps"
              :character-data="characterDataForPreset"
              @store-completed="onStoreCompleted"
            />
            <LoadingPreSeting variant="compact" size="small" @load-completed="onLoadCompleted" />
            <DataClearButtons variant="horizontal" size="small" @data-cleared="onDataCleared" />
          </div>
        </div>

        <!-- 修行之路：步骤进度 -->
        <nav class="progress-steps" :aria-label="$t('创角步骤')">
          <div class="progress-track" aria-hidden="true">
            <div class="progress-fill" :style="{ width: progressPercent }"></div>
          </div>
          <button
            v-for="step in store.totalSteps"
            :key="step"
            type="button"
            class="step"
            :class="{
              done: step < store.currentStep,
              current: step === store.currentStep,
            }"
            :disabled="step >= store.currentStep || store.isCreating"
            :aria-current="step === store.currentStep ? 'step' : undefined"
            :title="step < store.currentStep ? $t('返回此步') : undefined"
            @click="store.goToStep(step)"
          >
            <span class="step-node">
              <Check v-if="step < store.currentStep" :size="14" :stroke-width="3" />
              <span v-else class="step-numeral">{{ chineseNumerals[step - 1] }}</span>
            </span>
            <span class="step-label">{{ stepLabels[step - 1] }}</span>
          </button>
        </nav>
      </header>

      <!-- 内容区域 -->
      <main class="step-content">
        <transition name="fade-step" mode="out-in">
          <div :key="store.currentStep" class="step-wrapper">
            <Step1_WorldSelection
              v-if="store.currentStep === 1"
              ref="step1Ref"
              @ai-generate="handleAIGenerateClick"
            />
            <Step2_TalentTierSelection
              v-else-if="store.currentStep === 2"
              ref="step2Ref"
              @ai-generate="handleAIGenerateClick"
            />
            <Step3_OriginSelection
              v-else-if="store.currentStep === 3"
              ref="step3Ref"
              @ai-generate="handleAIGenerateClick"
            />
            <Step4_SpiritRootSelection
              v-else-if="store.currentStep === 4"
              ref="step4Ref"
              @ai-generate="handleAIGenerateClick"
            />
            <Step5_TalentSelection
              v-else-if="store.currentStep === 5"
              ref="step5Ref"
              @ai-generate="handleAIGenerateClick"
            />
            <Step6_AttributeAllocation v-else-if="store.currentStep === 6" />
            <Step7_Preview
              v-else-if="store.currentStep === 7"
              :is-local-creation="store.isLocalCreation"
            />
          </div>
        </transition>
      </main>

      <!-- 导航 -->
      <footer class="navigation-buttons">
        <button @click.prevent="handleBack" type="button" class="cc-btn nav-back">
          <ArrowLeft :size="16" />
          <span>{{ store.currentStep === 1 ? $t('返回道途') : $t('上一步') }}</span>
        </button>

        <!-- 剩余天道点 -->
        <div class="points-display">
          <div
            v-if="store.currentStep >= 3 && store.currentStep <= 7"
            class="destiny-points"
            :class="{ low: store.remainingTalentPoints < 0 }"
          >
            <span class="points-label">{{ $t('剩余天道点') }}</span>
            <span class="points-value">{{ store.remainingTalentPoints }}</span>
          </div>
        </div>

        <button
          type="button"
          @click.prevent="handleNext"
          :disabled="isNextBlocked"
          class="cc-btn primary nav-next"
          :class="{ 'is-final': store.currentStep === store.totalSteps }"
        >
          <template v-if="store.currentStep === store.totalSteps">
            <Sparkles :size="16" />
            <span>{{ $t('开启仙途') }}</span>
          </template>
          <template v-else>
            <span>{{ $t('下一步') }}</span>
            <ArrowRight :size="16" />
          </template>
        </button>
      </footer>
    </div>
    <CultivationBoard v-if="!store.isLocalCreation" />
    </div>

    <RedemptionCodeModal
      :visible="isCodeModalVisible"
      :type="currentAIType"
      title="使用仙缘信物"
      @close="isCodeModalVisible = false"
      @submit="handleCodeSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import VideoBackground from '@/components/common/VideoBackground.vue';
import CloudDataSync from '@/components/common/CloudDataSync.vue';
import DataClearButtons from '@/components/common/DataClearButtons.vue';
import StorePreSeting from '@/components/common/StorePreSeting.vue';
import LoadingPreSeting from '@/components/common/LoadingPreSeting.vue';
import { useCharacterCreationStore } from '../stores/characterCreationStore';
import Step1_WorldSelection from '../components/character-creation/Step1_WorldSelection.vue'
import Step2_TalentTierSelection from '../components/character-creation/Step2_TalentTierSelection.vue'
import Step3_OriginSelection from '../components/character-creation/Step3_OriginSelection.vue'
import Step4_SpiritRootSelection from '../components/character-creation/Step4_SpiritRootSelection.vue'
import Step5_TalentSelection from '../components/character-creation/Step5_TalentSelection.vue'
import Step6_AttributeAllocation from '../components/character-creation/Step6_AttributeAllocation.vue'
import Step7_Preview from '../components/character-creation/Step7_Preview.vue'
import RedemptionCodeModal from '../components/character-creation/RedemptionCodeModal.vue'
import CultivationBoard from '../components/character-creation/CultivationBoard.vue'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-vue-next';
import '@/styles/creation-theme.css';
import { request, verifyStoredToken } from '../services/request'
import { toast } from '../utils/toast'
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { getCurrentCharacterName } from '../utils/tavern';
import { isBackendConfigured } from '@/services/backendConfig';
import { useI18n } from '../i18n';
import type { CharacterPreset } from '@/utils/presetManager';


const props = defineProps<{
  onBack: () => void;
}>();

const emit = defineEmits<{
  (e: 'creation-complete', payload: { error?: unknown; [key: string]: unknown }): void; // 允许传递错误对象
}>()
const store = useCharacterCreationStore();
const { t, currentLanguage } = useI18n();
const isCodeModalVisible = ref(false)
// 使用 store 中的 isCreating 状态，不再使用本地 ref
const currentAIType = ref<'world' | 'talent_tier' | 'origin' | 'spirit_root' | 'talent'>('world')

type PresetGender = NonNullable<CharacterPreset['data']['gender']>;

function normalizeGender(value: unknown): CharacterPreset['data']['gender'] {
  if (value === '男' || value === '女' || value === '其他') return value satisfies PresetGender;
  return undefined;
}

onMounted(async () => {
  // 1. 初始化创世神殿（确保数据已加载）
  // 单机模式也需要获取云端数据作为备选
  console.log('【角色创建】当前模式:', store.isLocalCreation ? '单机' : '联机');

  // 2. 初始化创世神殿，确保本地和云端数据都加载
  await store.initializeStore(store.isLocalCreation ? 'single' : 'cloud');

  // 检查是否需要补充云端数据（检查总数据量而不是source标记）
  const totalWorlds = store.creationData.worlds.length;
  const totalTalents = store.creationData.talents.length;

  console.log('【角色创建】当前数据量:');
  console.log('- 总世界数量:', totalWorlds);
  console.log('- 总天赋数量:', totalTalents);

  // 在联机模式下，如果数据量明显不足（小于等于本地数据量），尝试获取云端数据
  if (!store.isLocalCreation && (totalWorlds <= 3 || totalTalents <= 5)) {
    console.log('【角色创建】联机模式下数据量不足，尝试获取云端数据...');

    await store.fetchAllCloudData();

    console.log('【角色创建】云端数据获取完成，最终数据量:');
    console.log('- 总世界数量:', store.creationData.worlds.length);
    console.log('- 总天赋数量:', store.creationData.talents.length);
  }

  // 2. 获取角色名字 - 自动从酒馆获取，无需用户输入
  try {
    const tavernCharacterName = await getCurrentCharacterName();
    if (tavernCharacterName) {
      console.log('【角色创建】成功获取酒馆角色卡名字:', tavernCharacterName);
      store.characterPayload.character_name = tavernCharacterName;
    } else {
      console.log('【角色创建】无法获取酒馆角色卡名字，使用默认值');
      store.characterPayload.character_name = store.isLocalCreation ? '无名者' : '修士';
    }
  } catch (error) {
    console.error('【角色创建】获取角色名字时出错:', error);
    store.characterPayload.character_name = store.isLocalCreation ? '无名者' : '修士';
  }
});

onUnmounted(() => {
  store.resetOnExit();
});

// 此函数只处理联机模式的AI生成（需要消耗信物）
async function executeCloudAiGeneration(code: string, userPrompt?: string) {
  let type = ''
  switch (store.currentStep) {
    case 1: type = 'world'; break
    case 2: type = 'talent_tier'; break
    case 3: type = 'origin'; break
    case 4: type = 'spirit_root'; break
    case 5: type = 'talent'; break
    default:
      toast.error('当前步骤不支持AI生成！')
      return
  }

  store.startCreation();
  const toastId = `cloud-ai-generate-${type}`;
  const initialMessage = userPrompt ? '基于你的心愿推演玄妙...' : '天机推演中...';
  toast.loading(initialMessage, { id: toastId });

  try {
    // 1. 验证兑换码 (可选，后端会做最终验证)
    toast.loading('正在验证仙缘信物...', { id: toastId });
    try {
      // 后端返回完整的 RedemptionCode 对象，验证成功说明可用
      await request<{ id: number; code: string; times_used: number; max_uses: number }>(`/api/v1/redemption/validate/${code}`, { method: 'POST' });
      // 如果请求成功，说明兑换码有效且未过期/未用完
    } catch (error: unknown) {
      // 后端会返回具体错误信息（404=不存在，400=已用完/已过期）
      const message = error instanceof Error ? error.message : '仙缘信物验证失败';
      toast.error(message, { id: toastId });
      store.resetCreationState();
      return;
    }

    // 2. 前端调用AI生成
    toast.loading('已连接天机阁，正在推演...', { id: toastId });

    // 构建AI提示词
    const typeNameMap: Record<string, string> = {
      'world': '世界背景',
      'talent_tier': '天资等级',
      'origin': '出身背景',
      'spirit_root': '灵根',
      'talent': '天赋'
    };
    const typeName = typeNameMap[type] || type;
    const prompt = userPrompt || `请为修仙游戏生成一个${typeName}选项，包含name、description等字段，返回JSON格式`;

    // 使用前端aiService生成内容
    const { aiService } = await import('@/services/aiService');
    const aiResponse = await aiService.generate({
      ordered_prompts: [
        { role: 'system', content: `你是一个修仙游戏内容生成器。请根据用户要求生成${typeName}内容，返回有效的JSON对象。` },
        { role: 'user', content: prompt }
      ],
      usageType: 'main'
    });

    if (!aiResponse) {
      toast.error('天机阁未能推演出结果', { id: toastId });
      store.resetCreationState();
      return;
    }

    // 解析AI生成的内容
    let generatedContent;
    try {
      // 尝试从响应中提取JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('未找到有效JSON');
      }
    } catch {
      toast.error('天机推演结果格式异常', { id: toastId });
      store.resetCreationState();
      return;
    }

    // 3. 保存到云端并消耗兑换码
    toast.loading('正在记录天机...', { id: toastId });

    const saveResponse = await request<{ message: string; saved_id: number }>('/api/v1/ai/save', {
      method: 'POST',
      body: JSON.stringify({
        code: code,
        type: type,
        content: generatedContent
      }),
    });

    if (saveResponse) {
      toast.success(`天机已定！${saveResponse.message}`, { id: toastId });
      // 刷新数据以显示新生成的内容
      await store.fetchAllCloudData();
    } else {
      toast.error('记录天机失败', { id: toastId });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知错误';
    if (message.includes('兑换码') || message.includes('信物')) {
      toast.error(message, { id: toastId });
    } else if (message.includes('登录')) {
      toast.error('身份验证失败，请重新登录！', { id: toastId });
    } else {
      toast.error('天机紊乱：' + message, { id: toastId });
    }
  } finally {
    store.resetCreationState();
    // 确保toast在非成功路径也被关闭
    setTimeout(() => toast.hide(toastId), 3000);
  }
}

// 父组件的AI生成处理器，只响应来自子组件的"联机"请求
function handleAIGenerateClick() {
  // 根据当前步骤设置AI推演类型
  const typeMap = {
    1: 'world' as const,
    2: 'talent_tier' as const,
    3: 'origin' as const,
    4: 'spirit_root' as const,
    5: 'talent' as const
  };

  currentAIType.value = typeMap[store.currentStep as keyof typeof typeMap] || 'world';

  if (!store.isLocalCreation) {
    isCodeModalVisible.value = true
  }
  // 本地模式的点击事件由子组件自行处理，此处无需操作
}

// 暴露给步骤组件调用
defineExpose({
  handleAIGenerateClick,
})

const stepLabels = computed(() => [
  t('诸天问道'),
  t('仙缘初定'),
  t('转世因果'),
  t('测灵问道'),
  t('神通择定'),
  t('命格天成'),
  t('窥天算命'),
])

const chineseNumerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

const stepCounter = computed(() => {
  if (currentLanguage.value === 'en') return `Step ${store.currentStep} / ${store.totalSteps}`;
  return `第${chineseNumerals[store.currentStep - 1]}步 · 共${chineseNumerals[store.totalSteps - 1]}步`;
});

const progressPercent = computed(() => {
  const total = Math.max(1, store.totalSteps - 1);
  return `${((store.currentStep - 1) / total) * 100}%`;
});

const isNextBlocked = computed(() =>
  store.isCreating ||
  isNextDisabled.value ||
  (store.currentStep === store.totalSteps && store.remainingTalentPoints < 0)
);

const characterDataForPreset = computed(() => ({
  // 基础信息
  character_name: store.characterPayload.character_name,
  gender: store.characterPayload.gender,
  race: store.characterPayload.race,
  current_age: store.characterPayload.current_age,

  // 创角选择（完整对象）
  world: store.selectedWorld,
  talentTier: store.selectedTalentTier,
  origin: store.selectedOrigin,
  spiritRoot: store.selectedSpiritRoot,
  talents: store.selectedTalents,

  // 先天六司
  baseAttributes: {
    root_bone: store.attributes.root_bone,
    spirituality: store.attributes.spirituality,
    comprehension: store.attributes.comprehension,
    fortune: store.attributes.fortune,
    charm: store.attributes.charm,
    temperament: store.attributes.temperament,
  }
}))

const handleBack = () => {
  if (store.currentStep > 1) {
    store.prevStep()
  } else {
    props.onBack();
  }
}

const isNextDisabled = computed(() => {
  const currentStep = store.currentStep;
  const totalSteps = store.totalSteps;
  const selectedWorld = store.selectedWorld;
  const selectedTalentTier = store.selectedTalentTier;
  const remainingPoints = store.remainingTalentPoints;
  const generating = store.isCreating;

  console.log('[DEBUG] 按钮状态检查 - 当前步骤:', currentStep, '/', totalSteps);
  console.log('[DEBUG] 按钮状态检查 - isCreating:', generating);
  console.log('[DEBUG] 按钮状态检查 - 选中的世界:', selectedWorld?.name);
  console.log('[DEBUG] 按钮状态检查 - 选中的天资:', selectedTalentTier?.name);
  console.log('[DEBUG] 按钮状态检查 - 剩余天赋点:', remainingPoints);

  // You can add validation logic here for each step
  if (currentStep === 1 && !selectedWorld) {
    console.log('[DEBUG] 按钮被禁用：第1步未选择世界');
    return true;
  }
  if (currentStep === 2 && !selectedTalentTier) {
    console.log('[DEBUG] 按钮被禁用：第2步未选择天资');
    return true;
  }

  console.log('[DEBUG] 按钮状态：启用');
  return false;
})

async function handleNext(event?: Event) {
  console.log('[DEBUG] handleNext 被调用，当前步骤:', store.currentStep, '总步骤:', store.totalSteps);

  if (event) {
    event.preventDefault();
    event.stopPropagation();
    console.log('[DEBUG] 事件已阻止默认行为');
  }

  if (store.currentStep < store.totalSteps) {
    console.log('[DEBUG] 执行下一步');
    store.nextStep()
  } else {
    // Final step: Create Character
    console.log('[DEBUG] 最后一步，准备创建角色');
    await createCharacter()
  }
}

const step1Ref = ref<InstanceType<typeof Step1_WorldSelection> | null>(null)
const step2Ref = ref<InstanceType<typeof Step2_TalentTierSelection> | null>(null)
const step3Ref = ref<InstanceType<typeof Step3_OriginSelection> | null>(null)
const step4Ref = ref<InstanceType<typeof Step4_SpiritRootSelection> | null>(null)
const step5Ref = ref<InstanceType<typeof Step5_TalentSelection> | null>(null)

// 处理仙缘信物提交 (仅联机模式)
async function handleCodeSubmit(data: { code: string; prompt?: string }) {
  const token = localStorage.getItem('access_token')
  if (!token) {
    toast.error('身份凭证缺失，请先登录再使用信物。')
    isCodeModalVisible.value = false
    return
  }

  if (!data.code || data.code.trim().length < 6) {
    toast.error('请输入有效的仙缘信物！')
    return
  }

  isCodeModalVisible.value = false
  await executeCloudAiGeneration(data.code, data.prompt)
}

async function createCharacter() {
  console.log('[DEBUG] createCharacter 开始执行');
  console.log('[DEBUG] store.isCreating:', store.isCreating);

  if (store.isCreating) {
    console.warn('[CharacterCreation.vue] 角色创建已在进行中，忽略重复请求');
    return;
  }
  console.log('[CharacterCreation.vue] createCharacter() called.');

  // 1. 统一数据校验
  console.log('[DEBUG] 开始数据校验');
  console.log('[DEBUG] 角色名:', store.characterPayload.character_name);
  console.log('[DEBUG] 选中的世界:', store.selectedWorld);
  console.log('[DEBUG] 选中的天资:', store.selectedTalentTier);
  console.log('[DEBUG] 选中的出身:', store.selectedOrigin);
  console.log('[DEBUG] 选中的灵根:', store.selectedSpiritRoot);

  // 角色名自动获取，如果为空则使用默认值
  if (!store.characterPayload.character_name) {
    console.log('[DEBUG] 角色名为空，使用默认值');
    store.characterPayload.character_name = '修士';
  }
  if (!store.selectedWorld || !store.selectedTalentTier) {
    console.log('[DEBUG] 验证失败：缺少必需选择项');
    console.log('[DEBUG] selectedWorld:', store.selectedWorld);
    console.log('[DEBUG] selectedTalentTier:', store.selectedTalentTier);
    toast.error('创建数据不完整，请检查世界和天资选择！');
    return;
  }

  // 出身和灵根可以为空（表示随机选择）
  console.log('[DEBUG] selectedOrigin:', store.selectedOrigin, '(可为空，表示随机出生)');
  console.log('[DEBUG] selectedSpiritRoot:', store.selectedSpiritRoot, '(可为空，表示随机灵根)');

  // 进入创建流程后锁定按钮，防止重复点击/重复请求
  store.startCreation();

  if (!store.isLocalCreation) {
    if (!isBackendConfigured()) {
      toast.error('云端修行需要先配置后端服务器地址');
      store.resetCreationState();
      return;
    }
    const tokenOk = await verifyStoredToken();
    if (!tokenOk) {
      toast.error('云端修行需要先登录');
      store.resetCreationState();
      return;
    }
  }

  console.log('[DEBUG] 数据校验通过，开始创建角色');

  try {
    // 2. 角色名由酒馆助手的角色管理功能编辑，此处不同步

    // 3. 构造 CharacterBaseInfo
    // 3. 构造 CharacterBaseInfo，确保所有选择都使用完整的对象结构
    const _baseInfo = {
      名字: store.characterPayload.character_name,
      性别: store.characterPayload.gender,
      种族: store.characterPayload.race,
      // 🔥 关键修复：确保所有核心选择都传递完整对象，而不仅仅是名称或ID
      // 这解决了下游服务（如AI提示生成）无法获取详细描述的问题
      世界: store.selectedWorld,
      天资: store.selectedTalentTier,
      出生: store.selectedOrigin || '随机出身', // service层会处理字符串
      灵根: store.selectedSpiritRoot || '随机灵根', // service层会处理字符串
      天赋: store.selectedTalents,
      先天六司: {
        根骨: store.attributes.root_bone,
        灵性: store.attributes.spirituality,
        悟性: store.attributes.comprehension,
        气运: store.attributes.fortune,
        魅力: store.attributes.charm,
        心性: store.attributes.temperament,
      },
      后天六司: {
        根骨: 0,
        灵性: 0,
        悟性: 0,
        气运: 0,
        魅力: 0,
        心性: 0,
      },
      // 移除冗余的 "详情" 字段，因为主字段现在就是完整对象
    };

    // 4. 构造完整的创建载荷并发射creation-complete事件
    const creationPayload = {
      charId: `char_${Date.now()}`,
      characterName: store.characterPayload.character_name,
      world: store.selectedWorld,
      talentTier: store.selectedTalentTier,
      origin: store.selectedOrigin,
      spiritRoot: store.selectedSpiritRoot,
      talents: store.selectedTalents,
      baseAttributes: {
        root_bone: store.attributes.root_bone,
        spirituality: store.attributes.spirituality,
        comprehension: store.attributes.comprehension,
        fortune: store.attributes.fortune,
        charm: store.attributes.charm,
        temperament: store.attributes.temperament,
      },
      mode: (store.isLocalCreation ? '单机' : '联机') as '单机' | '联机',
      age: store.characterPayload.current_age,
      gender: store.characterPayload.gender,
      race: store.characterPayload.race, // 🔥 添加种族字段
    };

    console.log('🔥 [角色创建] 当前选择的开局年龄:', store.characterPayload.current_age);
    console.log('🔥 [角色创建] 当前选择的种族:', store.characterPayload.race);
    console.log('发射creation-complete事件，载荷:', creationPayload);

    // 发射事件让App.vue处理创建逻辑
    emit('creation-complete', creationPayload);

  } catch (error: unknown) {
    console.error('创建角色时发生严重错误:', error);
    // 重置状态
    store.failCreation(error instanceof Error ? error.message : '未知错误');
    // 错误现在由App.vue统一处理，这里只记录日志并重新抛出，以便App.vue捕获
    emit('creation-complete', { error: error }); // 发射一个带错误的事件
  }
  // 注意：成功情况下不在这里重置状态，因为需要等待App.vue处理完成后再重置
}

// 处理云端同步完成事件
function onSyncCompleted(result: { success: boolean; newItemsCount: number; message: string }) {
  console.log('[角色创建] 云端同步完成:', result);
  if (result.success && result.newItemsCount > 0) {
    toast.success(`已更新 ${result.newItemsCount} 项云端数据`);
  }
}

// 处理数据清除完成事件
function onDataCleared(type: string, count: number) {
  console.log('[角色创建] 数据清除完成:', { type, count });
  // 清除数据后可能需要重置当前选择
  if (count > 0) {
    // 如果清除的数据包含当前选中的项目，重置选择
    store.resetCharacter();
  }
}

// 处理存储预设完成事件
async function onStoreCompleted(result: { success: boolean; message: string; presetData?: { name?: unknown; description?: unknown } }) {
  console.log('[角色创建] 存储预设完成:', result);
  if (result.success && result.presetData) {
    try {
      const { savePreset } = await import('@/utils/presetManager');
      
      const presetName = typeof result.presetData.name === 'string' ? result.presetData.name : '未命名预设';
      const presetDescription = typeof result.presetData.description === 'string' ? result.presetData.description : '';

      // 构造预设数据
      const presetData: Omit<CharacterPreset, 'id' | 'savedAt'> = {
        name: presetName,
        description: presetDescription,
        data: {
          character_name: store.characterPayload.character_name,
          gender: normalizeGender(store.characterPayload.gender),
          race: store.characterPayload.race,
          current_age: store.characterPayload.current_age,
          world: store.selectedWorld ?? null,
          talentTier: store.selectedTalentTier ?? null,
          origin: store.selectedOrigin ?? null,
          spiritRoot: store.selectedSpiritRoot ?? null,
          talents: store.selectedTalents ?? [],
          baseAttributes: {
            root_bone: store.attributes.root_bone,
            spirituality: store.attributes.spirituality,
            comprehension: store.attributes.comprehension,
            fortune: store.attributes.fortune,
            charm: store.attributes.charm,
            temperament: store.attributes.temperament,
          }
        }
      };
      
      // 保存到 IndexedDB
      const presetId = await savePreset(presetData);
      console.log('[角色创建] 预设已保存到 IndexedDB, ID:', presetId);
      toast.success('预设保存成功！');
    } catch (error) {
      console.error('[角色创建] 保存预设到 IndexedDB 失败:', error);
      toast.error('预设保存失败');
    }
  }
}

// 处理加载预设完成事件
async function onLoadCompleted(result: { success: boolean; message: string; presetData?: CharacterPreset }) {
  console.log('[角色创建] 加载预设完成:', result);
  
  if (!result.success) {
    toast.error(result.message);
    return;
  }

  if (!result.presetData) {
    console.warn('[角色创建] 预设数据为空');
    toast.error('预设数据无效');
    return;
  }

  console.log('[角色创建] 准备使用预设数据创建角色:', result.presetData);
  
  // 使用预设数据恢复store状态
  try {
    const presetData = result.presetData.data;

    // 1. 查找对象
    const world = store.creationData.worlds.find(w => w.name === presetData.world?.name);
    const talentTier = store.creationData.talentTiers.find(t => t.name === presetData.talentTier?.name);
    const origin = store.creationData.origins.find(o => o.name === presetData.origin?.name);
    const spiritRoot = store.creationData.spiritRoots.find(s => s.name === presetData.spiritRoot?.name);
    
    // 2. 显式注解类型来解决 TypeScript 推断问题
    const worldId: number | '' = world ? world.id : '';
    const talentTierId: number | '' = talentTier ? talentTier.id : '';

    const talentIds = (presetData.talents && Array.isArray(presetData.talents))
      ? presetData.talents
          .map((presetTalent: any) => store.creationData.talents.find(t => t.name === presetTalent.name)?.id)
          // 显式为 'id' 参数添加类型注解
          .filter((id: number | undefined): id is number => id !== undefined)
      : [];

    // 3. 构建新的 payload 对象
    const newPayload = {
      ...store.characterPayload,
      character_name: presetData.character_name || '无名者',
      gender: presetData.gender || '男',
      race: presetData.race || '人族',
      current_age: presetData.current_age ?? 16,
      world_id: worldId,
      talent_tier_id: talentTierId,
      origin_id: origin ? origin.id : null,
      spirit_root_id: spiritRoot ? spiritRoot.id : null,
      selected_talent_ids: talentIds,
      root_bone: presetData.baseAttributes?.root_bone ?? 0,
      spirituality: presetData.baseAttributes?.spirituality ?? 0,
      comprehension: presetData.baseAttributes?.comprehension ?? 0,
      fortune: presetData.baseAttributes?.fortune ?? 0,
      charm: presetData.baseAttributes?.charm ?? 0,
      temperament: presetData.baseAttributes?.temperament ?? 0,
    };

    // 4. 一次性更新整个 payload
    store.characterPayload = newPayload;
    
    console.log('[角色创建] 预设数据已原子性恢复, 新的Payload:', newPayload);

    // 5. 验证恢复后的状态
    await nextTick();

    if (!store.selectedWorld || !store.selectedTalentTier) {
      console.error('[角色创建] 预设恢复后检查失败，核心数据缺失。');
      toast.error('预设数据不完整或已失效，请重新选择。');
      store.currentStep = 1;
      return;
    }

    // 6. 跳转到最后一步并创建角色
    store.currentStep = store.totalSteps;
    await nextTick();
    
    console.log('[角色创建] 预设数据恢复且校验通过，执行创建...');
    await createCharacter();

  } catch (error) {
    console.error('[角色创建] 使用预设数据失败:', error);
    toast.error('预设数据处理失败');
  }
}
</script>

<style>
/* Step transition animation */
.fade-step-enter-active,
.fade-step-leave-active {
  transition: opacity 0.3s ease;
}

.fade-step-enter-from,
.fade-step-leave-to {
  opacity: 0;
}
</style>


<style scoped>
/* ============================================================
   创角外壳 —— 颜色令牌见 styles/creation-theme.css
   ============================================================ */
.step-wrapper {
  height: 100%;
}

.creation-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  background: transparent;
}

.creation-stage {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 0.9rem;
  width: min(1200px, 96%);
  height: calc(var(--app-vh) * 0.92);
  max-height: calc(var(--app-vh) * 0.92);
  min-height: 0;
}

.creation-stage.with-board {
  width: min(1520px, 96%);
}

.creation-scroll {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
  max-width: 1200px;
  height: 100%;
  max-height: 100%;
  padding: 1.75rem 2rem 1.5rem;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--cc-shell-bg);
  border: 1px solid var(--cc-shell-border);
  border-radius: 6px;
  box-shadow: var(--cc-shell-shadow);
  backdrop-filter: blur(22px) saturate(1.1);
  -webkit-backdrop-filter: blur(22px) saturate(1.1);
}

/* 古籍内框 + 四角回纹 */
.creation-scroll::before {
  content: '';
  position: absolute;
  inset: 9px;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.16);
  border-radius: 3px;
  pointer-events: none;
}

.frame-corner {
  position: absolute;
  width: 30px;
  height: 30px;
  border: 0 solid var(--cc-gold);
  opacity: 0.85;
  pointer-events: none;
}

.frame-corner.tl { top: 5px; left: 5px; border-top-width: 2px; border-left-width: 2px; }
.frame-corner.tr { top: 5px; right: 5px; border-top-width: 2px; border-right-width: 2px; }
.frame-corner.bl { bottom: 5px; left: 5px; border-bottom-width: 2px; border-left-width: 2px; }
.frame-corner.br { bottom: 5px; right: 5px; border-bottom-width: 2px; border-right-width: 2px; }

/* ---------- 头部 ---------- */
.header-container {
  flex-shrink: 0;
  margin-bottom: 1rem;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  margin-bottom: 1.1rem;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

/* 模式朱印 */
.mode-seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 3px;
  box-sizing: border-box;
  flex-shrink: 0;
  border-radius: 4px;
  background: var(--cc-seal);
  color: var(--cc-seal-text);
  font-family: var(--cc-calligraphy);
  font-size: 15px;
  line-height: 1.05;
  text-align: center;
  writing-mode: vertical-rl;
  letter-spacing: 0.05em;
  transform: rotate(-4deg);
  box-shadow: inset 0 0 0 1.5px rgba(255, 240, 230, 0.55), 0 2px 6px rgba(120, 20, 10, 0.3);
}

.mode-seal.cloud {
  background: #2c5aa0;
  box-shadow: inset 0 0 0 1.5px rgba(230, 240, 255, 0.55), 0 2px 6px rgba(20, 40, 120, 0.3);
}

.title-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.page-title {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 1.9rem;
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: 0.12em;
  color: var(--cc-text);
}

.page-sub {
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  color: var(--cc-text-3);
}

.cloud-sync-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* 中等宽度时右上角全局菜单按钮会压在面板上，给它让出位置 */
@media (max-width: 1400px) and (min-width: 481px) {
  .header-top {
    padding-right: 56px;
  }
}

/* ---------- 修行之路 ---------- */
.progress-steps {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 0.25rem;
  /* 横向可滚动会同时裁切纵向，留出上下空间给当前步骤的光晕 */
  padding: 18px 6px 8px;
  margin: -18px -6px -8px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.progress-steps::-webkit-scrollbar {
  display: none;
}

.progress-track {
  position: absolute;
  top: calc(18px + 16px);
  left: 38px;
  right: 38px;
  height: 2px;
  background: var(--cc-divider);
  border-radius: 1px;
}

.progress-fill {
  height: 100%;
  border-radius: 1px;
  background: linear-gradient(90deg, rgba(var(--cc-gold-rgb), 0.4), var(--cc-gold));
  box-shadow: 0 0 8px rgba(var(--cc-gold-rgb), 0.5);
  transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.step {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  flex: 0 0 auto;
  min-width: 64px;
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  color: inherit;
  cursor: default;
}

.step.done:not(:disabled) {
  cursor: pointer;
}

.step-node {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  box-sizing: border-box;
  background: var(--cc-shell-bg);
  border: 1px solid var(--cc-border-strong);
  color: var(--cc-text-3);
  transition: all 0.35s ease;
}

.step-numeral {
  font-family: var(--cc-calligraphy);
  font-size: 1rem;
  line-height: 1;
}

.step.done .step-node {
  background: var(--cc-gold);
  border-color: var(--cc-gold);
  color: #1a1408;
}

.step.done:not(:disabled):hover .step-node {
  transform: scale(1.1);
  box-shadow: 0 0 0 4px rgba(var(--cc-gold-rgb), 0.18);
}

.step.current .step-node {
  width: 36px;
  height: 36px;
  margin: -2px 0;
  background: var(--cc-primary-bg);
  border: 1px solid var(--cc-primary-border);
  color: #fff;
  box-shadow: 0 0 0 4px rgba(var(--cc-accent-rgb), 0.14), 0 0 18px rgba(var(--cc-accent-rgb), 0.45);
}

.step.current .step-numeral {
  font-size: 1.15rem;
}

.step-label {
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  white-space: nowrap;
  color: var(--cc-text-3);
  transition: color 0.3s ease;
}

.step.done .step-label {
  color: var(--cc-text-2);
}

.step.current .step-label {
  color: var(--cc-text);
  font-weight: 600;
}

.step:focus-visible {
  outline: none;
}

.step:focus-visible .step-node {
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.35);
}

/* ---------- 内容区 ---------- */
.step-content {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 1.1rem 0.25rem;
  border-top: 1px solid var(--cc-divider);
  border-bottom: 1px solid var(--cc-divider);
}

/* ---------- 底部导航 ---------- */
.navigation-buttons {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-shrink: 0;
  padding-top: 1.1rem;
}

.nav-back,
.nav-next {
  min-width: 132px;
}

.nav-next.is-final:not(:disabled)::after {
  content: '';
  position: absolute;
  top: 0;
  left: -60%;
  width: 40%;
  height: 100%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transform: skewX(-20deg);
  animation: sheen 3.5s ease-in-out infinite;
}

@keyframes sheen {
  0%, 55% { left: -60%; }
  100% { left: 130%; }
}

.points-display {
  position: absolute;
  left: 50%;
  display: flex;
  justify-content: center;
  transform: translateX(-50%);
}

.destiny-points {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.5rem 0.35rem 0.9rem;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.4);
  border-radius: 999px;
  background: rgba(var(--cc-gold-rgb), 0.07);
}

.points-label {
  font-size: 0.78rem;
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

.points-value {
  min-width: 2.2rem;
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  background: var(--cc-gold);
  color: #1a1408;
  font-size: 0.95rem;
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.destiny-points.low {
  border-color: rgba(var(--cc-danger-rgb), 0.55);
  background: rgba(var(--cc-danger-rgb), 0.08);
}

.destiny-points.low .points-value {
  background: var(--cc-danger);
  color: #fff;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  50% { opacity: 0.55; }
}

@media (prefers-reduced-motion: reduce) {
  .nav-next.is-final::after,
  .destiny-points.low .points-value {
    animation: none;
  }
}

/* ---------- 平板 ---------- */
@media (max-width: 1100px) {
  .creation-stage.with-board {
    width: 98%;
  }
}

@media (max-width: 768px) {
  .creation-stage {
    width: 98%;
    height: calc(var(--app-vh) * 0.95);
    max-height: calc(var(--app-vh) * 0.95);
  }

  .creation-scroll {
    width: 100%;
    height: 100%;
    max-height: 100%;
    padding: 1.25rem 1.25rem 1rem;
  }

  .page-title {
    font-size: 1.6rem;
  }

  .progress-steps {
    justify-content: flex-start;
    gap: 0.5rem;
  }

  .progress-track {
    display: none;
  }

  .step {
    min-width: 56px;
  }

  .step-content {
    padding: 0.9rem 0.1rem;
  }

  .navigation-buttons {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .points-display {
    position: static;
    order: -1;
    flex-basis: 100%;
    transform: none;
  }

  .nav-back,
  .nav-next {
    flex: 1;
    min-width: 0;
  }
}

/* ---------- 手机 ---------- */
@media (max-width: 480px) {
  .creation-stage {
    width: 100%;
    height: var(--app-vh);
    height: var(--app-svh);
    max-height: none;
  }

  .creation-scroll {
    width: 100%;
    height: 100%;
    max-height: none;
    padding: 0.9rem 0.85rem;
    padding-bottom: max(0.85rem, env(safe-area-inset-bottom));
    border-radius: 0;
    border-left: none;
    border-right: none;
    box-shadow: none;
  }

  .frame-corner {
    display: none;
  }

  .header-top {
    flex-direction: column;
    align-items: stretch;
    margin-bottom: 0.75rem;
  }

  .mode-seal {
    width: 34px;
    height: 34px;
    font-size: 13px;
  }

  .page-title {
    font-size: 1.45rem;
  }

  .cloud-sync-container {
    justify-content: flex-start;
  }

  .step {
    min-width: 46px;
  }

  .step-node {
    width: 28px;
    height: 28px;
  }

  .step.current .step-node {
    width: 32px;
    height: 32px;
  }

  .step-label {
    font-size: 0.62rem;
    letter-spacing: 0.04em;
  }
}
</style>
