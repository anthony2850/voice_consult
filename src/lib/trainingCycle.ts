import type { ConcernSlug } from './curriculum'

export type DayNum = 1 | 2 | 3 | 4 | 5

export interface TrainingLog {
  stage_num: number
  log_date: string  // YYYY-MM-DD
}

/**
 * Next slot to present, derived purely from session count.
 * Slot cycles 1→2→3→4→5→1→2→... regardless of past stage_num values.
 * Allows legacy rows to count without affecting the new rotation.
 */
export function nextDayNum(logs: TrainingLog[]): DayNum {
  return ((logs.length % 5) + 1) as DayNum
}

/**
 * Current cycle (1-based). Each completed set of 5 sessions advances to next cycle.
 * No logs → cycle 1 (we are about to do the first session of cycle 1).
 */
export function currentCycle(logs: TrainingLog[]): number {
  return Math.floor(logs.length / 5) + 1
}

/**
 * True iff the user's concerns intersect the day's matching concerns.
 * Kept for backward compatibility / focus marker logic.
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
