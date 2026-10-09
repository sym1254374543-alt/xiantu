import type { BankCard, BankTransaction, CurrencyAsset, CurrencySettings, Inventory } from '@/types/game';

export const DEFAULT_BASE_CURRENCY_ID = '人民币';

/**
 * 货币体系。灵气复苏的地球上灵石还不是货币（修士以物易物），
 * 故只剩「现代货币」一套；旧存档里的灵石币种会被迁移成背包里的「材料」物品。
 */
export type CurrencySystem = '现代货币' | '其他';

/** 各币种所属体系；未列出的按 id 前缀推断 */
export const CURRENCY_SYSTEM: Record<string, CurrencySystem> = {
  人民币: '现代货币', 美元: '现代货币', 欧元: '现代货币',
};

/**
 * 取币种所属体系（供钱包分组与「不跨体系求和」用）。
 * 未知币种归入「其他」而非默认归入现代货币——否则旧存档里的废弃币种
 * （如金银铜、灵石）会被算进现代货币的合计里，污染数值。
 */
export function currencySystemOf(id: string): CurrencySystem {
  if (CURRENCY_SYSTEM[id]) return CURRENCY_SYSTEM[id];
  return '其他';
}

export type DefaultCurrencyId = '人民币' | '美元' | '欧元';

export const DEFAULT_CURRENCIES: Record<DefaultCurrencyId, Omit<CurrencyAsset, '数量'>> = {
  人民币: { 币种: '人民币', 名称: '人民币', 价值度: 1, 描述: '现代货币基准单位（¥）', 图标: 'Banknote' },
  美元: { 币种: '美元', 名称: '美元', 价值度: 7.2, 描述: '国际结算货币（1 美元 ≈ 7.2 元）', 图标: 'BadgeDollarSign' },
  欧元: { 币种: '欧元', 名称: '欧元', 价值度: 7.8, 描述: '欧洲通用货币（1 欧元 ≈ 7.8 元）', 图标: 'Euro' },
};

/**
 * 灵石的四个档位。已经不是货币，仅用于把旧存档里的余额迁移成「材料」物品。
 * `id` 同时用作背包物品的 `物品ID`（按固定 ID 累加 → 重复迁移不会翻倍）。
 */
export const SPIRIT_STONES: { id: string; 档位: string; 名称: string; 价值度: number; 品质: { quality: string; grade: number }; 描述: string }[] = [
  { id: '灵石_下品', 档位: '下品', 名称: '下品灵石', 价值度: 1, 品质: { quality: '凡', grade: 1 }, 描述: '最常见的灵石，含少量灵气，修士以之辅助修炼或交换物资。' },
  { id: '灵石_中品', 档位: '中品', 名称: '中品灵石', 价值度: 100, 品质: { quality: '黄', grade: 5 }, 描述: '灵气浓厚的灵石，约为下品灵石的百倍。' },
  { id: '灵石_上品', 档位: '上品', 名称: '上品灵石', 价值度: 10000, 品质: { quality: '玄', grade: 8 }, 描述: '极为难得的灵石，多见于灵脉深处。' },
  { id: '灵石_极品', 档位: '极品', 名称: '极品灵石', 价值度: 1000000, 品质: { quality: '地', grade: 10 }, 描述: '传说中的灵石，灵气近乎凝成实质。' },
];

/**
 * 旧提示词把币种写成了「下品灵石」这类显示名，AI 便把它当成 key 直接写进
 * `背包.货币`，与规范 ID 并存 → 前端出现两个「极品灵石」。
 * 这张表把显示名映射回规范 ID，归一化时按数量合并。
 */
const DISPLAY_NAME_TO_ID: Record<string, string> = {
  下品灵石: '灵石_下品', 中品灵石: '灵石_中品', 上品灵石: '灵石_上品', 极品灵石: '灵石_极品',
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(min, Math.min(max, value));
  if (typeof value === 'string') {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  }
  return fallback;
}

function spiritStoneItem(s: (typeof SPIRIT_STONES)[number], 数量: number) {
  return {
    物品ID: s.id,
    名称: s.名称,
    类型: '材料' as const,
    品质: { ...s.品质 },
    数量,
    描述: s.描述,
    可叠加: true,
  };
}

