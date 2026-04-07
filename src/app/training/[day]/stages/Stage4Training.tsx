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
const SCRIPT = '서울 시내 주요 도로에서 극심한 교통 체증이 발생했습니다. 시 당국은 우회 도로 이용을 권고하고 있습니다.'

// Count Korean syllable blocks only (spaces & punctuation excluded)
function countKorean(text: string): number {
  return [...text].filter((c) => c >= '가' && c <= '힣').length
}
const SCRIPT_CHAR_COUNT = countKorean(SCRIPT) // 43

const MIN_SPEED = 4.5   // 글자/초 — 너무 느린 기준
const MAX_SPEED = 6.5   // 글자/초 — 너무 빠른 기준
const GAUGE_MIN = 2     // gauge 표시 최솟값
const GAUGE_MAX = 9     // gauge 표시 최댓값

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

function speedLabel(speed: number): { text: string; color: string } {
  if (speed < MIN_SPEED) return { text: '너무 느려요', color: 'text-sky-400' }
  if (speed > MAX_SPEED) return { text: '너무 빨라요', color: 'text-orange-400' }
  return { text: '딱 좋아요!', color: 'text-emerald-400' }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnalysisResult {
  durationSec: number
  speed: number          // 글자/초
  passed: boolean
}

type PageState = 'instruction' | 'recording' | 'analyzing' | 'result'

// ─── Component ────────────────────────────────────────────────────────────────
export default function Stage4Training() {
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
        setAlreadyDone(data.some((r: { stage_num: number }) => r.stage_num === 4))
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
    const durationSec = features.duration_sec
    const speed = durationSec > 0 ? SCRIPT_CHAR_COUNT / durationSec : 0
    setResult({
      durationSec,
      speed,
      passed: speed >= MIN_SPEED && speed <= MAX_SPEED,
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
        ? await uploadTrainingAudio(user.id, 4, todayStr, audioBlobRef.current)
        : null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('user_training_logs').upsert(
        { user_id: user.id, log_date: todayStr, theme: 'speed', score: 100, stage_num: 4, audio_url: audioPath },
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

  // ── Gauge helpers ─────────────────────────────────────────────────────────
  const gaugeRange = GAUGE_MAX - GAUGE_MIN
  const minPct = ((MIN_SPEED - GAUGE_MIN) / gaugeRange) * 100
  const maxPct = ((MAX_SPEED - GAUGE_MIN) / gaugeRange) * 100

  function speedToPct(s: number) {
    return Math.min(100, Math.max(0, ((s - GAUGE_MIN) / gaugeRange) * 100))
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

        {/* Script card — always visible */}
        <div className="glass rounded-3xl p-5 space-y-3">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">훈련 스크립트</p>
          <p className="text-sm text-foreground leading-relaxed font-medium">
            &ldquo;{SCRIPT}&rdquo;
          </p>
          <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            총 {SCRIPT_CHAR_COUNT}글자 · 목표 {MIN_SPEED}~{MAX_SPEED}글자/초 ({(SCRIPT_CHAR_COUNT / MAX_SPEED).toFixed(1)}~{(SCRIPT_CHAR_COUNT / MIN_SPEED).toFixed(1)}초 안에 읽기)
          </p>
        </div>

        {/* Instruction */}
        {pageState === 'instruction' && (
          <div className="glass rounded-3xl p-6 flex flex-col items-center gap-5 text-center">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">뉴스 앵커 속도로 읽기</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                녹음 버튼을 누른 뒤 스크립트를 읽고,<br />
                다 읽으면 <span className="text-primary font-semibold">바로 정지</span>해주세요.<br />
                앞뒤 무음이 짧을수록 정확하게 측정돼요.
              </p>
            </div>

            {/* Target zone */}
            <div className="w-full rounded-2xl bg-secondary/60 p-4 space-y-2 text-left">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">속도 기준</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-sky-400">너무 느림</span>
                <span className="text-foreground">{MIN_SPEED}글자/초 미만</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-bold">✓ 적정 속도</span>
                <span className="text-emerald-400 font-bold">{MIN_SPEED}~{MAX_SPEED}글자/초</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-orange-400">너무 빠름</span>
                <span className="text-foreground">{MAX_SPEED}글자/초 초과</span>
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
            <p className="text-sm font-semibold text-primary animate-pulse">녹음 중 — 스크립트를 읽어보세요</p>
            <canvas ref={canvasRef} className="w-full h-14 rounded-xl" />
            <p className={`text-4xl font-black tabular-nums ${
              recorder.duration >= SCRIPT_CHAR_COUNT / MIN_SPEED ? 'text-orange-400' : 'text-foreground'
            }`}>
              {recorder.duration}<span className="text-lg font-semibold text-muted-foreground ml-1">초</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              목표 구간: {(SCRIPT_CHAR_COUNT / MAX_SPEED).toFixed(1)}초 ~ {(SCRIPT_CHAR_COUNT / MIN_SPEED).toFixed(1)}초
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
            <p className="text-sm text-muted-foreground">읽기 속도를 계산하는 중이에요...</p>
          </div>
        )}

        {/* Result */}
        {pageState === 'result' && result && (() => {
          const label = speedLabel(result.speed)
          return (
            <div className="space-y-4">
              <div className="glass rounded-3xl p-5 space-y-4">
                <p className="text-sm font-bold text-foreground">속도 측정 결과</p>

                {/* Big speed number */}
                <div className="flex items-end justify-center gap-2 py-2">
                  <span className={`text-5xl font-black tabular-nums ${label.color}`}>
                    {result.speed.toFixed(1)}
                  </span>
                  <span className="text-base text-muted-foreground mb-1">글자/초</span>
                </div>

                {/* Gauge */}
                <div className="space-y-1">
                  <div className="relative h-4 bg-secondary/60 rounded-full overflow-hidden">
                    {/* Green zone */}
                    <div
                      className="absolute top-0 bottom-0 bg-emerald-400/30 rounded-full"
                      style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
                    />
                    {/* Speed indicator */}
                    <div
                      className={`absolute top-1 bottom-1 w-1.5 rounded-full ${result.passed ? 'bg-emerald-400' : result.speed < MIN_SPEED ? 'bg-sky-400' : 'bg-orange-400'}`}
                      style={{ left: `calc(${speedToPct(result.speed)}% - 3px)` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{GAUGE_MIN}글자/초</span>
                    <span className="text-emerald-400 font-bold">{MIN_SPEED}~{MAX_SPEED}</span>
                    <span>{GAUGE_MAX}글자/초</span>
                  </div>
                </div>

                {/* Duration & verdict */}
                <div className="flex items-center justify-between py-3 border-t border-border/40">
                  <p className="text-xs text-muted-foreground">
                    녹음 시간: <span className="font-semibold text-foreground">{result.durationSec.toFixed(1)}초</span>
                  </p>
                  <span className={`text-sm font-bold ${label.color}`}>{label.text}</span>
                </div>

                {/* Feedback */}
                {result.passed ? (
                  <div className="rounded-xl bg-emerald-400/10 border border-emerald-400/30 px-3 py-2">
                    <p className="text-xs text-emerald-400 font-semibold">🎉 뉴스 앵커 수준의 속도예요!</p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-secondary/60 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      {result.speed < MIN_SPEED
                        ? '조금 더 빠르게 읽어보세요. 단어와 단어 사이 호흡을 짧게 해보세요.'
                        : '조금 천천히, 또렷하게 읽어보세요. 너무 빠르면 전달력이 떨어져요.'}
                    </p>
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
          )
        })()}
      </div>
    </>
  )
}
