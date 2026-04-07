'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, RotateCcw, CheckCircle } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import { extractAudioFeatures } from '@/lib/extractAudioFeatures'
import { getSupabase } from '@/lib/supabase'
import { uploadTrainingAudio } from '@/lib/uploadTrainingAudio'
import StreakPopup from '@/components/StreakPopup'

// ─── Constants ────────────────────────────────────────────────────────────────
const SCRIPT_PARTS: { text: string; highlight: boolean }[] = [
  { text: '저희 팀은 지난 반년간 이 문제에 ', highlight: false },
  { text: '집중', highlight: true },
  { text: '했습니다. 그 결과, 기존 방식보다 ', highlight: false },
  { text: '훨씬', highlight: true },
  { text: ' 빠른 솔루션을 ', highlight: false },
  { text: '완성', highlight: true },
  { text: '했습니다.', highlight: false },
]

const SCRIPT_TEXT = SCRIPT_PARTS.map((p) => p.text).join('')

function countKorean(text: string): number {
  return [...text].filter((c) => c >= '가' && c <= '힣').length
}
const SCRIPT_CHAR_COUNT = countKorean(SCRIPT_TEXT) // 42

// Speed thresholds
const MIN_SPEED = 4.5
const MAX_SPEED = 6.5

// Emphasis thresholds
const PITCH_STD_THRESHOLD = 25   // Hz
const ENERGY_CV_THRESHOLD = 0.5

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
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
  speed: number
  pitchStdHz: number
  energyCV: number
  speedPassed: boolean
  emphasisPassed: boolean
  passed: boolean
}

type PageState = 'instruction' | 'recording' | 'analyzing' | 'result'

