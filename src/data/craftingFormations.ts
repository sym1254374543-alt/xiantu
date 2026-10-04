/**
 * 炼制阵法：额外消耗 = 当前灵气 / 神识的百分比。炼丹、炼器各 8 种（原在 CraftingPanel 组件里）。
 */
import type { CraftingType } from '@/utils/craftingSystem';

export interface FormationOption {
  id: string;
  name: string;
  desc: string;
  extraManaPercent: number;
  extraSpiritPercent: number;
}

export const CRAFTING_FORMATIONS: Record<CraftingType, FormationOption[]> = {
  炼丹: [
    { id: 'none', name: '无阵', desc: '不布阵，省力但更吃手感。', extraManaPercent: 0, extraSpiritPercent: 0 },
    { id: 'stable', name: '稳灵阵', desc: '稳住灵力流转，容错更高。', extraManaPercent: 4, extraSpiritPercent: 2 },
    { id: 'gather', name: '聚灵阵', desc: '聚拢灵气，适合药力凝聚。', extraManaPercent: 8, extraSpiritPercent: 3 },
    { id: 'focus', name: '凝神阵', desc: '凝神守一，适合控火与细节推衍。', extraManaPercent: 4, extraSpiritPercent: 8 },
    { id: 'condense', name: '凝丹阵', desc: '专注于成丹瞬间的凝结，风险也更集中。', extraManaPercent: 10, extraSpiritPercent: 10 },
    { id: 'purify', name: '净尘阵', desc: '祛杂去秽，降低杂质干扰。', extraManaPercent: 6, extraSpiritPercent: 4 },
    { id: 'seal', name: '封息阵', desc: '封住炉内药气，避免外泄与串味。', extraManaPercent: 7, extraSpiritPercent: 5 },
    { id: 'balance', name: '阴阳调和阵', desc: '调和阴阳，适合多性材料。', extraManaPercent: 9, extraSpiritPercent: 9 },
  ],
  炼器: [
    { id: 'none', name: '无阵', desc: '不布阵，靠锻打与心神掌控。', extraManaPercent: 0, extraSpiritPercent: 0 },
    { id: 'stable', name: '稳灵阵', desc: '稳住灵力灌注，减少走火与裂纹。', extraManaPercent: 4, extraSpiritPercent: 2 },
    { id: 'gather', name: '聚灵阵', desc: '提高灵力供给，利于材质融合。', extraManaPercent: 8, extraSpiritPercent: 3 },
    { id: 'focus', name: '凝神阵', desc: '加强神识操控，利于刻纹与成型。', extraManaPercent: 4, extraSpiritPercent: 8 },
    { id: 'temper', name: '淬器阵', desc: '专用于淬火定型，成器更锋，但更耗心神。', extraManaPercent: 10, extraSpiritPercent: 10 },
    { id: 'forge', name: '锻纹阵', desc: '加速刻纹与铭刻，适合复杂器胚。', extraManaPercent: 8, extraSpiritPercent: 12 },
    { id: 'bind', name: '缚形阵', desc: '束缚形态，减少成型偏差。', extraManaPercent: 9, extraSpiritPercent: 6 },
    { id: 'resonance', name: '共鸣阵', desc: '引导材质共鸣，利于高品质跃迁。', extraManaPercent: 12, extraSpiritPercent: 12 },
  ],
};

/** 火候：≤25 文火 / ≤50 中火 / ≤75 武火 / 其余暴火 */
export function fireLabel(percent: number): '文火' | '中火' | '武火' | '暴火' {
  if (percent <= 25) return '文火';
  if (percent <= 50) return '中火';
  if (percent <= 75) return '武火';
  return '暴火';
}
