/** 오늘 날짜 문자열 (로컬 시간) */
function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

const KEY = 'trainingProgress'

/** 오늘 완료한 stage 번호 목록 반환 (날짜가 오늘이 아니면 [] 반환) */
export function getTodayCompleted(): number[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const { date, completed } = JSON.parse(raw) as { date: string; completed: number[] }
    return date === todayStr() ? completed : []
  } catch {
    return []
  }
}

/** 단계 완료 표시 */
export function markStageComplete(stageNum: number): void {
  try {
    const completed = getTodayCompleted()
    if (!completed.includes(stageNum)) {
      localStorage.setItem(KEY, JSON.stringify({ date: todayStr(), completed: [...completed, stageNum] }))
    }
  } catch { /* noop */ }
}
