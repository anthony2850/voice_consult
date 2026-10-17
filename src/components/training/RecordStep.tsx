'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, RotateCcw } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
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
}

export default function RecordStep({
  eyebrow, title, keyInfo, instructions, variation, script, scriptLabel = '읽어 주세요',
  lastWord, maxSec, targetSec, prepSec, analyzing, onRecorded, doneLabel = '다음', silentNote,
}: Props) {
  const recorder = useAudioRecorder(maxSec)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useWaveform({ analyser: recorder.analyserNode, canvasRef, active: recorder.state === 'recording' })
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
    <div className="glass rounded-3xl p-6 space-y-4">
      <div className="space-y-1">
        {eyebrow && <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">{eyebrow}</p>}
        <p className="text-base font-bold text-foreground">{title}</p>
      </div>

      {keyInfo && (
        <div className="rounded-2xl bg-primary/10 border border-primary/30 px-4 py-3">
          <p className="text-[11px] font-semibold text-primary mb-0.5">지금 들을 것 하나</p>
          <p className="text-sm font-bold text-foreground">{keyInfo}</p>
        </div>
      )}

      <ul className="space-y-1.5">
        {instructions.map((line, i) => (
          <li key={i} className="text-sm text-foreground leading-relaxed">• {line}</li>
        ))}
        {targetSec && (
          <li className="text-sm text-foreground leading-relaxed">• 목표 {targetSec}초, 최대 {maxSec}초예요. 길게 버티는 게 목적이 아니에요.</li>
        )}
      </ul>

      {variation && (
        <div className="rounded-2xl bg-secondary/60 px-4 py-3 space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground">오늘의 변형 · {variation.label}</p>
          <p className="text-xs text-foreground"><span className="text-muted-foreground">바꿀 것</span> {variation.change}</p>
          <p className="text-xs text-foreground"><span className="text-muted-foreground">그대로</span> {variation.hold}</p>
          <p className="text-xs text-foreground"><span className="text-muted-foreground">볼 것</span> {variation.observe}</p>
        </div>
      )}

      {script && (
        <div className="rounded-2xl bg-secondary/60 p-4">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">{scriptLabel}</p>
          <p className="text-sm text-foreground leading-relaxed">&ldquo;{script}&rdquo;</p>
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
            className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform"
          >
            <Mic size={22} className="text-white" />
          </button>
          <p className="text-[11px] text-muted-foreground">{prepSec ? `누르면 ${prepSec}초 뒤 바로 시작돼요` : '누르면 바로 녹음돼요'}</p>
        </div>
      )}

      {prepLeft !== null && (
        <div className="flex flex-col items-center gap-2 py-2">
          <p className="text-xs text-muted-foreground">준비</p>
          <p className="text-5xl font-black tabular-nums text-primary">{prepLeft}</p>
        </div>
      )}

      {recorder.state === 'recording' && (
        <div className="flex flex-col items-center gap-3">
          <canvas ref={canvasRef} className="w-full h-12 rounded-xl" />
          <p className="text-xs tabular-nums text-muted-foreground">{recorder.duration}초 / {maxSec}초</p>
          <button
            onClick={() => recorder.stop()}
            aria-label="녹음 중지"
            className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
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
          <audio controls src={recorder.audioUrl} className="w-full h-10" />
          <div className="flex gap-2">
            <button
              onClick={() => recorder.reset()}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-2xl bg-secondary/60 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw size={13} />다시 녹음
            </button>
            <button
              onClick={() => recorder.audioBlob && onRecorded(recorder.audioBlob)}
              className="flex-1 h-10 rounded-2xl gradient-primary text-white text-sm font-bold active:scale-95 transition-transform"
            >
              {doneLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
