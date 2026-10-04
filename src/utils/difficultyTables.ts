/**
 * 判定系统难度常量表
 *
 * 核心设计理念：
 * - 基础值 = f(角色能力) - 角色有多强
 * - 难度 = f(事情本身) - 事情有多难
 * - 成功 = (基础值 + 幸运值 + 修正) >= 难度
 */

/**
 * 大道阶段对应的炼制能力加成
 * 阶段0-5分别对应：凡、黄、玄、地、天、仙品
 */
export const DAO_STAGE_BONUS = [5, 15, 30, 50, 75, 105] as const;

/**
 * 品质等级枚举（用于索引）
 */
export enum QualityLevel {
  凡品 = 0,
  黄品 = 1,
  玄品 = 2,
  地品 = 3,
  天品 = 4,
  仙品 = 5,
  神品 = 6,
}

/**
 * 品级枚举
 */
export enum ItemGrade {
  下品 = 0,
  中品 = 1,
  上品 = 2,
  极品 = 3,
}

/**
 * 炼制难度表：[品质][品级]
 * 行：凡、黄、玄、地、天、仙、神
 * 列：下品、中品、上品、极品
 */
export const CRAFTING_DIFFICULTY: readonly (readonly number[])[] = [
  [5, 8, 12, 18],        // 凡品
  [15, 20, 25, 35],      // 黄品
  [30, 38, 45, 60],      // 玄品
  [50, 60, 70, 90],      // 地品
  [75, 88, 100, 125],    // 天品
  [105, 120, 135, 160],  // 仙品
  [150, 175, 200, 250],  // 神品
] as const;

/**
 * 根据品质名称和品级获取炼制基准难度
 */
export function getCraftingDifficulty(quality: string, grade: string): number {
  const qualityMap: Record<string, number> = {
    '凡品': 0, '黄品': 1, '玄品': 2, '地品': 3,
    '天品': 4, '仙品': 5, '神品': 6,
  };
  const gradeMap: Record<string, number> = {
    '下品': 0, '中品': 1, '上品': 2, '极品': 3,
  };

  const qi = qualityMap[quality];
  const gi = gradeMap[grade];

  if (qi === undefined || gi === undefined) {
    // 未知品质或品级，返回中等难度
    return 50;
  }

  return CRAFTING_DIFFICULTY[qi][gi];
}

/**
 * 境界对应的战斗基础值（用于计算战斗难度）
 */
export const REALM_BASE_VALUES: Record<string, number> = {
  '凡人': 10,
  '练气': 15,
  '筑基': 25,
  '金丹': 40,
  '元婴': 58,
  '化神': 73,
  '渡劫': 88,
};

/**
 * 根据境界名称获取战斗基准难度（即对手的基础值）
 */
export function getCombatDifficulty(opponentRealm: string): number {
  return REALM_BASE_VALUES[opponentRealm] || 50;
}

/**
 * 社交难度基准值
 */
export const SOCIAL_DIFFICULTY = {
  普通村民: 10,
  商人: 15,
  散修: 20,
  外门弟子: 25,
  内门弟子: 35,
  核心弟子: 45,
  长老: 55,
  掌门: 70,
  仙人: 90,
} as const;

/**
 * 突破难度基准值（按目标境界）
 */
export const BREAKTHROUGH_DIFFICULTY = {
  练气: 15,
  筑基: 30,
  金丹: 50,
  元婴: 75,
  化神: 105,
  渡劫: 150,
} as const;

/**
 * 修炼功法难度基准值（按功法品质）
 */
export const CULTIVATION_DIFFICULTY = {
  凡品: 10,
  黄品: 20,
  玄品: 40,
  地品: 65,
  天品: 95,
  仙品: 130,
  神品: 180,
} as const;
