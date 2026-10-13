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

/** 世界.信息 里系统内部用、与叙事无关的字段 */
const WORLD_INFO_INTERNAL_KEYS = ['生成时间', '地图配置', '版本', '特殊设定'] as const;

/** 地点上恒为空数组的字段 */
const LOCATION_EMPTY_KEYS = ['特殊功能'] as const;

/** 势力上恒为空数组、且"能否加入"已由 可否加入 表达 */
const FACTION_EMPTY_KEYS = ['加入条件', '加入好处'] as const;

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

function stripKeys(list: unknown, keys: readonly string[]): void {
  if (!Array.isArray(list)) return;
  for (const item of list) {
    if (!isObj(item)) continue;
    for (const k of keys) delete item[k];
  }
}

/**
 * 大道阶段列表是**静态**数据（生成后不再变），每回合全发没有意义。
 * 只在 AI 需要引用阶段名/推演升阶时才有用，故保留「当前阶段」与「下一阶段」的完整对象，
 * 其余阶段只留名称。当前阶段是 0 基下标。
 */
function trimDaoStages(daos: unknown): void {
  if (!isObj(daos)) return;
  for (const dao of Object.values(daos)) {
    if (!isObj(dao) || !Array.isArray(dao.阶段列表)) continue;
    const cur = Number(dao.当前阶段);
    dao.阶段列表 = dao.阶段列表.map((stage: unknown, i: number) => {
      if (!isObj(stage)) return stage;
      if (i === cur || i === cur + 1) return stage;
      return { 名称: stage.名称 };
    });
  }
}

/**
 * 大陆信息是真实世界的静态地理，玩家一次只身处一个大洲。
 * 只保留玩家所在（或正前往）的大洲详情，其余只留名称与主要势力。
 */
function trimContinents(continents: unknown, playerPosition: unknown): void {
  if (!Array.isArray(continents)) return;
  const posText = String((playerPosition as any)?.描述 ?? '');
  for (const c of continents) {
    if (!isObj(c)) continue;
    const name = String(c.名称 ?? c.name ?? '');
    if (name && posText.includes(name)) continue;
    for (const k of Object.keys(c)) {
      if (k === '名称' || k === 'name' || k === '主要势力') continue;
      delete c[k];
    }
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
    stripKeys(info.势力信息, FACTION_EMPTY_KEYS);
    stripKeys(info.地点信息, LOCATION_EMPTY_KEYS);
    for (const key of ['大陆信息', 'continents'] as const) {
      stripKeys(info[key], CONTINENT_MIRROR_KEYS);
    }
    for (const k of WORLD_INFO_INTERNAL_KEYS) delete info[k];
    trimContinents(info.大陆信息, copy.角色?.位置);
  }

  // 世界背景在 角色.身份.世界.description 与 世界.信息.世界背景 各存一份（内容完全相同），删前者
  const idWorld = copy.角色?.身份?.世界;
  if (isObj(idWorld)) delete idWorld.description;

  trimDaoStages(copy.角色?.大道?.大道列表);

  return copy as T;
}
