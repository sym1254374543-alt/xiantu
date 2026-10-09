/**
 * 银行账户：角色.银行（BankCard）。与钱包（随身现金，inventory.货币）分开——
 * 卡里的是存款，取出来才进钱包。
 *
 * 灵气复苏初期，灵石还不是货币，故卡内余额只接受现代货币（人民币/美元/欧元）。
 * 读是纯 computed；写都走「克隆 → 归一化 → 变更 → updateState 整体替换 → 存档」。
 */
import { computed } from 'vue';
import { cloneDeep } from 'lodash';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore';
import { DEFAULT_CURRENCIES, normalizeBankCard, normalizeInventoryCurrencies } from '@/utils/currencySystem';
import type { BankCard, BankTransaction } from '@/types/game';

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const MAX_TX = 50;

export interface BankRow {
  id: string;
  name: string;
  amount: number;
}

export type BankOpResult = { ok: true } | { ok: false; reason: string };

export function useBank() {
  const gs = useGameStateStore();
  const characterStore = useCharacterStore();

  const card = computed<BankCard | null>(() => (gs.bank as BankCard | null) ?? null);
  const hasCard = computed(() => !!card.value);

  const nameOf = (id: string) => String((DEFAULT_CURRENCIES as any)[id]?.名称 || id);
  const walletAmount = (id: string) => num((gs.inventory as any)?.货币?.[id]?.数量);

  /** 卡内余额（含默认币种，便于「存入」时选择） */
  const rows = computed<BankRow[]>(() => {
    const c = card.value;
    if (!c) return [];
    const ids: string[] = Object.keys(DEFAULT_CURRENCIES);
    for (const id of Object.keys(c.余额 || {})) if (!ids.includes(id)) ids.push(id);
    return ids.map((id) => ({ id, name: nameOf(id), amount: num(c.余额?.[id]) }));
  });

  const transactions = computed<BankTransaction[]>(() => card.value?.交易记录 ?? []);

  /** 钱包里的现金（可存入的部分） */
  const walletRows = computed<BankRow[]>(() =>
    Object.keys(DEFAULT_CURRENCIES).map((id) => ({ id, name: nameOf(id), amount: walletAmount(id) })),
  );

  const pushTx = (bank: BankCard, tx: Omit<BankTransaction, '时间'>) => {
    const t = gs.gameTime as any;
    const 时间 = t ? `${t.年}年${t.月}月${t.日}日` : new Date().toLocaleString('zh-CN');
    bank.交易记录 = [{ 时间, ...tx }, ...(bank.交易记录 || [])].slice(0, MAX_TX);
  };

  const addToWallet = (wallet: Record<string, any>, id: string, amount: number) => {
    const def = (DEFAULT_CURRENCIES as any)[id];
    if (!wallet[id] || typeof wallet[id] !== 'object') {
      wallet[id] = def ? { ...def, 数量: 0 } : { 币种: id, 名称: id, 数量: 0, 价值度: 0 };
    }
    wallet[id].数量 = Math.max(0, num(wallet[id].数量) + amount);
  };

  const write = async (
    mutateBank: (bank: BankCard) => void,
    mutateWallet?: (wallet: Record<string, any>) => void,
  ): Promise<BankOpResult> => {
    const bank = normalizeBankCard(cloneDeep(gs.bank));
    if (!bank) return { ok: false, reason: '尚未开户' };
    mutateBank(bank);
    gs.updateState('bank', bank);

    if (mutateWallet) {
      const inv = cloneDeep(gs.inventory || {}) as any;
      normalizeInventoryCurrencies(inv);
      if (!inv.货币 || typeof inv.货币 !== 'object') inv.货币 = {};
      mutateWallet(inv.货币);
      gs.updateState('inventory', inv);
    }
    await characterStore.saveCurrentGame();
    return { ok: true };
  };

  /** 存入：钱包现金 → 卡内存款 */
  const deposit = async (id: string, amount: number): Promise<BankOpResult> => {
    if (!(amount > 0)) return { ok: false, reason: '金额需大于 0' };
    if (walletAmount(id) < amount) return { ok: false, reason: '现金不足' };
    return write(
      (bank) => {
        bank.余额[id] = num(bank.余额[id]) + amount;
        pushTx(bank, { 类型: '存入', 金额: amount, 币种: id, 备注: '存入' });
      },
      (wallet) => addToWallet(wallet, id, -amount),
    );
  };

  /** 取出：卡内存款 → 钱包现金 */
  const withdraw = async (id: string, amount: number): Promise<BankOpResult> => {
    if (!(amount > 0)) return { ok: false, reason: '金额需大于 0' };
    if (num(card.value?.余额?.[id]) < amount) return { ok: false, reason: '存款不足' };
    return write(
      (bank) => {
        bank.余额[id] = num(bank.余额[id]) - amount;
        pushTx(bank, { 类型: '取出', 金额: amount, 币种: id, 备注: '取出' });
      },
      (wallet) => addToWallet(wallet, id, amount),
    );
  };

  /** 转账给某人：可从卡内或身上现金扣，进对方账户（有卡入卡，无卡入钱包） */
  const transferTo = async (
    target: string,
    id: string,
    amount: number,
    from: 'bank' | 'wallet' = 'bank',
  ): Promise<BankOpResult> => {
    const name = target.trim();
    if (!name) return { ok: false, reason: '请填写收款人' };
    if (!(amount > 0)) return { ok: false, reason: '金额需大于 0' };

    const relationships = cloneDeep(gs.relationships || {}) as Record<string, any>;
    const receiver = relationships[name];
    if (!receiver) return { ok: false, reason: `查无此人：${name}` };

    if (from === 'bank' && num(card.value?.余额?.[id]) < amount) return { ok: false, reason: '存款不足' };
    if (from === 'wallet' && walletAmount(id) < amount) return { ok: false, reason: '现金不足' };

    const result = await write(
      (bank) => {
        if (from !== 'bank') return;
        bank.余额[id] = num(bank.余额[id]) - amount;
        pushTx(bank, { 类型: '转账', 金额: amount, 币种: id, 对方: name });
      },
      from === 'wallet' ? (wallet) => addToWallet(wallet, id, -amount) : undefined,
    );
    if (!result.ok) return result;

    const receiverCard = normalizeBankCard(receiver.银行);
    if (receiverCard) {
      receiverCard.余额[id] = num(receiverCard.余额[id]) + amount;
      receiver.银行 = receiverCard;
    } else {
      const bag = receiver.背包 && typeof receiver.背包 === 'object' ? receiver.背包 : (receiver.背包 = { 物品: {} });
      const wallet = bag.货币 && typeof bag.货币 === 'object' ? bag.货币 : (bag.货币 = {});
      addToWallet(wallet, id, amount);
    }
    gs.updateState('relationships', relationships);
    await characterStore.saveCurrentGame();
    return { ok: true };
  };

  /** 开户 / 办卡 */
  const openAccount = async (卡号: string, 开户行: string): Promise<BankOpResult> => {
    const cardNo = 卡号.trim() || `6222 **** ${Math.floor(1000 + Math.random() * 9000)}`;
    const bankName = 开户行.trim() || '工商银行';
    gs.updateState('bank', {
      卡号: cardNo,
      开户行: bankName,
      余额: { 人民币: 0 },
      交易记录: [],
    } as BankCard);
    await characterStore.saveCurrentGame();
    return { ok: true };
  };

  return {
    card, hasCard, rows, walletRows, transactions,
    deposit, withdraw, transferTo, openAccount, walletAmount,
  };
}
