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
      trackEvent('training_session_completed', { day_num: day.dayNum, deep: !!(units && units.length > day.standard.length) })
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
