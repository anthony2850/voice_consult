'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, Square, RotateCcw, Play, Pause } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import type { ExerciseUnit } from '@/lib/curriculum'
import { pickFromPool } from '@/lib/trainingCycle'

interface Props {
  unit: ExerciseUnit
  onDone: () => void
}

const DEFAULT_BPM = 60

export default function MetronomeExercise({ unit, onDone }: Props) {
  const bpm = unit.metronomeBPM ?? DEFAULT_BPM
  const intervalMs = 60_000 / bpm

  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<number | null>(null)

  const recorder = useAudioRecorder(120)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useWaveform({ analyser: recorder.analyserNode, canvasRef, active: recorder.state === 'recording' })

  const script = useMemo(() => pickFromPool(unit.scriptPool), [unit])
  const reviewing = recorder.state === 'recorded'

  // play a tick sound
  function tick() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    const ctx = audioCtxRef.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.05)
  }

  useEffect(() => {
    if (!running) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }
    // Fire immediately then on each interval
    const fire = () => {
      tick()
      setBeat((b) => b + 1)
    }
    const t = window.setTimeout(() => {
      fire()
      intervalRef.current = window.setInterval(fire, intervalMs)
    }, 0)
    return () => {
      window.clearTimeout(t)
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [running, intervalMs])

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close()
    }
  }, [])

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
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">박자에 맞춰 읽기</p>
          <p className="text-sm text-foreground leading-relaxed">&ldquo;{script}&rdquo;</p>
        </div>
      )}

      {/* Metronome visualizer */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">{bpm} BPM</span>
        </div>
        <div className={`w-16 h-16 rounded-full transition-transform ${
          beat % 2 === 0 ? 'bg-primary scale-110' : 'bg-secondary scale-90'
        }`} />
        <button
          onClick={() => setRunning((r) => !r)}
          className="px-5 h-10 rounded-2xl bg-secondary/60 text-sm font-semibold text-foreground active:scale-95 transition-transform flex items-center gap-2"
        >
          {running ? <><Pause size={14} />멈춤</> : <><Play size={14} />시작</>}
        </button>
      </div>

      {/* Recording controls */}
      {!reviewing && recorder.state !== 'recording' && (
        <div className="flex flex-col items-center gap-3 pt-3 border-t border-border/40">
          <p className="text-xs text-muted-foreground">박자에 맞춰 읽고 녹음하기</p>
          <button
            onClick={() => recorder.start()}
            className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform"
          >
            <Mic size={22} className="text-white" />
          </button>
        </div>
      )}

      {recorder.state === 'recording' && (
        <div className="flex flex-col items-center gap-3 pt-3 border-t border-border/40">
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
        <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
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
