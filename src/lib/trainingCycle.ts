import type { ConcernSlug } from './curriculum'

export type DayNum = 1 | 2 | 3 | 4 | 5

export interface TrainingLog {
  stage_num: number
  log_date: string  // YYYY-MM-DD
}

/**
 * Compute the next day number based on the most recent training log.
 * - No logs → Day 1
 * - Wraps from 5 to 1
 * - Out-of-range stage_num is treated as 5 (so next = 1) — a defensive default.
 */
export function nextDayNum(logs: TrainingLog[]): DayNum {
  if (logs.length === 0) return 1
  const sorted = [...logs].sort((a, b) => b.log_date.localeCompare(a.log_date))
  const last = sorted[0].stage_num
  const safe = last >= 1 && last <= 5 ? last : 5
  return (((safe) % 5) + 1) as DayNum
}

/**
 * True iff the user's concerns intersect the day's matching concerns.
 */
export function isDeepDay(
  dayMatchingConcerns: readonly ConcernSlug[],
  userConcerns: readonly ConcernSlug[],
): boolean {
  if (userConcerns.length === 0 || dayMatchingConcerns.length === 0) return false
  return dayMatchingConcerns.some((c) => userConcerns.includes(c))
}

/**
 * Random pick from a script/material pool. v1 = simple random.
 * Returns undefined for missing or empty pool.
 */
export function pickFromPool<T>(pool: readonly T[] | undefined): T | undefined {
  if (!pool || pool.length === 0) return undefined
  return pool[Math.floor(Math.random() * pool.length)]
}
