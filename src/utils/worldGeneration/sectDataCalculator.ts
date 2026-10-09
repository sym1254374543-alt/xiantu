/**
 * 势力数据自动计算器
 * 用算法确保数据的一致性，不依赖 AI 生成。
 *
 * 势力已不再统计"多少人"，故只保留**声望值**的计算。
 * （原「综合战力」依赖 最强修为/长老数量/各层弟子数，这些口径已废弃。）
 */

export interface SectCalculationData {
  名称: string;
  类型: string;
  等级: string;
  宗主修为?: string;
}

export interface CalculatedSectData {
  声望值: number;
}

/** 势力类型对声望的修正系数 */
const SECT_TYPE_MODIFIER: Record<string, number> = {
  // 现代地球势力
  官方机构: 1.1,
  财团企业: 1.0,
  家族世家: 0.9,
  研究所学院: 0.85,
  教团结社: 0.95,
  妖族: 1.05,
  // 古老道统（游戏中复苏后出现）
  修仙宗门: 1.0,
};

/** 按等级给声望基数 */
function baseReputationOf(level: string): number {
  switch (level) {
    case '超级': case '超级宗门': return 25;
    case '一流': case '一流宗门': return 20;
    case '二流': case '二流宗门': return 15;
    case '三流': case '三流宗门': return 10;
    default: return 5;
  }
}

/** 首领修为越高，势力声望越高（0-4） */
function realmBonusOf(realm: string): number {
  const order = ['练气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '渡劫'];
  const idx = order.findIndex((r) => !!r && realm.includes(r));
  if (idx < 0) return 0;
  return Math.min(4, Math.floor(idx / 2) + 1);
}

function calculateSectReputation(data: SectCalculationData): number {
  const baseReputation = baseReputationOf(data.等级);
  const typeBonus = SECT_TYPE_MODIFIER[data.类型] || 1.0;
  const randomFactor = 0.8 + Math.random() * 0.4;
  const finalReputation = Math.round((baseReputation * typeBonus + realmBonusOf(String(data.宗主修为 || ''))) * randomFactor);
  return Math.min(30, Math.max(0, finalReputation));
}

export function calculateSectData(data: SectCalculationData): CalculatedSectData {
  return { 声望值: calculateSectReputation(data) };
}

export function batchCalculateSectData(sectList: SectCalculationData[]): (SectCalculationData & CalculatedSectData)[] {
  return sectList.map((sect) => ({ ...sect, ...calculateSectData(sect) }));
}
