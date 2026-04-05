'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Flame } from 'lucide-react'

import { getSupabase } from '@/lib/supabase'
import { THEME_BY_DOW, THEME_INFO } from '@/lib/curriculum'
import { Badge } from '@/components/ui/badge'

// Mon=index 0 → DOW 1, ..., Sun=index 6 → DOW 0
const INDEX_TO_DOW = [1, 2, 3, 4, 5, 6, 0]
const DAY_KO = ['월', '화', '수', '목', '금', '토', '일']


function getWeekDates(): Date[] {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function TrainingClient() {
  const router = useRouter()
  const weekDates = useMemo(getWeekDates, [])
  const todayStr = useMemo(() => toDateStr(new Date()), [])
  const [stampedDates, setStampedDates] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_training_logs')
        .select('log_date')
        .eq('user_id', user.id)
        .gte('log_date', toDateStr(weekDates[0]))
        .lte('log_date', toDateStr(weekDates[6]))
      if (data) setStampedDates(data.map((r: { log_date: string }) => r.log_date))
    }
    load()
  }, [weekDates])

  const completedCount = stampedDates.length

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">이번 주 훈련</Badge>
          <h1 className="text-2xl font-black text-white mb-1">Weekly Training</h1>
          <p className="text-white/70 text-sm">
            {completedCount}/7 완료 · 오늘의 훈련을 완료하고 스탬프를 모아보세요 🔥
          </p>
        </div>
      </div>

      {/* Map: 4 + 3 grid */}
      <div className="px-4 pt-8 pb-4 space-y-6">
        {[weekDates.slice(0, 4), weekDates.slice(4)].map((row, rowIdx) => (
          <div key={rowIdx} className={`grid gap-3 ${rowIdx === 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {row.map((date, colIdx) => {
              const i = rowIdx === 0 ? colIdx : 4 + colIdx
              const dateStr = toDateStr(date)
              const theme = THEME_BY_DOW[INDEX_TO_DOW[i]]
              const info = THEME_INFO[theme]
              const isCompleted = stampedDates.includes(dateStr)
              const isToday = dateStr === todayStr
              const isFuture = dateStr > todayStr

              const nodeClass = [
                'relative flex flex-col items-center justify-center rounded-2xl py-3 gap-1.5 transition-all w-full',
                isCompleted || isToday ? 'gradient-primary shadow-md shadow-primary/40' : '',
                isToday ? 'ring-2 ring-white/40' : '',
                isFuture ? 'bg-secondary/50 opacity-50' : !isCompleted ? 'bg-secondary/80' : '',
                isFuture ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95',
              ].filter(Boolean).join(' ')

              return (
                <button
                  key={dateStr}
                  onClick={() => { if (!isFuture) router.push(`/training/${i + 1}`) }}
                  disabled={isFuture}
                  className={nodeClass}
                >
                  {isFuture ? (
                    <Lock size={20} className="text-muted-foreground" />
                  ) : isCompleted ? (
                    <Flame size={22} className="text-white" />
                  ) : (
                    <span className="text-xl">{info.emoji}</span>
                  )}
                  <span className={`text-[10px] font-bold ${isCompleted || isToday ? 'text-white' : 'text-muted-foreground'}`}>
                    {DAY_KO[i]}
                    {isToday ? ' ★' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
