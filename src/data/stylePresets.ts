/**
 * 文风与主角性格的内置预设。
 * 第一个预设即该槽位的默认提示词，需与 defaultPrompts 中的默认内容保持一致。
 */
import { PLAYER_PERSONALITY_RULES } from '@/utils/prompts/definitions/playerPersonality';

export const CUSTOM_PRESET_ID = 'custom';

export const STYLE_PROMPT_KEYS = ['styleNarrative', 'playerPersonality'] as const;
export type StylePromptKey = (typeof STYLE_PROMPT_KEYS)[number];

export interface StylePreset {
  id: string;
  name: string;
  desc: string;
  /** 一两句示例，帮助判断调性 */
  sample?: string;
  content: string;
}

export interface StyleSlotDef {
  key: StylePromptKey;
  name: string;
  desc: string;
  weight: number;
  presets: StylePreset[];
}

const STYLE_PRIORITY =
  '优先级:本文风优先于其他提示词中的格调、用词与节奏;判定标记、字数和数据结构仍以系统规则为准';

function narrative(body: string): string {
  return `[文风]\n${body.trim()}\n${STYLE_PRIORITY}`;
}

export const NARRATIVE_PRESETS: StylePreset[] = [
  {
    id: 'classical',
    name: '古典正剧',
    desc: '古朴凝练，画面清楚，不说现代白话',
    sample: '山风穿林而过，灵气如细丝贴着腕脉游走。他按剑而立，并不开口。',
    content: narrative(`
古典正剧:语言古朴凝练,有画面感;多用四字短语与古风韵律,忌现代白话、网络用语和轻浮表达
描写:环境氛围、动作细节、灵气流经身体的触感;多描写少总结,结尾留钩子
度量:时间用一瞬/弹指/盏茶/炷香,空间用寸/尺/丈/里,禁止秒/米
神通:高阶出手带天地异象,拒绝游戏读条式描写
禁用:玩家、获得、装备了、等级提升等出戏词;禁止暴露数值与机制`),
  },
  {
    id: 'vernacular',
    name: '白话通俗',
    desc: '句子明白好读，保留修仙世界的称谓',
    sample: '山风穿过树林，他感到一丝灵气顺着脉搏走。手按在剑上，暂时没说话。',
    content: narrative(`
白话通俗:句子明白好读,像在讲故事;少用生僻典故和堆砌辞藻,保留修仙世界的称谓与规矩
描写:动作和对话清楚,环境点到为止;节奏利落,不拖长抒情
度量:用片刻、一炷香、几里路这类听得懂的说法,避免秒、米
禁用:网络梗、现代口语、游戏术语`),
  },
  {
    id: 'light',
    name: '轻松诙谐',
    desc: '明快，可适度幽默，不拆掉世界的底色',
    sample: '山风倒是很勤快，他腕子上那缕灵气却懒洋洋的。剑还按着，话先省了。',
    content: narrative(`
轻松诙谐:基调明快,允许适度幽默、吐槽和反差,但不滑稽到拆掉修仙世界的严肃底色
对话可以俏皮,旁白保持清楚;危险场面可以先松后紧
禁用:低俗笑话、现代网络梗、打破第四面墙`),
  },
  {
    id: 'grim',
    name: '冷峻黑暗',
    desc: '克制、冷，代价写清楚',
    sample: '风刮过枯林。灵气又冷又细，像从骨头缝里钻。他按着剑，没有出声。',
    content: narrative(`
冷峻黑暗:语气克制、冷,少抒情;世界薄情,代价写清楚,不美化杀戮与背叛
描写偏短句,写具体的伤害与环境压迫,少用华丽辞藻
禁用:轻松卖萌、突然的热血说教、无代价的善报`),
  },
  {
    id: 'lyrical',
    name: '细腻抒情',
    desc: '重感官与意象，情节仍要往前走',
    sample: '山风缓缓穿过林梢，带来潮湿的草木气。一缕灵气贴着腕脉，轻得几乎像错觉。',
    content: narrative(`
细腻抒情:重感官与心境外化,句子可以稍长,意象清楚;不写主角内心独白,除非规则明确允许
景物、衣袂、呼吸、光影可以多写一层;情节推进不要被纯抒情淹没
禁用:空洞排比、现代抒情腔、堆砌「宛如/仿佛」`),
  },
];

