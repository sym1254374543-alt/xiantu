/**
 * @fileoverview 状态变更日志瘦身：长正文只在 `系统.历史.叙事[].content` 存一份，
 * 变更记录里的副本一律换成短摘要。
 *
 * 背景（2026-10-31 实测用户存档）：正文共 8.2 万字，但 `系统.历史.叙事[].stateChanges`
 * 合计 23.2 万字——叙事 push 的 newValue 是整篇正文，NPC 记忆变更的 push 也带着完整旧数组。
 * stateChanges 只用于「变更」弹窗展示，导出小说读的是 `叙事[].content`，所以这里截断不影响导出。
 */

/** 变更日志里单个字符串保留的最大长度 */
export const CHANGE_LOG_TEXT_LIMIT = 80
/** 变更日志里最多保留多少条变更（超出部分只留计数，防止一次意外写入撑爆存档） */
const CHANGE_LOG_MAX_ENTRIES = 300

function clipText(text: string): string {
  if (text.length <= CHANGE_LOG_TEXT_LIMIT) return text
  // 已截断过的字符串直接返回，保证重复修复幂等
  if (/…（共 \d+ 字）$/.test(text)) return text
  return `${text.slice(0, CHANGE_LOG_TEXT_LIMIT)}…（共 ${text.length} 字）`
}

/** 把任意变更值压成「可展示但很短」的形式；原始正文已经另有 `叙事[].content` 保存 */
function clipValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return clipText(value)
  if (typeof value !== 'object') return value
  if (depth >= 4) return '…'

  if (Array.isArray(value)) {
    const last = value.length ? clipValue(value[value.length - 1], depth + 1) : undefined
    // 短数组（≤2 项）保留全部条目，方便弹窗展示
    const short = value.length <= 2 ? value.map((item) => clipValue(item, depth + 1)) : undefined
    return {
      __type: 'Array',
      __length: value.length,
      __summary: `[数组: ${value.length}个元素]`,
      ...(short ? { __items: short } : {}),
      __last: last,
    }
  }

  const record = value as Record<string, unknown>
  // 本来就是日志自己生成的摘要，原样保留（只把里面的 __last 再压一层）
  if ('__summary' in record) {
    const next: Record<string, unknown> = { ...record }
    if ('__last' in next) next.__last = clipValue(next.__last, depth + 1)
    return next
  }

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record)) out[k] = clipValue(v, depth + 1)
  return out
}

/** 压缩单条 stateChange 的旧值/新值 */
export function compactStateChange(change: any): any {
  if (!change || typeof change !== 'object') return change
  const out = { ...change }
  if (change.oldValue !== undefined) {
    // push 的 oldValue 与 newValue 指向被 push 的同一数组（执行时原地修改），是纯重复
    const duplicated =
      change.action === 'push' &&
      change.newValue !== undefined &&
      JSON.stringify(change.oldValue) === JSON.stringify(change.newValue)
    out.oldValue = duplicated ? undefined : clipValue(change.oldValue)
  }
  if (change.newValue !== undefined) out.newValue = clipValue(change.newValue)
  return out
}

/** 压缩一份 StateChangeLog（就地替换每条的 oldValue/newValue，不改动结构字段） */
export function compactStateChangeLog<T extends { changes?: unknown[] } | null | undefined>(log: T): T {
  if (!log || !Array.isArray(log.changes)) return log
  let changes = log.changes.map(compactStateChange)
  if (changes.length > CHANGE_LOG_MAX_ENTRIES) {
    changes = [
      ...changes.slice(0, CHANGE_LOG_MAX_ENTRIES - 1),
      { key: '…', action: 'truncated', oldValue: undefined, newValue: { __summary: `变更过多，其余 ${changes.length - CHANGE_LOG_MAX_ENTRIES + 1} 条未记录` } },
    ]
  }
  return { ...log, changes } as T
}

/**
 * 旧存档自愈：把所有叙事记录的 stateChanges 里存的正文副本压成摘要。
 * 正文本身（`叙事[].content`）不动；迁移幂等，重复执行结果稳定。
 */
export function compactNarrativeHistoryLogs(history: unknown): void {
  if (!Array.isArray(history)) return
  for (const entry of history) {
    if (entry && typeof entry === 'object' && (entry as any).stateChanges) {
      ;(entry as any).stateChanges = compactStateChangeLog((entry as any).stateChanges)
    }
  }
}
