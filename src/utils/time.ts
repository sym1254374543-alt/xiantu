import type { GameTime } from '@/types/game';

const MONTHS_IN_YEAR = 12;
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = HOURS_IN_DAY * MINUTES_IN_HOUR;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** 公历月份天数（2 月按闰年） */
export function daysInMonth(year: number, month: number): number {
  const m = Math.max(1, Math.min(MONTHS_IN_YEAR, Math.floor(month || 1)));
  if (m === 2) return isLeapYear(Math.floor(year || 0)) ? 29 : 28;
  return MONTH_DAYS[m - 1];
}

/** 从 0001-01-01 00:00 起的总分钟数；用于正确计算时间差 */
export function gameTimeToTotalMinutes(time: GameTime): number {
  const y = Math.floor(Number(time?.年) || 0);
  const m = Math.max(1, Math.min(MONTHS_IN_YEAR, Math.floor(Number(time?.月) || 1)));
  const d = Math.max(1, Math.floor(Number(time?.日) || 1));
  const h = Math.max(0, Math.floor(Number(time?.小时) || 0));
  const min = Math.max(0, Math.floor(Number(time?.分钟) || 0));

  const yearsBefore = Math.max(0, y - 1);
  const leapYearsBefore =
    Math.floor(yearsBefore / 4) - Math.floor(yearsBefore / 100) + Math.floor(yearsBefore / 400);
  let total = (yearsBefore * 365 + leapYearsBefore) * MINUTES_IN_DAY;

  for (let i = 1; i < m; i += 1) total += daysInMonth(y, i) * MINUTES_IN_DAY;
  total += (d - 1) * MINUTES_IN_DAY + h * MINUTES_IN_HOUR + min;
  return total;
}

/** 时间差（分钟），b - a；负值表示 b 早于 a */
export function diffGameTimeMinutes(a: GameTime, b: GameTime): number {
  return gameTimeToTotalMinutes(b) - gameTimeToTotalMinutes(a);
}

/** 把分钟差格式化成“3天2小时5分钟” */
export function formatElapsedMinutes(minutes: number): string {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  if (total < 1) return '不到1分钟';
  const days = Math.floor(total / MINUTES_IN_DAY);
  const hours = Math.floor((total % MINUTES_IN_DAY) / MINUTES_IN_HOUR);
  const mins = total % MINUTES_IN_HOUR;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (mins > 0) parts.push(`${mins}分钟`);
  return parts.join('');
}

/**
 * 标准化游戏时间，按公历处理分钟/小时/天/月的进位与借位。
 * 注意：此前按月固定 30 天，长时间推进会累积偏差（这是“前天说成昨天/这个月说成上个月”的根因之一）。
 */
export function normalizeGameTime(time: GameTime): GameTime {
  let 年 = Math.floor(Number(time?.年) || 0);
  let 月 = Math.floor(Number(time?.月) || 1);
  let 日 = Math.floor(Number(time?.日) || 1);
  let 小时 = Math.floor(Number(time?.小时) || 0);
  let 分钟 = Math.floor(Number(time?.分钟) || 0);

  while (分钟 < 0) {
    分钟 += MINUTES_IN_HOUR;
    小时 -= 1;
  }
  while (分钟 >= MINUTES_IN_HOUR) {
    分钟 -= MINUTES_IN_HOUR;
    小时 += 1;
  }

  while (小时 < 0) {
    小时 += HOURS_IN_DAY;
    日 -= 1;
  }
  while (小时 >= HOURS_IN_DAY) {
    小时 -= HOURS_IN_DAY;
    日 += 1;
  }

  while (月 > MONTHS_IN_YEAR) {
    月 -= MONTHS_IN_YEAR;
    年 += 1;
  }
  while (月 < 1) {
    月 += MONTHS_IN_YEAR;
    年 -= 1;
  }

  while (日 < 1) {
    月 -= 1;
    if (月 < 1) {
      月 = MONTHS_IN_YEAR;
      年 -= 1;
    }
    日 += daysInMonth(年, 月);
  }
  while (日 > daysInMonth(年, 月)) {
    日 -= daysInMonth(年, 月);
    月 += 1;
    if (月 > MONTHS_IN_YEAR) {
      月 = 1;
      年 += 1;
    }
  }

  return { 年, 月, 日, 小时, 分钟 };
}
