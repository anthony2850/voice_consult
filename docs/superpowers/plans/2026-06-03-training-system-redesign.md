# Training System Redesign Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder 5-Day curriculum with an outcome-based 5-Day cycle (안정/전달력/명료성/표현력/선택) where each session runs 4 micro-exercises (L1→L4 of that Day's area).

**Architecture:** Data-driven curriculum (`TrainingDay` with 4-exercise array, outcome label, optional matchingConcern). Session player iterates through exercises. Day 5 is elective — user picks an outcome, session uses that outcome's exercises. Concerns become focus markers, not content gates. Cycle/slot derived from `user_training_logs` row count.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Vitest, Playwright.

**Spec reference:** [docs/superpowers/specs/2026-06-03-training-system-redesign-design.md](../specs/2026-06-03-training-system-redesign-design.md)
**Content reference:** [docs/superpowers/research/2026-06-03-exercise-pool-draft.md](../research/2026-06-03-exercise-pool-draft.md)

**Note on existing data:** `user_training_logs.stage_num` is reused as "Day number 1-5" (same range, semantics shifted). Existing rows from the old system count toward session totals; no migration needed. Cycle/slot is derived purely from row count, not stage_num values.

---

## Task 1: Update `trainingCycle.ts` to count-based slot calculation

**Files:**
- Modify: `src/lib/trainingCycle.ts`
- Modify: `src/lib/trainingCycle.test.ts`

The previous `nextDayNum` advanced based on the most recent log's `stage_num`. We change it to advance based on log **count** (each row = 1 session completed). Add `currentCycle(logs)` returning the 1-based cycle.

- [ ] **Step 1: Read existing `trainingCycle.test.ts` to confirm structure**

Read the file end-to-end so you understand the existing test setup.

- [ ] **Step 2: Replace the test file with new tests**

Overwrite `src/lib/trainingCycle.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
  nextDayNum,
  currentCycle,
  isDeepDay,
  pickFromPool,
} from './trainingCycle'

describe('nextDayNum', () => {
  it('returns 1 when no logs', () => {
    expect(nextDayNum([])).toBe(1)
  })

  it('returns 2 after 1 log', () => {
    expect(nextDayNum([{ stage_num: 1, log_date: '2026-06-01' }])).toBe(2)
  })

  it('returns 5 after 4 logs', () => {
    const logs = [1, 2, 3, 4].map((n) => ({ stage_num: n, log_date: `2026-06-0${n}` }))
    expect(nextDayNum(logs)).toBe(5)
  })

  it('wraps from 5 to 1 after 5 logs (cycle complete)', () => {
    const logs = [1, 2, 3, 4, 5].map((n) => ({ stage_num: n, log_date: `2026-06-0${n}` }))
    expect(nextDayNum(logs)).toBe(1)
  })

  it('ignores stage_num values — only counts rows', () => {
    // Even if past logs are inconsistent (legacy old-system rows), count drives slot.
    const logs = [
      { stage_num: 99, log_date: '2026-05-01' },
      { stage_num: 99, log_date: '2026-05-02' },
    ]
    expect(nextDayNum(logs)).toBe(3)
  })
})

describe('currentCycle', () => {
  it('returns 1 when no logs', () => {
    expect(currentCycle([])).toBe(1)
  })

  it('returns 1 during first 5 sessions', () => {
    const logs = [1, 2, 3, 4].map((n) => ({ stage_num: n, log_date: `2026-06-0${n}` }))
    expect(currentCycle(logs)).toBe(1)
  })

  it('returns 2 on the 6th session (after completing cycle 1)', () => {
    const logs = [1, 2, 3, 4, 5].map((n) => ({ stage_num: n, log_date: `2026-06-0${n}` }))
    expect(currentCycle(logs)).toBe(2)
  })

  it('returns 3 after 10 sessions', () => {
    const logs = Array.from({ length: 10 }, (_, i) => ({
      stage_num: (i % 5) + 1,
      log_date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    }))
    expect(currentCycle(logs)).toBe(3)
  })
})

describe('isDeepDay', () => {
  it('false when concerns empty', () => {
    expect(isDeepDay(['trembling'], [])).toBe(false)
    expect(isDeepDay([], ['trembling'])).toBe(false)
  })

  it('true when any concern in user list matches day', () => {
    expect(isDeepDay(['trembling'], ['trembling'])).toBe(true)
    expect(isDeepDay(['small_voice'], ['small_voice', 'fast'])).toBe(true)
  })

  it('false when no overlap', () => {
    expect(isDeepDay(['diction'], ['fast'])).toBe(false)
  })
})

describe('pickFromPool', () => {
  it('returns undefined when pool empty', () => {
    expect(pickFromPool(undefined)).toBeUndefined()
    expect(pickFromPool([])).toBeUndefined()
  })

  it('returns an element from the pool', () => {
    const pool = ['a', 'b', 'c']
    const result = pickFromPool(pool)
    expect(pool).toContain(result)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test
```
Expected: `nextDayNum` tests for "returns 2 after 1 log", "returns 5 after 4 logs", "ignores stage_num — only counts rows" all FAIL (existing impl uses stage_num). `currentCycle` tests fail with "is not a function".

- [ ] **Step 4: Update `trainingCycle.ts` implementation**

Modify `src/lib/trainingCycle.ts`. Replace the `nextDayNum` function and add `currentCycle`:

