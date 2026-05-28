'use client'

import { useMemo, useRef } from 'react'
import { Mic, Square, RotateCcw } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import type { ExerciseUnit } from '@/lib/curriculum'
import { pickFromPool } from '@/lib/trainingCycle'

interface Props {
  unit: ExerciseUnit
  onDone: () => void
}

export default function RecordExercise({ unit, onDone }: Props) {
  const recorder = useAudioRecorder(120)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useWaveform({ analyser: recorder.analyserNode, canvasRef, active: recorder.state === 'recording' })

  const script = useMemo(() => pickFromPool(unit.scriptPool), [unit])
  const reviewing = recorder.state === 'recorded'

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

      {script && (
        <div className="rounded-2xl bg-secondary/60 p-4">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">읽어 주세요</p>
          <p className="text-sm text-foreground leading-relaxed">&ldquo;{script}&rdquo;</p>
        </div>
      )}

      {!reviewing && recorder.state !== 'recording' && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground">준비되면 녹음 버튼을 눌러주세요</p>
          <button
            onClick={() => recorder.start()}
            className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform"
          >
            <Mic size={22} className="text-white" />
          </button>
        </div>
      )}

      {recorder.state === 'recording' && (
        <div className="flex flex-col items-center gap-3">
          <canvas ref={canvasRef} className="w-full h-12 rounded-xl" />
          <p className="text-xs tabular-nums text-muted-foreground">{recorder.duration}초</p>
          <button
            onClick={() => recorder.stop()}
            className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Square size={20} className="text-white fill-white" />
          </button>
        </div>
      )}

      {reviewing && recorder.audioUrl && (
        <div className="flex flex-col gap-3">
          <audio controls src={recorder.audioUrl} className="w-full h-10" />
          <div className="flex gap-2">
            <button
              onClick={() => recorder.reset()}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-2xl bg-secondary/60 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw size={13} />다시 녹음
            </button>
            <button
              onClick={onDone}
              className="flex-1 h-10 rounded-2xl gradient-primary text-white text-sm font-bold active:scale-95 transition-transform"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
