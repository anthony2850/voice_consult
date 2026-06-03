'use client'

import { useEffect, useState } from 'react'
import type { ExerciseUnit } from '@/lib/curriculum'

interface Props {
  unit: ExerciseUnit
  onDone: () => void
}

const TICK_MS = 100

/**
 * Phase-based breathing pacer (e.g. 4-7-8 호흡).
 * - Reads `unit.breathPhases` and `unit.repetitions`.
 * - Single source of truth: total elapsed ms. Phase/rep are derived.
 * - User can hit "다음" anytime; if not yet complete, a confirm() guards skip.
 */
export default function BreathPacerExercise({ unit, onDone }: Props) {
  const phases = unit.breathPhases ?? []
  const totalReps = unit.repetitions ?? 1
  const oneRepDurMs = phases.reduce((s, p) => s + p.durationSec, 0) * 1000
  const totalDurMs = oneRepDurMs * totalReps

  const [started, setStarted] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  const isCompleted = totalDurMs > 0 && elapsedMs >= totalDurMs

  useEffect(() => {
    if (!started || isCompleted || totalDurMs === 0) return
    const id = window.setInterval(() => {
      setElapsedMs((prev) => Math.min(prev + TICK_MS, totalDurMs))
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [started, isCompleted, totalDurMs])

  // Derive current rep / phase from elapsedMs
  const repIdx = oneRepDurMs > 0
    ? Math.min(Math.floor(elapsedMs / oneRepDurMs), totalReps - 1)
    : 0
  const elapsedInRep = elapsedMs - repIdx * oneRepDurMs
  let phaseIdx = 0
  let elapsedInPhase = elapsedInRep
  for (let i = 0; i < phases.length; i++) {
    const dMs = phases[i].durationSec * 1000
    if (elapsedInPhase < dMs) {
      phaseIdx = i
      break
    }
    elapsedInPhase -= dMs
    phaseIdx = phases.length - 1
  }
  const currentPhase = phases[phaseIdx]
  const progressPct = currentPhase
    ? Math.min(100, (elapsedInPhase / (currentPhase.durationSec * 1000)) * 100)
    : 100
  const remainingSec = currentPhase
    ? Math.max(0, Math.ceil(currentPhase.durationSec - elapsedInPhase / 1000))
    : 0

  function handleNext() {
    if (isCompleted) {
      onDone()
      return
    }
    if (window.confirm('아직 완료하지 않았어요. 넘어갈까요?')) {
      onDone()
    }
  }

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

      {/* Phase progress */}
      <div className="space-y-2 pt-3 border-t border-border/40">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">
            Rep {Math.min(repIdx + 1, totalReps)} / {totalReps}
          </p>
          {!isCompleted && currentPhase && (
            <p className="text-sm font-bold text-primary">{currentPhase.label}</p>
          )}
          {isCompleted && <p className="text-sm font-bold text-emerald-400">완료 ✓</p>}
        </div>

        <div className="h-3 bg-secondary/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-100 ease-linear"
            style={{ width: `${isCompleted ? 100 : progressPct}%` }}
          />
        </div>

        {!isCompleted && currentPhase && (
          <p className="text-[11px] text-muted-foreground tabular-nums text-center">
            {remainingSec}초
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 pt-2">
        {!started && !isCompleted && (
          <button
            onClick={() => setStarted(true)}
            className="flex-1 h-11 rounded-2xl gradient-primary text-white text-sm font-bold active:scale-95 transition-transform"
          >
            시작
          </button>
        )}
        <button
          onClick={handleNext}
          className={`flex-1 h-11 rounded-2xl text-sm font-bold active:scale-95 transition-transform ${
            isCompleted
              ? 'gradient-primary text-white'
              : 'bg-secondary/60 text-foreground'
          }`}
        >
          다음
        </button>
      </div>
    </div>
  )
}