```typescript
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```
Expected: all 14 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/trainingCycle.ts src/lib/trainingCycle.test.ts
git commit -m "refactor(training): switch nextDayNum to count-based + add currentCycle"
```

---

## Task 2: Rewrite `curriculum.ts` types and data model

**Files:**
- Modify (full rewrite): `src/lib/curriculum.ts`

Replace the existing types and data with the outcome-based model + 16 exercises across Days 1-4 + empty Day 5.

- [ ] **Step 1: Replace the entire file with new content**

Overwrite `src/lib/curriculum.ts`:

```typescript
/**
 * 훈련 커리큘럼 — outcome 기반 5-Day 사이클.
 * - Day 1~4: 4개 outcome (안정/전달력/명료성/표현력). 각 Day는 그 영역의 L1~L4 운동 4개.
 * - Day 5: elective. 런타임에 사용자가 outcome을 골라 그 Day의 운동 진행.
 * - concern은 focus 마커 (콘텐츠 게이트 아님). 모든 사용자가 모든 Day 진행.
 * - 운동 콘텐츠는 임상 검증 기법(VFE/SOVT/LSVT/Lessac/RVT) 기반.
 *
 * 사양: docs/superpowers/specs/2026-06-03-training-system-redesign-design.md
 */

export type ConcernSlug = 'small_voice' | 'trembling' | 'fast' | 'diction'

export const CONCERN_LABELS: Record<ConcernSlug, string> = {
  small_voice: '작은 목소리',
  trembling: '떨리는 목소리',
  fast: '빨라지는 목소리',
  diction: '발음 웅얼거림',
}

export type Outcome = 'stability' | 'projection' | 'clarity' | 'expression'

export const OUTCOME_LABELS: Record<Outcome, string> = {
  stability: '안정',
  projection: '전달력',
  clarity: '명료성',
  expression: '표현력',
}

/**
 * Concern → outcome 1:1 매핑.
 * 사용자의 자기 선언(concerns)이 어떤 outcome Day와 매칭되는지 결정.
 */
export const CONCERN_TO_OUTCOME: Record<ConcernSlug, Outcome> = {
  trembling: 'stability',
  small_voice: 'projection',
  diction: 'clarity',
  fast: 'expression',
}

export type Interaction = 'guided' | 'record' | 'metronome'

export interface ExerciseUnit {
  id: string
  title: string
  description: string
  instructions: string[]
  durationSec: number
  interaction: Interaction
  scriptPool?: string[]
  metronomeBPM?: number  // 'metronome' 용. 기본값은 컴포넌트가 결정
}

/**
 * Day 유형. Day 1~4는 outcome, Day 5는 elective.
 */
export interface TrainingDay {
  dayNum: 1 | 2 | 3 | 4 | 5
  outcome: Outcome | 'elective'
  theme: string                    // "안정", "전달력", ..., "선택"
  subtitle: string                 // aspirational framing
  emoji: string
  matchingConcern?: ConcernSlug    // 매칭 concern (Day 5는 없음)
  exercises: ExerciseUnit[]        // Day 1~4는 정확히 4개. Day 5는 빈 배열 (런타임 픽).
}

// ─── 16개 운동 정의 ───────────────────────────────────────────────────────────

// Day 1 안정 — trembling concern (B-L1~L4)
const STABILITY_EXERCISES: ExerciseUnit[] = [
  {
    id: 'stab-l1-478breath',
    title: '4-7-8 호흡',
    description: '부교감 활성화로 떨림 진정',
    instructions: [
      '코로 4초 천천히 들이마시기',
      '7초 동안 숨 멈추기',
      '입으로 8초 동안 천천히 내쉬기',
      '4회 반복',
    ],
    durationSec: 90,
    interaction: 'guided',
  },
  {
    id: 'stab-l2-sustained-vowel',
    title: '모음 길게 유지',
    description: '발성 안정성 측정·훈련',
    instructions: [
      '편안한 자세로 앉기',
      '"아~" 소리를 한 호흡으로 최대한 길게 유지',
      '흔들림 없이, 5-10초 목표',
    ],
    durationSec: 90,
    interaction: 'record',
  },
  {
    id: 'stab-l3-liptrill-scale',
    title: '립 트릴 음계',
    description: '후두 긴장 풀기',
    instructions: [
      '입술을 부르르 떨며 소리 내기',
      '도-미-솔-미-도 음계 따라 진행',
      '입술 진동이 끊기지 않게 유지',
    ],
    durationSec: 90,
    interaction: 'record',
  },
  {
    id: 'stab-l4-stable-reading',
    title: '안정된 문장 읽기',
    description: '흔들림 없이 한 문장을 끝까지',
    instructions: [
      '아래 문장을 천천히, 흔들림 없이 읽기',
      '한 호흡으로 끝까지 읽기 목표',
    ],
    durationSec: 60,
    interaction: 'record',
    scriptPool: [
      '오늘도 내 목소리는 단단하게 자리를 잡습니다.',
      '한 음 한 음 흔들림 없이 전달합니다.',
      '편안하게, 그러나 또렷하게 말합니다.',
    ],
  },
]

