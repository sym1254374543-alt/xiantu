/**
 * 钱包：新货币系统 inventory.货币 + 货币设置；旧 inventory.灵石 只做兼容同步。
 * 汇率 = 价值度 × 所在地区市场倍率（worldInfo.经济.地区波动[地点].货币波动[币种]，夹在 0.6–1.6）。
 * 读是纯 computed；写都走「克隆 → 修改 → updateState 整体替换 → 存档」。
 */
import { computed } from 'vue';
import { cloneDeep } from 'lodash';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore';
import { DEFAULT_BASE_CURRENCY_ID, DEFAULT_CURRENCIES, normalizeInventoryCurrencies, syncWalletToLegacySpiritStones } from '@/utils/currencySystem';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** 相邻面额：兑换 = 往上换，分解 = 往下拆，基准比 100，手续费 2% */
const LADDER: Record<string, { up?: string; down?: string }> = {
  灵石_下品: { up: '灵石_中品' },
  灵石_中品: { up: '灵石_上品', down: '灵石_下品' },
  灵石_上品: { up: '灵石_极品', down: '灵石_中品' },
  灵石_极品: { down: '灵石_上品' },
  铜币: { up: '银两' },
  银两: { up: '金锭', down: '铜币' },
  金锭: { down: '银两' },
};
const ORDER = ['灵石_下品', '灵石_中品', '灵石_上品', '灵石_极品', '铜币', '银两', '金锭'];
const FEE = 0.02;
const RATIO = 100;

export interface CurrencyRow {
  id: string;
  name: string;
  amount: number;
  desc: string;
  valueDegree: number;
  baseValue: number;
  /** 灵石面额越高越亮 */
  tier: number;
  up?: { to: string; toName: string; cost: number };
  down?: { to: string; toName: string; yield: number };
}

