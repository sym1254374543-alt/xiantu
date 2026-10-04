/**
 * PVP 服务边界草案（仅类型，未实现、未接入主流程）
 *
 * 设计约束（见 重构协作计划.md 第 5 节）：
 * - 固定单世界规则，按赛季版本化；不复用单机存档数值
 * - 服务端权威：客户端只提交意图，境界/气血/灵气/大道等级/装备属性/伤害/胜负/奖励/排名全部由服务端结算
 * - PVP 临时战斗状态只存在服务端，客户端只读快照；本地变量面板、云存档同步都不能写入这些字段
 * - 与单机存档、云存档、本地记忆索引完全隔离：不读写 characterStore / gameStateStore / localMemoryIndex
 *
 * 后续实现建议放在 src/services/pvp/ 下（HTTP + WebSocket 客户端），UI 只依赖本文件的类型。
 */

/** 规则集版本，由服务端下发；客户端只展示，不参与计算 */
export interface PvpRuleset {
  rulesetId: string;
  season: string;
  version: number;
  realmRange: { min: string; max: string };
  maxDaoCount: number;
  turnLimit: number;
  turnTimeoutSec: number;
}

/** 客户端可提交的全部内容：只有意图，没有数值 */
export type PvpClientIntent =
  | { type: 'action'; turn: number; text: string; optionId?: string; targetId?: string; tactic?: string }
  | { type: 'surrender'; turn: number };

/** 服务端下发的只读快照 */
export interface PvpMatchSnapshot {
  matchId: string;
  rulesetId: string;
  turn: number;
  phase: 'waiting' | 'submitting' | 'resolving' | 'finished';
  /** 本回合双方是否已锁定行动（锁定前互不可见内容） */
  locked: Record<string, boolean>;
  players: Array<{
    playerId: string;
    name: string;
    realm: string;
    hp: { current: number; max: number };
    qi: { current: number; max: number };
    daos: Array<{ name: string; stage: string }>;
  }>;
  result?: { winnerId: string | null; reason: 'defeat' | 'surrender' | 'timeout' | 'draw' | 'disconnect' };
  updatedAt: string;
}

/** WebSocket 事件（服务端 → 客户端） */
export type PvpServerEvent =
  | { type: 'snapshot'; snapshot: PvpMatchSnapshot }
  | { type: 'turn_resolved'; turn: number; narrative: string; snapshot: PvpMatchSnapshot }
  | { type: 'opponent_locked'; turn: number }
  | { type: 'match_finished'; snapshot: PvpMatchSnapshot }
  | { type: 'error'; code: string; message: string };

/** 未来 PVP 客户端需要实现的接口 */
export interface PvpClient {
  getRuleset(): Promise<PvpRuleset>;
  joinQueue(characterId: string): Promise<{ ticketId: string }>;
  leaveQueue(ticketId: string): Promise<void>;
  submitIntent(matchId: string, intent: PvpClientIntent): Promise<void>;
  subscribe(matchId: string, onEvent: (event: PvpServerEvent) => void): () => void;
}
