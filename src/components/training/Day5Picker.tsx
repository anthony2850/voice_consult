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