// Day 2 전달력 — small_voice concern (A-L1~L4)
const PROJECTION_EXERCISES: ExerciseUnit[] = [
  {
    id: 'proj-l1-diaphragm',
    title: '복식호흡 인지',
    description: '전달력의 토대인 복식호흡 감각 잡기',
    instructions: [
      '편안히 눕거나 의자에 앉기',
      '한 손은 가슴, 다른 손은 배에 두기',
      '코로 4초 들이마시기 — 배가 부풀어야 함',
      '입으로 6초 내쉬기 — 배가 내려가야 함',
    ],
    durationSec: 90,
    interaction: 'guided',
  },
  {
    id: 'proj-l2-straw',
    title: '빨대 호흡 (SOVT)',
    description: '성대 효율을 높이는 임상 운동',
    instructions: [
      '가는 빨대를 입에 물기',
      '"우~" 소리를 내며 음정 유지',
      '도-레-미 음계로 천천히 상승 후 하강',
    ],
    durationSec: 90,
    interaction: 'record',
  },
  {
    id: 'proj-l3-hum-to-vowel',
    title: '험 → 모음 전환',
    description: '전방 공명 훈련',
    instructions: [
      '입을 다물고 "음~" 험을 길게 — 입술/광대 진동 느끼기',
      '진동감을 유지한 채 입을 천천히 열며 "아~"로 전환',
      '진동이 코·광대 앞쪽에서 계속 느껴져야 함',
    ],
    durationSec: 90,
    interaction: 'record',
  },
  {
    id: 'proj-l4-distance',
    title: '거리감 시뮬레이션',
    description: '일상 볼륨 조절 적용',
    instructions: [
      '1m 앞 사람에게 말하듯 읽기 (보통 음량)',
      '3m 앞 사람에게 말하듯 (조금 큰 음량)',
      '5m 앞 사람에게 말하듯 (더 큰 음량, 짜내지 않게)',
    ],
    durationSec: 90,
    interaction: 'record',
    scriptPool: [
      '안녕하세요. 좋은 하루 보내고 계신가요.',
      '제 목소리가 거기까지 잘 들리시나요.',
      '오늘 날씨가 정말 좋네요.',
    ],
  },
]

// Day 3 명료성 — diction concern (D-L1~L4)
const CLARITY_EXERCISES: ExerciseUnit[] = [
  {
    id: 'clar-l1-articulator-warmup',
    title: '입술·혀 풀기',
    description: '조음기관 유연성 확보',
    instructions: [
      '입술을 부르르 떨기 30초',
      '혀를 시계방향·반시계방향으로 천천히 돌리기 30초',
      '턱을 좌우·상하로 부드럽게 풀기 30초',
    ],
    durationSec: 90,
    interaction: 'guided',
  },
  {
    id: 'clar-l2-consonant-precision',
    title: '자음 정밀화',
    description: '입 모양·혀 위치 정확히',
    instructions: [
      'ㅂ-ㅍ-ㅁ을 또렷이 5회 (입술 닫고 열기 분명히)',
      'ㄷ-ㅌ-ㄴ을 또렷이 5회 (혀끝 윗잇몸)',
      'ㄱ-ㅋ-ㅇ을 또렷이 5회 (혀뒤 연구개)',
    ],
    durationSec: 90,
    interaction: 'record',
  },
  {
    id: 'clar-l3-tongue-twister',
    title: '잰말놀이',
    description: '조음 속도와 정확도 동시 훈련',
    instructions: [
      '아래 잰말을 처음엔 느리고 또렷이',
      '점점 빠르게 — 그러나 정확하게',
      '3번 반복',
    ],
    durationSec: 90,
    interaction: 'record',
    scriptPool: [
      '간장 공장 공장장은 강 공장장이고 된장 공장 공장장은 장 공장장이다.',
      '경찰청 철창살은 외철창살이고 검찰청 철창살은 쌍철창살이다.',
      '저 분이 박 법학박사이시고 그 분이 백 법학박사이시다.',
    ],
  },
  {
    id: 'clar-l4-natural-sentence',
    title: '자연 문장 적용',
    description: '일상 발화로 명료성 전이',
    instructions: [
      '아래 문장을 또렷한 발음으로 읽기',
      '받침, 자음 하나하나 살리기',
    ],
    durationSec: 60,
    interaction: 'record',
    scriptPool: [
      '안녕하세요, 저는 □□입니다. 오늘 하루도 또렷하게 시작합니다.',
      '오늘 일정은 회의 두 건과 점심 약속이 있습니다.',
      '주말에는 가족과 산책을 할 계획입니다.',
    ],
  },
]

// Day 4 표현력 — fast concern (C-L1~L4)
const EXPRESSION_EXERCISES: ExerciseUnit[] = [
  {
    id: 'expr-l1-metronome',
    title: '메트로놈 음절 읽기',
    description: '외적 페이스로 내적 리듬 잡기',
    instructions: [
      '메트로놈 박자에 맞춰 한 음절씩',
      '"가-나-다-라" 처럼 한 박자에 한 음절',
      '점점 박자에 익숙해지기',
    ],
    durationSec: 60,
    interaction: 'metronome',
    metronomeBPM: 60,
    scriptPool: [
      '가-나-다-라-마-바-사-아-자-차',
      '안-녕-하-세-요-반-갑-습-니-다',
    ],
  },
  {
    id: 'expr-l2-pauses',
    title: '의도적 휴지',
    description: '의미 단위로 끊어 읽기',
    instructions: [
      '아래 문장에서 "/" 자리마다 1초 휴지',
      '천천히, 휴지를 충분히',
    ],
    durationSec: 60,
    interaction: 'record',
    scriptPool: [
      '오늘은 / 정말 좋은 / 하루였습니다.',
      '제가 / 말씀드리고 싶은 것은 / 바로 이 점입니다.',
      '천천히 / 그러나 분명하게 / 전달합니다.',
    ],
  },
  {
    id: 'expr-l3-shadowing',
    title: '슬로우 섀도잉',
    description: '차분한 페이스 모방',
    instructions: [
      '아래 문장을 차분한 뉴스 앵커처럼',
      '한 음절 한 음절 차분히',
      '평소보다 0.7배 속도',
    ],
    durationSec: 90,
    interaction: 'record',
    scriptPool: [
      '오늘의 주요 소식을 전해드리겠습니다.',
      '청취자 여러분, 좋은 저녁입니다.',
      '날씨 정보를 알려드리겠습니다.',
    ],
  },
  {
    id: 'expr-l4-target-bpm',
    title: '목표 페이스 발화',
    description: '자유 발화 페이스 자가 측정',
    instructions: [
      '아래 주제로 30초간 자유롭게 말하기',
      '평소 페이스로 자연스럽게',
    ],
    durationSec: 60,
    interaction: 'record',
    scriptPool: [
      '오늘 아침에 있었던 일을 말해보세요.',
      '주말 계획을 설명해보세요.',
      '좋아하는 음식 하나를 추천해보세요.',
    ],
  },
]

