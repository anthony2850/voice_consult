'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, RotateCcw, CheckCircle, ChevronRight } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import { extractAudioFeatures } from '@/lib/extractAudioFeatures'
import { getSupabase } from '@/lib/supabase'

// ─── Scoring (same as ResultClient) ───────────────────────────────────────────
function remapTo60(raw: number): number {
  return Math.round(60 + (Math.max(0, Math.min(100, raw)) / 100) * 40)
}
function calcStabilityScore(jitter: number, shimmer: number): number {
  const j = Math.max(0, 1 - jitter / 3.0) * 100
  const s = Math.max(0, 1 - shimmer / 6.0) * 100
  return remapTo60(j * 0.5 + s * 0.5)
}
function calcPaceScore(opsec: number): number {
  const optimal = 4.5
  const sigma = 1.8
  const raw = 100 * Math.exp(-0.5 * Math.pow((opsec - optimal) / sigma, 2))
  return remapTo60(raw)
}
function calcExpressivenessScore(stdHz: number, dbMean: number): number {
  const pitchVar = Math.min(100, (stdHz / 50) * 100)
  const dbScore = Math.min(100, Math.max(0, ((dbMean + 40) / 30) * 100))
  return remapTo60(pitchVar * 0.6 + dbScore * 0.4)
}
function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400'
  if (score >= 75) return 'text-primary'
  return 'text-orange-400'
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Scores {
  stability: number
  pace: number
  expressiveness: number
}

type PageState = 'idle' | 'recording' | 'analyzing' | 'result' | 'saved'

const SCRIPT = '안녕하세요. 저는 오늘 제 목소리를 분석하러 왔습니다. 저는 평소에 친구들과 이야기하는 것을 좋아하고, 새로운 것을 배우는 것도 즐깁니다. 잘 부탁드립니다.'

