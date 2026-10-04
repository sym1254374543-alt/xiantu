// src/utils/indexedDBManager.ts
import type { LocalStorageRoot, SaveData } from '@/types/game';
import { buildSaveDataKey, isSaveDataKeyOfCharacter } from '@/utils/saveIdentity';

/**
 * @fileoverview
 * 乾坤宝库 (V4 - IndexedDB版本)
 * 使用 IndexedDB 存储大容量存档数据，解决 localStorage 5-10MB 限制问题
 * @author 千夜 (qianye60) | CC BY-NC-SA 4.0
 */

// XianTu by qianye60 - https://github.com/qianye60
const DB_NAME = 'DAD_SAVES_DB';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const ROOT_KEY = 'root_data'; // 兼容旧数据，但未来会被逐步取代
const CHARACTERS_KEY = 'characters';
const ACTIVE_SAVE_KEY = 'active_save';


// IndexedDB 实例缓存
let dbInstance: IDBDatabase | null = null;

/**
 * 打开/创建 IndexedDB 数据库
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // 如果已经有缓存的实例，直接返回
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('【乾坤宝库-IDB】数据库打开失败:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('【乾坤宝库-IDB】数据库已打开');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 创建对象存储（类似于表）
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        console.log('【乾坤宝库-IDB】对象存储已创建:', STORE_NAME);
      }
    };
  });
}

/**
 * 获取空的根数据结构
 */
function getEmptyRoot(): LocalStorageRoot {
  return {
    当前激活存档: null,
    角色列表: {},
  };
}

/**
 * 从 IndexedDB 加载根数据
 */
export async function loadRootData(): Promise<LocalStorageRoot> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);

    const charactersReq = objectStore.get(CHARACTERS_KEY);
    const activeSaveReq = objectStore.get(ACTIVE_SAVE_KEY);

    return new Promise((resolve, reject) => {
      let characters: Record<string, any> | null = null;
      let activeSave: any = null;
      let completed = 0;

      const checkCompletion = () => {
        if (completed === 2) {
          console.log('【乾坤宝库-IDB】分片数据加载完成');
          resolve({
            角色列表: characters || {},
            当前激活存档: activeSave || null,
          });
        }
      };

      charactersReq.onsuccess = () => {
        characters = charactersReq.result?.data || {};
        completed++;
        checkCompletion();
      };
      charactersReq.onerror = () => reject(charactersReq.error);

      activeSaveReq.onsuccess = () => {
        activeSave = activeSaveReq.result?.data || null;
        completed++;
        checkCompletion();
      };
      activeSaveReq.onerror = () => reject(activeSaveReq.error);
    });
  } catch (error) {
    console.error('【乾坤宝库-IDB】加载根数据时出错:', error);
    return getEmptyRoot();
  }
}

/**
 * 将根数据保存到 IndexedDB
 */
