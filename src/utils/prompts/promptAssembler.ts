import { getPrompt } from '@/services/defaultPrompts';
import { stripNsfwContent, augmentDataDefinitionsPrompt } from './definitions/dataDefinitions';
import { getContentSettings } from '@/utils/nsfw';
import { IMAGE_PROMPT_RULES } from '@/services/imagePlaceholders';
import { resolveImageApi } from '@/services/storyImageRunner';
import { isJudgementSystemEnabled } from '@/utils/promptModeSettings';

/**
 * 组装最终的系统Prompt（异步版本，支持自定义提示词）
 * 所有提示词都通过 getPrompt() 获取，支持用户自定义
 * @param activePrompts - 一个包含了当前需要激活的prompt模块名称的数组
 * @param customActionPrompt - 自定义行动选项提示词（可选）
 * @param gameState - 游戏状态（可选，用于读取本地提示词配置）
 * @returns {Promise<string>} - 拼接好的完整prompt字符串
 */
export async function assembleSystemPrompt(
  activePrompts: string[],
  customActionPrompt?: string,
  gameState?: any,
  options?: { judgementEnabled?: boolean }
): Promise<string> {
  // 关闭判定系统时改用另一套内置提示词（与原版共用其他模块，互不影响）
  const judgementEnabled = options?.judgementEnabled ?? isJudgementSystemEnabled();
  // 所有提示词都使用 getPrompt() 获取，支持用户自定义
  const [
    coreRulesPrompt,
    businessRulesPrompt,
    extendedBusinessRulesPrompt,
    playerPersonalityPrompt,
    styleNarrativePrompt,
    dataDefinitionsPrompt,
    textFormatsPrompt,
    worldStandardsPrompt,
    splendorRulesPrompt,
    nsfwRulesPrompt
  ] = await Promise.all([
    getPrompt(judgementEnabled ? 'coreOutputRules' : 'coreOutputRulesNoJudgement'),
    getPrompt(judgementEnabled ? 'businessRules' : 'businessRulesNoJudgement'),
    getPrompt('extendedBusinessRules'), // 默认关闭，停用时为空字符串
    getPrompt('playerPersonality'),
    getPrompt('styleNarrative'),
    getPrompt('dataDefinitions'),
    getPrompt(judgementEnabled ? 'textFormatRules' : 'textFormatRulesNoJudgement'),
    getPrompt('worldStandards'),
    getPrompt('splendorRules'),
    getPrompt('nsfwRules')
  ]);

  // 判定关闭时：扩展规则改用无判定版本（是否发送跟随「2.5 扩展规则」的开关）
  const extendedRulesEffective = judgementEnabled
    ? extendedBusinessRulesPrompt
    : extendedBusinessRulesPrompt.trim()
      ? await getPrompt('extendedBusinessRulesNoJudgement')
      : '';

  const contentSettings = getContentSettings(gameState?.系统?.配置);
  const sanitize = (prompt: string) => (contentSettings.nsfwMode ? prompt : stripNsfwContent(prompt));
  const sanitizedDataDefinitionsPrompt = augmentDataDefinitionsPrompt(
    sanitize(dataDefinitionsPrompt),
    {
      body: contentSettings.splendorMode || contentSettings.nsfwMode,
      nsfw: contentSettings.nsfwMode,
      splendor: contentSettings.splendorMode
    }
  );
  const sanitizedBusinessRulesPrompt = sanitize(businessRulesPrompt);

  const promptSections = [
    // 1. 核心规则（JSON格式、响应格式、数据结构严格性）
    coreRulesPrompt,
    // 2. 业务规则
    sanitizedBusinessRulesPrompt,
    // 2.5 扩展规则（可选）
    sanitize(extendedRulesEffective),
    // 文风（可预设 / 自定义）
    styleNarrativePrompt,
    // 2.1 主角性格（可预设 / 自定义）
    playerPersonalityPrompt,
    // 3. 数据结构定义
    sanitizedDataDefinitionsPrompt,
    // 4. 文本格式与命名
    textFormatsPrompt,
    // 5. 世界设定参考
    worldStandardsPrompt,
  ];

  // 根据激活列表来添加可选模块
  if (activePrompts.includes('actionOptions')) {
    const actionOptionsPrompt = (await getPrompt('actionOptions')).trim();
    const customPromptSection = customActionPrompt
      ? `**用户自定义要求**：${customActionPrompt}

请严格按照以上自定义要求生成行动选项。`
      : '（无特殊要求，按默认规则生成）';
    if (actionOptionsPrompt) {
      promptSections.push(actionOptionsPrompt.replace('{{CUSTOM_ACTION_PROMPT}}', customPromptSection));
    }
  }

  if (resolveImageApi()) {
    promptSections.push(IMAGE_PROMPT_RULES);
  }

  if (activePrompts.includes('eventSystem')) {
    const eventRules = (await getPrompt('eventSystemRules')).trim();
    if (eventRules) {
      promptSections.push(eventRules);
    }
  }

  // 风华仪容与 NSFW 分开：由能力开关决定，提示词可在提示词管理中编辑/停用
  if (contentSettings.splendorMode) {
    const rules = splendorRulesPrompt.trim();
    if (rules) promptSections.push(rules);
  }
  if (contentSettings.nsfwMode) {
    const raw = nsfwRulesPrompt.trim();
    if (raw) {
      const rendered = raw.includes('{{NSFW_GENDER_FILTER}}')
        ? raw.replace('{{NSFW_GENDER_FILTER}}', contentSettings.nsfwGenderFilter)
        : `${raw}\n- 当前性别过滤: ${contentSettings.nsfwGenderFilter}`;
      promptSections.push(rendered);
    }
  }

  const normalizedSections = promptSections
    .map(section => section.trim())
    .filter(Boolean);

  return normalizedSections.join('\n\n---\n\n');
}
