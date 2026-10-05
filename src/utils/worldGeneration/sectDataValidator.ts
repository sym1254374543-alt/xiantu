/**
 * 宗门数据验证器
 * 确保AI生成的宗门数据逻辑一致性
 */

import { FACTION_RANKS } from '@/utils/prompts/definitions/valueDomains';

// 境界等级映射 - 支持带"期"和不带"期"的格式
// 注意：同一境界的不同阶段（初期、中期、后期、圆满、极境）都算同一等级
const REALM_LEVELS: Record<string, number> = {
  // 不带期的格式
  '练气': 1, '练气初期': 1, '练气中期': 1, '练气后期': 1, '练气圆满': 1, '练气极境': 1,
  '筑基': 2, '筑基初期': 2, '筑基中期': 2, '筑基后期': 2, '筑基圆满': 2, '筑基极境': 2,
  '金丹': 3, '金丹初期': 3, '金丹中期': 3, '金丹后期': 3, '金丹圆满': 3, '金丹极境': 3,
  '元婴': 4, '元婴初期': 4, '元婴中期': 4, '元婴后期': 4, '元婴圆满': 4, '元婴极境': 4,
  '化神': 5, '化神初期': 5, '化神中期': 5, '化神后期': 5, '化神圆满': 5, '化神极境': 5,
  '炼虚': 6, '炼虚初期': 6, '炼虚中期': 6, '炼虚后期': 6, '炼虚圆满': 6, '炼虚极境': 6,
  '合体': 7, '合体初期': 7, '合体中期': 7, '合体后期': 7, '合体圆满': 7, '合体极境': 7,
  '渡劫': 8, '渡劫初期': 8, '渡劫中期': 8, '渡劫后期': 8, '渡劫圆满': 8, '渡劫极境': 8,

  // 带期的格式
  '练气期': 1, '筑基期': 2, '金丹期': 3, '元婴期': 4, '化神期': 5,
  '炼虚期': 6, '合体期': 7, '渡劫期': 8
};

/**
 * 获取境界等级
 */
function getRealmLevel(realm: string): number {
  return REALM_LEVELS[realm] || 0;
}