// 辅助函数：保存单个键值对
export async function saveData(key: string, data: any): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.put({
      id: key,
      data: JSON.parse(JSON.stringify(data)), // 清理数据
      timestamp: new Date().toISOString(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveCharacters(characters: LocalStorageRoot['角色列表']): Promise<void> {
  try {
    console.log('[IndexedDB-保存角色] 准备保存角色列表, 角色数:', Object.keys(characters).length);
    await saveData(CHARACTERS_KEY, characters);
    console.log('[IndexedDB-保存角色] ✅ 角色列表已保存到 IndexedDB');
  } catch (error) {
    console.error('[IndexedDB-保存角色] ❌ 保存角色列表失败:', error);
    throw error;
  }
}

export async function saveActiveSave(activeSave: LocalStorageRoot['当前激活存档']): Promise<void> {
  try {
    await saveData(ACTIVE_SAVE_KEY, activeSave);
    console.log('【乾坤宝库-IDB】当前激活存档已保存');
  } catch (error) {
    console.error('【乾坤宝库-IDB】保存当前激活存档失败:', error);
    throw error;
  }
}

export async function saveRootData(root: LocalStorageRoot): Promise<void> {
  try {
    console.log('[IndexedDB-保存] 开始保存根数据');
    console.log('[IndexedDB-保存] 角色列表键名:', Object.keys(root.角色列表));
    console.log('[IndexedDB-保存] 当前激活存档:', root.当前激活存档);

    await Promise.all([
      saveCharacters(root.角色列表),
      saveActiveSave(root.当前激活存档),
    ]);

    console.log('[IndexedDB-保存] ✅ 根数据（分片）保存成功');
  } catch (error) {
    console.error('[IndexedDB-保存] ❌ 保存根数据时出错:', error);
    throw error;
  }
}

/**
 * 清除所有数据
 */
export async function clearAllLocalData(): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onsuccess = () => {
        console.log('【乾坤宝库-IDB】已执行虚空破碎，所有数据已清除');
        resolve();
      };

      request.onerror = () => {
        console.error('【乾坤宝库-IDB】清除数据失败:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('【乾坤宝库-IDB】清除数据时出错:', error);
    throw error;
  }
}

/**
 * 从 localStorage 迁移数据到 IndexedDB
 * 这个函数会在应用启动时自动调用一次
 */
export async function migrateData(): Promise<boolean> {
  try {
    // 1. 从 localStorage 迁移
    const OLD_LS_KEY = 'DAD_SAVES_V3';
    const oldLSData = localStorage.getItem(OLD_LS_KEY);
    if (oldLSData) {
      console.log('【乾坤宝库-IDB】检测到localStorage数据，开始迁移...');
      const parsedData = JSON.parse(oldLSData) as LocalStorageRoot;
      await saveRootData(parsedData);
      localStorage.setItem('DAD_SAVES_V3_BACKUP', oldLSData);
      localStorage.removeItem(OLD_LS_KEY);
      console.log('【乾坤宝库-IDB】✅ localStorage 数据迁移完成！');
      return true;
    }

    // 2. 从旧的单体 IndexedDB 记录迁移到分片记录
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const oldRootReq = objectStore.get(ROOT_KEY);

    return new Promise((resolve, reject) => {
      oldRootReq.onsuccess = async () => {
        const oldRoot = oldRootReq.result;
        if (oldRoot && oldRoot.data && (oldRoot.data.角色列表 || oldRoot.data.当前激活存档)) {
          console.log('【乾坤宝库-IDB】检测到旧的单体DB记录，开始分片迁移...');
          try {
            const data = oldRoot.data as LocalStorageRoot;
            await saveCharacters(data.角色列表 || {});
            await saveActiveSave(data.当前激活存档 || null);
            
            // 删除旧的单体记录
            const deleteReq = objectStore.delete(ROOT_KEY);
            deleteReq.onsuccess = () => {
              console.log('【乾坤宝库-IDB】✅ 旧的单体DB记录已成功迁移并删除');
              resolve(true);
            };
            deleteReq.onerror = () => {
               console.error('【乾坤宝库-IDB】❌ 删除旧的单体DB记录失败:', deleteReq.error);
               reject(deleteReq.error);
            };
          } catch (error) {
            console.error('【乾坤宝库-IDB】❌ 分片迁移失败:', error);
            reject(error);
          }
        } else {
          console.log('【乾坤宝库-IDB】无需数据迁移');
          resolve(false);
        }
      };
      oldRootReq.onerror = () => {
        console.error('【乾坤宝库-IDB】❌ 检查旧数据失败:', oldRootReq.error);
        reject(oldRootReq.error);
      };
    });
  } catch (error) {
    console.error('【乾坤宝库-IDB】❌ 数据迁移过程出错:', error);
    return false;
  }
}

/**
 * 获取数据库统计信息（用于调试）
 */
export async function getStorageStats(): Promise<{ itemCount: number; estimatedSize: string }> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const countRequest = objectStore.count();

      countRequest.onsuccess = () => {
        const itemCount = countRequest.result;

        // 尝试估算大小（需要读取实际数据）
        const getAllRequest = objectStore.getAll();

        getAllRequest.onsuccess = () => {
          const allData = getAllRequest.result;
          const estimatedBytes = JSON.stringify(allData).length;
          const estimatedMB = (estimatedBytes / 1024 / 1024).toFixed(2);

          resolve({
            itemCount,
            estimatedSize: `~${estimatedMB} MB`
          });
        };

        getAllRequest.onerror = () => {
          resolve({
            itemCount,
            estimatedSize: '未知'
          });
        };
      };

      countRequest.onerror = () => {
        reject(countRequest.error);
      };
    });
  } catch (error) {
    console.error('【乾坤宝库-IDB】获取统计信息失败:', error);
    return { itemCount: 0, estimatedSize: '未知' };
  }
}

/**
 * 🔥 新增：保存激活存档的 SaveData 到 IndexedDB
 * 用于替代酒馆变量存储
 * @param characterId 角色ID
 * @param slotId 存档槽位ID
 * @param saveDataContent 完整的游戏存档数据
 */
export async function saveSaveData(
  characterId: string,
  slotId: string,
  saveDataContent: SaveData
): Promise<void> {
  try {
    const key = buildSaveDataKey(characterId, slotId);
    await saveData(key, saveDataContent);
    console.log(`【乾坤宝库-IDB】SaveData 已保存 (${characterId}/${slotId})`);
  } catch (error) {
    console.error('【乾坤宝库-IDB】保存 SaveData 失败:', error);
    throw error;
  }
}

/**
 * 🔥 新增：从 IndexedDB 加载激活存档的 SaveData
 * 用于替代从酒馆变量读取
 * @param characterId 角色ID
 * @param slotId 存档槽位ID
 * @returns SaveData 或 null（如果不存在）
 */
