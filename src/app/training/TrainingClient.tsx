'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Flame, CheckCircle } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { STAGES } from '@/lib/curriculum'
import { Badge } from '@/components/ui/badge'

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function TrainingClient() {
  const router = useRouter()
  const todayStr = useMemo(() => toDateStr(new Date()), [])
  const [completedStages, setCompletedStages] = useState<Set<number>>(new Set())
  const [streakDates, setStreakDates] = useState<string[]>([])

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
      if (data) {
        const todayCompleted = data
          .filter((r: { log_date: string }) => r.log_date === todayStr)
          .map((r: { stage_num: number }) => r.stage_num)
        setCompletedStages(new Set(todayCompleted))
        setStreakDates(data.map((r: { log_date: string }) => r.log_date))
      }
    }
    load()
  }, [])

  // Streak = consecutive days up to today
  const streak = useMemo(() => {
    const unique = [...new Set(streakDates)].sort((a, b) => b.localeCompare(a))
    let count = 0
    let expected = todayStr
    for (const date of unique) {
      if (date === expected) {
        count++
        const d = new Date(expected)
        d.setDate(d.getDate() - 1)
        expected = toDateStr(d)
      } else if (date < expected) break
    }
    return count
  }, [streakDates, todayStr])

  const trainedToday = streakDates.includes(todayStr)

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">훈련 커리큘럼</Badge>
          <h1 className="text-2xl font-black text-white mb-1">Voice Training</h1>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
              <Flame size={14} className="text-orange-300" />
              <span className="text-white text-xs font-bold">{streak}일 연속</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
              <CheckCircle size={14} className="text-emerald-300" />
              <span className="text-white text-xs font-bold">{completedStages.size}/{STAGES.length} 완료</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stage grid: 4 + 3 */}
      <div className="px-4 pt-8 pb-4 flex flex-wrap justify-center gap-3">
        {STAGES.map((stage) => {
          const isCompleted = completedStages.has(stage.stageNum)
          const isLocked = stage.stageNum > 1 && !completedStages.has(stage.stageNum - 1)

          const nodeClass = [
            'flex flex-col items-center justify-center rounded-2xl py-3 gap-1.5 transition-all',
            isCompleted ? 'gradient-primary shadow-md shadow-primary/40' : '',
            isLocked ? 'bg-secondary/40 opacity-50 cursor-not-allowed' : !isCompleted ? 'bg-secondary/80 cursor-pointer active:scale-95' : 'cursor-pointer active:scale-95',
          ].filter(Boolean).join(' ')

          return (
            <button
              key={stage.stageNum}
              onClick={() => { if (!isLocked) router.push(`/training/${stage.stageNum}`) }}
              disabled={isLocked}
              className={nodeClass}
              style={{ width: 'calc(25% - 9px)' }}
            >
              {isLocked ? (
                <Lock size={20} className="text-muted-foreground" />
              ) : isCompleted ? (
                <Flame size={22} className="text-white" />
              ) : (
                <span className="text-xl">{stage.emoji}</span>
              )}
              <span className={`text-[10px] font-bold leading-tight text-center px-1
                ${isCompleted ? 'text-white' : 'text-muted-foreground'}`}>
                {stage.stageNum}단계
              </span>
            </button>
          )
        })}
      </div>

      {/* Stage list */}
      <div className="px-4 mt-2 space-y-2">
        {STAGES.map((stage) => {
          const isCompleted = completedStages.has(stage.stageNum)
          const isLocked = stage.stageNum > 1 && !completedStages.has(stage.stageNum - 1)
          return (
            <button
              key={stage.stageNum}
              onClick={() => { if (!isLocked) router.push(`/training/${stage.stageNum}`) }}
              disabled={isLocked}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all text-left
                ${isLocked ? 'bg-secondary/30 opacity-50 cursor-not-allowed' : 'bg-secondary/60 hover:bg-secondary active:scale-[0.98]'}`}
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base
                ${isCompleted ? 'gradient-primary' : 'bg-secondary'}`}>
                {isCompleted ? '✓' : isLocked ? '🔒' : stage.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {stage.stageNum}단계 · {stage.name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{stage.description}</p>
              </div>
              {isCompleted && (
                <Flame size={16} className="text-orange-400 shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {/* Today nudge */}
      {!trainedToday && (
        <div className="mx-4 mt-4 glass rounded-2xl px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">오늘 아직 훈련을 안 했어요. 연속 기록을 이어가볼까요? 🔥</p>
        </div>
      )}
    </div>
  )
}
