# Training Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 4-category training tab with a unified 5-day curriculum that personalizes via depth (more exercises on days matching user's declared concerns).

**Architecture:** Data-driven curriculum (`ExerciseUnit[]` per `TrainingDay`) + session player that iterates a Day's exercises in sequence + concerns capture modal at `/result`. Big-bang migration: legacy `/training/category/` and `/training/[day]/` deleted; new `/training/session/[day]/` route built from scratch.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind, Supabase (DB + auth), Playwright (e2e). Vitest added for pure-logic unit tests.

**Spec reference:** [docs/superpowers/specs/2026-05-27-training-tab-redesign-design.md](../specs/2026-05-27-training-tab-redesign-design.md)

**Note on existing data:**
- `user_training_logs.stage_num` column already exists — reused as "day number" (1-5). No rename.
- `user_profiles` table is created by Task 4.
- Old themes in `curriculum.ts` STAGES (호흡, 립트릴, 볼륨, 속도, 발음) happen to closely match the new Day 1-5 themes, so existing logs remain meaningful.

---

## Task 1: Add Vitest for unit tests

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm install --save-dev vitest@^2 @vitest/ui
```
Expected: package added to devDependencies, no peer warnings.

- [ ] **Step 2: Add npm script**

Edit `package.json` — add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create minimal Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

- [ ] **Step 4: Sanity check**

Run: `npm test`
Expected: "No test files found" (no tests yet, but vitest runs cleanly).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit tests"
```

---

## Task 2: New types + provisional CURRICULUM data

**Files:**
- Modify (full rewrite): `src/lib/curriculum.ts`

The existing `STAGES`, `THEME_BY_DOW`, etc. are only consumed by files we are deleting in Task 12 — full rewrite is safe.

- [ ] **Step 1: Rewrite `src/lib/curriculum.ts`**

