/**
 * 훈련 온보딩에서 정하는 "내 계획" — 순수 함수 + 기기 저장.
 *
 * - 주간 목표: 매일 연속 기록 대신 쓴다. 목도 쉬는 날이 훈련의 일부라 쉬는 날이 벌이 되면 안 된다.
 * - 연습 시간: 실행 의도(Gollwitzer, 1999). "언제 하겠다"를 정하면 실천 확률이 오른다.
 *   웹 앱이라 푸시를 못 보내므로 캘린더 알림(.ics)으로 잇는다.
 */
import type { ConcernSlug } from './curriculum'

export type WeeklyGoal = 3 | 5 | 7
export type PracticeTime = 'morning' | 'midday' | 'evening'

export interface Plan {
  weeklyGoal: WeeklyGoal
  time: PracticeTime
  /** 스스로 고른 고민. 모르겠다고 하면 null — 진단이 정한다. */
  selfConcern: ConcernSlug | null
}

/** 온보딩 답. 연습 문장(상황)은 온보딩이 아니라 트랙을 시작할 때 고른다. */
export type PendingOnboarding = Plan

export const PRACTICE_TIME: Record<PracticeTime, { label: string; hint: string; hh: number; mm: number }> = {
  morning: { label: '아침', hint: '출근이나 등교 전에', hh: 8, mm: 0 },
  midday: { label: '점심', hint: '점심시간에 잠깐', hh: 12, mm: 30 },
  evening: { label: '저녁', hint: '하루를 마무리하며', hh: 21, mm: 0 },
}

const WEEKLY_DAYS: Record<WeeklyGoal, string> = { 3: 'MO,WE,FR', 5: 'MO,TU,WE,TH,FR', 7: 'MO,TU,WE,TH,FR,SA,SU' }

export function isPlan(v: unknown): v is Plan {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (o.weeklyGoal === 3 || o.weeklyGoal === 5 || o.weeklyGoal === 7)
    && (o.time === 'morning' || o.time === 'midday' || o.time === 'evening')
    && (o.selfConcern === null || typeof o.selfConcern === 'string')
}

// ─── 이번 주 진행 ────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

/** 이번 주(월요일 시작)에 훈련한 날 수. dates는 'YYYY-MM-DD'. 하루에 여러 번 해도 하루로 센다. */
export function daysTrainedThisWeek(dates: string[], now: Date = new Date()): number {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dow = monday.getDay()
  monday.setDate(monday.getDate() + (dow === 0 ? -6 : 1 - dow))
  const from = ymd(monday)
  const to = ymd(now)
  return new Set(dates.filter((d) => d >= from && d <= to)).size
}

// ─── 캘린더 알림 (.ics) ──────────────────────────────────────────────────────

/** 알림을 누르면 열리는 연습 전화 화면 */
export const PRACTICE_CALL_URL = 'https://mytoneai.vercel.app/call?from=calendar'

/** 주간 반복 일정 하나. 시각은 기기 시간대 그대로(floating time) 둔다. */
export function buildPracticeIcs(plan: Plan, now: Date = new Date()): string {
  const t = PRACTICE_TIME[plan.time]
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, t.hh, t.mm)
  const end = new Date(start.getTime() + 10 * 60_000)
  const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
  const utc = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MyTone//Practice//KO',
    'BEGIN:VEVENT',
    `UID:mytone-practice-${now.getTime()}@mytoneai.vercel.app`,
    `DTSTAMP:${utc}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${WEEKLY_DAYS[plan.weeklyGoal]}`,
    'SUMMARY:MyTone 코치의 연습 전화',
    `DESCRIPTION:코치에게서 전화가 와요. 눌러서 받아 보세요. ${PRACTICE_CALL_URL}`,
    `URL:${PRACTICE_CALL_URL}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:MyTone 코치에게서 전화가 와요',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

// ─── 기기 저장 (로그인 전 임시, 마이그레이션 전 대비) ─────────────────────────

const PLAN_KEY = 'mytonePlan'
const PENDING_KEY = 'mytonePendingOnboarding'

function read<T>(key: string, check: (v: unknown) => v is T): T | null {
  try {
    const raw = localStorage.getItem(key)
    const v = raw ? JSON.parse(raw) : null
    return check(v) ? v : null
  } catch {
    return null
  }
}
function write(key: string, v: unknown) {
  try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)) } catch { /* noop */ }
}

export const readLocalPlan = () => read(PLAN_KEY, isPlan)
export const writeLocalPlan = (p: Plan) => write(PLAN_KEY, p)

const isPending = (v: unknown): v is PendingOnboarding => isPlan(v)
export const readPendingOnboarding = () => read(PENDING_KEY, isPending)
export const writePendingOnboarding = (p: PendingOnboarding | null) => write(PENDING_KEY, p)
