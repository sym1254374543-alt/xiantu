/**
 * 发给 AI 的「游戏状态」视图。
 *
 * 背景：`stateForAI = cloneDeep(v3)`，AI 拿到的是**原始存档**，因此旧存档里那些
 * 只给代码兼容用的英文镜像键会每回合原样发出去。实测用户存档里
 * 世界.信息 26,956 字中有 16,637 字是英文键，其中约 1.1 万字是纯重复。
 *
 * 这里**只删除确证冗余的键**（白名单式删除，不做「删掉所有英文键」这种一刀切）：
 * 坐标（coordinates / x / y）、物品品质（quality / grade）、灵根（name / tier）、
 * 天赋（id / name / description / effects）等都是**唯一载体**，必须保留。
 *
 * 约定：本函数只作用于**发给 AI 的那份副本**，绝不写回存档。
 */
import { cloneDeep } from 'lodash';

/** 势力上纯英文镜像键（中文键 领导层/可否加入/加入条件/加入好处/势力范围详情 才是权威） */
const FACTION_MIRROR_KEYS = [
  'leadership',
  'canJoin',
  'joinRequirements',
  'benefits',
  'territoryInfo',
] as const;

/** 势力上已废弃的键：人头统计（含其英文镜像）——本次改版后势力只用「主要成员」具名名单 */
const FACTION_DEPRECATED_KEYS = [
  '成员数量',
  'memberCount',
] as const;

/** 大陆上的英文镜像键（权威是 大洲边界） */
const CONTINENT_MIRROR_KEYS = ['continent_bounds'] as const;

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

function stripKeys(list: unknown, keys: readonly string[]): void {
  if (!Array.isArray(list)) return;
  for (const item of list) {
    if (!isObj(item)) continue;
    for (const k of keys) delete item[k];
  }
}

/**
 * 生成发给 AI 的状态副本（深拷贝后删冗余键）。
 * 传进来的对象不会被修改。
 *
 * 深拷贝用 lodash 的 cloneDeep 而非 structuredClone：酒馆助手 3.6.11 环境下
 * structuredClone 有问题（见 sectContentService / characterCreationStore 的同类处理）。
 */
export function toPromptState<T>(state: T): T {
  if (!isObj(state)) return state;
  const copy = cloneDeep(state) as Record<string, any>;

  const info = copy.世界?.信息;
  if (isObj(info)) {
    stripKeys(info.势力信息, FACTION_MIRROR_KEYS);
    stripKeys(info.势力信息, FACTION_DEPRECATED_KEYS);
    for (const key of ['大陆信息', 'continents'] as const) {
      stripKeys(info[key], CONTINENT_MIRROR_KEYS);
    }
  }

  return copy as T;
}