// ─── Component ────────────────────────────────────────────────────────────────
export default function VoiceCheckClient() {
  const router = useRouter()

  const [pageState, setPageState] = useState<PageState>('idle')
  const [scores, setScores] = useState<Scores | null>(null)
  const [saving, setSaving] = useState(false)

  const recorder = useAudioRecorder(30)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useWaveform({ analyser: recorder.analyserNode, canvasRef, active: recorder.state === 'recording' })
  const analyzingRef = useRef(false)

  // Auto-trigger analysis when recording stops
  useEffect(() => {
    if (recorder.state === 'recorded' && recorder.audioBlob && !analyzingRef.current) {
      analyzingRef.current = true
      runAnalysis(recorder.audioBlob)
    }
    if (recorder.state === 'idle') {
      analyzingRef.current = false
    }
  }, [recorder.state, recorder.audioBlob]) // eslint-disable-line react-hooks/exhaustive-deps

  async function runAnalysis(blob: Blob) {
    setPageState('analyzing')
    const features = await extractAudioFeatures(blob)
    if (!features) {
      setPageState('idle')
      recorder.reset()
      analyzingRef.current = false
      return
    }
    setScores({
      stability: calcStabilityScore(
        features.voice_quality.jitter_rel_pct,
        features.voice_quality.shimmer_rel_pct,
      ),
      pace: calcPaceScore(features.rhythm.onsets_per_second),
      expressiveness: calcExpressivenessScore(features.pitch.std_hz, features.energy.db_mean),
    })
    setPageState('result')
    analyzingRef.current = false
  }

  async function handleSave() {
    if (!scores) return
    setSaving(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('voice_quality_logs').insert({
          user_id: user.id,
          source: 'post_training',
          stability_score: scores.stability,
          pace_score: scores.pace,
          expressiveness_score: scores.expressiveness,
        })
        if (error) console.error('[voice-check] save failed:', error)
      }
      setPageState('saved')
    } finally {
      setSaving(false)
    }
  }

  function handleRetry() {
    recorder.reset()
    setScores(null)
    setPageState('idle')
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {/* Header */}
      <div className="space-y-1 px-1">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide">훈련 후 분석</p>
        <h1 className="text-lg font-bold text-foreground">목소리 변화 측정</h1>
        <p className="text-xs text-muted-foreground">
          5단계 훈련 전후 목소리 품질을 비교해요. 평소 목소리로 아래 스크립트를 읽어주세요.
        </p>
      </div>

      {/* Script card */}
      <div className="glass rounded-3xl p-5 space-y-2">
        <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">읽어 주세요</p>
        <p className="text-sm text-foreground leading-relaxed">
          &ldquo;{SCRIPT}&rdquo;
        </p>
        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
          ✦ 평소 자신의 목소리 그대로 자연스럽게 읽어 주세요
        </p>
      </div>

      {/* Idle */}
      {pageState === 'idle' && (
        <div className="glass rounded-3xl p-6 flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground text-center">준비되면 녹음 버튼을 눌러주세요</p>
          <button
            onClick={() => { setPageState('recording'); recorder.start() }}
            className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center shadow-xl shadow-primary/30 active:scale-95 transition-transform"
          >
            <Mic size={26} className="text-white" />
          </button>
          <p className="text-[11px] text-muted-foreground">버튼을 누르는 즉시 녹음이 시작돼요</p>
        </div>
      )}

      {/* Recording */}
      {pageState === 'recording' && (
        <div className="glass rounded-3xl p-6 flex flex-col items-center gap-4">
          <p className="text-sm font-semibold text-primary animate-pulse">녹음 중 — 스크립트를 읽어주세요</p>
          <canvas ref={canvasRef} className="w-full h-14 rounded-xl" />
          <p className="text-4xl font-black tabular-nums text-foreground">
            {recorder.duration}<span className="text-lg font-semibold text-muted-foreground ml-1">초</span>
          </p>
          <button
            onClick={() => recorder.stop()}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-xl shadow-red-500/30 active:scale-95 transition-transform"
          >
            <Square size={22} className="text-white fill-white" />
          </button>
        </div>
      )}

      {/* Analyzing */}
      {pageState === 'analyzing' && (
        <div className="glass rounded-3xl p-10 flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">목소리를 분석하는 중이에요...</p>
        </div>
      )}

      {/* Result */}
      {(pageState === 'result' || pageState === 'saved') && scores && (
        <div className="space-y-4">
          {/* Score cards */}
          <div className="glass rounded-3xl p-5 space-y-4">
            <p className="text-sm font-bold text-foreground">목소리 품질 분석 결과</p>

            {[
              { label: '목소리 안정감', desc: 'Jitter·Shimmer 기반', score: scores.stability },
              { label: '말하기 여유 및 전달력', desc: '발화 속도 기반', score: scores.pace },
              { label: '생동감 및 표현력', desc: '피치 변화·볼륨 기반', score: scores.expressiveness },
            ].map(({ label, desc, score }) => (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                  <span className={`text-2xl font-black tabular-nums ${scoreColor(score)}`}>{score}</span>
                </div>
                <div className="relative h-2.5 bg-secondary/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full gradient-primary transition-all duration-700"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Saved banner */}
          {pageState === 'saved' && (
            <div className="flex items-center gap-3 bg-emerald-400/10 border border-emerald-400/30 rounded-2xl px-4 py-3">
              <CheckCircle size={18} className="text-emerald-400 shrink-0" />
              <p className="text-sm font-semibold text-emerald-400">아카이브에 저장됐어요!</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {pageState === 'result' && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-14 rounded-2xl gradient-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-primary/30 active:scale-95 transition-transform disabled:opacity-70"
              >
                {saving
                  ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  : <><CheckCircle size={20} />아카이브에 저장하기</>}
              </button>
            )}
            {pageState === 'saved' && (
              <button
                onClick={() => router.push('/archive')}
                className="w-full h-14 rounded-2xl gradient-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-primary/30 active:scale-95 transition-transform"
              >
                아카이브에서 추이 보기
                <ChevronRight size={20} />
              </button>
            )}
            <button
              onClick={handleRetry}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary/60 text-sm text-muted-foreground hover:text-foreground active:scale-95 transition-all"
            >
              <RotateCcw size={14} />
              다시 녹음하기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
