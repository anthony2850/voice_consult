'use client'

import { LADDER, type RungLevel } from '@/lib/curriculum'

interface Props {
  current: RungLevel
  compact?: boolean
}

/** 훈련 단계 — 현재 단계를 강조해 보여준다. */
export default function RungLadder({ current, compact = false }: Props) {
  return (
    <ol className="space-y-1.5">
      {[...LADDER].reverse().map((r) => {
        const state = r.level < current ? 'done' : r.level === current ? 'now' : 'later'
        return (
          <li
            key={r.id}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${
              state === 'now' ? 'bg-primary/15 border border-primary/40' : 'bg-secondary/40'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                state === 'done' ? 'bg-emerald-500 text-white'
                : state === 'now' ? 'gradient-primary text-primary-foreground'
                : 'bg-border text-muted-foreground'
              }`}
            >
              {state === 'done' ? '✓' : r.level}
            </span>
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${state === 'later' ? 'text-muted-foreground' : 'text-foreground'}`}>
                {r.title}
              </p>
              {!compact && state === 'now' && (
                <p className="text-[11px] text-muted-foreground truncate">{r.adds}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
