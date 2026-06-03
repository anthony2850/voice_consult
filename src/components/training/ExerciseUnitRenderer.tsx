'use client'

import type { ExerciseUnit } from '@/lib/curriculum'
import GuidedExercise from './exercise/GuidedExercise'
import RecordExercise from './exercise/RecordExercise'
import MetronomeExercise from './exercise/MetronomeExercise'
import BreathPacerExercise from './exercise/BreathPacerExercise'

interface Props {
  unit: ExerciseUnit
  onDone: () => void
}

export default function ExerciseUnitRenderer({ unit, onDone }: Props) {
  switch (unit.interaction) {
    case 'guided':
      return <GuidedExercise unit={unit} onDone={onDone} />
    case 'record':
      return <RecordExercise unit={unit} onDone={onDone} />
    case 'metronome':
      return <MetronomeExercise unit={unit} onDone={onDone} />
    case 'breath-pacer':
      return <BreathPacerExercise unit={unit} onDone={onDone} />
    default: {
      const exhaustive: never = unit.interaction
      return <p className="text-sm text-red-500">Unknown interaction: {String(exhaustive)}</p>
    }
  }
}