/** 构造「灵石作为材料」的初始物品集合（角色/NPC 初始数据用） */
export function buildSpiritStoneItems(amounts: Partial<Record<'下品' | '中品' | '上品' | '极品', number>>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const s of SPIRIT_STONES) {
    const n = clampNumber(amounts[s.档位 as keyof typeof amounts], 0, 9e15, 0);
    if (n > 0) out[s.id] = spiritStoneItem(s, n);
  }
  return out;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function ensureCurrencySettings(backpack: any): CurrencySettings {
  const raw = backpack?.货币设置;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    backpack.货币设置 = { 禁用币种: [], 基准币种: DEFAULT_BASE_CURRENCY_ID };
    return backpack.货币设置 as CurrencySettings;
  }
  if (!Array.isArray(raw.禁用币种)) raw.禁用币种 = [];
  raw.禁用币种 = raw.禁用币种.filter((v: any) => typeof v === 'string' && v.trim());
  // 旧存档的基准币种可能是「灵石_下品」，改版后已非法 → 重置
  if (typeof raw.基准币种 !== 'string' || !(raw.基准币种 in DEFAULT_CURRENCIES)) {
    raw.基准币种 = DEFAULT_BASE_CURRENCY_ID;
  }
  return raw as CurrencySettings;
}

export function ensureCurrencyWallet(backpack: any): Record<string, CurrencyAsset> {
  const raw = backpack?.货币;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    backpack.货币 = {};
    return backpack.货币 as Record<string, CurrencyAsset>;
  }
  return raw as Record<string, CurrencyAsset>;
}

export function normalizeCurrencyAsset(id: string, value: any): CurrencyAsset | null {
  const keyId = normalizeString(id);
  if (!keyId) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const 币种 = normalizeString(value.币种) || keyId;
  const 名称 = normalizeString(value.名称) || keyId;
  const 数量 = clampNumber(value.数量, 0, 9e15, 0);
  const 价值度 = clampNumber(value.价值度, 0, 9e15, 0);
  const 描述 = normalizeString(value.描述) || undefined;
  const 图标 = normalizeString(value.图标) || undefined;

  return { 币种, 名称, 数量, 价值度, 描述, 图标 };
}

export function ensureDefaultCurrencies(backpack: any) {
  const settings = ensureCurrencySettings(backpack);
  const wallet = ensureCurrencyWallet(backpack);
  const disabled = new Set(settings.禁用币种);

  for (const [id, def] of Object.entries(DEFAULT_CURRENCIES)) {
    const existing = wallet[id];
    if (existing == null || typeof existing !== 'object') {
      if (disabled.has(id)) continue;
      wallet[id] = { ...def, 数量: 0 };
    } else {
      const normalized = normalizeCurrencyAsset(id, existing);
      wallet[id] = normalized ? { ...def, ...normalized, 数量: normalized.数量 } : { ...def, 数量: 0 };
      if (wallet[id].价值度 <= 0) wallet[id].价值度 = def.价值度;
      if (!wallet[id].名称) wallet[id].名称 = def.名称;
      if (!wallet[id].图标) wallet[id].图标 = def.图标;
    }
  }
}

/** 把「下品灵石」这类显示名 key 合并进规范 ID（数量相加） */
function mergeDisplayNameKeys(wallet: Record<string, any>) {
  for (const key of Object.keys(wallet)) {
    const canonical = DISPLAY_NAME_TO_ID[key];
    if (!canonical || canonical === key) continue;
    const incoming = clampNumber(wallet[key]?.数量, 0, 9e15, 0);
    const target = wallet[canonical];
    if (isPlainObject(target)) {
      target.数量 = clampNumber(target.数量, 0, 9e15, 0) + incoming;
    } else {
      const def = SPIRIT_STONES.find((s) => s.id === canonical);
      wallet[canonical] = {
        币种: canonical,
        名称: def?.名称 || canonical,
        数量: incoming,
        价值度: def?.价值度 ?? 0,
      };
    }
    delete wallet[key];
  }
}

/**
 * 灵石迁出货币体系 → 背包「材料」物品。
 * 数量来源两处求和：新钱包 `货币[灵石_x].数量` + 旧字段 `背包.灵石.{档位}`。
 * 写完后清空这两处 → 幂等，重复运行不会翻倍。
 */
