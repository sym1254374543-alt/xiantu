/**
 * 增强版动作队列系统
 * 支持装备/使用物品的直接操作和撤回恢复功能
 */

import { useCharacterStore } from '@/stores/characterStore';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useActionQueueStore } from '@/stores/actionQueueStore';
import type { Item, SaveData, CultivationTechniqueReference } from '@/types/game';
import { toast } from './toast';
// import { getTavernHelper } from '@/utils/tavern'; // 已废弃：新架构中不再使用

export interface UndoAction {
  type: 'equip' | 'unequip' | 'use' | 'discard' | 'cultivate' | 'stop_cultivation';
  itemId: string;
  itemName: string;
  quantity?: number;
  // 撤回恢复数据
  restoreData?: {
    // 装备操作的恢复数据
    originalSlot?: string | null; // 原来在哪个装备槽位，null表示在背包
    replacedItem?: Item | null; // 被替换的装备
    // 使用/丢弃操作的恢复数据  
    originalQuantity?: number;
    // 功法修炼的恢复数据
    originalCultivationState?: {
      previousTechnique: CultivationTechniqueReference | null;
      wasInInventory: boolean;
    };
  };
  itemData?: Item;
}

export class EnhancedActionQueueManager {
  private static instance: EnhancedActionQueueManager | null = null;
  private undoActions: UndoAction[] = [];
  private readonly storageKey = 'dao_undo_actions';

  constructor() {
    this.loadUndoHistoryFromStorage();
  }
  
  static getInstance(): EnhancedActionQueueManager {
    if (!this.instance) {
      this.instance = new EnhancedActionQueueManager();
    }
    return this.instance;
  }

  private getEquipmentSlotItemId(slotValue: unknown): string | null {
    if (!slotValue) return null;
    if (typeof slotValue === 'string') return slotValue;
    if (typeof slotValue === 'object' && slotValue !== null && '物品ID' in slotValue) {
      const itemId = (slotValue as any).物品ID;
      return typeof itemId === 'string' ? itemId : null;
    }
    return null;
  }

  /**
   * 装备槽位只存物品ID(string|null)；完整物品数据在 角色.背包.物品
   * 兼容旧槽位存 {物品ID,名称} 的格式，并在此处统一归一化。
   */
  private ensureEquipmentSlots(saveData: SaveData): Record<string, string | null> {
    const defaultSlots: Record<string, string | null> = {
      装备1: null,
      装备2: null,
      装备3: null,
      装备4: null,
      装备5: null,
      装备6: null,
    };

    const anySave = saveData as any;
    if (!anySave.角色) anySave.角色 = {};
    const rawSlots = (anySave.角色.装备 ?? defaultSlots) as Record<string, unknown>;
    const normalized: Record<string, string | null> = { ...defaultSlots };

    for (let i = 1; i <= 6; i++) {
      const key = `装备${i}`;
      normalized[key] = this.getEquipmentSlotItemId(rawSlots?.[key]) ?? null;
    }

    anySave.角色.装备 = normalized;
    return normalized;
  }

  private ensureRoleBackpack(saveData: SaveData): any {
    const anySave = saveData as any;
    if (!anySave.角色) anySave.角色 = {};
    if (!anySave.角色.背包) anySave.角色.背包 = { 物品: {}, 灵石: { 下品: 0, 中品: 0, 上品: 0, 极品: 0 } };
    if (!anySave.角色.背包.物品) anySave.角色.背包.物品 = {};
    if (!anySave.角色.背包.灵石) anySave.角色.背包.灵石 = { 下品: 0, 中品: 0, 上品: 0, 极品: 0 };
    return anySave.角色.背包;
  }

  private ensureRoleCultivation(saveData: SaveData): any {
    const anySave = saveData as any;
    if (!anySave.角色) anySave.角色 = {};
    if (!anySave.角色.修炼) anySave.角色.修炼 = { 修炼功法: null, 修炼状态: { 模式: '未修炼' } };
    return anySave.角色.修炼;
  }
  
