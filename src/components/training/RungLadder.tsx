'use client'

import { Check } from 'lucide-react'
import { LADDER, type RungLevel } from '@/lib/curriculum'

interface Props {
  current: RungLevel
  compact?: boolean
}

/** 훈련 단계 — 현재 단계를 강조해 보여준다. */
export default function RungLadder({ current, compact = false }: Props) {
  return (
    <ol className="space-y-2">
      {[...LADDER].reverse().map((r) => {
        const state = r.level < current ? 'done' : r.level === current ? 'now' : 'later'
        return (
          <li
            key={r.id}
            className={`flex items-center gap-3 rounded-2xl bg-card px-4 py-3 border-2 ${
              state === 'now' ? 'border-accent' : 'border-transparent'
            }`}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black shrink-0 tabular-nums ${
                state === 'done' ? 'bg-accent text-accent-foreground'
                : state === 'now' ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground'
              }`}
            >
              {state === 'done' ? <Check size={15} strokeWidth={3} aria-label="완료" /> : r.level}
            </span>
            <div className="min-w-0">
              <p className={`text-[14px] font-bold ${state === 'later' ? 'text-muted-foreground' : 'text-foreground'}`}>
                {r.title}
              </p>
              {!compact && state === 'now' && (
                <p className="text-[12px] text-muted-foreground truncate">{r.adds}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