export function migrateSpiritStonesToItems(backpack: any) {
  if (!isPlainObject(backpack)) return;
  const wallet = isPlainObject(backpack.货币) ? backpack.货币 : null;
  const legacy = isPlainObject(backpack.灵石) ? backpack.灵石 : null;
  if (!wallet && !legacy) return;

  const amounts: Record<string, number> = {};
  let total = 0;
  for (const s of SPIRIT_STONES) {
    const n = clampNumber(wallet?.[s.id]?.数量, 0, 9e15, 0) + clampNumber(legacy?.[s.档位], 0, 9e15, 0);
    amounts[s.id] = n;
    total += n;
  }

  if (wallet) for (const s of SPIRIT_STONES) delete wallet[s.id];
  delete backpack.灵石;

  if (total <= 0) return;

  const items = isPlainObject(backpack.物品) ? backpack.物品 : (backpack.物品 = {});
  for (const s of SPIRIT_STONES) {
    const n = amounts[s.id];
    if (n <= 0) continue;
    const existing = items[s.id];
    if (isPlainObject(existing)) {
      existing.数量 = clampNumber(existing.数量, 0, 9e15, 0) + n;
      if (!normalizeString(existing.名称)) existing.名称 = s.名称;
      if (!normalizeString(existing.类型)) existing.类型 = '材料';
      if (!isPlainObject(existing.品质)) existing.品质 = { ...s.品质 };
    } else {
      items[s.id] = spiritStoneItem(s, n);
    }
  }
}

export function normalizeBackpackCurrencies(backpack: any) {
  if (!backpack || typeof backpack !== 'object') return;

  ensureCurrencySettings(backpack);
  ensureCurrencyWallet(backpack);

  // 1) 规范化 wallet（剔除无效项）
  const wallet = backpack.货币 as Record<string, any>;
  const normalizedWallet: Record<string, CurrencyAsset> = {};
  for (const [id, raw] of Object.entries(wallet)) {
    const normalized = normalizeCurrencyAsset(id, raw);
    if (!normalized) continue;
    normalizedWallet[id] = normalized;
  }
  backpack.货币 = normalizedWallet;

  // 2) 合并显示名 key（「极品灵石」→「灵石_极品」）——必须在转物品之前，
  //    否则这些脏键会被当成「其他」体系残留或直接丢失
  mergeDisplayNameKeys(backpack.货币);

  // 3) 补默认币种（尊重禁用列表）
  ensureDefaultCurrencies(backpack);

  // 4) 灵石迁出货币体系，转为背包材料
  migrateSpiritStonesToItems(backpack);
}

export function normalizeInventoryCurrencies(inventory: Inventory | null | undefined) {
  if (!inventory || typeof inventory !== 'object') return;
  normalizeBackpackCurrencies(inventory as any);
}

const BANK_TX_TYPES = ['存入', '取出', '转账', '收款', '消费'] as const;

/**
 * 归一化银行账户。
 * - `余额` 只保留现代货币（灵石等非货币一律剔除，防 AI 往卡里写灵石）
 * - 金额非负、交易流水截断到最近 50 条
 * - 完全没有内容时返回 null（表示未开户，不凭空建档）
 */
export function normalizeBankCard(raw: any): BankCard | null {
  if (!isPlainObject(raw)) return null;

  const 卡号 = normalizeString(raw.卡号);
  const 开户行 = normalizeString(raw.开户行);

  const 余额: Record<string, number> = {};
  if (isPlainObject(raw.余额)) {
    for (const [id, value] of Object.entries(raw.余额)) {
      if (!(id in DEFAULT_CURRENCIES)) {
        console.warn(`[银行] 余额中出现非货币币种「${id}」，已剔除（灵石不是货币）`);
        continue;
      }
      const n = clampNumber(value, 0, 9e15, 0);
      if (n > 0) 余额[id] = n;
    }
  }

  let 交易记录: BankTransaction[] | undefined;
  if (Array.isArray(raw.交易记录)) {
    const list = raw.交易记录
      .map((tx: any): BankTransaction | null => {
        if (!isPlainObject(tx)) return null;
        const 币种 = normalizeString(tx.币种);
        if (!(币种 in DEFAULT_CURRENCIES)) return null;
        const 类型 = BANK_TX_TYPES.includes(tx.类型) ? tx.类型 : '消费';
        return {
          时间: normalizeString(tx.时间),
          类型,
          金额: clampNumber(tx.金额, 0, 9e15, 0),
          币种,
          对方: normalizeString(tx.对方) || undefined,
          备注: normalizeString(tx.备注) || undefined,
        };
      })
      .filter((tx: BankTransaction | null): tx is BankTransaction => !!tx)
      .slice(0, 50);
    if (list.length) 交易记录 = list;
  }

  if (!卡号 && !开户行 && Object.keys(余额).length === 0 && !交易记录) return null;

  return {
    卡号: 卡号 || '未知卡号',
    开户行: 开户行 || '未知银行',
    余额,
    ...(交易记录 ? { 交易记录 } : {}),
  };
}