export function useWallet() {
  const gs = useGameStateStore();
  const characterStore = useCharacterStore();

  /** 只读视图：旧存档没有「货币」时在副本上迁移出来显示，不写回 store */
  const wallet = computed<Record<string, any>>(() => {
    const inv = gs.inventory as any;
    const w = inv?.货币;
    if (w && typeof w === 'object' && !Array.isArray(w) && Object.keys(w).length) return w;
    if (!inv) return {};
    const copy = cloneDeep(inv);
    normalizeInventoryCurrencies(copy);
    return copy.货币 || {};
  });

  const marketKey = computed(() => String((gs.location as any)?.描述 || '全局'));

  const multiplierOf = (id: string): number => {
    const eco = (gs.worldInfo as any)?.经济;
    const raw = eco?.地区波动?.[marketKey.value]?.货币波动?.[id] ?? eco?.货币波动?.[id] ?? 1;
    return clamp(num(raw, 1), 0.6, 1.6);
  };

  const baseId = computed(() => {
    const raw = (gs.inventory as any)?.货币设置?.基准币种;
    const c = typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_BASE_CURRENCY_ID;
    if (c in wallet.value) return c;
    if (DEFAULT_BASE_CURRENCY_ID in wallet.value) return DEFAULT_BASE_CURRENCY_ID;
    return Object.keys(wallet.value)[0] || DEFAULT_BASE_CURRENCY_ID;
  });

  const nameOf = (id: string) => {
    const n = wallet.value[id]?.名称 ?? (DEFAULT_CURRENCIES as any)[id]?.名称;
    return typeof n === 'string' && n.trim() ? n.trim() : id;
  };
  const baseName = computed(() => nameOf(baseId.value));

  const valueDegreeOf = (id: string) => num(wallet.value[id]?.价值度, num((DEFAULT_CURRENCIES as any)[id]?.价值度, 0));

  const toBase = (id: string, amount: number) => {
    const denom = (valueDegreeOf(baseId.value) || 1) * multiplierOf(baseId.value) || 1;
    return (amount * valueDegreeOf(id) * multiplierOf(id)) / denom;
  };

  const rows = computed<CurrencyRow[]>(() => {
    const ids = Object.keys(wallet.value);
    const extra = ids.filter((id) => !ORDER.includes(id)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return [...ORDER.filter((id) => ids.includes(id)), ...extra].map((id) => {
      const asset = wallet.value[id] || {};
      const amount = num(asset.数量);
      const row: CurrencyRow = {
        id,
        name: nameOf(id),
        amount,
        desc: String(asset.描述 || ''),
        valueDegree: valueDegreeOf(id),
        baseValue: toBase(id, amount),
        tier: ORDER.indexOf(id) >= 0 && id.startsWith('灵石_') ? ORDER.indexOf(id) : -1,
      };
      const pair = LADDER[id];
      const fromMult = multiplierOf(id);
      if (pair?.up) {
        const ratio = multiplierOf(pair.up) / fromMult;
        row.up = { to: pair.up, toName: nameOf(pair.up), cost: Math.max(1, Math.ceil(RATIO * ratio * (1 + FEE))) };
      }
      if (pair?.down) {
        const ratio = multiplierOf(pair.down) / fromMult;
        row.down = { to: pair.down, toName: nameOf(pair.down), yield: Math.max(1, Math.floor((RATIO / ratio) * (1 - FEE))) };
      }
      return row;
    });
  });

  const totalInBase = computed(() => rows.value.reduce((s, r) => s + r.baseValue, 0));

  const market = computed(() => {
    const m = multiplierOf(DEFAULT_BASE_CURRENCY_ID);
    return { place: marketKey.value, multiplier: m, stable: m === 1 };
  });

  // ─── 写 ───
  const writeInventory = async (mutate: (inv: any) => void, mutateWorld?: (world: any) => void) => {
    const inv = cloneDeep(gs.inventory || {}) as any;
    normalizeInventoryCurrencies(inv);
    if (!inv.货币 || typeof inv.货币 !== 'object' || Array.isArray(inv.货币)) inv.货币 = {};
    if (!inv.货币设置 || typeof inv.货币设置 !== 'object') inv.货币设置 = { 禁用币种: [], 基准币种: DEFAULT_BASE_CURRENCY_ID };
    if (!Array.isArray(inv.货币设置.禁用币种)) inv.货币设置.禁用币种 = [];
    mutate(inv);
    syncWalletToLegacySpiritStones(inv);
    gs.updateState('inventory', inv);
    if (mutateWorld && gs.worldInfo) {
      const world = cloneDeep(gs.worldInfo) as any;
      mutateWorld(world);
      gs.updateState('worldInfo', world);
    }
    await characterStore.saveCurrentGame();
  };

  const ensureAsset = (w: Record<string, any>, id: string) => {
    if (!w[id] || typeof w[id] !== 'object') {
      const def = (DEFAULT_CURRENCIES as any)[id];
      w[id] = def ? { ...def, 数量: 0 } : { 币种: id, 名称: id, 数量: 0, 价值度: 0, 图标: 'Coins' };
    }
    w[id].数量 = num(w[id].数量);
  };

  /** 轻微施加交易压力，体现波动（与旧版一致） */
  const nudge = (world: any, id: string, factor: number) => {
    world.经济 ??= {};
    world.经济.地区波动 ??= {};
    world.经济.地区波动[marketKey.value] ??= { 货币波动: {} };
    world.经济.地区波动[marketKey.value].货币波动 ??= {};
    world.经济.地区波动[marketKey.value].货币波动[id] = clamp(multiplierOf(id) * factor, 0.6, 1.6);
  };

  /** 兑换：cost 个本币 → 1 个上一级 */
  const exchangeUp = async (id: string) => {
    const row = rows.value.find((r) => r.id === id);
    if (!row?.up || row.amount < row.up.cost) return false;
    const { to, cost } = row.up;
    await writeInventory(
      (inv) => {
        ensureAsset(inv.货币, id);
        ensureAsset(inv.货币, to);
        inv.货币[id].数量 -= cost;
        inv.货币[to].数量 += 1;
      },
      (world) => {
        nudge(world, to, 1 + clamp(cost / 50000, 0, 0.01));
        nudge(world, id, 1 - clamp(cost / 80000, 0, 0.006));
      },
    );
    return true;
  };

  /** 分解：1 个本币 → yield 个下一级 */
  const exchangeDown = async (id: string) => {
    const row = rows.value.find((r) => r.id === id);
    if (!row?.down || row.amount < 1) return false;
    const { to, yield: y } = row.down;
    await writeInventory(
      (inv) => {
        ensureAsset(inv.货币, id);
        ensureAsset(inv.货币, to);
        inv.货币[id].数量 -= 1;
        inv.货币[to].数量 += y;
      },
      (world) => {
        nudge(world, to, 1 + clamp(y / 80000, 0, 0.01));
        nudge(world, id, 1 - clamp(y / 120000, 0, 0.006));
      },
    );
    return true;
  };

  /** 删除币种：清掉并写入禁用币种（避免数据修复又补回来） */
  const removeCurrency = async (id: string) => {
    await writeInventory((inv) => {
      delete inv.货币[id];
      if (!inv.货币设置.禁用币种.includes(id)) inv.货币设置.禁用币种.push(id);
      if (inv.货币设置.基准币种 === id) {
        const left = Object.keys(inv.货币);
        inv.货币设置.基准币种 = left.includes(DEFAULT_BASE_CURRENCY_ID) ? DEFAULT_BASE_CURRENCY_ID : left[0] || DEFAULT_BASE_CURRENCY_ID;
      }
    });
  };

  return { rows, totalInBase, baseId, baseName, market, exchangeUp, exchangeDown, removeCurrency };
}