  /**
   * 装备物品 - 直接修改装备栏并支持撤回
   */
  async equipItem(item: Item): Promise<boolean> {
    const actionQueue = useActionQueueStore();

    try {
      // 🔥 [新架构] 从 gameStateStore 获取存档数据
      const gameStateStore = useGameStateStore();
      const saveData = gameStateStore.toSaveData();
      if (!saveData) {
        toast.error('存档数据不存在，无法装备');
        return false;
      }

      const equipmentSlots = this.ensureEquipmentSlots(saveData);

      // 检查是否已装备 - 物品是对象结构
      const inventoryItems = this.ensureRoleBackpack(saveData).物品;
      if (!inventoryItems || typeof inventoryItems !== 'object') {
        toast.error('背包数据异常');
        return false;
      }

      const inventoryItem = inventoryItems[item.物品ID];
      if (inventoryItem && inventoryItem.已装备 === true) {
        toast.info(`《${item.名称}》已经装备在身上了`);
        return false;
      }

      // 检查互斥操作：如果队列中有同一物品的卸下操作，先移除它
      this.removeConflictingActions(item.物品ID, 'unequip');

      // 寻找空槽位或需要替换的槽位
      let targetSlot: string | null = null;
      let replacedItem: Item | null = null;

      for (let i = 1; i <= 6; i++) {
        const slotKey = `装备${i}`;
        const slotItem = equipmentSlots[slotKey];
        if (!slotItem || slotItem === null) {
          targetSlot = slotKey;
          break;
        }
      }

      if (!targetSlot) {
        // 装备栏已满，替换第一个槽位
        targetSlot = '装备1';
        const replacedItemId = equipmentSlots[targetSlot];
        if (replacedItemId) {
          replacedItem = inventoryItems[replacedItemId] || null;
          if (replacedItem) {
            inventoryItems[replacedItemId] = { ...replacedItem, 已装备: false };
          }
        }
      }

      // 执行装备操作 - 槽位仅存物品ID
      equipmentSlots[targetSlot] = item.物品ID;

      // 设置物品的已装备标记 - 使用响应式替换
      if (inventoryItem) {
        inventoryItems[item.物品ID] = {
          ...inventoryItem,
          已装备: true
        };
      }

      console.log('装备操作完成:', {
        槽位: targetSlot,
        物品: item,
        装备栏状态: equipmentSlots
      });

      // 注意：不从背包中移除物品，装备和背包是独立的
      // 被替换的装备也不放回背包，而是丢失（符合游戏逻辑）

      // 应用装备属性加成到存档的 角色.身份.后天六司（V3）
      const { applyEquipmentBonus } = await import('./equipmentBonusApplier');
      applyEquipmentBonus(saveData, item.物品ID);

      // 🔥 [新架构] 更新 gameStateStore 并保存到 IndexedDB
      gameStateStore.loadFromSaveData(saveData);
      await gameStateStore.saveGame();

      // 创建撤回数据
      const undoAction: UndoAction = {
        type: 'equip',
        itemId: item.物品ID,
        itemName: item.名称,
        restoreData: {
          originalSlot: null, // 原来在背包
          replacedItem
        }
      };
      this.undoActions.push(undoAction);
      this.saveUndoHistoryToStorage();

      // 添加到动作队列显示
      actionQueue.addAction({
        type: 'equip',
        itemName: item.名称,
        itemType: item.类型,
        description: replacedItem
          ? `装备了《${item.名称}》，替换了《${replacedItem.名称}》`
          : `装备了《${item.名称}》`
      });

      // toast.success(`已装备《${item.名称}》`); // 弹窗逻辑已移至Store
      return true;

    } catch (error) {
      console.error('装备物品失败:', error);
      toast.error('装备失败');
      return false;
    }
  }
  