```typescript
/**
 * 훈련 커리큘럼 — 5-day 통합 코스.
 * 사용자 concerns 배열과 매칭되는 Day에서 deep 운동이 활성화됨.
 * 테마(호흡/이완/공명/속도/발음)와 운동 콘텐츠는 잠정 안 — 추후 코치 콘텐츠 조사 후 데이터만 교체.
 */

export type ConcernSlug = 'small_voice' | 'trembling' | 'fast' | 'diction'

export const CONCERN_LABELS: Record<ConcernSlug, string> = {
  small_voice: '작은 목소리',
  trembling: '떨리는 목소리',
  fast: '빨라지는 목소리',
  diction: '발음 웅얼거림',
}

export type Interaction = 'guided' | 'record'
// 'metronome' | 'visualizer' will be added when needed.

export interface ExerciseUnit {
  id: string
  title: string
  description: string
  instructions: string[]
  durationSec: number
  interaction: Interaction
  scriptPool?: string[]
}

export interface TrainingDay {
  dayNum: 1 | 2 | 3 | 4 | 5
  theme: string
  emoji: string
  matchingConcerns: ConcernSlug[]
  standard: ExerciseUnit[]
  deep: ExerciseUnit[]
}

// v1 sample content — 1 sample 'guided' + 1 sample 'record' per day to validate the framework.
// Replace these with real exercises after coach content research.
function sampleStandard(dayKey: string): ExerciseUnit[] {
  return [
    {
      id: `${dayKey}-warmup`,
      title: '워밍업',
      description: '오늘의 단계 준비',
      instructions: ['편안하게 호흡을 가다듬으세요', '어깨를 천천히 돌려보세요'],
      durationSec: 60,
      interaction: 'guided',
    },
    {
      id: `${dayKey}-main`,
      title: '메인 운동 (sample)',
      description: '오늘의 핵심 연습',
      instructions: ['스크립트를 읽고 녹음하세요'],
      durationSec: 120,
      interaction: 'record',
      scriptPool: [
        '안녕하세요. 오늘의 훈련을 시작합니다.',
        '천천히 정확하게 읽어보겠습니다.',
        '편안한 마음으로 연습합니다.',
      ],
    },
  ]
}

function sampleDeep(dayKey: string): ExerciseUnit[] {
  return [
    {
      id: `${dayKey}-deep-1`,
      title: '깊이 운동 (sample)',
      description: '약점 일치 day 추가 연습',
      instructions: ['좀 더 도전적인 변형을 시도하세요'],
      durationSec: 90,
      interaction: 'record',
      scriptPool: [
        '한 번 더 집중해서 읽어보겠습니다.',
        '핵심 약점을 강화하는 시간입니다.',
      ],
    },
  ]
}

export const CURRICULUM: TrainingDay[] = [
  {
    dayNum: 1,
    theme: '호흡·안정',
    emoji: '🫁',
    matchingConcerns: ['trembling'],
    standard: sampleStandard('day1'),
    deep: sampleDeep('day1'),
  },
  {
    dayNum: 2,
    theme: '립트릴·이완',
    emoji: '🎵',
    matchingConcerns: ['trembling'],
    standard: sampleStandard('day2'),
    deep: sampleDeep('day2'),
  },
  {
    dayNum: 3,
    theme: '공명·볼륨',
    emoji: '📢',
    matchingConcerns: ['small_voice'],
    standard: sampleStandard('day3'),
    deep: sampleDeep('day3'),
  },
  {
    dayNum: 4,
    theme: '속도 조절',
    emoji: '⚡',
    matchingConcerns: ['fast'],
    standard: sampleStandard('day4'),
    deep: sampleDeep('day4'),
  },
  {
    dayNum: 5,
    theme: '발음·딕션',
    emoji: '🗣️',
    matchingConcerns: ['diction'],
    standard: sampleStandard('day5'),
    deep: sampleDeep('day5'),
  },
]

export function getDay(dayNum: number): TrainingDay | undefined {
  return CURRICULUM.find((d) => d.dayNum === dayNum)
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in legacy files (`DayTrainingClient.tsx`, `category/[slug]/...`) because they import deleted symbols (`STAGES`, `Theme`, etc.) — these are removed in Task 12. Expect NO new errors in unrelated files.

- [ ] **Step 3: Commit**

```bash
git add src/lib/curriculum.ts
git commit -m "feat(training): replace curriculum.ts with new data model"
```

Note: legacy code will be broken between this commit and Task 12. That is acceptable for a feature branch; if working on `main`, defer this commit until Task 12 is also ready.

---

## Task 3: Pure logic — `trainingCycle.ts` with TDD

**Files:**
- Create: `src/lib/trainingCycle.ts`
- Create: `src/lib/trainingCycle.test.ts`

This module is pure (no I/O, no React, no Supabase). Tested with Vitest.

- [ ] **Step 1: Write failing tests**

Create `src/lib/trainingCycle.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
  nextDayNum,
  isDeepDay,
  pickFromPool,
} from './trainingCycle'

