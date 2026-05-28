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
