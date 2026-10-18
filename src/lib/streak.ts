export function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 오늘 또는 어제까지 이어진 연속 훈련 일수 */
export function streakFrom(dates: string[], todayStr: string): number {
  const unique = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  if (unique.length === 0) return 0
  const y = new Date(todayStr); y.setDate(y.getDate() - 1)
  if (unique[0] !== todayStr && unique[0] !== toDateStr(y)) return 0
  let count = 0
  let expected = unique[0]
  for (const date of unique) {
    if (date === expected) {
      count++
      const d = new Date(expected); d.setDate(d.getDate() - 1); expected = toDateStr(d)
    } else if (date < expected) break
  }
  return count
}