export const PERSONA_PRESETS: StylePreset[] = [
  {
    id: 'normal',
    name: '正常人',
    desc: '理性谨慎，有底线，不自负也不卑微',
    content: PLAYER_PERSONALITY_RULES.trim(),
  },
  {
    id: 'decisive',
    name: '杀伐果断',
    desc: '目标明确，确认威胁后直接处理',
    content: `[主角性格](可修改)
默认:杀伐果断(目标明确/出手干脆/不拖泥带水/有自己的底线)
用法:仅在叙事措辞/氛围/选项倾向体现;玩家明确表达时以玩家为准

[杀伐果断倾向]
危险:先评估,确认威胁后直接处理,不反复犹豫;冲突:话少,底线被触即反击,不无谓虐杀;利益:取所需,不滥杀无辜,也不因仁慈放走明敌;权威:不服空话,认实力与结果

[输出约束]
text避免代入内心独白(除非要求),偏向外在表现;action_options给保守/中庸/冒险各1-2个,冒险项更干脆`,
  },
  {
    id: 'kind',
    name: '温和仁厚',
    desc: '先礼后兵，顾及旁人，退无可退才出手',
    content: `[主角性格](可修改)
默认:温和仁厚(先礼后兵/顾及旁人/不轻易杀生/仍有底线)
用法:仅在叙事措辞/氛围/选项倾向体现;玩家明确表达时以玩家为准

[温和仁厚倾向]
危险:先劝、先退、先护人,退无可退才出手;冲突:优先化解,被欺压到底才反击;利益:不占弱者便宜,也不圣母到自毁;权威:恭敬,但会为弱者说话

[输出约束]
text避免代入内心独白(除非要求),偏向外在表现;action_options给保守/中庸/冒险各1-2个,保守与中庸更偏化解`,
  },
  {
    id: 'scheming',
    name: '谋定后动',
    desc: '先观察布局，不打无准备的仗',
    content: `[主角性格](可修改)
默认:谋定后动(观察/布局/不打无准备的仗/话留三分)
用法:仅在叙事措辞/氛围/选项倾向体现;玩家明确表达时以玩家为准

[谋定后动倾向]
危险:收集信息、试探、找退路再行动;冲突:用规则、关系和信息差,少正面硬刚;利益:算长远,不因一时意气;权威:表面遵从,暗中留后手

[输出约束]
text避免代入内心独白(除非要求),偏向外在表现;action_options给保守/中庸/冒险各1-2个,中庸项偏布局与试探`,
  },
  {
    id: 'casual',
    name: '玩世不恭',
    desc: '随性爱开玩笑，关键处不糊涂',
    content: `[主角性格](可修改)
默认:玩世不恭(随性/爱开玩笑/不爱受拘束/关键处不糊涂)
用法:仅在叙事措辞/氛围/选项倾向体现;玩家明确表达时以玩家为准

[玩世不恭倾向]
危险:表面散漫,真危险时会认真;冲突:用玩笑和退让卸力,触及同伴或底线才收起笑;利益:不贪,偶尔贪嘴;权威:不爱跪,也不主动挑衅送死

[输出约束]
text避免代入内心独白(除非要求),偏向外在表现;action_options给保守/中庸/冒险各1-2个,语气可以松,不要全是耍宝`,
  },
];

export const STYLE_SLOTS: StyleSlotDef[] = [
  {
    key: 'styleNarrative',
    name: '文风',
    desc: '语言格调、描写偏好与节奏',
    weight: 8,
    presets: NARRATIVE_PRESETS,
  },
  {
    key: 'playerPersonality',
    name: '主角性格',
    desc: '行事倾向，只影响措辞、氛围和选项',
    weight: 6,
    presets: PERSONA_PRESETS,
  },
];

export function styleSlotDef(key: string): StyleSlotDef | undefined {
  return STYLE_SLOTS.find((s) => s.key === key);
}
