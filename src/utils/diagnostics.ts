/**
 * 运行诊断收集器。
 *
 * 判定/计算过程中凡走了保底、字段缺失、数值被截断等情况，都记到这里，
 * 由界面提供可展开的展示（手机端看不到控制台，必须走 UI）。
 */

export type DiagnosticLevel = 'info' | 'warn' | 'error'

export interface DiagnosticItem {
  level: DiagnosticLevel
  /** 分类，便于聚合（如 判定/炼制、能力加成） */
  scope: string
  message: string
  /** 具体数据，便于排查 */
  detail?: string
  /** 记录时间戳（由外部注入，避免非确定性） */
  at?: number
}

const MAX_ITEMS = 200

class DiagnosticsStore {
  private items: DiagnosticItem[] = []
  private listeners = new Set<() => void>()
  private seq = 0

  /**
   * 记录一条诊断。
   * 同一条(scope+message+detail)只保留一条：判定/守卫每回合都会跑，
   * 存档里的同一处问题会被反复检出，不去重会刷屏。
   */
  push(item: DiagnosticItem): void {
    const key = (d: DiagnosticItem) => `${d.scope}|${d.message}|${d.detail ?? ''}`
    const k = key(item)
    const idx = this.items.findIndex((d) => key(d) === k)
    if (idx >= 0) {
      // 已存在：只更新时间戳，不重复堆积
      this.items[idx] = { ...this.items[idx], at: item.at ?? Date.now() }
      return
    }
    this.items.push({ ...item, at: item.at ?? Date.now() })
    this.seq++
    if (this.items.length > MAX_ITEMS) this.items = this.items.slice(-MAX_ITEMS)
    this.emit()
  }

  /** 批量记录（逐条走 push，享有同样的去重） */
  pushAll(items: DiagnosticItem[]): void {
    for (const it of items) this.push(it)
  }

  /** 清空 */
  clear(): void {
    this.items = []
    this.seq++
    this.emit()
  }

  /** 取全部（倒序，最新在前） */
  list(): DiagnosticItem[] {
    return this.items.slice().reverse()
  }

  /** 计数，用于展示角标 */
  get count(): number {
    return this.items.length
  }

  /** 版本号，供 Vue 响应式订阅 */
  get version(): number {
    return this.seq
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) {
      try {
        fn()
      } catch {
        /* 监听器异常不影响主流程 */
      }
    }
  }
}

export const diagnostics = new DiagnosticsStore()

/** 便捷方法 */
export const diag = {
  info: (scope: string, message: string, detail?: string) =>
    diagnostics.push({ level: 'info', scope, message, detail }),
  warn: (scope: string, message: string, detail?: string) =>
    diagnostics.push({ level: 'warn', scope, message, detail }),
  error: (scope: string, message: string, detail?: string) =>
    diagnostics.push({ level: 'error', scope, message, detail }),
}