  /**
   * 卸下装备 - 直接修改装备栏并支持撤回
   */
  async unequipItem(item: Item): Promise<boolean> {
    const actionQueue = useActionQueueStore();

    try {
      // 🔥 [新架构] 从 gameStateStore 获取存档数据
      const gameStateStore = useGameStateStore();
      const saveData = gameStateStore.toSaveData();
      if (!saveData) {
        toast.error('装备栏数据不存在');
        return false;
      }

      const equipmentSlots = this.ensureEquipmentSlots(saveData);

      // 检查物品是否已装备 - 物品是对象结构
      const inventoryItems = this.ensureRoleBackpack(saveData).物品;
      if (!inventoryItems || typeof inventoryItems !== 'object') {
        toast.error('背包数据异常');
        return false;
      }

      const inventoryItem = inventoryItems[item.物品ID];
      if (!inventoryItem || inventoryItem.已装备 !== true) {
        toast.info(`《${item.名称}》未装备，无法卸下`);
        // 即使物品状态已经是"未装备"，也尝试同步一下装备栏，以防数据不一致
        let foundInSlots = false;
        for (let i = 1; i <= 6; i++) {
          const slotKey = `装备${i}`;
          if (equipmentSlots[slotKey] === item.物品ID) {
            equipmentSlots[slotKey] = null; // 清理掉残留的装备槽位
            foundInSlots = true;
          }
        }
        if (foundInSlots) {
          gameStateStore.loadFromSaveData(saveData);
          await gameStateStore.saveGame();
        }
        return false;
      }

      // 检查互斥操作：如果队列中有同一物品的装备操作，先移除它
      this.removeConflictingActions(item.物品ID, 'equip');

      // 找到物品在哪个槽位 - 只支持新的引用格式
      let sourceSlot: string | null = null;
      for (let i = 1; i <= 6; i++) {
        const slotKey = `装备${i}`;
        if (equipmentSlots[slotKey] === item.物品ID) {
          sourceSlot = slotKey;
          break;
        }
      }

      if (!sourceSlot) {
        toast.error('装备栏中未找到该装备，数据可能不一致');
        // 即使装备栏中没找到，也要清除已装备标记
        const backpack = this.ensureRoleBackpack(saveData);
        if (backpack?.物品?.[item.物品ID]) backpack.物品[item.物品ID].已装备 = false;
        gameStateStore.loadFromSaveData(saveData);
        await gameStateStore.saveGame();
        return true;
      }

      // 执行卸下操作
      equipmentSlots[sourceSlot] = null;

      // 清除物品的已装备标记 - 使用响应式替换
      if (inventoryItem) {
        inventoryItems[item.物品ID] = {
          ...inventoryItem,
          已装备: false
        };
        console.log('卸下装备完成:', {
          物品: item.名称,
          物品ID: item.物品ID,
          清空槽位: sourceSlot,
          已装备状态: false
        });
      } else {
        console.warn('背包中未找到物品:', item.物品ID);
      }

      // 注意：不需要将装备放回背包，因为装备从未从背包中移除

      // 移除装备属性加成从存档的 角色.身份.后天六司（V3）
      const { removeEquipmentBonus } = await import('./equipmentBonusApplier');
      removeEquipmentBonus(saveData, item.物品ID);

      // 🔥 [新架构] 更新 gameStateStore 并保存到 IndexedDB
      gameStateStore.loadFromSaveData(saveData);
      await gameStateStore.saveGame();

      // 创建撤回数据
      const undoAction: UndoAction = {
        type: 'unequip',
        itemId: item.物品ID,
        itemName: item.名称,
        restoreData: {
          originalSlot: sourceSlot
        }
      };
      this.undoActions.push(undoAction);
      this.saveUndoHistoryToStorage();

      // 添加到动作队列显示
      actionQueue.addAction({
        type: 'unequip',
        itemName: item.名称,
        itemType: item.类型,
        description: `卸下了《${item.名称}》`
      });

      // toast.success(`已卸下《${item.名称}》`); // 弹窗逻辑已移至Store
      return true;

    } catch (error) {
      console.error('卸下装备失败:', error);
      toast.error('卸下失败');
      return false;
    }
  }
  
