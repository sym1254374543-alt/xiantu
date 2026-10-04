/**
 * 轻量级快照：每次玩家行动前记一档，回退只撤最近这一档。
 */
import { ref } from 'vue';
import type { SaveData } from '@/types/game';

export interface Snapshot {
  id: string;
  timestamp: number;
  label: string;
  data: Partial<SaveData>;
  叙事历史: unknown[];
}

const MAX_SNAPSHOTS = 10;
const snapshots = new Map<string, Snapshot[]>();

/** 列表变化时递增，让界面上的回退按钮跟着更新。 */
export const snapshotVersion = ref(0);

function getKey(charId: string, slot: string): string {
  return `${charId}_${slot}`;
}

function touch(): void {
  snapshotVersion.value += 1;
}

function readNarrative(saveData: SaveData): unknown[] {
  const data = saveData as { 系统?: { 历史?: { 叙事?: unknown } }; 叙事历史?: unknown };
  const fromSystem = data.系统?.历史?.叙事;
  if (Array.isArray(fromSystem)) return fromSystem;
  if (Array.isArray(data.叙事历史)) return data.叙事历史;
  return [];
}

function extractCoreData(saveData: SaveData): Partial<SaveData> {
  return {
    角色: saveData.角色,
    社交: saveData.社交,
    世界: saveData.世界,
    元数据: saveData.元数据,
    宗门系统: saveData.宗门系统,
    三千大道: saveData.三千大道,
    修炼: saveData.修炼,
    功法系统: saveData.功法系统,
    技能状态: saveData.技能状态,
    效果: saveData.效果,
    事件系统: saveData.事件系统,
  };
}

function memoryPreview(saveData: SaveData): string {
  const memory = (saveData as { 社交?: { 记忆?: { 短期记忆?: unknown[] } } }).社交?.记忆?.短期记忆;
  const last = Array.isArray(memory) ? memory[memory.length - 1] : undefined;
  const text = typeof last === 'string' ? last : (last as { 内容?: string } | undefined)?.内容;
  const trimmed = text?.replace(/^【.*?】\s*/, '').trim();
  return trimmed ? trimmed.slice(0, 15) : '对话';
}

export function createSnapshot(charId: string, slot: string, saveData: SaveData, label?: string): void {
  const key = getKey(charId, slot);
  const list = snapshots.get(key) || [];

  const time = new Date();
  const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

  const snapshot: Snapshot = {
    id: `snap_${Date.now()}_${list.length}`,
    timestamp: Date.now(),
    label: label || `${timeStr} ${memoryPreview(saveData)}`,
    data: extractCoreData(saveData),
    叙事历史: JSON.parse(JSON.stringify(readNarrative(saveData))),
  };

  list.push(snapshot);
  if (list.length > MAX_SNAPSHOTS) list.shift();
  snapshots.set(key, list);
  touch();
}

/** 按时间从旧到新。返回副本，避免调用方 reverse 改到库存。 */
export function getSnapshots(charId: string, slot: string): Snapshot[] {
  return [...(snapshots.get(getKey(charId, slot)) || [])];
}

export function getSnapshot(charId: string, slot: string, id: string): Snapshot | null {
  return (snapshots.get(getKey(charId, slot)) || []).find(s => s.id === id) || null;
}

export function clearSnapshots(charId: string, slot: string): void {
  snapshots.delete(getKey(charId, slot));
  touch();
}

/** 删掉这一档以及比它更新的档。 */
export function deleteSnapshotsFrom(charId: string, slot: string, fromIndex: number): void {
  const list = snapshots.get(getKey(charId, slot));
  if (!list || fromIndex < 0 || fromIndex >= list.length) return;
  list.splice(fromIndex);
  touch();
}

export function restoreSnapshot(currentData: SaveData, snapshot: Snapshot): SaveData {
  const current = currentData as {
    系统?: { 历史?: Record<string, unknown> };
  };
  const narrative = JSON.parse(JSON.stringify(snapshot.叙事历史 || []));
  return {
    ...currentData,
    ...snapshot.data,
    系统: {
      ...(current.系统 || {}),
      历史: {
        ...(current.系统?.历史 || {}),
        叙事: narrative,
      },
    },
  };
}
