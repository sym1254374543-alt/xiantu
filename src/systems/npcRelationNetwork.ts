/**
 * NPC关系网络系统
 * 处理NPC之间的关系逻辑
 */

import type { GameTime } from '../types/game';

export interface RelationEdge {
  from: string;
  to: string;
  relation: string;
  score: number;
  type: '单向' | '双向';
  tags?: string[];
  events?: string[];
  updatedAt: GameTime;
}

export interface RelationMatrix {
  edges: RelationEdge[];
}

export class NPCRelationNetwork {
  /**
   * 添加NPC关系
   */
  static addRelation(
    matrix: RelationMatrix,
    from: string,
    to: string,
    relation: string,
    score: number,
    type: '单向' | '双向',
    currentTime: GameTime
  ): void {
    const edge: RelationEdge = {
      from,
      to,
      relation,
      score,
      type,
      tags: [],
      events: [],
      updatedAt: currentTime,
    };
    matrix.edges.push(edge);
  }

  /**
   * 查询NPC的所有关系
   */
  static getRelations(matrix: RelationMatrix, npcName: string): RelationEdge[] {
    return matrix.edges.filter((e) => e.from === npcName || e.to === npcName);
  }

  /**
   * 查询两个NPC之间的关系
   */
  static getRelationBetween(
    matrix: RelationMatrix,
    npc1: string,
    npc2: string
  ): RelationEdge | undefined {
    return matrix.edges.find(
      (e) => (e.from === npc1 && e.to === npc2) || (e.from === npc2 && e.to === npc1)
    );
  }

  /**
   * 更新关系分数
   */
  static updateScore(
    matrix: RelationMatrix,
    from: string,
    to: string,
    delta: number,
    currentTime: GameTime
  ): void {
    const edge = matrix.edges.find((e) => e.from === from && e.to === to);
    if (edge) {
      edge.score = Math.max(-100, Math.min(100, edge.score + delta));
      edge.updatedAt = currentTime;
    }
  }

  /**
   * 记录关系事件
   */
  static addEvent(
    matrix: RelationMatrix,
    from: string,
    to: string,
    event: string
  ): void {
    const edge = matrix.edges.find((e) => e.from === from && e.to === to);
    if (edge) {
      edge.events = edge.events || [];
      edge.events.push(event);
    }
  }

  /**
   * 获取NPC的仇敌列表
   */
  static getEnemies(matrix: RelationMatrix, npcName: string): string[] {
    return matrix.edges
      .filter(
        (e) =>
          (e.from === npcName || e.to === npcName) &&
          e.relation === '仇敌' &&
          e.score < -20
      )
      .map((e) => (e.from === npcName ? e.to : e.from));
  }

  /**
   * 获取NPC的盟友列表
   */
  static getAllies(matrix: RelationMatrix, npcName: string): string[] {
    return matrix.edges
      .filter(
        (e) =>
          (e.from === npcName || e.to === npcName) &&
          (e.relation === '盟友' || e.relation === '同门') &&
          e.score > 20
      )
      .map((e) => (e.from === npcName ? e.to : e.from));
  }
}