// ─── Component ────────────────────────────────────────────────────────────────
export default function Stage5Training() {
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
        setAlreadyDone(data.some((r: { stage_num: number }) => r.stage_num === 5))
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
    const speed = features.duration_sec > 0 ? SCRIPT_CHAR_COUNT / features.duration_sec : 0
    const pitchStdHz = features.pitch.std_hz
    const energyCV = features.energy.rms_mean > 0
      ? features.energy.rms_std / features.energy.rms_mean
      : 0
    const speedPassed = speed >= MIN_SPEED && speed <= MAX_SPEED
    const emphasisPassed = pitchStdHz >= PITCH_STD_THRESHOLD && energyCV >= ENERGY_CV_THRESHOLD
    setResult({
      speed,
      pitchStdHz,
      energyCV,
      speedPassed,
      emphasisPassed,
      passed: speedPassed && emphasisPassed,
    })
    setPageState('result')
  }

  async function handleComplete() {
    if (!result?.passed) return
    setSaving(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const audioPath = audioBlobRef.current
        ? await uploadTrainingAudio(user.id, 5, todayStr, audioBlobRef.current)
        : null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('user_training_logs').upsert(
        { user_id: user.id, log_date: todayStr, theme: 'accuracy', score: 100, stage_num: 5, audio_url: audioPath },
        { onConflict: 'user_id,stage_num' },
      )
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
          onClose={() => { setShowStreak(false); router.push(`/training`) }}
        />
      )}

      <div className="px-4 pt-4 pb-8 space-y-4">
        {alreadyDone && pageState === 'instruction' && (
          <div className="flex items-center gap-3 bg-orange-400/10 border border-orange-400/30 rounded-2xl px-4 py-3">
            <span className="text-lg">🔥</span>
            <p className="text-sm font-semibold text-orange-400">이미 완료한 단계예요! 다시 연습해도 좋아요.</p>
          </div>
        )}

        {/* Script card */}
        <div className="glass rounded-3xl p-5 space-y-3">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">훈련 스크립트</p>
          <p className="text-sm leading-relaxed font-medium">
            {SCRIPT_PARTS.map((part, i) =>
              part.highlight ? (
                <span key={i} className="text-primary font-black underline decoration-primary/50 decoration-2 underline-offset-2">
                  {part.text}
                </span>
              ) : (
                <span key={i} className="text-foreground">{part.text}</span>
              )
            )}
          </p>
          <div className="flex items-center gap-2 pt-1 border-t border-border/40">
            <span className="w-3 h-3 rounded-sm bg-primary shrink-0" />
            <p className="text-[11px] text-muted-foreground">강조 단어에 힘을 주고, {MIN_SPEED}~{MAX_SPEED}글자/초 속도로 읽어보세요</p>
          </div>
        </div>

        {/* Checklist */}
        <div className="glass rounded-3xl p-5 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground mb-3">종합 체크리스트</p>
          {[
            { emoji: '⚡', label: '속도', desc: `${MIN_SPEED}~${MAX_SPEED}글자/초` },
            { emoji: '🎯', label: '강세', desc: '강조 단어에서 음정·볼륨 변화' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-base">{item.emoji}</span>
              <div>
                <p className="text-xs font-semibold text-foreground">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Instruction */}
        {pageState === 'instruction' && (
          <div className="glass rounded-3xl p-6 flex flex-col items-center gap-5 text-center">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">속도 + 강세를 한 번에</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                강조 단어에 힘을 주면서,<br />
                뉴스 앵커 속도로 읽어보세요.<br />
                다 읽으면 <span className="text-primary font-semibold">바로 정지</span>해주세요.
              </p>
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
            <p className="text-4xl font-black tabular-nums text-foreground">
              {recorder.duration}<span className="text-lg font-semibold text-muted-foreground ml-1">초</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              목표 시간: {(SCRIPT_CHAR_COUNT / MAX_SPEED).toFixed(1)}~{(SCRIPT_CHAR_COUNT / MIN_SPEED).toFixed(1)}초
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
            <p className="text-sm text-muted-foreground">종합 분석 중이에요...</p>
          </div>
        )}

        {/* Result */}
        {pageState === 'result' && result && (
          <div className="space-y-4">
            {/* Overall verdict */}
            <div className={`rounded-3xl px-5 py-4 flex items-center gap-3 ${
              result.passed
                ? 'bg-emerald-400/10 border border-emerald-400/30'
                : 'bg-secondary/60'
            }`}>
              <span className="text-2xl">{result.passed ? '🏆' : '💪'}</span>
              <div>
                <p className={`text-sm font-bold ${result.passed ? 'text-emerald-400' : 'text-foreground'}`}>
                  {result.passed ? '종합 훈련 통과!' : '조금만 더 해봐요'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {result.passed
                    ? '속도와 강세 모두 완벽해요'
                    : `${!result.speedPassed ? '속도' : ''}${!result.speedPassed && !result.emphasisPassed ? ' · ' : ''}${!result.emphasisPassed ? '강세' : ''} 항목을 다시 확인해보세요`}
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="glass rounded-3xl p-5 space-y-4">
              {/* Speed */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">⚡</span>
                    <p className="text-xs font-semibold text-foreground">속도</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black tabular-nums">{result.speed.toFixed(1)}글자/초</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      result.speedPassed ? 'bg-emerald-400/20 text-emerald-400' : 'bg-orange-400/20 text-orange-400'
                    }`}>
                      {result.speedPassed ? '통과' : result.speed < MIN_SPEED ? '느림' : '빠름'}
                    </span>
                  </div>
                </div>
                <div className="relative h-2 bg-secondary/60 rounded-full overflow-hidden">
                  {/* green zone */}
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-400/30"
                    style={{
                      left: `${((MIN_SPEED - 2) / 7) * 100}%`,
                      width: `${((MAX_SPEED - MIN_SPEED) / 7) * 100}%`,
                    }}
                  />
                  <div
                    className={`absolute top-0.5 bottom-0.5 w-1 rounded-full ${result.speedPassed ? 'bg-emerald-400' : 'bg-orange-400'}`}
                    style={{ left: `calc(${Math.min(100, Math.max(0, ((result.speed - 2) / 7) * 100))}% - 2px)` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>2글자/초</span>
                  <span className="text-emerald-400">{MIN_SPEED}~{MAX_SPEED}</span>
                  <span>9글자/초</span>
                </div>
              </div>

              <div className="border-t border-border/40" />

              {/* Emphasis */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🎯</span>
                    <p className="text-xs font-semibold text-foreground">강세</p>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    result.emphasisPassed ? 'bg-emerald-400/20 text-emerald-400' : 'bg-orange-400/20 text-orange-400'
                  }`}>
                    {result.emphasisPassed ? '통과' : '개선 필요'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-secondary/60 p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">음정 변화</p>
                    <p className="text-sm font-black tabular-nums">{result.pitchStdHz.toFixed(1)}Hz</p>
                    <p className={`text-[10px] font-bold ${result.pitchStdHz >= PITCH_STD_THRESHOLD ? 'text-emerald-400' : 'text-orange-400'}`}>
                      기준 {PITCH_STD_THRESHOLD}Hz
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary/60 p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">볼륨 변동</p>
                    <p className="text-sm font-black tabular-nums">{result.energyCV.toFixed(2)}</p>
                    <p className={`text-[10px] font-bold ${result.energyCV >= ENERGY_CV_THRESHOLD ? 'text-emerald-400' : 'text-orange-400'}`}>
                      기준 {ENERGY_CV_THRESHOLD}
                    </p>
                  </div>
                </div>
              </div>
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
