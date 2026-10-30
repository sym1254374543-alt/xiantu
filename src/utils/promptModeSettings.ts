/**
 * @fileoverview 「判定系统」开关的读取。
 *
 * 开关保存在 `dad_game_settings`，默认打开；关闭后主循环改用
 * `noJudgementPrompts.ts` 里的整套规则，并且不再注入预计算的判定块。
 */
export const JUDGEMENT_SYSTEM_SETTING_KEY = 'judgementSystemEnabled'

/** 判定系统是否启用（默认启用；读取失败也按启用处理，保持旧行为） */
export function isJudgementSystemEnabled(): boolean {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('dad_game_settings') : null
    if (!raw) return true
    const parsed = JSON.parse(raw)
    return parsed?.[JUDGEMENT_SYSTEM_SETTING_KEY] !== false
  } catch {
    return true
  }
}
