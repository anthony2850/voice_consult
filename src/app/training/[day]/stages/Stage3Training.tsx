'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, RotateCcw, CheckCircle } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import { extractAudioFeatures } from '@/lib/extractAudioFeatures'
import { getSupabase } from '@/lib/supabase'
import { markStageComplete } from '@/lib/trainingProgress'
import { uploadTrainingAudio } from '@/lib/uploadTrainingAudio'
import StreakPopup from '@/components/StreakPopup'

// ─── Constants ────────────────────────────────────────────────────────────────
// Pitch std dev threshold for "good emphasis"
const PITCH_STD_THRESHOLD = 25   // Hz
// Energy coefficient of variation threshold (rms_std / rms_mean)
const ENERGY_CV_THRESHOLD = 0.5

// Script split into segments; highlighted = must be stressed
const SCRIPT_PARTS: { text: string; highlight: boolean }[] = [
  { text: '이 시장은 ', highlight: false },
  { text: '지금', highlight: true },
  { text: ' 움직이고 있습니다. 우리에게 필요한 건 더 많은 준비가 아니라, ', highlight: false },
  { text: '실행', highlight: true },
  { text: '입니다. 그리고 저희는 ', highlight: false },
  { text: '오늘', highlight: true },
  { text: ' 시작합니다.', highlight: false },
]

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
  pitchStdHz: number
  energyCV: number       // rms_std / rms_mean
  pitchPassed: boolean
  energyPassed: boolean
  passed: boolean        // both checks
}

type PageState = 'instruction' | 'recording' | 'analyzing' | 'result'