describe('nextDayNum', () => {
  it('returns 1 when no logs', () => {
    expect(nextDayNum([])).toBe(1)
  })

  it('returns next day after last completed', () => {
    expect(nextDayNum([{ stage_num: 2, log_date: '2026-05-26' }])).toBe(3)
  })

  it('wraps from 5 to 1', () => {
    expect(nextDayNum([{ stage_num: 5, log_date: '2026-05-26' }])).toBe(1)
  })

  it('uses the most recent log by date', () => {
    const logs = [
      { stage_num: 5, log_date: '2026-05-20' },
      { stage_num: 2, log_date: '2026-05-26' },
    ]
    expect(nextDayNum(logs)).toBe(3)
  })

  it('caps invalid stage_num to range and returns Day 1', () => {
    expect(nextDayNum([{ stage_num: 99, log_date: '2026-05-26' }])).toBe(1)
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

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test`
Expected: tests FAIL with "Cannot find module './trainingCycle'".

- [ ] **Step 3: Implement `trainingCycle.ts`**

Create `src/lib/trainingCycle.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests — verify pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trainingCycle.ts src/lib/trainingCycle.test.ts
git commit -m "feat(training): add cycle logic and deep-mode determination"
```

---

## Task 4: DB migration — `user_profiles` with concerns

**Files:**
- Create: `docs/superpowers/migrations/2026-05-27-user-profiles-concerns.sql`

The repo has no `supabase/` folder — migrations are run manually on the Supabase dashboard. We save the SQL to the docs folder so it's tracked and reviewable.

- [ ] **Step 1: Write the migration SQL**

Create `docs/superpowers/migrations/2026-05-27-user-profiles-concerns.sql`:
```sql
-- Training tab redesign: store user's declared voice concerns.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  concerns text[] not null default '{}',
  concerns_set_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce concern slugs at the DB level.
alter table public.user_profiles
  drop constraint if exists user_profiles_concerns_check;
alter table public.user_profiles
  add constraint user_profiles_concerns_check
  check (concerns <@ array['small_voice','trembling','fast','diction']::text[]);

-- Row-level security: each user manages their own row.
alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles self read" on public.user_profiles;
create policy "user_profiles self read"
  on public.user_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "user_profiles self upsert" on public.user_profiles;
create policy "user_profiles self upsert"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_profiles self update" on public.user_profiles;
create policy "user_profiles self update"
  on public.user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Run the SQL on Supabase**

Manually:
1. Open Supabase dashboard → SQL editor for this project.
2. Paste the file's contents.
3. Run. Confirm "Success".
4. Sanity: in Table editor, `user_profiles` exists with the expected columns and RLS policies.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/migrations/2026-05-27-user-profiles-concerns.sql
git commit -m "feat(db): add user_profiles.concerns for training personalization"
```

---

## Task 5: `useConcerns` hook (load / save concerns)

**Files:**
- Create: `src/hooks/useConcerns.ts`

Centralizes Supabase access for concerns. Used by `ConcernsModal`, new `TrainingClient`, and `SessionPlayer`.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useConcerns.ts`:
```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import type { ConcernSlug } from '@/lib/curriculum'

interface UseConcernsResult {
  concerns: ConcernSlug[]
  loading: boolean
  save: (next: ConcernSlug[]) => Promise<void>
  refresh: () => Promise<void>
}

export function useConcerns(): UseConcernsResult {
  const [concerns, setConcerns] = useState<ConcernSlug[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setConcerns([])
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_profiles')
        .select('concerns')
        .eq('user_id', user.id)
        .maybeSingle()
      setConcerns((data?.concerns ?? []) as ConcernSlug[])
    } finally {
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (next: ConcernSlug[]) => {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        concerns: next,
        concerns_set_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    if (error) {
      console.error('[useConcerns] save failed:', error)
      return
    }
    setConcerns(next)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { concerns, loading, save, refresh }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useConcerns.ts
git commit -m "feat(training): add useConcerns hook"
```

---

## Task 6: `ExerciseUnitRenderer` with `guided` and `record` sub-renderers

**Files:**
- Create: `src/components/training/ExerciseUnitRenderer.tsx`
- Create: `src/components/training/exercise/GuidedExercise.tsx`
- Create: `src/components/training/exercise/RecordExercise.tsx`

- [ ] **Step 1: Create `GuidedExercise`**

Create `src/components/training/exercise/GuidedExercise.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import type { ExerciseUnit } from '@/lib/curriculum'

interface Props {
  unit: ExerciseUnit
  onDone: () => void
}

export default function GuidedExercise({ unit, onDone }: Props) {
  const [remaining, setRemaining] = useState(unit.durationSec)

  useEffect(() => {
    if (remaining <= 0) return
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(id)
  }, [remaining])

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

      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <p className="text-xs text-muted-foreground tabular-nums">남은 시간 {remaining}초</p>
        <button
          onClick={onDone}
          disabled={remaining > 0}
          className="px-5 h-10 rounded-2xl gradient-primary text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
        >
          {remaining > 0 ? '진행 중…' : '다음'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `RecordExercise`**

Create `src/components/training/exercise/RecordExercise.tsx`:
```typescript
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, Square, RotateCcw } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import type { ExerciseUnit } from '@/lib/curriculum'
import { pickFromPool } from '@/lib/trainingCycle'

interface Props {
  unit: ExerciseUnit
  onDone: () => void
}

export default function RecordExercise({ unit, onDone }: Props) {
  const recorder = useAudioRecorder(120)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useWaveform({ analyser: recorder.analyserNode, canvasRef, active: recorder.state === 'recording' })

  const script = useMemo(() => pickFromPool(unit.scriptPool), [unit])
  const [reviewing, setReviewing] = useState(false)

  useEffect(() => {
    if (recorder.state === 'recorded') setReviewing(true)
  }, [recorder.state])

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
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">읽어 주세요</p>
          <p className="text-sm text-foreground leading-relaxed">&ldquo;{script}&rdquo;</p>
        </div>
      )}

      {!reviewing && recorder.state !== 'recording' && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground">준비되면 녹음 버튼을 눌러주세요</p>
          <button
            onClick={() => recorder.start()}
            className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform"
          >
            <Mic size={22} className="text-white" />
          </button>
        </div>
      )}

      {recorder.state === 'recording' && (
        <div className="flex flex-col items-center gap-3">
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
        <div className="flex flex-col gap-3">
          <audio controls src={recorder.audioUrl} className="w-full h-10" />
          <div className="flex gap-2">
            <button
              onClick={() => { recorder.reset(); setReviewing(false) }}
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

- [ ] **Step 3: Create the dispatcher `ExerciseUnitRenderer`**

Create `src/components/training/ExerciseUnitRenderer.tsx`:
```typescript
'use client'

import type { ExerciseUnit } from '@/lib/curriculum'
import GuidedExercise from './exercise/GuidedExercise'
import RecordExercise from './exercise/RecordExercise'

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
    default: {
      const exhaustive: never = unit.interaction
      return <p className="text-sm text-red-500">Unknown interaction: {String(exhaustive)}</p>
    }
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. Legacy errors from Task 2 still present, fixed in Task 12.

- [ ] **Step 5: Commit**

```bash
git add src/components/training/
git commit -m "feat(training): add ExerciseUnitRenderer and guided/record renderers"
```

---

## Task 7: `SessionPlayer` — orchestrates a Day's exercise sequence

**Files:**
- Create: `src/components/training/SessionPlayer.tsx`

- [ ] **Step 1: Create `SessionPlayer`**

Create `src/components/training/SessionPlayer.tsx`:
```typescript
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { TrainingDay } from '@/lib/curriculum'
import { isDeepDay } from '@/lib/trainingCycle'
import { useConcerns } from '@/hooks/useConcerns'
import ExerciseUnitRenderer from './ExerciseUnitRenderer'
import { getSupabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props { day: TrainingDay }

export default function SessionPlayer({ day }: Props) {
  const router = useRouter()
  const { concerns, loading } = useConcerns()

  const units = useMemo(() => {
    if (loading) return null
    const deep = isDeepDay(day.matchingConcerns, concerns)
    return deep ? [...day.standard, ...day.deep] : day.standard
  }, [day, concerns, loading])

  const [stepIdx, setStepIdx] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSessionComplete() {
    setSaving(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('user_training_logs').insert({
          user_id: user.id,
          log_date: todayStr(),
          stage_num: day.dayNum,
          theme: day.theme,
          score: 100,
        })
        if (error && error.code !== '23505') {
          console.error('[session] save failed:', error)
        }
      }
      trackEvent('training_session_completed', { day_num: day.dayNum, deep: units && units.length > day.standard.length })
      setCompleted(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading || units === null) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
  }

  if (completed) {
    return (
      <div className="px-4 pt-6 space-y-4">
        <div className="glass rounded-3xl p-8 flex flex-col items-center text-center gap-3">
          <span className="text-4xl">🎉</span>
          <p className="text-base font-bold">오늘의 훈련 완료!</p>
          <p className="text-xs text-muted-foreground">Day {day.dayNum} · {day.theme}</p>
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

- [ ] **Step 2: Commit**

```bash
git add src/components/training/SessionPlayer.tsx
git commit -m "feat(training): add SessionPlayer orchestrator"
```

---

## Task 8: Session route `/training/session/[day]/`

**Files:**
- Create: `src/app/training/session/[day]/page.tsx`

- [ ] **Step 1: Create the route page**

Create `src/app/training/session/[day]/page.tsx`:
```typescript
import { notFound } from 'next/navigation'
import SessionPlayer from '@/components/training/SessionPlayer'
import { getDay } from '@/lib/curriculum'

export default async function Page({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params
  const dayNum = parseInt(day, 10)
  const trainingDay = getDay(dayNum)
  if (!trainingDay) notFound()

  return (
    <div className="min-h-[calc(100vh-84px)]">
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <p className="text-white/80 text-xs mb-1">Day {trainingDay.dayNum} / 5</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{trainingDay.emoji}</span>
            <h1 className="text-xl font-black text-white">{trainingDay.theme}</h1>
          </div>
        </div>
      </div>
      <SessionPlayer day={trainingDay} />
    </div>
  )
}
```

- [ ] **Step 2: Smoke test (dev server)**

Run: `npm run dev`, navigate to `http://localhost:3000/training/session/3`.
Expected: Day 3 (공명·볼륨) header + first sample exercise renders. Stepping through to "다음" advances; final exercise completes session and shows the 🎉 screen.

- [ ] **Step 3: Commit**

```bash
git add src/app/training/session/
git commit -m "feat(training): add session route /training/session/[day]"
```

---

## Task 9: `ConcernsModal` — multi-select capture

**Files:**
- Create: `src/components/training/ConcernsModal.tsx`

- [ ] **Step 1: Create the modal**

Create `src/components/training/ConcernsModal.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ConcernSlug } from '@/lib/curriculum'
import { CONCERN_LABELS } from '@/lib/curriculum'

interface Props {
  open: boolean
  initial: ConcernSlug[]
  onClose: () => void
  onSave: (next: ConcernSlug[]) => Promise<void> | void
  title?: string
}

const ALL: ConcernSlug[] = ['small_voice', 'trembling', 'fast', 'diction']

export default function ConcernsModal({ open, initial, onClose, onSave, title = '내 목소리 고민' }: Props) {
  const [selected, setSelected] = useState<ConcernSlug[]>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setSelected(initial) }, [initial, open])

  if (!open) return null

  function toggle(c: ConcernSlug) {
    setSelected((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c])
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(selected)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-foreground">{title}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          해당하는 고민을 모두 선택해주세요. 선택한 영역의 Day는 매일 더 깊은 훈련이 제공돼요.
          보통 1-2개를 권장합니다.
        </p>
        <div className="space-y-2">
          {ALL.map((c) => {
            const checked = selected.includes(c)
            return (
              <button
                key={c}
                onClick={() => toggle(c)}
                className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl text-left transition-colors ${
                  checked ? 'bg-primary/15 border border-primary/40' : 'bg-secondary/60 border border-transparent'
                }`}
              >
                <span className="text-sm font-semibold text-foreground">{CONCERN_LABELS[c]}</span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  checked ? 'border-primary bg-primary' : 'border-border'
                }`}>
                  {checked && <span className="text-white text-[10px]">✓</span>}
                </span>
              </button>
            )
          })}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-2xl gradient-primary text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-70"
        >
          {saving ? '저장 중…' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/training/ConcernsModal.tsx
git commit -m "feat(training): add ConcernsModal for multi-select capture"
```

---

## Task 10: Trigger ConcernsModal from `/result`

**Files:**
- Modify: `src/app/result/ResultClient.tsx`

The modal should auto-open once after the analysis result is shown, with concerns pre-selected from the score thresholds.

- [ ] **Step 1: Read existing ResultClient to find the right insertion point**

Read `src/app/result/ResultClient.tsx`. Identify where the score result is rendered (look for `stability_score`, `pace_score`, `expressiveness_score` or similar). The modal should mount near the top level and trigger via `useEffect` once scores are available.

- [ ] **Step 2: Add modal state + auto-open + save**

Inside `ResultClient`, near the existing top-level state declarations, add:
```typescript
import ConcernsModal from '@/components/training/ConcernsModal'
import { useConcerns } from '@/hooks/useConcerns'
import type { ConcernSlug } from '@/lib/curriculum'

// ...inside the component
const { concerns, loading: concernsLoading, save: saveConcerns } = useConcerns()
const [showConcerns, setShowConcerns] = useState(false)
const [autoOpened, setAutoOpened] = useState(false)

// Replace `stability`, `pace`, `expressiveness` with whatever variables this file
// exposes for the 3 scores. If they live in `scores.stability` etc., adjust accordingly.
const suggestedFromScores = useMemo<ConcernSlug[]>(() => {
  if (typeof stability !== 'number') return []
  const out: ConcernSlug[] = []
  if (stability < 75) out.push('trembling')
  if (pace < 75) out.push('fast')         // pace covers two concerns; user can edit
  if (expressiveness < 75) out.push('small_voice')  // no exact mapping; closest fit
  return out
}, [stability, pace, expressiveness])

useEffect(() => {
  if (autoOpened) return
  if (concernsLoading) return              // wait for existing concerns to load
  if (typeof stability !== 'number') return  // wait for scores to resolve
  if (concerns.length === 0 && suggestedFromScores.length > 0) {
    setShowConcerns(true)
  }
  setAutoOpened(true)
}, [stability, pace, expressiveness, concerns, concernsLoading, suggestedFromScores, autoOpened])
```

And in the JSX (preferably just before the closing root element):
```tsx
<ConcernsModal
  open={showConcerns}
  initial={concerns.length > 0 ? concerns : suggestedFromScores}
  onClose={() => setShowConcerns(false)}
  onSave={saveConcerns}
  title="내 목소리 고민 확인"
/>
```

- [ ] **Step 3: Manual verify**

Run `npm run dev`, complete an analysis. Expected: after scores load, modal appears once with sensible pre-selection. Closing and reopening should not auto-open again in the same session.

- [ ] **Step 4: Commit**

```bash
git add src/app/result/ResultClient.tsx
git commit -m "feat(result): capture user concerns after voice analysis"
```

---

## Task 11: New `TrainingClient` landing

**Files:**
- Modify (full rewrite): `src/app/training/TrainingClient.tsx`

- [ ] **Step 1: Rewrite TrainingClient**

Replace the entire contents of `src/app/training/TrainingClient.tsx` with:
```typescript
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, ChevronRight, Pencil } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { CURRICULUM, CONCERN_LABELS, type ConcernSlug } from '@/lib/curriculum'
import { nextDayNum, isDeepDay, type TrainingLog } from '@/lib/trainingCycle'
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

  const todayDayNum = useMemo(() => nextDayNum(logs), [logs])
  const todayDay = useMemo(() => CURRICULUM.find((d) => d.dayNum === todayDayNum)!, [todayDayNum])
  const todayIsDeep = useMemo(() => isDeepDay(todayDay.matchingConcerns, concerns), [todayDay, concerns])
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
          <p className="text-white/80 text-xs mb-3">5일 사이클의 통합 코스</p>
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
            trackEvent('training_today_clicked', { day_num: todayDay.dayNum, deep: todayIsDeep })
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
          {todayIsDeep && (
            <p className="text-[11px] font-semibold text-orange-400 mb-1">⚡ 당신의 핵심 단계예요</p>
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
          onClick={() => router.push('/training/voice-check')}
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

- [ ] **Step 2: Smoke test**

Run `npm run dev`. Navigate to `/training`.
Expected: header + today's day card (Day N based on existing logs) + 4 other day cards + concerns row + voice-check CTA. Clicking today's card routes to `/training/session/N`.

- [ ] **Step 3: Commit**

```bash
git add src/app/training/TrainingClient.tsx
git commit -m "feat(training): rewrite landing for unified 5-day curriculum"
```

---

## Task 12: Delete legacy code

**Files:**
- Delete: `src/app/training/category/` (entire folder)
- Delete: `src/app/training/[day]/` (entire folder)
- Delete: `src/lib/trainingCategories.ts`
- Delete: `src/lib/trainingProgress.ts` (only consumed by deleted Stage components)

- [ ] **Step 1: Verify no remaining imports**

Run:
```bash
grep -rE "from '@/lib/trainingCategories'|from '@/lib/trainingProgress'|from '@/lib/curriculum'" --include="*.ts" --include="*.tsx" src/ | grep -v "trainingCategories.ts\|trainingProgress.ts\|curriculum.ts\|curriculum.test.ts"
```
Expected output should be ONLY:
- `src/lib/trainingCycle.ts` importing `ConcernSlug` from `curriculum`
- `src/components/**` imports of `curriculum`
- `src/app/training/**` imports of `curriculum`
- `src/app/result/ResultClient.tsx` imports of `curriculum`
- `src/hooks/useConcerns.ts` import of `curriculum`

If anything else, fix that file first.

- [ ] **Step 2: Delete legacy files**

Run:
```bash
git rm -r src/app/training/category src/app/training/\[day\]
git rm src/lib/trainingCategories.ts src/lib/trainingProgress.ts
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. If errors, fix imports.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(training): remove legacy categories and per-day stages"
```

---

## Task 13: Playwright smoke test for the new flow

**Files:**
- Create: `tests/qa/07-training-redesign.spec.ts`

- [ ] **Step 1: Write the smoke test**

Create `tests/qa/07-training-redesign.spec.ts`:
```typescript
import { test, expect } from '@playwright/test'

test.describe('Training tab redesign', () => {
  test('landing renders today day card and other-day cards', async ({ page }) => {
    await page.goto('/training')
    await expect(page.getByText('Voice Training')).toBeVisible()
    await expect(page.getByText(/Day \d \/ 5/)).toBeVisible()
    await expect(page.getByText('다른 단계 둘러보기')).toBeVisible()
    await expect(page.getByText('훈련 후 목소리 변화 측정')).toBeVisible()
  })

  test('session route renders the day header and first exercise', async ({ page }) => {
    await page.goto('/training/session/1')
    await expect(page.getByText('Day 1 / 5')).toBeVisible()
    await expect(page.getByText(/Step 1 \/ \d/)).toBeVisible()
  })

  test('invalid day shows 404', async ({ page }) => {
    const response = await page.goto('/training/session/99')
    expect(response?.status()).toBe(404)
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npm run test:qa -- tests/qa/07-training-redesign.spec.ts`
Expected: all 3 tests PASS. If "today's day card" assertions fail due to auth/loading states, adjust selectors to match the actual rendered DOM.

- [ ] **Step 3: Commit**

```bash
git add tests/qa/07-training-redesign.spec.ts
git commit -m "test(training): add smoke test for redesigned training flow"
```

---

## Task 14: Manual end-to-end verification

Not a code task — a checklist of in-browser verifications before declaring done.

- [ ] **Step 1: Run dev server** — `npm run dev`

- [ ] **Step 2: Verify each path**
  - [ ] `/training` loads, shows correct Day N (based on logs), streak, concerns row, voice-check CTA
  - [ ] Clicking today's card → `/training/session/N` opens
  - [ ] Stepping through all units → 🎉 completion screen
  - [ ] After completion, return to `/training` — Day card shows "오늘 이미 완료"
  - [ ] Day 5 completion shows the voice-check CTA
  - [ ] Setting concerns via the "Pencil" row updates the landing; matching Day shows "⚡ 당신의 핵심 단계예요"
  - [ ] Running a fresh `/record` → `/result` → modal auto-opens, pre-selecting based on scores
  - [ ] Saving in modal persists (refresh `/training`, concerns row reflects new selection)
  - [ ] `/training/category/small-voice` → 404 (legacy removed)
  - [ ] `/training/3` (legacy day path) → 404

- [ ] **Step 3: Run lint + types + unit + e2e once more**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run test:qa
```
Expected: all clean.

---

## Out of Scope (deferred to future work)

- Real exercise content (coach research pending)
- `metronome` / `visualizer` interaction types
- Voice-check trend graph on landing (Section 4 mentions, but data wiring deferred to a follow-up plan)
- Push notifications / reminders
- Concerns history / change log

---

## Quick file map (reference)

**Created:**
- `vitest.config.ts`
- `src/lib/trainingCycle.ts` + `.test.ts`
- `src/hooks/useConcerns.ts`
- `src/components/training/SessionPlayer.tsx`
- `src/components/training/ExerciseUnitRenderer.tsx`
- `src/components/training/exercise/GuidedExercise.tsx`
- `src/components/training/exercise/RecordExercise.tsx`
- `src/components/training/ConcernsModal.tsx`
- `src/app/training/session/[day]/page.tsx`
- `tests/qa/07-training-redesign.spec.ts`
- `docs/superpowers/migrations/2026-05-27-user-profiles-concerns.sql`

**Rewritten:**
- `src/lib/curriculum.ts`
- `src/app/training/TrainingClient.tsx`

**Modified:**
- `package.json` (vitest deps, test scripts)
- `src/app/result/ResultClient.tsx` (concerns modal trigger)

**Deleted:**
- `src/app/training/category/` (folder)
- `src/app/training/[day]/` (folder)
- `src/lib/trainingCategories.ts`
- `src/lib/trainingProgress.ts`