  /**
   * 使用物品 - 直接减少数量并支持撤回
   */
  async useItem(item: Item, quantity: number = 1): Promise<boolean> {
    const actionQueue = useActionQueueStore();

    try {
      // 🔥 [新架构] 从 gameStateStore 获取存档数据
      const gameStateStore = useGameStateStore();
      const saveData = gameStateStore.toSaveData();
      if (!saveData) {
        toast.error('存档数据不存在');
        return false;
      }

      const backpack = this.ensureRoleBackpack(saveData);
      const inventoryItem = backpack?.物品?.[item.物品ID];
      if (!inventoryItem || inventoryItem.数量 < quantity) {
        toast.error('物品数量不足');
        return false;
      }

      const originalQuantity = inventoryItem.数量;
      const itemToStore = JSON.parse(JSON.stringify(inventoryItem)); // Deep copy before modification

      // 执行使用操作
      if (inventoryItem.数量 === quantity) {
        // 完全使用完，删除物品
        delete backpack.物品[item.物品ID];
      } else {
        // 减少数量
        inventoryItem.数量 -= quantity;
      }

      // 🔥 [新架构] 更新 gameStateStore 并保存到 IndexedDB
      gameStateStore.updateInventory({ 物品: backpack.物品 });
      await gameStateStore.saveGame();

      // 创建撤回数据
      const undoAction: UndoAction = {
        type: 'use',
        itemId: item.物品ID,
        itemName: item.名称,
        quantity,
        restoreData: {
          originalQuantity
        },
        itemData: itemToStore
      };
      this.undoActions.push(undoAction);
      this.saveUndoHistoryToStorage();

      // 添加到动作队列显示
      const consumableTypes = ['丹药', '材料', '其他'];
      const useEffect = (consumableTypes.includes(item.类型) && '使用效果' in item) ? item.使用效果 : item.描述 || '无特殊效果';
      actionQueue.addAction({
        type: 'use',
        itemName: item.名称,
        itemType: item.类型,
        description: `使用了 ${quantity} 个《${item.名称}》（效果：${useEffect}）`
      });

      // toast.success(`使用了 ${quantity} 个《${item.名称}》`); // 弹窗逻辑已移至Store
      return true;

    } catch (error) {
      console.error('使用物品失败:', error);
      toast.error('使用失败');
      return false;
    }
  }
  
  /**
   * 丢弃物品 - 扣数量（为 0 删除）+ 记入行动队列，可撤回
   */
  async discardItem(item: Item, quantity: number = 1): Promise<boolean> {
    const actionQueue = useActionQueueStore();
    try {
      const gameStateStore = useGameStateStore();
      const saveData = gameStateStore.toSaveData();
      if (!saveData) {
        toast.error('存档数据不存在');
        return false;
      }

      const backpack = this.ensureRoleBackpack(saveData);
      const inventoryItem = backpack?.物品?.[item.物品ID];
      if (!inventoryItem || inventoryItem.数量 < quantity) {
        toast.error('物品数量不足');
        return false;
      }
      if (inventoryItem.已装备) {
        toast.warning('请先卸下再丢弃');
        return false;
      }

      const originalQuantity = inventoryItem.数量;
      const itemToStore = JSON.parse(JSON.stringify(inventoryItem));
      if (inventoryItem.数量 === quantity) delete backpack.物品[item.物品ID];
      else inventoryItem.数量 -= quantity;

      gameStateStore.updateInventory({ 物品: backpack.物品 });
      await gameStateStore.saveGame();

      this.undoActions.push({
        type: 'discard',
        itemId: item.物品ID,
        itemName: item.名称,
        quantity,
        restoreData: { originalQuantity },
        itemData: itemToStore,
      });
      this.saveUndoHistoryToStorage();

      actionQueue.addAction({
        type: 'discard',
        itemName: item.名称,
        itemType: item.类型,
        description: `丢弃了 ${quantity} 个《${item.名称}》`,
      });
      return true;
    } catch (error) {
      console.error('丢弃物品失败:', error);
      toast.error('丢弃失败');
      return false;
    }
  }

