/**
 * 境界工具函数
 * 用于格式化境界显示
 */

/**
 * 格式化境界和阶段显示
 * @param realm 境界对象或字符串
 * @returns 格式化后的境界字符串
 */
export function formatRealmWithStage(realm: any): string {
  if (!realm) {
    return '凡人';
  }

  // 如果是字符串，直接返回
  if (typeof realm === 'string') {
    return realm;
  }

  // 如果是对象，提取名称和阶段
  const name = realm.名称 || realm.name || '凡人';
  const stage = realm.阶段 || realm.stage || '';

  // 凡人不加阶段
  if (name === '凡人' || name === 'Mortal') {
    return '凡人';
  }

  // 如果有阶段，返回"境界+阶段"
  if (stage) {
    return `${name}·${stage}`;
  }

  // 否则只返回境界名称
  return name;
}