// ─── Component ────────────────────────────────────────────────────────────────
export default function Stage3Training() {
  const router = useRouter()
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
        setAlreadyDone(data.some((r: { stage_num: number }) => r.stage_num === 3))
        setAllLogDates(data.map((r: { log_date: string }) => r.log_date))
      }
    }
    checkDone()
  }, [])

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
    const pitchStdHz = features.pitch.std_hz
    const energyCV = features.energy.rms_mean > 0
      ? features.energy.rms_std / features.energy.rms_mean
      : 0
    const pitchPassed = pitchStdHz >= PITCH_STD_THRESHOLD
    const energyPassed = energyCV >= ENERGY_CV_THRESHOLD
    setResult({
      pitchStdHz,
      energyCV,
      pitchPassed,
      energyPassed,
      passed: pitchPassed && energyPassed,
    })
    setPageState('result')
  }

  async function handleComplete() {
    if (!result?.passed) return
    markStageComplete(3)
    setSaving(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const audioPath = audioBlobRef.current
        ? await uploadTrainingAudio(user.id, 3, todayStr, audioBlobRef.current)
        : null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: saveError } = await (supabase as any).from('user_training_logs').insert(
        { user_id: user.id, log_date: todayStr, theme: 'emotion', score: 100, stage_num: 3, audio_url: audioPath },
      )
      if (saveError && saveError.code !== '23505') {
        console.error('[stage3] save failed:', saveError)
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
        {alreadyDone && pageState === 'instruction' && (
          <div className="flex items-center gap-3 bg-orange-400/10 border border-orange-400/30 rounded-2xl px-4 py-3">
            <span className="text-lg">🔥</span>
            <p className="text-sm font-semibold text-orange-400">이미 완료한 단계예요! 다시 연습해도 좋아요.</p>
          </div>
        )}

        {/* Script card — always visible */}
        <div className="glass rounded-3xl p-5 space-y-4">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">훈련 스크립트</p>
          {/* Highlighted script */}
          <p className="text-sm leading-relaxed font-medium">
            {SCRIPT_PARTS.map((part, i) =>
              part.highlight ? (
                <span
                  key={i}
                  className="text-primary font-black underline decoration-primary/50 decoration-2 underline-offset-2"
                >
                  {part.text}
                </span>
              ) : (
                <span key={i} className="text-foreground">{part.text}</span>
              )
            )}
          </p>
          {/* Legend */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/40">
            <span className="w-3 h-3 rounded-sm bg-primary shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              강조 단어에 힘을 주고, 살짝 더 높은 톤으로 짚어주세요
            </p>
          </div>
        </div>

        {/* Instruction */}
        {pageState === 'instruction' && (
          <div className="glass rounded-3xl p-6 flex flex-col items-center gap-5 text-center">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">강조 단어를 짚어가며 읽기</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                밑줄 친 단어를 읽을 때 목소리를 <span className="text-primary font-semibold">살짝 높이고</span> 힘을 주어<br />
                나머지 단어와 확실한 차이가 느껴지도록 읽어보세요.
              </p>
            </div>

            {/* Criteria */}
            <div className="w-full rounded-2xl bg-secondary/60 p-4 space-y-2 text-left">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">측정 항목</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">음정 변화량 (Pitch std)</span>
                <span className="text-primary font-bold">{PITCH_STD_THRESHOLD}Hz 이상 → 통과</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">볼륨 변동률 (Energy CV)</span>
                <span className="text-primary font-bold">{ENERGY_CV_THRESHOLD} 이상 → 통과</span>
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
            <p className="text-sm font-semibold text-primary animate-pulse">녹음 중 — 강조 단어를 짚어가세요</p>
            <canvas ref={canvasRef} className="w-full h-14 rounded-xl" />
            <p className="text-3xl font-black tabular-nums text-foreground">
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
            <p className="text-sm text-muted-foreground">강세 패턴을 분석하는 중이에요...</p>
          </div>
        )}

        {/* Result */}
        {pageState === 'result' && result && (
          <div className="space-y-4">
            {/* Metrics */}
            <div className="glass rounded-3xl p-5 space-y-4">
              <p className="text-sm font-bold text-foreground">강세 분석 결과</p>

              {/* Pitch std gauge */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">음정 변화량 (Pitch std)</p>
                    <p className="text-[11px] text-muted-foreground">기준: {PITCH_STD_THRESHOLD}Hz 이상</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black tabular-nums">{result.pitchStdHz.toFixed(1)}Hz</p>
                    <span className={`text-[10px] font-bold ${result.pitchPassed ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {result.pitchPassed ? '통과' : '개선 필요'}
                    </span>
                  </div>
                </div>
                <div className="relative h-3 bg-secondary/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${result.pitchPassed ? 'bg-emerald-400' : 'bg-orange-400'}`}
                    style={{ width: `${Math.min(100, (result.pitchStdHz / 50) * 100)}%` }}
                  />
                  {/* threshold marker */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white/60" style={{ left: `${(PITCH_STD_THRESHOLD / 50) * 100}%` }} />
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted-foreground">0Hz</span>
                  <span className="text-[10px] text-primary font-bold">목표 {PITCH_STD_THRESHOLD}Hz</span>
                  <span className="text-[10px] text-muted-foreground">50Hz</span>
                </div>
              </div>

              {/* Energy CV gauge */}
              <div className="space-y-2 pt-3 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">볼륨 변동률 (Energy CV)</p>
                    <p className="text-[11px] text-muted-foreground">기준: {ENERGY_CV_THRESHOLD} 이상</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black tabular-nums">{result.energyCV.toFixed(2)}</p>
                    <span className={`text-[10px] font-bold ${result.energyPassed ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {result.energyPassed ? '통과' : '개선 필요'}
                    </span>
                  </div>
                </div>
                <div className="relative h-3 bg-secondary/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${result.energyPassed ? 'bg-emerald-400' : 'bg-orange-400'}`}
                    style={{ width: `${Math.min(100, (result.energyCV / 1.0) * 100)}%` }}
                  />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white/60" style={{ left: `${(ENERGY_CV_THRESHOLD / 1.0) * 100}%` }} />
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted-foreground">0</span>
                  <span className="text-[10px] text-primary font-bold">목표 {ENERGY_CV_THRESHOLD}</span>
                  <span className="text-[10px] text-muted-foreground">1.0</span>
                </div>
              </div>

              {/* Summary */}
              {result.passed ? (
                <div className="rounded-xl bg-emerald-400/10 border border-emerald-400/30 px-3 py-2">
                  <p className="text-xs text-emerald-400 font-semibold">
                    🎉 강조 단어가 확실히 돋보이는 목소리예요!
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-secondary/60 px-3 py-2 space-y-1">
                  {!result.pitchPassed && (
                    <p className="text-xs text-muted-foreground">
                      • 강조 단어에서 음정을 조금 더 높여보세요
                    </p>
                  )}
                  {!result.energyPassed && (
                    <p className="text-xs text-muted-foreground">
                      • 강조 단어와 일반 단어의 볼륨 차이를 더 크게 내보세요
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {result.passed && !alreadyDone && (
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
              {alreadyDone && result.passed && (
                <button
                  onClick={() => router.back()}
                  className="w-full h-14 rounded-2xl bg-secondary text-foreground font-bold text-base active:scale-95 transition-transform"
                >
                  훈련 목록으로
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