  /**
   * 修炼功法 - 直接修改修炼状态并支持撤回
   */
  async cultivateItem(item: Item): Promise<boolean> {
    const actionQueue = useActionQueueStore();

    try {
      // 🔥 [新架构] 从 gameStateStore 获取存档数据
      const gameStateStore = useGameStateStore();
      const saveData = gameStateStore.toSaveData();
      if (!saveData) {
        toast.error('存档数据不存在，无法修炼功法');
        return false;
      }

      if (item.类型 !== '功法') {
        toast.error('只能修炼功法类物品');
        return false;
      }

      // 获取背包物品对象
      const inventoryItems = this.ensureRoleBackpack(saveData).物品;
      if (!inventoryItems || typeof inventoryItems !== 'object') {
        toast.error('背包数据异常');
        return false;
      }

      let previousTechnique: CultivationTechniqueReference | null = null;

      // 检查是否已经在修炼其他功法
      const cultivationState = this.ensureRoleCultivation(saveData);
      const currentTechnique = cultivationState.修炼功法;
      if (currentTechnique && currentTechnique.物品ID !== item.物品ID) {
        // 保存完整的功法数据+进度
        previousTechnique = { ...currentTechnique };

        // 清除之前功法的已装备状态 - 使用响应式替换
        const previousId = currentTechnique.物品ID;
        const previousInventoryItem = inventoryItems[previousId];
        if (previousInventoryItem && previousInventoryItem.类型 === '功法') {
          inventoryItems[previousId] = {
            ...previousInventoryItem,
            已装备: false,
            修炼中: false
          };
        }
      }

      // 获取功法的完整数据作为基础
      const inventoryItem = inventoryItems[item.物品ID];
      if (!inventoryItem || inventoryItem.类型 !== '功法') {
        toast.error('物品不是功法类型');
        return false;
      }

      // 设置修炼功法 - 只存储引用（物品ID和名称）
      // 修炼进度存储在背包物品中，不存储在这里
      cultivationState.修炼功法 = {
        物品ID: inventoryItem.物品ID,
        名称: inventoryItem.名称
      };

      // 设置功法的已装备和修炼中标记 - 使用响应式替换
      inventoryItems[item.物品ID] = {
        ...inventoryItem,
        已装备: true,
        修炼中: true
      };
      // 移除时间戳记录，简化逻辑

      // 注意：修炼功法不从背包移除，功法和背包是独立的

      // 🔥 [新架构] 更新 gameStateStore 并保存到 IndexedDB
      gameStateStore.loadFromSaveData(saveData);
      await gameStateStore.saveGame();

      // 创建撤回数据
      const undoAction: UndoAction = {
        type: 'cultivate',
        itemId: item.物品ID,
        itemName: item.名称,
        restoreData: {
          originalCultivationState: {
            previousTechnique,
            wasInInventory: true
          }
        }
      };
      this.undoActions.push(undoAction);
      this.saveUndoHistoryToStorage();
      
      // 添加到动作队列显示
      actionQueue.addAction({
        type: 'cultivate',
        itemName: item.名称,
        itemType: item.类型,
        description: previousTechnique 
          ? `开始修炼《${item.名称}》功法，停止修炼《${previousTechnique.名称}》`
          : `开始修炼《${item.名称}》功法`
      });
      
      // toast.success(`开始修炼《${item.名称}》`); // 弹窗逻辑已移至Store
      return true;
      
    } catch (error) {
      console.error('修炼功法失败:', error);
      toast.error('修炼功法失败');
      return false;
    }
  }
  
  /**
   * 停止修炼功法
   */
  async stopCultivation(item: Item): Promise<boolean> {
    const actionQueue = useActionQueueStore();

    try {
      // 🔥 [新架构] 从 gameStateStore 获取存档数据
      const gameStateStore = useGameStateStore();
      const saveData = gameStateStore.toSaveData();
      if (!saveData) {
        toast.error('存档数据不存在');
        return false;
      }

      const cultivationState = this.ensureRoleCultivation(saveData);
      if (!cultivationState?.修炼功法) {
        toast.error('当前没有正在修炼的功法');
        return false;
      }

      const techniqueToStop = cultivationState.修炼功法;
      const techniqueId = techniqueToStop.物品ID;
      const techniqueName = techniqueToStop.名称;

      if (techniqueName !== item.名称) {
        toast.error('操作的功法与当前修炼的功法不符');
        return false;
      }

      // 获取背包物品对象
      const inventoryItems = this.ensureRoleBackpack(saveData).物品;
      if (!inventoryItems || typeof inventoryItems !== 'object') {
        toast.error('背包数据异常');
        return false;
      }

      const inventoryItem = inventoryItems[techniqueId];

      // 清空修炼槽位，设置修炼状态为false（设置为null）
      cultivationState.修炼功法 = null;

      // 清除功法的已装备和修炼中标记 - 使用响应式替换
      if (inventoryItem && inventoryItem.类型 === '功法') {
        inventoryItems[techniqueId] = {
          ...inventoryItem,
          已装备: false,
          修炼中: false
        };
      }

      // 注意：停止修炼功法不放回背包，功法和背包是独立的

      // 🔥 [新架构] 更新 gameStateStore 并保存到 IndexedDB
      gameStateStore.loadFromSaveData(saveData);
      await gameStateStore.saveGame();

      // 创建撤回数据 - 保存完整的功法数据+进度
      const undoAction: UndoAction = {
        type: 'cultivate',
        itemId: item.物品ID,
        itemName: item.名称,
        restoreData: {
          originalCultivationState: {
            previousTechnique: techniqueToStop ? { ...techniqueToStop } : null,
            wasInInventory: false
          }
        }
      };
      this.undoActions.push(undoAction);
      this.saveUndoHistoryToStorage();
      
      // 添加到动作队列显示
      actionQueue.addAction({
        type: 'stop_cultivation',
        itemName: item.名称,
        itemType: item.类型,
        description: `停止修炼《${item.名称}》功法`
      });
      
      // toast.success(`已停止修炼《${item.名称}》`); // 弹窗逻辑已移至Store
      return true;
      
    } catch (error) {
      console.error('停止修炼失败:', error);
      toast.error('停止修炼失败');
      return false;
    }
  }
  
