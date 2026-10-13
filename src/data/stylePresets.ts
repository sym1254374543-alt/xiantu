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
  '优先级:本文风优先于其他提示词中的格调、用词、度量与称谓;判定标记、字数和数据结构仍以系统规则为准';

function narrative(body: string): string {
  return `[文风]\n${body.trim()}\n${STYLE_PRIORITY}`;
}

export const NARRATIVE_PRESETS: StylePreset[] = [
  {
    id: 'urban',
    name: '都市修真',
    desc: '现代都市为底，只在超凡场面转雅正笔法',
    sample: '他按掉手机的闹钟，地铁刚好进站。人群里那缕灵气很淡，贴着腕脉走了一圈——站台上没人察觉。',
    content: narrative(`
都市修真:世界观是现代都市,日常描写用现代白话与生活细节——手机、地铁、写字楼、外卖、快递、人民币、天气App
尺度分轨:世俗场景用秒/分钟/小时/天、米/公里;超凡场面才用一瞬/弹指/盏茶/丈/里
**转仙侠笔法的判据:这一场是否"涉及修真",涉及就转,不涉及就保持现代白话**
 算涉及:身处宗门/道场/秘境等修行场所(哪怕只是在里面谈话、吃饭)|施展或目睹法术、符箓、阵法|谈论功法、境界、丹药、灵材、道统|面对天地异象、灵兽、古修遗存|以修士身份与道统中人交往
 不算涉及:现代都市的日常——通勤、上班、吃饭、购物、打电话、看新闻、与普通人寒暄,哪怕主角本人是修士
 拿不准时看本场的**主体**:主体是办事就是现代白话,主体是斗法/论道就是仙侠笔法;一场之内随主体切换
 凡人在场时,超凡之事要写得像"怪事"或"被瞒住",不要写成旁若无人的仙侠场面
命名分轨:人名、公司/机构/组织/品牌/产品名与真实都市一致(如"陈嘉禾""林逾静""远洲集团""滨江壹号院");功法、法术、丹药、灵材、道统、古修遗存用仙侠命名(凝练、有意境)
 不要反过来:公司叫"XX宗""XX门",或功法叫"XX操作手册"
称谓:现代人之间用现代称呼(我/你、先生/女士/老板/处长/同学);道友/前辈只在古修道统内部或正式拜见时出现
节奏:日常写得快而干净,不堆古语;超凡场面可放慢
限制:不写网络梗与吐槽腔、不写游戏术语,不暴露数值与机制`),
  },
  {
    id: 'classical',
    name: '古典仙侠',
    desc: '纯古风笔法，画面凝练（脱离现代都市舞台时选用）',
    sample: '山风穿林而过，灵气如细丝贴着腕脉游走。他按剑而立，并不开口。',
    content: narrative(`
古典仙侠:语言古朴凝练,有画面感;多用四字短语与古风韵律
描写:环境氛围、动作细节、灵气流经身体的触感;多描写少总结,结尾留钩子
度量:时间用一瞬/弹指/盏茶/炷香,空间用寸/尺/丈/里
神通:高阶出手带天地异象,拒绝游戏读条式描写
限制:不写游戏术语,不暴露数值与机制`),
  },
  {
    id: 'light',
    name: '轻松诙谐',
    desc: '明快，可适度幽默，不拆掉世界的底色',
    sample: '地铁上人挤人，他腕子上那缕灵气却懒洋洋的。手机响了，他先没接。',
    content: narrative(`
轻松诙谐:基调明快,允许适度幽默、反差与内心吐槽,但不滑稽到拆掉世界的严肃底色
对话可以俏皮,旁白保持清楚;危险场面可以先松后紧
限制:不写低俗笑话,不打破第四面墙,不写游戏术语`),
  },
  {
    id: 'grim',
    name: '冷峻克制',
    desc: '克制、冷，代价写清楚',
    sample: '风从楼缝里刮下来。灵气又冷又细，像从骨头缝里钻。他没出声。',
    content: narrative(`
冷峻克制:语气克制、冷,少抒情;世界薄情,代价写清楚,不美化杀戮与背叛
描写偏短句,写具体的伤害与环境压迫,少用华丽辞藻
限制:不写轻松卖萌、不写突兀的热血说教、不给无代价的善报`),
  },
  {
    id: 'lyrical',
    name: '细腻抒情',
    desc: '重感官与意象，情节仍要往前走',
    sample: '夜风穿过阳台，带着潮气。一缕灵气贴着腕脉，轻得几乎像错觉。',
    content: narrative(`
细腻抒情:重感官与心境外化,句子可以稍长,意象清楚;不写主角内心独白,除非规则明确允许
景物、呼吸、光影、声音可以多写一层;情节推进不要被纯抒情淹没
限制:不写空洞排比,不堆砌「宛如/仿佛」`),
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
用法:预设只提供默认底色;玩家本次输入的态度(认真/郑重/玩笑/冷淡/热情等)一律优先于本预设

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
用法:预设只提供默认底色;玩家本次输入的态度(认真/郑重/玩笑/冷淡/热情等)一律优先于本预设

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
用法:预设只提供默认底色;玩家本次输入的态度(认真/郑重/玩笑/冷淡/热情等)一律优先于本预设

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
用法:预设只提供默认底色;玩家本次输入的态度(认真/郑重/玩笑/冷淡/热情等)一律优先于本预设

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
