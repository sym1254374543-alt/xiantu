/**
 * 势力数据验证器
 * 确保 AI 生成的势力数据逻辑一致。
 *
 * 设计变更：势力不再统计"多少人"（成员数量/最强修为/综合战力/各层弟子数均已废弃），
 * 改为**具名成员名单** `主要成员: [{名字,职位,境界?}]`。旧存档里的 成员数量 会被直接丢弃，
 * 不再参与任何推算（历史上它曾反向覆盖权威值并批量污染过 7 个势力）。
 */

import { cloneDeep } from 'lodash';
import { FACTION_RANKS } from '@/utils/prompts/definitions/valueDomains';

// 境界等级映射 - 支持带"期"和不带"期"的格式
// 同一境界的不同阶段（初期、中期、后期、圆满、极境）都算同一等级
const REALM_LEVELS: Record<string, number> = {
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

function getRealmLevel(realm: string): number {
  return REALM_LEVELS[realm] || 0;
}

const asText = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * 归一化具名成员名单（主要成员）。
 * 兼容 AI 可能写的英文键，丢掉没有姓名的条目；同名去重（保留先出现的）。
 * 同时删除已废弃的人数统计字段——它们会让 AI 与界面重新按"人头"思考。
 */
function normalizeMembers(sectData: any): void {
  delete sectData.成员数量;
  delete sectData.memberCount;

  const raw = sectData.主要成员 ?? sectData.members;
  if (!Array.isArray(raw)) {
    delete sectData.主要成员;
    delete sectData.members;
    return;
  }

  const seen = new Set<string>();
  const members: Array<{ 名字: string; 职位: string; 境界?: string }> = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const 名字 = asText(m.名字 ?? m.name);
    if (!名字 || seen.has(名字)) continue;
    seen.add(名字);
    const 境界 = asText(m.境界 ?? m.realm);
    members.push({
      名字,
      职位: asText(m.职位 ?? m.position ?? m.title) || '成员',
      ...(境界 ? { 境界 } : {}),
    });
  }

  delete sectData.members;
  sectData.主要成员 = members;
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
  // 副手修为：只留一个权威键（世界生成提示词用「副手修为」，契约用「副宗主修为」）
  if (L.副宗主修为 === undefined && typeof L.副手修为 === 'string') L.副宗主修为 = L.副手修为;
  delete L.副手修为;
  // 供界面显示该势力应有的首领称谓（财团=董事长、家族=家主……）
  L.首领称谓 = leaderTitle;
  L.副手称谓 = deputyTitle;

  // 已废弃的人数/战力字段：清掉，防止旧存档残留被界面重新显示
  delete L.长老数量;
  delete L.最强修为;
  delete L.综合战力;
  delete L.核心弟子数;
  delete L.内门弟子数;
  delete L.外门弟子数;
}

/**
 * 验证并修复**单个**势力数据。
 *
 * ⚠️**本函数直接修改传入的对象**（就地修复）。
 * 传进来的如果是 store / 响应式对象，就会把修改写回 store ——
 * 若调用点位于 computed 内，会造成无限重算（宗门页卡死事故的成因）。
 * 所以：**调用方必须先深拷贝**，或改用下面的 validateAndFixSectDataList。
 */
export function validateAndFixSectRealmData(sectData: any): any {
  if (!sectData) return sectData;

  // 字段名兼容：将英文字段名转换为中文字段名
  if (sectData.leadership && !sectData.领导层) {
    sectData.领导层 = sectData.leadership;
  }
  delete sectData.leadership;

  // 废弃的顶层字段（旧存档残留）
  delete sectData.最强修为;
  delete sectData.综合战力;

  // 特殊规则：合欢宗若缺失"圣女"，自动补齐（避免只生成宗门不生成关键职位）
  const sectName = String(sectData.名称 || sectData.name || '');
  if (sectName.includes('合欢')) {
    if (!sectData.领导层) {
      sectData.领导层 = {
        宗主: '合欢老魔',
        宗主修为: '化神期',
        圣女: '灰夫人(合欢圣女)'
      };
    } else if (!sectData.领导层.圣女) {
      sectData.领导层.圣女 = '灰夫人(合欢圣女)';
    }
  } else if (sectData.领导层) {
    // 彩蛋限定：其他宗门不应出现"圣女/圣子"字段（即便AI生成了也移除）
    if ('圣女' in sectData.领导层) delete sectData.领导层.圣女;
    if ('圣子' in sectData.领导层) delete sectData.领导层.圣子;
  }

  normalizeLeadership(sectData);
  normalizeMembers(sectData);

  return sectData;
}

/**
 * 验证势力数据的整体一致性
 */
export function validateSectConsistency(sectData: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!sectData) {
    errors.push('势力数据为空');
    return { isValid: false, errors };
  }

  const L = sectData.领导层;
  if (!L || typeof L !== 'object') {
    errors.push('缺少领导层');
  } else {
    if (!asText(L.宗主)) errors.push('领导层缺少首领姓名');
    if (!asText(L.宗主修为)) errors.push('领导层缺少首领修为');
    else if (getRealmLevel(asText(L.宗主修为)) === 0) {
      errors.push(`首领修为「${L.宗主修为}」不是合法境界`);
    }
  }

  const members = sectData.主要成员;
  if (members !== undefined && !Array.isArray(members)) {
    errors.push('主要成员必须是数组');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * 批量验证并修复势力数据列表。
 *
 * ⚠️**不修改传入的对象**，逐项深拷贝后再修复。
 * 原因：本函数会被 `useSectContext.allSects` 这个 **computed** 调用，而入参就是
 * store 里的活数组。若在 computed 求值过程中写回 reactive 状态，computed 会被
 * 自己失效并不断重算 —— 页面直接卡死。
 * （归一化里会给 `主要成员` 赋一个新数组，数组引用每次都变，所以更早那版
 *  "写一次就稳定"的校验器没暴露这个问题，改成具名名单后就踩到了。）
 */
export function validateAndFixSectDataList(sects: any[]): any[] {
  if (!Array.isArray(sects)) return sects;

  return sects.map(sect => {
    const fixedSect = validateAndFixSectRealmData(cloneDeep(sect));
    const validation = validateSectConsistency(fixedSect);

    if (!validation.isValid) {
      console.warn(`[势力验证] ${sect.名称 || '未知势力'}存在问题:`, validation.errors);
    }

    return fixedSect;
  });
}