export async function loadSaveData(
  characterId: string,
  slotId: string
): Promise<SaveData | null> {
  try {
    const key = buildSaveDataKey(characterId, slotId);
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.data) {
          console.log(`【乾坤宝库-IDB】SaveData 已加载 (${characterId}/${slotId})`);
          resolve(result.data as SaveData);
        } else {
          // 兼容：联机存档槽位历史上使用过 “存档” / “云端修行” 两种 key
          // - v3.7.x 常见：存档
          // - v4.0+ 常见：云端修行
          const alias =
            slotId === '云端修行' ? '存档' :
            slotId === '存档' ? '云端修行' :
            null;

          if (!alias) {
            console.warn(`【乾坤宝库-IDB】SaveData 不存在 (${characterId}/${slotId})`);
            resolve(null);
            return;
          }

          const aliasKey = buildSaveDataKey(characterId, alias);
          const aliasReq = objectStore.get(aliasKey);
          aliasReq.onsuccess = () => {
            const aliasResult = aliasReq.result;
            if (aliasResult && aliasResult.data) {
              console.warn(`【乾坤宝库-IDB】SaveData 未命中(${slotId})，回退命中(${alias}) (${characterId}/${slotId})`);
              resolve(aliasResult.data as SaveData);
            } else {
              console.warn(`【乾坤宝库-IDB】SaveData 不存在 (${characterId}/${slotId})`);
              resolve(null);
            }
          };
          aliasReq.onerror = () => {
            console.error('【乾坤宝库-IDB】加载 SaveData 失败(别名):', aliasReq.error);
            reject(aliasReq.error);
          };
        }
      };

      request.onerror = () => {
        console.error('【乾坤宝库-IDB】加载 SaveData 失败:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('【乾坤宝库-IDB】加载 SaveData 时出错:', error);
    return null;
  }
}

/**
 * 🔥 新增：删除指定的 SaveData
 * @param characterId 角色ID
 * @param slotId 存档槽位ID
 */
export async function deleteSaveData(
  characterId: string,
  slotId: string
): Promise<void> {
  try {
    const key = buildSaveDataKey(characterId, slotId);
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(key);

      request.onsuccess = () => {
        console.log(`【乾坤宝库-IDB】SaveData 已删除 (${characterId}/${slotId})`);
        resolve();
      };

      request.onerror = () => {
        console.error('【乾坤宝库-IDB】删除 SaveData 失败:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('【乾坤宝库-IDB】删除 SaveData 时出错:', error);
    throw error;
  }
}

/**
 * 🔥 新增：批量删除指定角色的所有存档数据
 * @param characterId 角色ID
 * @param knownCharacterIds 全部已知角色ID，用于排除“以本角色ID为前缀”的其他角色存档
 * @returns 删除的记录数量
 */
export async function deleteAllSaveDataForCharacter(characterId: string, knownCharacterIds: string[] = []): Promise<number> {
  try {
    const db = await openDatabase();
    
    console.log(`【乾坤宝库-IDB】开始清理角色 ${characterId} 的所有存档...`);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      
      // 获取所有键
      const getAllKeysRequest = objectStore.getAllKeys();
      
      getAllKeysRequest.onsuccess = () => {
        const allKeys = getAllKeysRequest.result as string[];
        // 筛选出该角色的所有存档键
        const keysToDelete = allKeys.filter(key =>
          typeof key === 'string' && isSaveDataKeyOfCharacter(key, characterId, knownCharacterIds)
        );
        
        console.log(`【乾坤宝库-IDB】找到 ${keysToDelete.length} 个存档记录待删除:`, keysToDelete);
        
        if (keysToDelete.length === 0) {
          console.log(`【乾坤宝库-IDB】没有找到需要删除的存档`);
          resolve(0);
          return;
        }
        
        // 批量删除
        let deleteCount = 0;
        let errorCount = 0;
        
        keysToDelete.forEach(key => {
          const deleteRequest = objectStore.delete(key);
          
          deleteRequest.onsuccess = () => {
            deleteCount++;
            console.log(`【乾坤宝库-IDB】✅ 已删除: ${key}`);
            
            if (deleteCount + errorCount === keysToDelete.length) {
              console.log(`【乾坤宝库-IDB】批量删除完成，成功 ${deleteCount} 个，失败 ${errorCount} 个`);
              resolve(deleteCount);
            }
          };
          
          deleteRequest.onerror = () => {
            errorCount++;
            console.error(`【乾坤宝库-IDB】❌ 删除失败: ${key}`, deleteRequest.error);
            
            if (deleteCount + errorCount === keysToDelete.length) {
              console.log(`【乾坤宝库-IDB】批量删除完成，成功 ${deleteCount} 个，失败 ${errorCount} 个`);
              resolve(deleteCount);
            }
          };
        });
      };
      
      getAllKeysRequest.onerror = () => {
        console.error('【乾坤宝库-IDB】获取所有键失败:', getAllKeysRequest.error);
        reject(getAllKeysRequest.error);
      };
    });
  } catch (error) {
    console.error('【乾坤宝库-IDB】批量删除存档数据时出错:', error);
    throw error;
  }
}

/**
 * 从 IndexedDB 加载任意数据
 * @param key 要加载的数据的键
 * @returns 数据或 null
 */
export async function loadFromIndexedDB(key: string): Promise<any | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.data) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`【乾坤宝库-IDB】从 IndexedDB 加载数据失败 (key: ${key}):`, error);
    return null;
  }
}
