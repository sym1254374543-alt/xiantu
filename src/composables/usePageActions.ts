/**
 * 功能页页头按钮：由页面自己声明，只在页面激活时生效。
 * 取代旧的 panelBus 广播 + GameView.panelActionMap（见 docs/功能页重写规格.md 0.5）。
 *
 * 用法（页面 setup 里）：
 *   usePageActions(() => [
 *     { key: 'save', title: '快速存档', icon: Save, primary: true, onClick: quickSave },
 *   ]);
 */
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, shallowRef, toValue, type Component, type MaybeRefOrGetter } from 'vue';

export interface PageAction {
  key: string;
  title: string;
  icon?: Component;
  onClick: () => unknown;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  /** 忙碌中：显示转圈并禁用 */
  busy?: boolean;
}

interface Owner {
  id: symbol;
  source: () => PageAction[];
}

const current = shallowRef<Owner | null>(null);

export function usePageActions(source: MaybeRefOrGetter<PageAction[]>) {
  const owner: Owner = { id: Symbol('page-actions'), source: () => toValue(source) || [] };
  const activate = () => {
    current.value = owner;
  };
  const deactivate = () => {
    if (current.value?.id === owner.id) current.value = null;
  };
  onMounted(activate);
  onActivated(activate);
  onDeactivated(deactivate);
  onBeforeUnmount(deactivate);
}

/** 容器用：当前激活页面的按钮 */
export function useCurrentPageActions() {
  return computed(() => (current.value ? current.value.source().filter((a) => !a.hidden) : []));
}