  /**
   * 撤回上一个动作
   */
  async undoLastAction(): Promise<boolean> {
    if (this.undoActions.length === 0) {
      toast.info('未找到可撤回的动作记录，可能已清空或刷新后丢失');
      return false;
    }

    const lastAction = this.undoActions.pop()!;
    this.saveUndoHistoryToStorage();
    const actionQueue = useActionQueueStore();

    try {
      // 🔥 [新架构] 从 gameStateStore 获取存档数据
      const gameStateStore = useGameStateStore();
      const saveData = gameStateStore.toSaveData();
      if (!saveData) {
        toast.error('存档数据不存在');
        return false;
      }
      
      switch (lastAction.type) {
        case 'equip':
          await this.undoEquip(lastAction, saveData);
          break;
        case 'unequip':
          await this.undoUnequip(lastAction, saveData);
          break;
        case 'use':
        case 'discard':
          await this.undoUse(lastAction, saveData);
          break;
        case 'cultivate':
          await this.undoCultivate(lastAction, saveData);
          break;
      }

      // 撤回改的是 saveData 副本，需要写回 store 并落盘
      gameStateStore.loadFromSaveData(saveData);
      await gameStateStore.saveGame();

      // 从动作队列中移除最后一个对应的动作
      const actions = actionQueue.pendingActions;
      for (let i = actions.length - 1; i >= 0; i--) {
        if (actions[i].itemName === lastAction.itemName && actions[i].type === lastAction.type) {
          actionQueue.removeAction(actions[i].id);
          break;
        }
      }
      
      // toast.success(`已撤回：${lastAction.itemName}`); // 弹窗逻辑已移至Store
      return true;
      
    } catch (error) {
      console.error('撤回动作失败:', error);
      toast.error('撤回失败');
      return false;
    }
  }

  /**
   * 按动作类型与物品名撤回（用于从动作队列点击撤回时）
   */
  async undoByItemName(type: UndoAction['type'], itemName: string): Promise<boolean> {
    if (this.undoActions.length === 0) {
      toast.info('未找到可撤回的动作记录，可能已清空或刷新后丢失');
      return false;
    }

    // 从后向前查找匹配的撤回记录
    let index = -1;
    for (let i = this.undoActions.length - 1; i >= 0; i--) {
      const a = this.undoActions[i];
      if (a.type === type && a.itemName === itemName) {
        index = i;
        break;
      }
    }

    if (index === -1) {
      toast.info('未找到该动作的撤回记录');
      return false;
    }

    const action = this.undoActions.splice(index, 1)[0];
    this.saveUndoHistoryToStorage();

    try {
      // 🔥 [新架构] 从 gameStateStore 获取存档数据
      const gameStateStore = useGameStateStore();
      const saveData = gameStateStore.toSaveData();
      if (!saveData) {
        toast.error('当前存档不存在，无法撤回');
        return false;
      }

      switch (action.type) {
        case 'equip':
          await this.undoEquip(action, saveData);
          break;
        case 'unequip':
          await this.undoUnequip(action, saveData);
          break;
        case 'use':
        case 'discard':
          await this.undoUse(action, saveData);
          break;
        case 'cultivate':
          await this.undoCultivate(action, saveData);
          break;
        default:
          break;
      }

      // NEW: Also remove from the UI action queue
      const actionQueue = useActionQueueStore();
      const uiActions = actionQueue.pendingActions;
      // Find the corresponding UI action and remove it
      for (let i = uiActions.length - 1; i >= 0; i--) {
          if (uiActions[i].itemName === itemName && uiActions[i].type === type) {
              actionQueue.removeAction(uiActions[i].id);
              break; // Remove only one, the last one
          }
      }

      // 🔥 [新架构] 更新 gameStateStore 并保存到 IndexedDB
      gameStateStore.loadFromSaveData(saveData);
      await gameStateStore.saveGame();
      // toast.success(`已撤回：${action.itemName}`); // 弹窗逻辑已移至Store
      return true;
    } catch (error) {
      console.error('按名称撤回失败:', error);
      toast.error('撤回失败');
      return false;
    }
  }
  