// ─── CURRICULUM 정의 ─────────────────────────────────────────────────────────

export const CURRICULUM: TrainingDay[] = [
  {
    dayNum: 1,
    outcome: 'stability',
    theme: '안정',
    subtitle: '당신의 진정성이 흔들림 없이 전달되도록',
    emoji: '🫁',
    matchingConcern: 'trembling',
    exercises: STABILITY_EXERCISES,
  },
  {
    dayNum: 2,
    outcome: 'projection',
    theme: '전달력',
    subtitle: '당신의 존재감이 또렷하게 닿도록',
    emoji: '📢',
    matchingConcern: 'small_voice',
    exercises: PROJECTION_EXERCISES,
  },
  {
    dayNum: 3,
    outcome: 'clarity',
    theme: '명료성',
    subtitle: '당신의 한 마디 한 마디가 또렷하게 전해지도록',
    emoji: '🗣️',
    matchingConcern: 'diction',
    exercises: CLARITY_EXERCISES,
  },
  {
    dayNum: 4,
    outcome: 'expression',
    theme: '표현력',
    subtitle: '당신의 말에 여유와 무게가 담기도록',
    emoji: '🎵',
    matchingConcern: 'fast',
    exercises: EXPRESSION_EXERCISES,
  },
  {
    dayNum: 5,
    outcome: 'elective',
    theme: '선택',
    subtitle: '한 번 더 다듬을 영역을 골라요',
    emoji: '🎯',
    exercises: [],  // 런타임에 사용자가 outcome을 픽하면 그 Day의 exercises 사용
  },
]

export function getDay(dayNum: number): TrainingDay | undefined {
  return CURRICULUM.find((d) => d.dayNum === dayNum)
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: errors only in files we'll update in later tasks:
- `SessionPlayer.tsx` (uses `day.matchingConcerns`, `day.standard`, `day.deep` — removed fields)
- `TrainingClient.tsx` (uses `todayDay.matchingConcerns`)
- Possibly other consumers of the removed fields

Plus the pre-existing `tests/qa/02-share-bug.spec.ts(29,54)`.

NO unrelated new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/curriculum.ts
git commit -m "feat(training): rewrite curriculum to outcome-based 5-Day with 16 exercises"
```

---

## Task 3: MetronomeExercise component

**Files:**
- Create: `src/components/training/exercise/MetronomeExercise.tsx`

A new exercise renderer for the `'metronome'` interaction. Shows a visual + audible beat, lets user read along, then record optionally.

- [ ] **Step 1: Create `MetronomeExercise.tsx`**

```typescript
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, Square, RotateCcw, Play, Pause } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import type { ExerciseUnit } from '@/lib/curriculum'
import { pickFromPool } from '@/lib/trainingCycle'

interface Props {
  unit: ExerciseUnit
  onDone: () => void
}

const DEFAULT_BPM = 60

