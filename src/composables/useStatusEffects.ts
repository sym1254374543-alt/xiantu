/**
 * 状态效果（角色.效果）的增删。
 *
 * 平时由 AI 通过 `push 角色.效果` / `delete 角色.效果[n]` 维护（易容、隐身、伪装成凡人、
 * 敛息这类「当前形态」都写在这里）；本 composable 给状态栏一个**手动解除**的兜底入口，
 * 免得 AI 忘了解除、状态一直挂着。
 *
 * 写模式与 useBank/useWallet 一致：克隆 → 改 → updateState → 存档。
 */
import { computed } from 'vue';
import { cloneDeep } from 'lodash';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore';
import type { StatusEffect } from '@/types/game';

export function useStatusEffects() {
  const gs = useGameStateStore();
  const characterStore = useCharacterStore();

  const effects = computed<StatusEffect[]>(() => (Array.isArray(gs.effects) ? (gs.effects as StatusEffect[]) : []));

  const write = async (mutate: (list: StatusEffect[]) => StatusEffect[]) => {
    const next = mutate(cloneDeep(effects.value));
    gs.updateState('effects', next);
    await characterStore.saveCurrentGame();
    return next;
  };

  /** 按名称解除一条状态（同名只留一条语义，全部移除） */
  const removeByName = async (name: string) => {
    const target = String(name || '').trim();
    if (!target) return effects.value;
    return write((list) => list.filter((e) => String(e?.状态名称 || '').trim() !== target));
  };

  /** 添加/覆盖一条状态 */
  const upsert = async (effect: StatusEffect) =>
    write((list) => [...list.filter((e) => String(e?.状态名称 || '').trim() !== String(effect.状态名称).trim()), effect]);

  return { effects, removeByName, upsert };
}