  private async undoEquip(action: UndoAction, saveData: SaveData): Promise<void> {
    const equipmentSlots = this.ensureEquipmentSlots(saveData);
    const inventoryItems = this.ensureRoleBackpack(saveData).物品;
    // 找到装备的位置并卸下
    for (let i = 1; i <= 6; i++) {
      const slotKey = `装备${i}`;
      if (equipmentSlots[slotKey] === action.itemId) {
        // 移除装备属性加成（撤回装备 = 卸下装备）
        const { removeEquipmentBonus } = await import('./equipmentBonusApplier');
        removeEquipmentBonus(saveData, action.itemId);

        // 卸下装备
        equipmentSlots[slotKey] = null;

        // 清除物品的已装备标记
        if (inventoryItems?.[action.itemId]) {
          const inventoryItem = inventoryItems[action.itemId];
          inventoryItems[action.itemId] = { ...inventoryItem, 已装备: false };
        }

        // 如果有被替换的装备，恢复它
        if (action.restoreData?.replacedItem) {
          // 应用被替换装备的属性加成
          const { applyEquipmentBonus } = await import('./equipmentBonusApplier');
          applyEquipmentBonus(saveData, action.restoreData.replacedItem.物品ID);

          equipmentSlots[slotKey] = action.restoreData.replacedItem.物品ID;
          // 设置被替换物品的已装备标记
          if (inventoryItems?.[action.restoreData.replacedItem.物品ID]) {
            const replacedInventoryItem = inventoryItems[action.restoreData.replacedItem.物品ID];
            inventoryItems[action.restoreData.replacedItem.物品ID] = { ...replacedInventoryItem, 已装备: true };
          }
        }

        break;
      }
    }
  }

  /**
   * 从撤回历史中移除一个动作记录
   */
  removeUndoAction(type: string, itemName: string): void {
    const index = this.undoActions.findIndex(
      a => a.type === type && a.itemName === itemName
    );
    if (index !== -1) {
      this.undoActions.splice(index, 1);
      this.saveUndoHistoryToStorage();
      console.log('[撤销历史] 移除了一个已抵消的动作:', { type, itemName });
    }
  }
  
  private async undoUnequip(action: UndoAction, saveData: SaveData): Promise<void> {
    // 撤回卸下操作 = 重新装备
    if (!action.restoreData?.originalSlot) return;

    const originalSlot = action.restoreData.originalSlot;
    const equipmentSlots = this.ensureEquipmentSlots(saveData);

    // 重新装备到原来的槽位
    equipmentSlots[originalSlot] = action.itemId;

    // 设置物品的已装备标记
    const inventoryItems = this.ensureRoleBackpack(saveData).物品;
    if (inventoryItems?.[action.itemId]) {
      const inventoryItem = inventoryItems[action.itemId];
      inventoryItems[action.itemId] = { ...inventoryItem, 已装备: true };
    }

    // 应用装备属性加成
    const { applyEquipmentBonus } = await import('./equipmentBonusApplier');
    applyEquipmentBonus(saveData, action.itemId);
  }
  
  private async undoUse(action: UndoAction, saveData: SaveData): Promise<void> {
    if (action.itemData) {
        const backpack = this.ensureRoleBackpack(saveData);
        backpack.物品[action.itemId] = JSON.parse(JSON.stringify(action.itemData));
    } else {
        toast.warning('物品已完全消失，且无备份数据，无法恢复');
    }
  }
  