export default function MetronomeExercise({ unit, onDone }: Props) {
  const bpm = unit.metronomeBPM ?? DEFAULT_BPM
  const intervalMs = 60_000 / bpm

  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<number | null>(null)

  const recorder = useAudioRecorder(120)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useWaveform({ analyser: recorder.analyserNode, canvasRef, active: recorder.state === 'recording' })

  const script = useMemo(() => pickFromPool(unit.scriptPool), [unit])
  const reviewing = recorder.state === 'recorded'

  // play a tick sound
  function tick() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    const ctx = audioCtxRef.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.05)
  }

  useEffect(() => {
    if (!running) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }
    tick()
    setBeat((b) => b + 1)
    intervalRef.current = window.setInterval(() => {
      tick()
      setBeat((b) => b + 1)
    }, intervalMs)
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [running, intervalMs])

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close()
    }
  }, [])

  return (
    <div className="glass rounded-3xl p-6 space-y-4">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">{unit.title}</p>
        <p className="text-sm text-muted-foreground">{unit.description}</p>
      </div>

      <ul className="space-y-2">
        {unit.instructions.map((line, i) => (
          <li key={i} className="text-sm text-foreground leading-relaxed">• {line}</li>
        ))}
      </ul>

      {script && (
        <div className="rounded-2xl bg-secondary/60 p-4">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">박자에 맞춰 읽기</p>
          <p className="text-sm text-foreground leading-relaxed">&ldquo;{script}&rdquo;</p>
        </div>
      )}

      {/* Metronome visualizer */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">{bpm} BPM</span>
        </div>
        <div className={`w-16 h-16 rounded-full transition-transform ${
          beat % 2 === 0 ? 'bg-primary scale-110' : 'bg-secondary scale-90'
        }`} />
        <button
          onClick={() => setRunning((r) => !r)}
          className="px-5 h-10 rounded-2xl bg-secondary/60 text-sm font-semibold text-foreground active:scale-95 transition-transform flex items-center gap-2"
        >
          {running ? <><Pause size={14} />멈춤</> : <><Play size={14} />시작</>}
        </button>
      </div>

      {/* Recording controls */}
      {!reviewing && recorder.state !== 'recording' && (
        <div className="flex flex-col items-center gap-3 pt-3 border-t border-border/40">
          <p className="text-xs text-muted-foreground">박자에 맞춰 읽고 녹음하기</p>
          <button
            onClick={() => recorder.start()}
            className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform"
          >
            <Mic size={22} className="text-white" />
          </button>
        </div>
      )}

      {recorder.state === 'recording' && (
        <div className="flex flex-col items-center gap-3 pt-3 border-t border-border/40">
          <canvas ref={canvasRef} className="w-full h-12 rounded-xl" />
          <p className="text-xs tabular-nums text-muted-foreground">{recorder.duration}초</p>
          <button
            onClick={() => recorder.stop()}
            className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Square size={20} className="text-white fill-white" />
          </button>
        </div>
      )}

      {reviewing && recorder.audioUrl && (
        <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
          <audio controls src={recorder.audioUrl} className="w-full h-10" />
          <div className="flex gap-2">
            <button
              onClick={() => recorder.reset()}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-2xl bg-secondary/60 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw size={13} />다시 녹음
            </button>
            <button
              onClick={onDone}
              className="flex-1 h-10 rounded-2xl gradient-primary text-white text-sm font-bold active:scale-95 transition-transform"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no new errors in this file. Other legacy errors still present (we fix them next tasks).

- [ ] **Step 3: Commit**

```bash
git add src/components/training/exercise/MetronomeExercise.tsx
git commit -m "feat(training): add MetronomeExercise renderer"
```

---

## Task 4: Wire `MetronomeExercise` into `ExerciseUnitRenderer`

**Files:**
- Modify: `src/components/training/ExerciseUnitRenderer.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/components/training/ExerciseUnitRenderer.tsx`:

```typescript
'use client'

import type { ExerciseUnit } from '@/lib/curriculum'
import GuidedExercise from './exercise/GuidedExercise'
import RecordExercise from './exercise/RecordExercise'
import MetronomeExercise from './exercise/MetronomeExercise'

interface Props {
  unit: ExerciseUnit
  onDone: () => void
}

export default function ExerciseUnitRenderer({ unit, onDone }: Props) {
  switch (unit.interaction) {
    case 'guided':
      return <GuidedExercise unit={unit} onDone={onDone} />
    case 'record':
      return <RecordExercise unit={unit} onDone={onDone} />
    case 'metronome':
      return <MetronomeExercise unit={unit} onDone={onDone} />
    default: {
      const exhaustive: never = unit.interaction
      return <p className="text-sm text-red-500">Unknown interaction: {String(exhaustive)}</p>
    }
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: still failing on SessionPlayer/TrainingClient (next tasks). No new errors here.

- [ ] **Step 3: Commit**

```bash
git add src/components/training/ExerciseUnitRenderer.tsx
git commit -m "feat(training): dispatch metronome interaction in ExerciseUnitRenderer"
```

---

## Task 5: `Day5Picker` component

**Files:**
- Create: `src/components/training/Day5Picker.tsx`

A modal-less screen showing 4 outcome cards. User taps one to start that outcome's session.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { CURRICULUM, OUTCOME_LABELS, type Outcome, type TrainingDay } from '@/lib/curriculum'

interface Props {
  onPick: (day: TrainingDay) => void
}

const OUTCOMES: Outcome[] = ['stability', 'projection', 'clarity', 'expression']

export default function Day5Picker({ onPick }: Props) {
  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="glass rounded-3xl p-5 space-y-2">
        <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Day 5 · 선택</p>
        <p className="text-sm text-foreground leading-relaxed font-bold">어떤 영역을 한 번 더?</p>
        <p className="text-xs text-muted-foreground">아래 4가지 중 하나를 골라 그 영역의 운동 4개를 진행해요.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {OUTCOMES.map((outcome) => {
          const day = CURRICULUM.find((d) => d.outcome === outcome)
          if (!day) return null
          return (
            <button
              key={outcome}
              onClick={() => onPick(day)}
              className="flex flex-col items-start text-left rounded-3xl bg-secondary/60 hover:bg-secondary active:scale-[0.98] transition-all p-5 min-h-[120px]"
            >
              <span className="text-3xl mb-2">{day.emoji}</span>
              <p className="text-base font-bold text-foreground mb-1">{OUTCOME_LABELS[outcome]}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{day.subtitle}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no new errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/training/Day5Picker.tsx
git commit -m "feat(training): add Day5Picker for elective outcome selection"
```

---

## Task 6: Update `SessionPlayer` for Day 5 elective + drop deep mode

**Files:**
- Modify (full rewrite): `src/components/training/SessionPlayer.tsx`

Removes the `standard/deep` split. Uses `day.exercises` directly. For Day 5 (elective), shows `Day5Picker` first; once user picks, switches to the picked Day's exercises.

- [ ] **Step 1: Replace the file**

Overwrite `src/components/training/SessionPlayer.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { TrainingDay } from '@/lib/curriculum'
import ExerciseUnitRenderer from './ExerciseUnitRenderer'
import Day5Picker from './Day5Picker'
import { getSupabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props { day: TrainingDay }

export default function SessionPlayer({ day }: Props) {
  const router = useRouter()
  const [pickedDay, setPickedDay] = useState<TrainingDay | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [saving, setSaving] = useState(false)

  // For elective Day 5, use the user's picked day. Otherwise use the route day.
  const activeDay = day.outcome === 'elective' ? pickedDay : day

  async function handleSessionComplete() {
    if (!activeDay) return
    setSaving(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const themeRecorded = day.outcome === 'elective'
          ? `선택: ${activeDay.theme}`
          : day.theme
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('user_training_logs').insert({
          user_id: user.id,
          log_date: todayStr(),
          stage_num: day.dayNum,
          theme: themeRecorded,
          score: 100,
        })
        if (error && error.code !== '23505') {
          console.error('[session] save failed:', error)
        }
      }
      trackEvent('training_session_completed', {
        day_num: day.dayNum,
        outcome: activeDay.outcome,
        elective: day.outcome === 'elective',
      })
      setCompleted(true)
    } finally {
      setSaving(false)
    }
  }

  // Day 5 elective: show picker until user selects
  if (day.outcome === 'elective' && !pickedDay && !completed) {
    return <Day5Picker onPick={(d) => setPickedDay(d)} />
  }

  if (completed) {
    return (
      <div className="px-4 pt-6 space-y-4">
        <div className="glass rounded-3xl p-8 flex flex-col items-center text-center gap-3">
          <span className="text-4xl">🎉</span>
          <p className="text-base font-bold">오늘의 훈련 완료!</p>
          <p className="text-xs text-muted-foreground">
            Day {day.dayNum} · {activeDay?.theme ?? day.theme}
          </p>
        </div>
        {day.dayNum === 5 && (
          <button
            onClick={() => router.push('/training/voice-check')}
            className="w-full h-12 rounded-2xl border border-primary/40 bg-primary/10 text-sm font-bold text-primary active:scale-95 transition-transform"
          >
            🎤 이번 사이클 voice-check 측정하기
          </button>
        )}
        <button
          onClick={() => router.push('/training')}
          className="w-full h-12 rounded-2xl bg-secondary text-foreground text-sm font-bold active:scale-95 transition-transform"
        >
          훈련 목록으로
        </button>
      </div>
    )
  }

  if (!activeDay) return null
  const units = activeDay.exercises
  if (units.length === 0) {
    return (
      <div className="px-4 pt-6">
        <p className="text-sm text-muted-foreground text-center">이 Day에는 운동이 없습니다.</p>
      </div>
    )
  }

  const current = units[stepIdx]
  const isLast = stepIdx === units.length - 1

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />나가기
        </button>
        <p className="text-xs font-semibold text-muted-foreground tabular-nums">
          Step {stepIdx + 1} / {units.length}
        </p>
      </div>

      <ExerciseUnitRenderer
        key={current.id}
        unit={current}
        onDone={() => {
          if (isLast) {
            if (!saving) handleSessionComplete()
          } else {
            setStepIdx((i) => i + 1)
          }
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: still failing on TrainingClient.tsx (next task). No new errors here.

- [ ] **Step 3: Commit**

```bash
git add src/components/training/SessionPlayer.tsx
git commit -m "feat(training): SessionPlayer handles Day 5 elective + drops deep mode"
```

---

## Task 7: Update `TrainingClient` landing for new Day labels and cycle display

**Files:**
- Modify (full rewrite): `src/app/training/TrainingClient.tsx`

Changes: use `currentCycle` for display, use `matchingConcern` (singular) for focus check, drop references to old `matchingConcerns` / `isDeepDay`.

- [ ] **Step 1: Replace the file**

Overwrite `src/app/training/TrainingClient.tsx`:

```typescript
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, ChevronRight, Pencil } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { CURRICULUM, CONCERN_LABELS } from '@/lib/curriculum'
import { nextDayNum, currentCycle, type TrainingLog } from '@/lib/trainingCycle'
import { useConcerns } from '@/hooks/useConcerns'
import ConcernsModal from '@/components/training/ConcernsModal'
import { trackEvent } from '@/lib/analytics'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TrainingClient() {
  const router = useRouter()
  const todayStr = useMemo(() => toDateStr(new Date()), [])
  const [logs, setLogs] = useState<TrainingLog[]>([])
  const { concerns, save: saveConcerns } = useConcerns()
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_training_logs')
        .select('stage_num, log_date')
        .eq('user_id', user.id)
      if (data) setLogs(data as TrainingLog[])
    }
    load()
  }, [])

  const streak = useMemo(() => {
    const unique = [...new Set(logs.map((l) => l.log_date))].sort((a, b) => b.localeCompare(a))
    if (unique.length === 0) return 0
    const yesterday = new Date(todayStr)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = toDateStr(yesterday)
    if (unique[0] !== todayStr && unique[0] !== yesterdayStr) return 0
    let count = 0
    let expected = unique[0]
    for (const date of unique) {
      if (date === expected) {
        count++
        const d = new Date(expected)
        d.setDate(d.getDate() - 1)
        expected = toDateStr(d)
      } else if (date < expected) break
    }
    return count
  }, [logs, todayStr])

  const cycle = useMemo(() => currentCycle(logs), [logs])
  const todayDayNum = useMemo(() => nextDayNum(logs), [logs])
  const todayDay = useMemo(() => CURRICULUM.find((d) => d.dayNum === todayDayNum)!, [todayDayNum])
  const todayIsFocus = useMemo(
    () => !!todayDay.matchingConcern && concerns.includes(todayDay.matchingConcern),
    [todayDay, concerns],
  )
  const alreadyDoneToday = useMemo(
    () => logs.some((l) => l.log_date === todayStr),
    [logs, todayStr],
  )

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">훈련 트랙</Badge>
          <h1 className="text-2xl font-black text-white mb-1">Voice Training</h1>
          <p className="text-white/80 text-xs mb-3">Cycle {cycle} · 5일 코스 진행 중</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
              <Flame size={14} className="text-orange-300" />
              <span className="text-white text-xs font-bold">{streak}일 연속</span>
            </div>
          </div>
        </div>
      </div>

      {/* Today's day card */}
      <div className="px-4 pt-6">
        <button
          onClick={() => {
            trackEvent('training_today_clicked', {
              day_num: todayDay.dayNum,
              outcome: todayDay.outcome,
              focus: todayIsFocus,
            })
            router.push(`/training/session/${todayDay.dayNum}`)
          }}
          className="w-full text-left rounded-3xl bg-secondary/60 hover:bg-secondary active:scale-[0.98] transition-all p-5"
        >
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wide mb-1">
            오늘의 단계 · Day {todayDay.dayNum} / 5
          </p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{todayDay.emoji}</span>
            <p className="text-base font-bold text-foreground">{todayDay.theme}</p>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug mb-1">{todayDay.subtitle}</p>
          {todayIsFocus && (
            <p className="text-[11px] font-semibold text-orange-400 mb-1">⚡ 당신이 가장 빛날 단계예요</p>
          )}
          {alreadyDoneToday && (
            <p className="text-[11px] text-emerald-400 font-semibold">✓ 오늘 이미 완료 · 다시 진행 가능</p>
          )}
        </button>
      </div>

      {/* Other days */}
      <div className="px-4 pt-4">
        <p className="text-[11px] font-semibold text-muted-foreground mb-2">다른 단계 둘러보기</p>
        <div className="grid grid-cols-2 gap-2">
          {CURRICULUM.filter((d) => d.dayNum !== todayDay.dayNum).map((d) => (
            <button
              key={d.dayNum}
              onClick={() => router.push(`/training/session/${d.dayNum}`)}
              className="flex items-center gap-2 rounded-2xl bg-secondary/40 hover:bg-secondary/70 p-3 active:scale-95 transition-all"
            >
              <span className="text-lg">{d.emoji}</span>
              <div className="text-left">
                <p className="text-[10px] text-muted-foreground">Day {d.dayNum}</p>
                <p className="text-xs font-semibold text-foreground">{d.theme}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* My concerns */}
      <div className="px-4 pt-6">
        <button
          onClick={() => setEditing(true)}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-secondary/30 active:scale-[0.98] transition-all"
        >
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground">현재 고민</p>
            <p className="text-xs font-semibold text-foreground">
              {concerns.length === 0 ? '아직 선언 안 함' : concerns.map((c) => CONCERN_LABELS[c]).join(', ')}
            </p>
          </div>
          <Pencil size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Voice-check CTA */}
      <div className="px-4 mt-6">
        <button
          onClick={() => {
            trackEvent('voice_check_cta_clicked', { source: 'training_landing' })
            router.push('/training/voice-check')
          }}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border border-primary/40 bg-primary/10 active:scale-[0.98] transition-all"
        >
          <span className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0 text-base">🎤</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-primary">훈련 후 목소리 변화 측정</p>
            <p className="text-[11px] text-muted-foreground">전후 목소리 품질이 얼마나 달라졌는지 확인해요</p>
          </div>
          <ChevronRight size={16} className="text-primary shrink-0" />
        </button>
      </div>

      <ConcernsModal
        open={editing}
        initial={concerns}
        onClose={() => setEditing(false)}
        onSave={saveConcerns}
        title="고민 수정"
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: legacy errors should be gone. Only `tests/qa/02-share-bug.spec.ts(29,54)` pre-existing.

- [ ] **Step 3: Commit**

```bash
git add src/app/training/TrainingClient.tsx
git commit -m "feat(training): landing uses new Day labels and currentCycle"
```

---

## Task 8: Lint sweep + manual route smoke

**Files:**
- (no code changes — verification)

After the major rewrites we sanity-check.

- [ ] **Step 1: Run lint**

```bash
npm run lint
```
Expected: 0 errors (warnings are pre-existing — img tag, exhaustive-deps in other files). If any NEW errors appear in our touched files, fix them.

- [ ] **Step 2: Run unit tests**

```bash
npm test
```
Expected: 14/14 pass.

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```
Expected: only the pre-existing `tests/qa/02-share-bug.spec.ts(29,54)` error.

- [ ] **Step 4: Manual dev server smoke (optional, document if skipped)**

Run:
```bash
npm run dev
```
Open in browser:
- `/training` → see "Cycle N · 5일 코스 진행 중" subtitle, today's Day card with new theme/subtitle
- `/training/session/1` → 4-step sequence of stability exercises (4-7-8 호흡 → 모음 유지 → 립트릴 → 안정된 문장)
- `/training/session/4` → first exercise is metronome (visual pulse + tick sound)
- `/training/session/5` → Day5Picker shows 4 outcome cards; tap one → that outcome's 4-step session

Subagents that can't run a dev server should skip this step and note it in self-review.

- [ ] **Step 5: Commit (no-op if no changes needed)**

If lint or tsc surfaced fixable issues you addressed, commit them:
```bash
git add -A
git commit -m "chore(training): post-redesign lint/type fixes"
```
Otherwise skip.

---

## Task 9: Update Playwright smoke test for new structure

**Files:**
- Modify: `tests/qa/07-training-redesign.spec.ts`

The earlier smoke test referenced the old Day labels. Update assertions for new labels.

- [ ] **Step 1: Replace the test file**

Overwrite `tests/qa/07-training-redesign.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Training tab redesign (Phase 2 — outcome-based)', () => {
  test('landing renders Cycle N subtitle, today day card, and other day cards', async ({ page }) => {
    await page.goto('/training')
    await expect(page.getByText('Voice Training')).toBeVisible()
    await expect(page.getByText(/Cycle \d+/)).toBeVisible()
    await expect(page.getByText(/Day \d \/ 5/)).toBeVisible()
    await expect(page.getByText('다른 단계 둘러보기')).toBeVisible()
    await expect(page.getByText('훈련 후 목소리 변화 측정')).toBeVisible()
  })

  test('session route renders the day header with theme + subtitle', async ({ page }) => {
    await page.goto('/training/session/1')
    await expect(page.getByText('Day 1 / 5')).toBeVisible()
    await expect(page.getByText('안정')).toBeVisible()
    await expect(page.getByText('당신의 진정성이 흔들림 없이 전달되도록')).toBeVisible()
  })

  test('Day 5 route shows outcome picker before exercises', async ({ page }) => {
    await page.goto('/training/session/5')
    await expect(page.getByText('어떤 영역을 한 번 더?')).toBeVisible()
    // 4 outcome cards
    await expect(page.getByText('안정', { exact: true })).toBeVisible()
    await expect(page.getByText('전달력', { exact: true })).toBeVisible()
    await expect(page.getByText('명료성', { exact: true })).toBeVisible()
    await expect(page.getByText('표현력', { exact: true })).toBeVisible()
  })

  test('invalid day shows 404', async ({ page }) => {
    const response = await page.goto('/training/session/99')
    expect(response?.status()).toBe(404)
  })
})
```

- [ ] **Step 2: Run the test (best-effort)**

```bash
npm run test:qa -- tests/qa/07-training-redesign.spec.ts
```
Expected: tests fail with `net::ERR_CONNECTION_REFUSED` unless a dev server runs on port 3000. That's a server-not-running issue, not a code issue. Report DONE_WITH_CONCERNS if so.

If dev server IS running, tests should pass.

- [ ] **Step 3: Commit**

```bash
git add tests/qa/07-training-redesign.spec.ts
git commit -m "test(training): update smoke test for outcome-based Days"
```

---

## Task 10: Manual end-to-end verification

Not a code task — checklist before declaring complete.

- [ ] **Step 1: Run dev server** — `npm run dev`

- [ ] **Step 2: Verify each route/state**
  - [ ] `/training` shows "Cycle N · 5일 코스 진행 중", today's Day card with theme/subtitle, focus marker only when user's concern matches today
  - [ ] `/training/session/1` (안정) — 4 sequential exercises starting with "4-7-8 호흡" guided countdown
  - [ ] `/training/session/2` (전달력) — starts with "복식호흡 인지" guided exercise
  - [ ] `/training/session/3` (명료성) — starts with "입술·혀 풀기" guided exercise
  - [ ] `/training/session/4` (표현력) — first exercise is metronome (pulse + tick), can record
  - [ ] `/training/session/5` (선택) — picker shows 4 outcome cards; pick one → runs that outcome's 4 exercises
  - [ ] After completing a session, returning to `/training` shows the day counter advanced (next Day or wrapped to Day 1 with cycle bumped)
  - [ ] `/training/category/...` → 404 (legacy already removed)

- [ ] **Step 3: Final clean check**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run test:qa -- tests/qa/07-training-redesign.spec.ts
```
Expected: all clean except the pre-existing tests/qa/02-share-bug.spec.ts error and the playwright connection issue if no dev server.

