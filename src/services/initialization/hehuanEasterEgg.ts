/**
 * 彩蛋：合欢宗圣女「灰夫人」
 * - 无论是否酒馆环境：若世界中有合欢宗，补齐其领导层与「圣女」职位，保证宗门信息完整
 * - 仅酒馆环境：额外注入灰夫人 NPC（包含 NSFW 信息，网页版不会注入）
 *
 * 从 characterInitialization.ts 原样迁出，行为不变。
 */
import type { NpcProfile, SaveData, WorldInfo } from '@/types/game';
import { isTavernEnv } from '@/utils/tavern';
import { buildSpiritStoneItems } from '@/utils/currencySystem';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function applyHehuanSectEasterEgg(worldInfo: WorldInfo, saveData: SaveData): void {
  // 🔥 [彩蛋] 合欢宗圣女 - 灰夫人
  // - 无论是否酒馆环境：补齐合欢宗“圣女”字段，保证宗门信息完整
  // - 仅酒馆环境：注入灰夫人NPC（包含NSFW信息）
  const hehuanSect = worldInfo.势力信息.find((f: any) => f.名称?.includes('合欢') || f.name?.includes('合欢'));
  if (hehuanSect) {
    const sectName = hehuanSect.名称 || (hehuanSect as any).name || '合欢宗';

    // 1) 补齐宗门领导层与“圣女”职位（兼容 leadership / 领导层 两套字段）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingLeadership = ((hehuanSect as any).领导层 || (hehuanSect as any).leadership) as any;
    const nextLeadership =
      existingLeadership && typeof existingLeadership === 'object'
        ? { ...existingLeadership }
        : ({} as any);

    if (!nextLeadership.宗主) nextLeadership.宗主 = '合欢老魔';
    if (!nextLeadership.宗主修为) nextLeadership.宗主修为 = '化神期';

    if (!nextLeadership.圣女) {
      nextLeadership.圣女 = '灰夫人(合欢圣女)';
      console.log('[角色初始化] ✅ 已补齐合欢宗领导层：圣女=灰夫人(合欢圣女)');
    }

    (hehuanSect as any).领导层 = nextLeadership;
    (hehuanSect as any).leadership = nextLeadership;

    // 2) 酒馆环境才注入NPC数据
    if (isTavernEnv()) {
      console.log('[角色初始化] 🎲 触发合欢宗彩蛋：生成灰夫人NPC');

      // 获取游戏时间，默认1000年
      const currentYear = (saveData as any).元数据?.时间?.年 ?? 1000;

      const greyLady: NpcProfile = {
        名字: "灰夫人(合欢圣女)",
        性别: "女",
        出生日期: { 年: currentYear - 200, 月: 1, 日: 1 }, // 金丹圆满约200岁
        种族: "人族",
        出生: "合欢宗",
        外貌描述: "身材极度丰满，拥有夸张的丰乳肥臀，腰肢纤细如蛇。面容妖媚，眼神含春，举手投足间散发着惊人的魅惑力。身着轻薄纱衣，曼妙身姿若隐若现。",
        性格特征: ["平易近人", "开放", "双性恋", "M体质", "S体质", "痴女(潜在)"],
        境界: { 名称: "金丹", 阶段: "圆满", 当前进度: 0, 下一级所需: 100, 突破描述: "阴阳调和，丹破婴生" },
        灵根: { name: "天阴灵根", tier: "极品" } as any,
        天赋: [{ name: "合欢圣体", description: "天生媚骨，极适合双修，采补效果翻倍" }] as any,
        先天六司: { 根骨: 8, 灵性: 9, 悟性: 8, 气运: 7, 魅力: 10, 心性: 5 },
        属性: {
          气血: { 当前: 5000, 上限: 5000 }, // 金丹圆满
          灵气: { 当前: 8000, 上限: 8000 },
          神识: { 当前: 3000, 上限: 3000 },
          寿元上限: 500 // 金丹期寿命约500年
        },
        与玩家关系: "陌生人", // 初始关系
        好感度: 10, // 初始好感略高
        当前位置: { 描述: `${sectName}驻地` },
        势力归属: sectName,
        人格底线: [], // 暂无底线
        记忆: [
          "我是合欢宗的圣女，人称灰夫人。",
          "我的真实姓名是一个秘密，只有真正征服我的人才能知道。",
          "我渴望体验世间极致的快乐与痛苦，无论是给予还是接受。"
        ],
        当前外貌状态: "衣衫半解，媚眼如丝",
        当前内心想法: "观察着周围的人，寻找能让我感兴趣的猎物",
        背包: { 物品: buildSpiritStoneItems({ 下品: 5000, 中品: 500, 上品: 50 }) },
        实时关注: true, // 关键：让AI主动关注此NPC
        私密信息: {
          是否为处女: true,
          身体部位: [
            { 部位名称: "后庭", 特征描述: "九曲回廊，紧致幽深，内壁褶皱繁复，仿佛能吞噬一切", 敏感度: 80, 开发度: 0, 特殊印记: "未开发", 反应描述: "稍有触碰便轻颤，呼吸凌乱", 偏好刺激: "缓慢深入与节奏变化", 禁忌: "粗暴扩张" },
            { 部位名称: "阴道", 特征描述: "春水玉壶，名器天成，常年湿润，紧致如初", 敏感度: 90, 开发度: 0, 特殊印记: "白虎", 反应描述: "情绪一动便春水泛滥", 偏好刺激: "前戏充足与温热指探", 禁忌: "敷衍草率" },
            { 部位名称: "腰部", 特征描述: "七寸盘蛇，柔若无骨，可做出任何高难度姿势", 敏感度: 70, 开发度: 0 },
            { 部位名称: "手", 特征描述: "纤手观音，指若削葱，灵活多变，擅长挑逗", 敏感度: 60, 开发度: 0 },
            { 部位名称: "足", 特征描述: "玲珑鸳鸯，弓足如玉，脚趾圆润可爱，足弓优美", 敏感度: 85, 开发度: 0 },
            { 部位名称: "嘴", 特征描述: "如意鱼唇，樱桃小口，舌头灵活，深喉天赋异禀", 敏感度: 75, 开发度: 0 },
            { 部位名称: "胸部", 特征描述: "乳燕玉峰，波涛汹涌，乳晕粉嫩，乳头敏感易硬", 敏感度: 95, 开发度: 0 },
          ],
          性格倾向: "开放且顺从(待调教)",
          性取向: "双性恋",
          性经验等级: "资深",
          亲密节奏: "快慢随心，重视前戏与情绪引导",
          亲密需求: "渴望征服与被征服的拉扯感",
          安全偏好: "边界沟通+安全词+禁术防护",
          避孕措施: "避孕丹/隔绝阵",
          性癖好: ["BDSM", "足交", "乳交", "捆绑", "调教", "采补", "角色扮演", "支配", "被支配", "露出", "放尿", "凌辱", "刑具"],
          亲密偏好: ["前戏充分", "情话引导", "视觉挑逗", "角色扮演", "掌控节奏"],
          禁忌清单: ["毫无沟通", "粗暴撕扯", "当众羞辱"],
          性渴望程度: 80,
          当前性状态: "渴望",
          体液分泌状态: "充沛",
          性交总次数: 128,
          性伴侣名单: [],
          最近一次性行为时间: "无",
          生育状态: { 是否可孕: true, 当前状态: "未怀孕" },
          特殊体质: ["合欢圣体", "名器合集"]
        }
      };

      // 3. 注入存档
      if (!(saveData as any).社交) (saveData as any).社交 = { 关系: {}, 事件: {}, 记忆: {} };
      if (!(saveData as any).社交.关系) (saveData as any).社交.关系 = {};
      if (!(saveData as any).社交.关系[greyLady.名字]) {
        (saveData as any).社交.关系[greyLady.名字] = greyLady;
      }
    }
  }
}