  private async undoCultivate(action: UndoAction, saveData: SaveData): Promise<void> {
    const cultivationState = action.restoreData?.originalCultivationState;
    if (!cultivationState) return;

    // 获取背包物品对象
    const inventoryItems = this.ensureRoleBackpack(saveData).物品;
    if (!inventoryItems || typeof inventoryItems !== 'object') {
      console.error('背包数据异常，无法撤回修炼');
      return;
    }

    const cultivation = this.ensureRoleCultivation(saveData);

    // 由于修炼功法不再涉及背包操作，撤回时只需要恢复修炼状态
    if (cultivationState.previousTechnique) {
      // 恢复之前的修炼功法 - previousTechnique 现在已包含完整的数据+进度
      const previousId = cultivationState.previousTechnique.物品ID;
      cultivation.修炼功法 = { ...cultivationState.previousTechnique };

      // 标记背包中的功法为已装备和修炼中
      const previousItem = inventoryItems[previousId];
      if (previousItem && previousItem.类型 === '功法') {
        inventoryItems[previousId] = {
          ...previousItem,
          已装备: true,
          修炼中: true
        };
      }
    } else {
      // 清空修炼槽位
      cultivation.修炼功法 = null;
    }

  }
  
  /**
   * 清空撤回历史
   */
  clearUndoHistory(): void {
    this.undoActions = [];
    this.saveUndoHistoryToStorage();
  }
  
  /**
   * 获取可撤回动作数量
   */
  getUndoActionsCount(): number {
    return this.undoActions.length;
  }
  
  /**
   * 移除冲突的动作（装备/卸下互斥）
   */
  private removeConflictingActions(itemId: string, conflictType: 'equip' | 'unequip'): void {
    const actionQueue = useActionQueueStore();
    
    // 从显示队列中移除冲突的动作
    const conflictingActions = actionQueue.pendingActions.filter(action => 
      action.itemName && action.type === conflictType && 
      // 这里需要通过名称匹配，因为action中没有itemId
      this.findItemByName(action.itemName)?.物品ID === itemId
    );
    
    conflictingActions.forEach(action => {
      actionQueue.removeAction(action.id);
    });
    
    // 从撤回历史中移除对应的记录
    this.undoActions = this.undoActions.filter(undoAction => 
      !(undoAction.itemId === itemId && undoAction.type === conflictType)
    );
    this.saveUndoHistoryToStorage();
    
    if (conflictingActions.length > 0) {
      toast.info('已移除冲突的操作');
    }
  }
  
  /**
   * 通过名称查找物品（辅助函数）
   */
  private findItemByName(itemName: string): Item | null {
    const gameStateStore = useGameStateStore();
    const saveData = gameStateStore.toSaveData();
    if (!saveData) return null;

    const equipmentSlots = this.ensureEquipmentSlots(saveData);
    const inventoryItems = this.ensureRoleBackpack(saveData).物品;
    
    // 在背包中查找
    if (inventoryItems) {
      for (const item of Object.values(inventoryItems as Record<string, any>)) {
        if (item && typeof item === 'object' && (item as any).名称 === itemName) {
          return item as Item;
        }
      }
    }
    
    // 在装备槽位中查找（槽位存物品ID，需回查背包）
    for (let i = 1; i <= 6; i++) {
      const slotKey = `装备${i}`;
      const equippedItemId = equipmentSlots[slotKey];
      if (!equippedItemId) continue;
      const equippedItem = inventoryItems?.[equippedItemId];
      if (equippedItem && equippedItem.名称 === itemName) return equippedItem;
    }
    
    return null;
  }
  
  /**
   * 🔥 [已废弃] 同步装备栏到酒馆变量
   * 新架构中数据已在 gameStateStore 统一管理，无需单独同步
   */
  private async syncEquipmentToTavern(saveData: SaveData): Promise<void> {
    console.warn('[装备同步] syncEquipmentToTavern 已废弃，新架构中数据由 gameStateStore 统一管理');
    // 保留空实现以兼容旧代码，避免调用出错
  }

  /**
   * 🔥 [已废弃] 同步背包到酒馆变量
   * 新架构中数据已在 gameStateStore 统一管理，无需单独同步
   */
  private async syncInventoryToTavern(saveData: SaveData): Promise<void> {
    console.warn('[背包同步] syncInventoryToTavern 已废弃，新架构中数据由 gameStateStore 统一管理');
    // 保留空实现以兼容旧代码，避免调用出错
  }

  /**
   * 撤回历史持久化
   */
  private saveUndoHistoryToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.undoActions));
    } catch (e) {
      console.warn('[撤回历史] 保存失败:', e);
    }
  }

  private loadUndoHistoryFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.undoActions = parsed as UndoAction[];
        }
      }
    } catch (e) {
      console.warn('[撤回历史] 加载失败:', e);
    }
  }
}
