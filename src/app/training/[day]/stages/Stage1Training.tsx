'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, RotateCcw, CheckCircle } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import { extractAudioFeatures } from '@/lib/extractAudioFeatures'
import { getSupabase } from '@/lib/supabase'
import { uploadTrainingAudio } from '@/lib/uploadTrainingAudio'
import { markStageComplete } from '@/lib/trainingProgress'
import StreakPopup from '@/components/StreakPopup'

// ─── Thresholds ───────────────────────────────────────────────────────────────
const MIN_DURATION_SEC = 5
const JITTER_THRESHOLD = 1.5   // %
const SHIMMER_THRESHOLD = 15   // %
const DB_MEAN_THRESHOLD = -35  // dB (묵음 감지)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

function calcStreak(dates: string[]): number {
  const unique = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  const today = toDateStr(new Date())
  let count = 0
  let expected = today
  for (const date of unique) {
    if (date === expected) {
      count++
      const d = new Date(expected)
      d.setDate(d.getDate() - 1)
      expected = toDateStr(d)
    } else if (date < expected) break
  }
  return count
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnalysisResult {
  durationSec: number
  jitterPct: number
  shimmerPct: number
  dbMean: number
  jitterStable: boolean
  shimmerStable: boolean
  soundDetected: boolean
  passed: boolean  // duration >= 5s AND sound detected
}

type PageState = 'instruction' | 'recording' | 'analyzing' | 'result'

// ─── Component ────────────────────────────────────────────────────────────────
export default function Stage1Training() {
  const todayStr = toDateStr(new Date())

  const [pageState, setPageState] = useState<PageState>('instruction')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [showStreak, setShowStreak] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [allLogDates, setAllLogDates] = useState<string[]>([])

  const recorder = useAudioRecorder(30)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useWaveform({ analyser: recorder.analyserNode, canvasRef, active: recorder.state === 'recording' })
  const analyzingRef = useRef(false)
  const audioBlobRef = useRef<Blob | null>(null)

  useEffect(() => {
    async function checkDone() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_training_logs')
        .select('stage_num, log_date')
        .eq('user_id', user.id)
      if (data) {
        setAlreadyDone(data.some((r: { stage_num: number; log_date: string }) => r.stage_num === 1 && r.log_date === todayStr))
        setAllLogDates(data.map((r: { log_date: string }) => r.log_date))
      }
    }
    checkDone()
  }, [])

  // Auto-trigger analysis when recording finishes
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
    audioBlobRef.current = blob
    setPageState('analyzing')
    const features = await extractAudioFeatures(blob)
    if (!features) {
      setPageState('instruction')
      recorder.reset()
      return
    }
    const durationSec = features.duration_sec
    const jitterPct = features.voice_quality.jitter_rel_pct
    const shimmerPct = features.voice_quality.shimmer_rel_pct
    const dbMean = features.energy.db_mean
    const soundDetected = dbMean >= DB_MEAN_THRESHOLD
    setResult({
      durationSec,
      jitterPct,
      shimmerPct,
      dbMean,
      jitterStable: jitterPct < JITTER_THRESHOLD,
      shimmerStable: shimmerPct < SHIMMER_THRESHOLD,
      soundDetected,
      passed: durationSec >= MIN_DURATION_SEC && soundDetected,
    })
    setPageState('result')
  }

  async function handleComplete() {
    if (!result?.passed) return
    // localStorage에 즉시 저장 → unlock이 DB와 무관하게 동작
    markStageComplete(1)
    setSaving(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const audioPath = audioBlobRef.current
        ? await uploadTrainingAudio(user.id, 1, todayStr, audioBlobRef.current)
        : null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: saveError } = await (supabase as any).from('user_training_logs').insert(
        { user_id: user.id, log_date: todayStr, theme: 'accuracy', score: 100, stage_num: 1, audio_url: audioPath },
      )
      if (saveError && saveError.code !== '23505') {
        console.error('[stage1] save failed:', saveError)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_training_logs')
        .select('log_date')
        .eq('user_id', user.id)
      const dates: string[] = [...new Set([...(data?.map((r: { log_date: string }) => r.log_date) ?? []), todayStr])]
      setAllLogDates(dates)
      setStreakCount(calcStreak(dates))
      setAlreadyDone(true)
      setShowStreak(true)
    } finally {
      setSaving(false)
    }
  }

  function handleRetry() {
    recorder.reset()
    setResult(null)
    setPageState('instruction')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {showStreak && (
        <StreakPopup
          streak={streakCount}
          logDates={allLogDates}
          onClose={() => { setShowStreak(false); window.location.replace('/training') }}
        />
      )}

      <div className="px-4 pt-4 pb-8 space-y-4">
        {/* Already done banner */}
        {alreadyDone && (
          <div className="flex items-center gap-3 bg-orange-400/10 border border-orange-400/30 rounded-2xl px-4 py-3">
            <span className="text-lg">🔥</span>
            <p className="text-sm font-semibold text-orange-400">이미 완료한 단계예요!</p>
          </div>
        )}

        {/* Instruction */}
        {pageState === 'instruction' && (
          <div className="glass rounded-3xl p-6 flex flex-col items-center gap-5 text-center">
            <span className="text-6xl font-black text-foreground tracking-widest">아—</span>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">호흡 안정성 훈련</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                숨을 깊게 들이쉰 후 녹음 버튼을 누르고<br />
                <span className="text-primary font-semibold">&#39;아—&#39; 소리를 최대한 길게 유지</span>해보세요.<br />
                5초 이상 유지하면 성공이에요.
              </p>
            </div>

            {/* Criteria */}
            <div className="w-full rounded-2xl bg-secondary/60 p-4 space-y-2 text-left">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">측정 항목</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">지속 시간</span>
                <span className="text-primary font-bold">5초 이상 → 통과</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">Jitter (음정 흔들림)</span>
                <span className="text-muted-foreground">{JITTER_THRESHOLD}% 미만 → 안정</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">Shimmer (음량 흔들림)</span>
                <span className="text-muted-foreground">{SHIMMER_THRESHOLD}% 미만 → 안정</span>
              </div>
            </div>

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
          <div className="glass rounded-3xl p-6 flex flex-col items-center gap-5">
            <p className="text-sm font-semibold text-primary animate-pulse">녹음 중 — 소리를 유지하세요</p>
            <span className="text-5xl font-black text-foreground tracking-widest">아—</span>
            <canvas ref={canvasRef} className="w-full h-14 rounded-xl" />
            <p className={`text-4xl font-black tabular-nums ${recorder.duration >= MIN_DURATION_SEC ? 'text-emerald-400' : 'text-foreground'}`}>
              {recorder.duration}<span className="text-lg font-semibold text-muted-foreground ml-1">초</span>
            </p>
            {recorder.duration >= MIN_DURATION_SEC && (
              <p className="text-xs text-emerald-400 font-semibold animate-pulse">✓ 5초 달성! 계속 유지하거나 완료하세요</p>
            )}
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
        {pageState === 'result' && result && (
          <div className="space-y-4">
            {/* Duration result */}
            <div className="glass rounded-3xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-foreground">지속 시간</p>
                <span className={`text-2xl font-black ${result.passed ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {result.durationSec.toFixed(1)}초
                </span>
              </div>
              {/* Duration gauge */}
              <div className="relative h-3 bg-secondary/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${result.passed ? 'bg-emerald-400' : 'bg-orange-400'}`}
                  style={{ width: `${Math.min(100, (result.durationSec / 15) * 100)}%` }}
                />
                {/* 5s marker */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-white/60" style={{ left: `${(5 / 15) * 100}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">0초</span>
                <span className="text-[10px] text-primary font-bold">목표 5초</span>
                <span className="text-[10px] text-muted-foreground">15초</span>
              </div>
              {!result.soundDetected ? (
                <p className="text-xs font-semibold mt-3 text-orange-400">✗ 소리가 감지되지 않았어요. '아—' 소리를 내주세요</p>
              ) : (
                <p className={`text-xs font-semibold mt-3 ${result.durationSec >= MIN_DURATION_SEC ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {result.durationSec >= MIN_DURATION_SEC ? '✓ 통과! 5초 이상 유지했어요' : `✗ 조금 더 필요해요 (${(MIN_DURATION_SEC - result.durationSec).toFixed(1)}초 부족)`}
                </p>
              )}
            </div>

            {/* Stability result */}
            <div className="glass rounded-3xl p-5 space-y-3">
              <p className="text-sm font-bold text-foreground">목소리 안정성</p>

              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <div>
                  <p className="text-xs font-semibold text-foreground">Jitter (음정 흔들림)</p>
                  <p className="text-[11px] text-muted-foreground">기준: {JITTER_THRESHOLD}% 미만</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black tabular-nums">{result.jitterPct.toFixed(2)}%</p>
                  <span className={`text-[10px] font-bold ${result.jitterStable ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {result.jitterStable ? '안정적' : '개선 필요'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">Shimmer (음량 흔들림)</p>
                  <p className="text-[11px] text-muted-foreground">기준: {SHIMMER_THRESHOLD}% 미만</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black tabular-nums">{result.shimmerPct.toFixed(2)}%</p>
                  <span className={`text-[10px] font-bold ${result.shimmerStable ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {result.shimmerStable ? '안정적' : '개선 필요'}
                  </span>
                </div>
              </div>

              {result.jitterStable && result.shimmerStable ? (
                <div className="rounded-xl bg-emerald-400/10 border border-emerald-400/30 px-3 py-2">
                  <p className="text-xs text-emerald-400 font-semibold">🎉 흔들림 없는 안정적인 목소리예요!</p>
                </div>
              ) : (
                <div className="rounded-xl bg-secondary/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">꾸준히 연습하면 목소리 안정성이 높아져요 💪</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {result.passed && (
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="w-full h-14 rounded-2xl gradient-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-primary/30 active:scale-95 transition-transform disabled:opacity-70"
                >
                  {saving
                    ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <><CheckCircle size={20} />훈련 완료하기</>}
                </button>
              )}
              <button
                onClick={handleRetry}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary/60 text-sm text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              >
                <RotateCcw size={14} />
                다시 도전하기
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