/** 大境界名（用于拼接合法的阶段写法）。剥掉小阶段后缀与"期"字 */
const BIG_REALMS = ['练气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '渡劫'];
function bigRealmOf(realm: string): string {
  const name = String(realm || '').replace(/期$/, '');
  return BIG_REALMS.find((r) => name.startsWith(r)) || name;
}

/**
 * 取境界分布里的最高境界（按 level 比较，取 level 最大者）。
 * 旧实现用"严格大于"遍历，遇到同 level 的多个 key 会停在**第一个**，
 * 因而"练气初期"常被当成最高境界——此处需返回 level 最高、且同 level 时
 * 取小阶段更靠后的那个。
 */
function highestRealmIn(dist: Record<string, number> | undefined): string {
  if (!dist || typeof dist !== 'object') return '';
  let best = '';
  let bestLevel = 0;
  let bestStage = -1;
  for (const [realm, count] of Object.entries(dist)) {
    if (!(Number(count) > 0)) continue;
    const level = getRealmLevel(realm);
    if (level === 0) continue;
    const stageText = String(realm).replace(/期$/, '').slice(bigRealmOf(realm).length);
    const stage = REALM_STAGE_ORDER.indexOf(stageText);
    if (level > bestLevel || (level === bestLevel && stage > bestStage)) {
      bestLevel = level;
      bestStage = stage;
      best = realm;
    }
  }
  return best;
}

/** 小阶段顺序（用于同境界内比较） */
const REALM_STAGE_ORDER = ['初期', '中期', '后期', '圆满', '极境'];

/**
 * 以「最强修为」为准校验成员分层：任何一层的境界都不得超过天花板。
 * 越界的层直接压到天花板对应的境界（人数不动，只改境界标注）。
 */
function validateRealmDistribution(sectData: any): void {
  const leadership = sectData?.领导层;
  const tiers = sectData?.成员数量?.成员 ?? sectData?.成员数量?.职位;
  if (!leadership || !Array.isArray(tiers)) return;

  const ceiling = String(leadership.最强修为 || '');
  const ceilingLevel = getRealmLevel(ceiling);
  if (ceilingLevel <= 0) return;

  for (const tier of tiers) {
    const level = getRealmLevel(String(tier?.境界 || ''));
    if (level > ceilingLevel) {
      console.warn(`[宗门验证] ${sectData.名称}: 成员层「${tier.名称}」境界 "${tier.境界}" 高于最强修为 "${ceiling}"，已压至 "${ceiling}"`);
      tier.境界 = ceiling;
    }
  }
}

/**
 * 归一化成员构成到「按职位分层」结构（成员:[{名称,人数,境界}]）。
 * 兼容旧存档的两种写法：
 *  - 按职位 + 按境界 两套映射（旧地球存档）
 *  - byPosition / byRealm 英文键（旧生成器）
 * 新结构只有一个「人数」口径，故旧数据只取「按职位」的人数，
 * 境界按层级从高到低就近分配（顶层给最强修为，底层给凡人）。
 */
function normalizeMemberTiers(sectData: any): void {
  const mc = sectData?.成员数量;
  if (!mc || typeof mc !== 'object') return;

  // 已是新结构
  if (Array.isArray(mc.成员) || Array.isArray(mc.职位)) {
    if (!Array.isArray(mc.成员) && Array.isArray(mc.职位)) mc.成员 = mc.职位;
    recomputeTotal(sectData);
    return;
  }

  const byPosition = mc.按职位 || mc.byPosition;
  if (!byPosition || typeof byPosition !== 'object') return;

  const ceiling = String(sectData?.领导层?.最强修为 || '').trim();
  const ceilingLevel = getRealmLevel(ceiling);
  const bigCeiling = ceilingLevel > 0 ? bigRealmOf(ceiling) : '';

  const entries = Object.entries(byPosition as Record<string, any>)
    .map(([name, n]) => ({ name, count: Number(n) || 0 }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count); // 人数多的在底，少的在顶

  // 层级境界由低到高排布（不采用旧数据里的境界 key——它们本身可能是损坏值，
  // 如"练气初圆满"）：人数最多的层是凡人，顶层给最强修为，中间层递推。
  const top = ceilingLevel > 0 ? `${bigCeiling}圆满` : '凡人';
  const mid = ceilingLevel > 1 ? `${bigCeiling}初期` : '练气初期';
  const ladder: string[] = ['凡人', mid, top];

  mc.成员 = entries.map((e, i) => ({
    名称: e.name,
    人数: e.count,
    // entries 已按人数降序：i=0 人数最多 → 取阶梯最低档
    境界: ladder[Math.min(i, ladder.length - 1)],
  }));

  delete mc.按境界;
  delete mc.byRealm;
  delete mc.按职位;
  delete mc.byPosition;
  recomputeTotal(sectData);
  console.warn(`[宗门验证] ${sectData.名称}: 成员构成已归一化为按职位分层（旧的两套统计不再维护）`);
}

/** 总数 = 各层人数之和 */
function recomputeTotal(sectData: any): void {
  const tiers = sectData?.成员数量?.成员;
  if (!Array.isArray(tiers)) return;
  const sum = tiers.reduce((s: number, t: any) => s + (Number(t?.人数) || 0), 0);
  if (sum > 0) sectData.成员数量.总数 = sum;
}

/**
 * 领导层字段名规范化。
 *
 * 旧键名 宗主/宗主修为/副宗主 是为"修仙宗门"起的，但地上还有财团、官方机构、
 * 研究所等现代组织——界面写"宗主：沈建国"就出戏了。
 * 这里按势力类型给出通用的 **首领/首领修为/副手**，同时保留旧键名作为别名，
 * 避免破坏仍在读 宗主 的地方（sectLeadershipUtils / sectContentService / 各视图）。
 */
function normalizeLeadership(sectData: any): void {
  const L = sectData?.领导层;
  if (!L || typeof L !== 'object') return;

  const ranks = FACTION_RANKS[String(sectData.类型 || '')] || FACTION_RANKS['修仙宗门'];
  const leaderTitle = ranks?.首领 || '首领';
  const deputyTitle = ranks?.副手 || '副手';

  // 首领 = 旧宗主（若 AI 已按新称谓写 首领，则反向兼容）
  const leaderName = L.首领 ?? L.宗主;
  const leaderRealm = L.首领修为 ?? L.宗主修为;
  const deputyName = L.副手 ?? L.副宗主;

  if (leaderName !== undefined) {
    L.首领 = leaderName;
    L.宗主 = leaderName; // 别名：旧读取方仍可用
  }
  if (leaderRealm !== undefined) {
    L.首领修为 = leaderRealm;
    L.宗主修为 = leaderRealm;
  }
  if (deputyName !== undefined) {
    L.副手 = deputyName;
    L.副宗主 = deputyName;
  }
  // 供界面显示该势力应有的首领称谓（财团=董事长、家族=家主……）
  L.首领称谓 = leaderTitle;
  L.副手称谓 = deputyTitle;
}

/**
 * 验证并修复宗门境界分布数据
 */
export function validateAndFixSectRealmData(sectData: any): any {
  if (!sectData) return sectData;

  // 字段名兼容：将英文字段名转换为中文字段名
  if (sectData.leadership && !sectData.领导层) {
    sectData.领导层 = sectData.leadership;
    delete sectData.leadership;
  }

  // 特殊规则：合欢宗若缺失“圣女”，自动补齐（避免只生成宗门不生成关键职位）
  const sectName = String(sectData.名称 || sectData.name || '');
  if (sectName.includes('合欢')) {
    if (!sectData.领导层) {
      sectData.领导层 = {
        宗主: '合欢老魔',
        宗主修为: sectData.最强修为 || '化神期',
        最强修为: sectData.最强修为 || '化神期',
        圣女: '灰夫人(合欢圣女)'
      };
    } else if (!sectData.领导层.圣女) {
      sectData.领导层.圣女 = '灰夫人(合欢圣女)';
    }
  } else if (sectData.领导层) {
    // 彩蛋限定：其他宗门不应出现“圣女/圣子”字段（即便AI生成了也移除）
    if ('圣女' in sectData.领导层) delete sectData.领导层.圣女;
    if ('圣子' in sectData.领导层) delete sectData.领导层.圣子;
  }

  // 处理 memberCount 字段
  if (sectData.memberCount && !sectData.成员数量) {
    sectData.成员数量 = {
      总数: sectData.memberCount.total,
      按境界: sectData.memberCount.byRealm,
      按职位: sectData.memberCount.byPosition
    };
    delete sectData.memberCount;
  }

  // 成员构成：归一化为「按职位分层」单一结构（兼容旧的两套统计写法）
  // 注意：必须放在「最强修为」修正**之后**——分层境界要按天花板推算，
  // 若先跑，损坏的天花板（如"练气初圆满"）会让 all 层退化成「凡人」。
  if (sectData.成员数量?.total !== undefined && sectData.成员数量.总数 === undefined) {
    sectData.成员数量.总数 = sectData.成员数量.total;
  }

  // ─── 最强修为是权威值 ───
  // 它表示该势力的战力天花板，成员分布应当服从于它；
  // 旧实现反过来用"分布里的最高 key"去覆盖它，且拼接时把"练气初期"拼成
  // "练气初圆满"这类不存在的阶段——此处改为：以 最强修为 为准，缺失/非法时才推断。
  const leadership = sectData.领导层;
  if (leadership) {
    const declared = String(leadership.最强修为 || '').trim();
    const declaredLevel = getRealmLevel(declared);

    if (declaredLevel > 0) {
      // 最强修为合法：仅校验一致性，不覆盖
      const masterLevel = getRealmLevel(leadership.宗主修为 || '');
      if (masterLevel > declaredLevel) {
        // 宗主比"最强"还强，说明最强修为写低了——按宗主修为抬高
        leadership.最强修为 = leadership.宗主修为;
        console.warn(`[宗门验证] ${sectData.名称}: 宗主修为高于最强修为，已抬高最强修为为 "${leadership.宗主修为}"`);
      } else if (!leadership.宗主修为) {
        leadership.宗主修为 = declared;
      }
    } else {
      // 最强修为缺失或非法：优先取宗主修为，其次取分布中的最高境界
      const fallback = leadership.宗主修为 || highestRealmIn(sectData.成员数量?.按境界);
      if (fallback) {
        const fixed = /^(凡人|练气|筑基|金丹|元婴|化神|炼虚|合体|渡劫)$/.test(String(fallback).trim())
          ? String(fallback).trim()
          : `${bigRealmOf(fallback)}圆满`;
        leadership.最强修为 = fixed;
        if (!leadership.宗主修为) leadership.宗主修为 = fixed;
        console.warn(`[宗门验证] ${sectData.名称}: 最强修为缺失/非法("${declared}")，已推断为 "${fixed}"`);
      }
    }
  }

  // 归一化成员构成（须在天花板修正之后，分层境界才推得准）
  normalizeMemberTiers(sectData);

  // 领导层字段名规范化：按势力类型给出 首领/副手（保留旧键名作别名）
  normalizeLeadership(sectData);

  // 校验：成员分层不得出现高于最强修为的境界（以最强修为为准，压回天花板）
  validateRealmDistribution(sectData);

  return sectData;
}

/**
 * 验证宗门数据的整体一致性
 */
export function validateSectConsistency(sectData: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!sectData) {
    errors.push('宗门数据为空');
    return { isValid: false, errors };
  }

  // 检查最强修为与境界分布的一致性
  const maxRealm = sectData.领导层?.最强修为 || sectData.最强修为;
  const maxLevel = getRealmLevel(maxRealm);

  if (sectData.成员数量?.按境界) {
    Object.keys(sectData.成员数量.按境界).forEach(realm => {
      const realmLevel = getRealmLevel(realm);
      if (realmLevel > maxLevel) {
        errors.push(`境界分布错误: 存在${realm}期修士，但最强修为仅为${maxRealm}`);
      }
    });
  }

  // 检查长老数量与高境界修士的合理性
  const elderCount = sectData.领导层?.长老数量;
  if (elderCount && sectData.成员数量?.按境界) {
    let highRealmCount = 0;
    Object.keys(sectData.成员数量.按境界).forEach(realm => {
      const realmLevel = getRealmLevel(realm);
      if (realmLevel >= 4) {
        highRealmCount += sectData.成员数量.按境界[realm] || 0;
      }
    });

    if (highRealmCount > elderCount * 2) {
      errors.push(`人员配置不合理: 长老${elderCount}位，但元婴期以上修士${highRealmCount}人`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * 批量验证并修复宗门数据列表
 */
export function validateAndFixSectDataList(sects: any[]): any[] {
  if (!Array.isArray(sects)) return sects;

  return sects.map(sect => {
    const fixedSect = validateAndFixSectRealmData(sect);
    const validation = validateSectConsistency(fixedSect);
    
    if (!validation.isValid) {
      console.warn(`[宗门验证] ${sect.名称 || '未知宗门'}存在问题:`, validation.errors);
    }
    
    return fixedSect;
  });
}
