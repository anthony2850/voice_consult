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

// Duolingo-style zigzag: left/center/right offsets
const ZIGZAG: React.CSSProperties[] = [
  { alignSelf: 'center' },
  { alignSelf: 'flex-start', marginLeft: '2.5rem' },
  { alignSelf: 'center' },
  { alignSelf: 'flex-end', marginRight: '2.5rem' },
  { alignSelf: 'center' },
  { alignSelf: 'flex-start', marginLeft: '2.5rem' },
  { alignSelf: 'center' },
]

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

      {/* Map path */}
      <div className="flex flex-col gap-5 px-4 pt-8 pb-4">
        {weekDates.map((date, i) => {
          const dateStr = toDateStr(date)
          const theme = THEME_BY_DOW[INDEX_TO_DOW[i]]
          const info = THEME_INFO[theme]
          const isCompleted = stampedDates.includes(dateStr)
          const isToday = dateStr === todayStr
          const isFuture = dateStr > todayStr

          const size = isToday ? 96 : 80
          const nodeClass = [
            'relative flex items-center justify-center rounded-full transition-all',
            isCompleted || isToday ? 'gradient-primary shadow-lg shadow-primary/40' : '',
            isToday ? 'ring-4 ring-white/30' : '',
            isFuture ? 'bg-secondary/50 opacity-50' : !isCompleted ? 'bg-secondary/80' : '',
            isFuture ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95',
          ].filter(Boolean).join(' ')

          return (
            <div
              key={dateStr}
              style={ZIGZAG[i]}
              className="flex flex-col items-center gap-2"
            >
              <button
                onClick={() => { if (!isFuture) router.push(`/training/${i + 1}`) }}
                disabled={isFuture}
                className={nodeClass}
                style={{ width: size, height: size }}
              >
                {isFuture ? (
                  <Lock size={22} className="text-muted-foreground" />
                ) : isCompleted ? (
                  <Flame size={isToday ? 36 : 28} className="text-white" />
                ) : (
                  <span className="text-3xl">{info.emoji}</span>
                )}

                {/* Today badge */}
                {isToday && (
                  <span className="absolute -bottom-1.5 text-[9px] font-bold text-primary bg-background px-2 py-0.5 rounded-full border border-primary/30 whitespace-nowrap">
                    오늘
                  </span>
                )}
              </button>

              <div className="text-center">
                <p className={`text-[11px] font-bold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {DAY_KO[i]}요일
                </p>
                <p className="text-[10px] text-muted-foreground">{info.label}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
