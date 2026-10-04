import { request } from '@/services/httpClient';

/**
 * 向后端提交角色创建信息
 */
export async function createCharacter(characterData: unknown): Promise<unknown> {
  return await request.post<unknown>('/api/v1/characters/create', characterData);
}

export interface CloudSaveResponse {
  version?: number;
  last_sync?: string;
  /** 服务端采用乐观锁时，版本落后会返回 conflict=true 或 HTTP 409。 */
  conflict?: boolean;
}

/** 更新角色存档数据到云端。 */
export async function updateCharacterSave(charId: string, saveData: unknown): Promise<CloudSaveResponse> {
  return await request.put<CloudSaveResponse>(`/api/v1/characters/${charId}/save`, saveData);
}

/**
 * 获取角色详情（联机模式：用于拉取云端权威存档）
 */
export async function fetchCharacterProfile(charId: string): Promise<unknown> {
  return await request.get<unknown>(`/api/v1/characters/${charId}`);
}

/** 删除云端角色及其存档；后端不存在该角色时视为已删除。 */
export async function deleteCharacter(charId: string): Promise<void> {
  await request.delete(`/api/v1/characters/${charId}`, { silent: true });
}

export interface RealmLeaderboardItem {
  rank: number;
  name: string;
  realm: string;
  stage: string;
  label: string;
  progress: number;
  progress_max: number;
  mine: boolean;
}

/** 云端修为榜。后端未部署该接口时由调用方静默处理。 */
export async function fetchRealmLeaderboard(limit = 20): Promise<RealmLeaderboardItem[]> {
  const data = await request.get<{ items?: RealmLeaderboardItem[] }>(
    `/api/v1/characters/leaderboard?limit=${limit}`,
    { silent: true },
  );
  return Array.isArray(data?.items) ? data.items : [];
}


