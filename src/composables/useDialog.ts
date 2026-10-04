/**
 * 统一对话框：确认 / 输入文字 / 选数量，均返回 Promise。
 * 宿主组件 components/common/DialogHost.vue 挂在 App.vue，局内局外都能用。
 *
 *   const { confirm, askText, askQuantity } = useDialog();
 *   if (!(await confirm({ title: '删除存档', message: '…', danger: true }))) return;
 */
import { shallowReactive } from 'vue';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** 额外的条目说明（逐行列出） */
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export interface TextOptions {
  title: string;
  message?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  multiline?: boolean;
  /** 返回错误文字表示不合法 */
  validate?: (v: string) => string | null;
}

export interface QuantityOptions {
  title: string;
  itemName?: string;
  message?: string;
  max: number;
  min?: number;
  defaultValue?: number;
  unit?: string;
  confirmText?: string;
  danger?: boolean;
  /** 自定义快捷值；不传时用 1 / 5 / 10 / 一半 / 全部 */
  presets?: { label: string; value: number }[];
  /** 数量标签（默认「持有」） */
  maxLabel?: string;
}

export type DialogRequest =
  | { id: number; kind: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: 'text'; options: TextOptions; resolve: (v: string | null) => void }
  | { id: number; kind: 'quantity'; options: QuantityOptions; resolve: (v: number | null) => void };

let seq = 0;
export const dialogQueue = shallowReactive<DialogRequest[]>([]);

function push<T>(kind: DialogRequest['kind'], options: unknown): Promise<T> {
  return new Promise<T>((resolve) => {
    dialogQueue.push({ id: ++seq, kind, options, resolve } as unknown as DialogRequest);
  });
}

export function settleDialog(id: number, value: unknown) {
  const idx = dialogQueue.findIndex((d) => d.id === id);
  if (idx < 0) return;
  const [req] = dialogQueue.splice(idx, 1);
  (req.resolve as (v: unknown) => void)(value);
}

export const confirmDialog = (options: ConfirmOptions) => push<boolean>('confirm', options);
export const askText = (options: TextOptions) => push<string | null>('text', options);
export const askQuantity = (options: QuantityOptions) => push<number | null>('quantity', options);

export function useDialog() {
  return { confirm: confirmDialog, askText, askQuantity };
}

/** 只要确认框时的简写：const confirm = useConfirm(); await confirm({ … }) */
export const useConfirm = () => confirmDialog;