---

## Out of Scope (deferred)

- Cycle-based variation (scriptPool rotation logic, BPM progression algorithms)
- New interaction types: `'breath-pacer'` (B-L1, A-L1 visual pacers), `'stopwatch'` (B-L2 timed hold)
- Achievement/graduation badge system
- Cross-train recommendation on Day 5
- Voice-check axis prioritization based on user concerns (display change only)
- Praat jitter measurement display inside exercises (UI shows nothing yet; backend still measures on save)
- Phoneme accuracy feedback display in exercises
- Push notifications, reminders

---

## Quick file map (reference)

**Created:**
- `src/components/training/exercise/MetronomeExercise.tsx`
- `src/components/training/Day5Picker.tsx`

**Rewritten:**
- `src/lib/curriculum.ts` (types + 16 exercises + 5 days)
- `src/components/training/SessionPlayer.tsx` (drops deep mode, adds elective flow)
- `src/components/training/ExerciseUnitRenderer.tsx` (dispatches metronome)
- `src/app/training/TrainingClient.tsx` (new labels + cycle display)
- `tests/qa/07-training-redesign.spec.ts` (new assertions)

**Modified:**
- `src/lib/trainingCycle.ts` (count-based slot + new currentCycle)
- `src/lib/trainingCycle.test.ts` (new test cases)

**Unchanged but checked:**
- `src/hooks/useConcerns.ts` — no changes needed
- `src/components/training/ConcernsModal.tsx` — no changes needed
- `src/app/training/session/[day]/page.tsx` — already displays subtitle; still works
- `src/app/result/ResultClient.tsx` — concerns modal trigger unchanged
- `src/components/training/exercise/GuidedExercise.tsx`, `RecordExercise.tsx` — work as-is for new exercise data
