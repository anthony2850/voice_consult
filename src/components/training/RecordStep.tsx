'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, RotateCcw } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import { useVoiceLine } from '@/hooks/useVoiceLine'
import type { Variation } from '@/lib/curriculum'

interface Props {
  eyebrow?: string
  title: string
  /** 핵심 정보 한 줄 — 녹음 화면에서 가장 크게 보이는 것 */
  keyInfo?: string
  instructions: string[]
  /** 이번 세션의 변형 (바꿀 조건 / 유지할 조건 / 관찰할 결과) */
  variation?: Variation
  script?: string | null
  scriptLabel?: string
  /** 녹음 직전 마지막 한마디 — 결과를 향한다 */
  lastWord?: string
  maxSec: number
  targetSec?: number
  /** 준비 시간. 있으면 버튼을 누른 뒤 카운트다운 후 자동 시작 */
  prepSec?: number
  analyzing: boolean
  onRecorded: (blob: Blob) => void
  doneLabel?: string
  /** 점수를 보여주지 않는 단계라는 안내 */
  silentNote?: string
  /** 파형 대신 목소리 크기 선을 그린다. 연습 녹음에만 쓰고, 비교용 측정 녹음에는 쓰지 않는다 */
  voiceLine?: boolean
}

export default function RecordStep({
  eyebrow, title, keyInfo, instructions, variation, script, scriptLabel = '읽어 주세요',
  lastWord, maxSec, targetSec, prepSec, analyzing, onRecorded, doneLabel = '다음', silentNote, voiceLine = false,
}: Props) {
  const recorder = useAudioRecorder(maxSec)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useWaveform({ analyser: recorder.analyserNode, canvasRef, active: recorder.state === 'recording' })
  const lineRef = useRef<HTMLCanvasElement>(null)
  useVoiceLine({ analyser: voiceLine ? recorder.analyserNode : null, canvasRef: lineRef, spanSec: targetSec ?? maxSec })
  const [prepLeft, setPrepLeft] = useState<number | null>(null)
  const prepTimer = useRef<number | null>(null)

  // Countdown runs in its own interval; the recorder starts from inside the tick.
  function beginWithPrep() {
    if (!prepSec) { recorder.start(); return }
    let left = prepSec
    setPrepLeft(left)
    prepTimer.current = window.setInterval(() => {
      left -= 1
      if (left <= 0) {
        if (prepTimer.current) window.clearInterval(prepTimer.current)
        prepTimer.current = null
        setPrepLeft(null)
        recorder.start()
      } else {
        setPrepLeft(left)
      }
    }, 1000)
  }

  useEffect(() => () => { if (prepTimer.current) window.clearInterval(prepTimer.current) }, [])

  const idle = recorder.state === 'idle' && prepLeft === null
  const reviewing = recorder.state === 'recorded'

  return (
    <section className="rounded-[28px] bg-secondary p-6 space-y-4">
      <div className="space-y-1">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <p className="text-[19px] font-black tracking-[-0.02em] text-foreground">{title}</p>
      </div>

      {keyInfo && (
        <div className="rounded-2xl bg-card px-4 py-3">
          <p className="eyebrow mb-1">녹음할 때 확인할 것</p>
          <p className="text-[15px] font-bold text-foreground">{keyInfo}</p>
        </div>
      )}

      <ul className="space-y-1.5">
        {instructions.map((line, i) => (
          <li key={i} className="flex gap-2 text-[14px] text-foreground leading-relaxed"><span aria-hidden="true" className="mt-2 w-1.5 h-1.5 shrink-0 rounded-full bg-accent" />{line}</li>
        ))}
        {targetSec && (
          <li className="flex gap-2 text-[14px] text-foreground leading-relaxed"><span aria-hidden="true" className="mt-2 w-1.5 h-1.5 shrink-0 rounded-full bg-accent" />{targetSec}초면 충분해요.</li>
        )}
      </ul>

      {variation && (
        <div className="rounded-2xl bg-card px-4 py-3">
          <p className="eyebrow mb-1">오늘은 이렇게: {variation.label}</p>
          <p className="text-[14px] font-semibold text-foreground">{variation.change}</p>
        </div>
      )}

      {script && (
        <div className="rounded-2xl bg-card p-4">
          <p className="eyebrow mb-1">{scriptLabel}</p>
          <p className="text-[16px] text-foreground leading-relaxed">&ldquo;{script}&rdquo;</p>
        </div>
      )}

      {recorder.error && <p className="text-xs text-red-500">{recorder.error}</p>}

      {idle && !analyzing && (
        <div className="flex flex-col items-center gap-3">
          {lastWord && <p className="text-sm font-semibold text-foreground text-center">{lastWord}</p>}
          {silentNote && <p className="text-[11px] text-muted-foreground text-center">{silentNote}</p>}
          <button
            onClick={beginWithPrep}
            aria-label="녹음 시작"
            className="w-16 h-16 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform"
          >
            <Mic size={22} className="text-primary-foreground" />
          </button>
          <p className="text-[11px] text-muted-foreground">{prepSec ? `누르면 ${prepSec}초 뒤 바로 시작돼요` : '누르면 바로 녹음돼요'}</p>
        </div>
      )}

      {prepLeft !== null && (
        <div className="flex flex-col items-center gap-2 py-2">
          <p className="text-xs text-muted-foreground">준비</p>
          <p className="text-6xl font-black tabular-nums text-foreground">{prepLeft}</p>
        </div>
      )}

      {recorder.state === 'recording' && (
        <div className="flex flex-col items-center gap-3">
          {voiceLine
            ? <canvas ref={lineRef} className="w-full h-20" aria-label="목소리 크기 선" />
            : <canvas ref={canvasRef} className="w-full h-12 rounded-xl" />}
          <p className="text-xs tabular-nums text-muted-foreground">{recorder.duration}초 / {maxSec}초</p>
          <button
            onClick={() => recorder.stop()}
            aria-label="녹음 중지"
            className="w-16 h-16 rounded-full bg-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Square size={20} className="text-white fill-white" />
          </button>
        </div>
      )}

      {analyzing && (
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground">저장하는 중이에요</p>
        </div>
      )}

      {reviewing && !analyzing && recorder.audioUrl && (
        <div className="flex flex-col gap-3">
          {voiceLine && (
            <div>
              <canvas ref={lineRef} className="w-full h-20" aria-label="방금 녹음한 목소리 크기 선" />
              <p className="mt-1 text-[12px] text-muted-foreground text-center">선이 곧고 끊기지 않을수록 고른 소리예요</p>
            </div>
          )}
          <audio controls src={recorder.audioUrl} className="w-full h-10" />
          <div className="flex gap-2">
            <button
              onClick={() => recorder.reset()}
              className="flex-1 flex items-center justify-center gap-1.5 h-12 rounded-full bg-card text-[14px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw size={13} />다시 녹음
            </button>
            <button
              onClick={() => recorder.audioBlob && onRecorded(recorder.audioBlob)}
              className="flex-1 h-12 rounded-full bg-primary text-primary-foreground text-[15px] font-bold active:scale-95 transition-transform"
            >
              {doneLabel}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
