/**
 * 境界排序提示：把「练气 / 筑基 …」以及武道体系「淬体 / 凝气 …」映射成可比较的等级。
 * 地图生成、未收录地点、宗门任务的地图上下文共用（原先各组件各抄一份）。
 */
const REALM_ORDER_HINTS: Array<[string, number]> = [
  ['凡人', 0], ['练气', 1], ['筑基', 2], ['金丹', 3], ['元婴', 4], ['化神', 5], ['炼虚', 6], ['合体', 7], ['大乘', 8], ['渡劫', 9],
  ['真仙', 10], ['金仙', 11], ['太乙', 12], ['大罗', 13],
  ['淬体', 1], ['凝气', 2], ['通玄', 3], ['化真', 4], ['破虚', 5], ['登天', 6],
];

/** 未识别返回 -1 */
export function realmRank(name: string): number {
  const raw = String(name || '').trim();
  if (!raw) return -1;
  let best = -1;
  for (const [token, rank] of REALM_ORDER_HINTS) if (raw.includes(token)) best = Math.max(best, rank);
  return best;
}
