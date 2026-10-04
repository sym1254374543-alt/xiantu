/**
 * 行动类型 → 行动队列文案。功法 / 大道 / 物品页的「通知 AI」按钮统一从这里取文案，
 * 提示词统一重构时只改这一处（docs/功能页重写规格.md 第 17 章）。
 */
import { useActionQueueStore } from '@/stores/actionQueueStore';

type Builder = (name: string, extra?: Record<string, unknown>) => { itemType: string; description: string };

export const ACTION_TEXTS: Record<string, Builder> = {
  cultivate: (n) => ({ itemType: '功法', description: `开始修炼《${n}》，提升功法熟练度` }),
  secluded_cultivation: (n) => ({ itemType: '闭关', description: `进入闭关状态，专心修炼《${n}》，效率大幅提升` }),
  deep_cultivation: (n, x) => ({ itemType: '功法', description: `对《${n}》进行${x?.days ?? 1}天的深度修炼` }),
  breakthrough: (n) => ({ itemType: '突破', description: `尝试突破《${n}》的当前境界，进入更高层次` }),
  comprehend: (n) => ({ itemType: '大道', description: `感悟《${n}》` }),
  meditate: (n) => ({ itemType: '大道', description: `深度参悟《${n}》` }),
  dao_breakthrough: (n) => ({ itemType: '大道', description: `尝试突破《${n}》境界` }),
  comprehend_from_technique: () => ({ itemType: '大道', description: '从已修炼的功法中领悟大道' }),
  comprehend_nature: () => ({ itemType: '大道', description: '观察天地自然，感悟大道法则' }),
};

/** 行动队列里的 type：深修记为 cultivate，空态领悟记为 comprehend（与旧版一致） */
const QUEUE_TYPE: Record<string, string> = {
  deep_cultivation: 'cultivate',
  comprehend_from_technique: 'comprehend',
  comprehend_nature: 'comprehend',
};

export function queueGameAction(kind: keyof typeof ACTION_TEXTS, name = '', extra?: Record<string, unknown>) {
  const text = ACTION_TEXTS[kind](name, extra);
  useActionQueueStore().addAction({
    type: (QUEUE_TYPE[kind] || kind) as any,
    itemName: name || text.itemType,
    itemType: text.itemType,
    description: text.description,
  });
  return text.description;
}
