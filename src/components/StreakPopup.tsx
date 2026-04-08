'use client'

import { Check } from 'lucide-react'

interface Props {
  streak: number
  logDates: string[]   // all user log_dates (YYYY-MM-DD)
  onClose: () => void
}

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

const MESSAGES: Record<number, string> = {
  1: '첫 훈련을 완료했어요! 내일도 이어가볼까요?',
  2: '이틀 연속이에요! 이대로 계속 가봐요 🔥',
  3: '사흘 연속! 습관이 되고 있어요 💪',
  7: '일주일 연속이에요! 정말 대단해요 🎉',
}

function getMessage(streak: number) {
  if (streak >= 7) return MESSAGES[7]
  if (streak >= 3) return MESSAGES[3]
  return MESSAGES[streak] ?? '오늘도 훈련을 완료했어요! 내일도 한번 더 해봐요.'
}

export default function StreakPopup({ streak, logDates, onClose }: Props) {
  const today = new Date()
  const todayStr = toDateStr(today)
  const logDateSet = new Set(logDates)

  // Last 7 days ending today
  const recentDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - 6 + i)
    return d
  })

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background px-6 pb-8 pt-12">
      {/* Speech bubble */}
      <div className="relative bg-secondary/80 rounded-2xl px-5 py-4 mb-2 mx-4">
        <p className="text-sm font-semibold text-foreground leading-relaxed text-center">
          {getMessage(streak)}
        </p>
        {/* Arrow */}
        <div className="absolute left-1/2 -bottom-3 -translate-x-1/2 w-0 h-0
          border-l-[10px] border-l-transparent
          border-r-[10px] border-r-transparent
          border-t-[12px] border-t-secondary/80" />
      </div>

      {/* Flame + streak number */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <span className="text-8xl leading-none">🔥</span>
        <p className="text-8xl font-black text-orange-400 leading-none mt-4">{streak}</p>
        <p className="text-2xl font-black text-orange-400 tracking-tight">일 연속 학습</p>
      </div>

      {/* Week strip */}
      <div className="flex justify-between mb-8 px-2">
        {recentDays.map((d, i) => {
          const dStr = toDateStr(d)
          const isCompleted = logDateSet.has(dStr)
          const isToday = dStr === todayStr
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium">
                {DAY_KO[d.getDay()]}
              </span>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center
                ${isCompleted ? 'bg-orange-400' : isToday ? 'bg-secondary/80 ring-2 ring-orange-400/40' : 'bg-secondary/60'}
              `}>
                {isCompleted
                  ? <Check size={18} className="text-white" strokeWidth={3} />
                  : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* CTA */}
      <button
        onClick={onClose}
        className="w-full h-14 rounded-2xl gradient-primary text-white font-bold text-base shadow-xl shadow-primary/30 active:scale-95 transition-transform"
      >
        계속하기
      </button>
    </div>
  )
}
