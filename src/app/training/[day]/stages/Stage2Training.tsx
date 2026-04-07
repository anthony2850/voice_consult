'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, RotateCcw, ChevronRight, CheckCircle } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import { extractAudioFeatures } from '@/lib/extractAudioFeatures'
import { getSupabase } from '@/lib/supabase'
import { uploadTrainingAudio } from '@/lib/uploadTrainingAudio'
import StreakPopup from '@/components/StreakPopup'

// ─── Constants ────────────────────────────────────────────────────────────────
const TARGET_RATIO = 1.5
const SCRIPT = '안녕하세요. 저는 오늘 여러분께 중요한 이야기를 전하려고 합니다. 잘 부탁드립니다.'

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
type PageState =
  | 'step1_ready'
  | 'step1_recording'
  | 'step1_analyzing'
  | 'step1_done'
  | 'step2_ready'
  | 'step2_recording'
  | 'step2_analyzing'
  | 'result'

// ─── Component ────────────────────────────────────────────────────────────────
export default function Stage2Training() {
  const router = useRouter()
  const todayStr = toDateStr(new Date())

  const [pageState, setPageState] = useState<PageState>('step1_ready')
  const [baselineRms, setBaselineRms] = useState(0)
  const [loudRms, setLoudRms] = useState(0)
  const [saving, setSaving] = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [showStreak, setShowStreak] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [allLogDates, setAllLogDates] = useState<string[]>([])

  const recorder = useAudioRecorder(30)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useWaveform({ analyser: recorder.analyserNode, canvasRef, active: recorder.state === 'recording' })

  const analyzingRef = useRef(false)
  const stepRef = useRef<1 | 2>(1)
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
        setAlreadyDone(data.some((r: { stage_num: number }) => r.stage_num === 2))
        setAllLogDates(data.map((r: { log_date: string }) => r.log_date))
      }
    }
    checkDone()
  }, [])

  // Auto-trigger analysis when recording stops
  useEffect(() => {
    if (recorder.state === 'recorded' && recorder.audioBlob && !analyzingRef.current) {
      analyzingRef.current = true
      if (stepRef.current === 1) {
        analyzeStep1(recorder.audioBlob)
      } else {
        analyzeStep2(recorder.audioBlob)
      }
    }
    if (recorder.state === 'idle') {
      analyzingRef.current = false
    }
  }, [recorder.state, recorder.audioBlob]) // eslint-disable-line react-hooks/exhaustive-deps

  async function analyzeStep1(blob: Blob) {
    setPageState('step1_analyzing')
    const features = await extractAudioFeatures(blob)
    const rms = features?.energy.rms_mean ?? 0
    setBaselineRms(rms)
    setPageState('step1_done')
  }

  async function analyzeStep2(blob: Blob) {
    audioBlobRef.current = blob  // save loud-voice recording
    setPageState('step2_analyzing')
    const features = await extractAudioFeatures(blob)
    const rms = features?.energy.rms_mean ?? 0
    setLoudRms(rms)
    setPageState('result')
  }

  function startStep1() {
    stepRef.current = 1
    setPageState('step1_recording')
    recorder.start()
  }

  function startStep2() {
    stepRef.current = 2
    recorder.reset()
    setPageState('step2_recording')
    // recorder.reset() is async in state — start after a tick
    setTimeout(() => recorder.start(), 50)
  }

  function retryStep1() {
    recorder.reset()
    setBaselineRms(0)
    setLoudRms(0)
    setPageState('step1_ready')
  }

  const ratio = baselineRms > 0 ? loudRms / baselineRms : 0
  const passed = ratio >= TARGET_RATIO

  async function handleComplete() {
    setSaving(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const audioPath = audioBlobRef.current
        ? await uploadTrainingAudio(user.id, 2, todayStr, audioBlobRef.current)
        : null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: saveError } = await (supabase as any).from('user_training_logs').insert(
        { user_id: user.id, log_date: todayStr, theme: 'speed', score: 100, stage_num: 2, audio_url: audioPath },
      )
      if (saveError && saveError.code !== '23505') {
        console.error('[stage2] save failed:', saveError)
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
        {alreadyDone && pageState === 'step1_ready' && (
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
          {/* Tip */}
          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border/40">
            💡 크게 말하는 연습을 하는 것만으로 자신감 없어 보이는 목소리를 많이 개선할 수 있어요.
          </p>
        </div>

        {/* ── STEP 1 ──────────────────────────────────────────────────── */}
        <div className={`glass rounded-3xl p-5 space-y-4 transition-opacity ${
          ['step2_ready', 'step2_recording', 'step2_analyzing', 'result'].includes(pageState) ? 'opacity-50' : ''
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">1</span>
            <p className="text-sm font-bold text-foreground">평소 목소리로 읽어보세요</p>
          </div>

          {pageState === 'step1_ready' && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-muted-foreground text-center">
                평소 대화할 때처럼 자연스럽게 읽어보세요
              </p>
              <button
                onClick={startStep1}
                className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform"
              >
                <Mic size={22} className="text-white" />
              </button>
            </div>
          )}

          {pageState === 'step1_recording' && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs font-semibold text-primary animate-pulse">녹음 중...</p>
              <canvas ref={canvasRef} className="w-full h-12 rounded-xl" />
              <p className="text-xs text-muted-foreground tabular-nums">{recorder.duration}초</p>
              <button
                onClick={() => recorder.stop()}
                className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <Square size={20} className="text-white fill-white" />
              </button>
            </div>
          )}

          {pageState === 'step1_analyzing' && (
            <div className="flex items-center justify-center gap-3 py-2">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs text-muted-foreground">분석 중...</p>
            </div>
          )}

          {['step1_done', 'step2_ready', 'step2_recording', 'step2_analyzing', 'result'].includes(pageState) && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 text-sm">✓</span>
                <p className="text-xs text-muted-foreground">기준 볼륨 측정 완료</p>
              </div>
              {pageState === 'step1_done' && (
                <button onClick={retryStep1} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                  <RotateCcw size={11} />다시
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── STEP 2 ──────────────────────────────────────────────────── */}
        {['step1_done', 'step2_ready', 'step2_recording', 'step2_analyzing', 'result'].includes(pageState) && (
          <div className="glass rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">2</span>
              <p className="text-sm font-bold text-foreground">
                1.5배 더 크게 읽어보세요
              </p>
            </div>

            {pageState === 'step1_done' && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-muted-foreground text-center">
                  방금보다 확실히 크게, 자신있게 읽어보세요
                </p>
                <button
                  onClick={startStep2}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl gradient-primary text-white text-sm font-bold shadow-lg shadow-primary/30 active:scale-95 transition-transform"
                >
                  <ChevronRight size={16} />
                  크게 읽기 시작
                </button>
              </div>
            )}

            {pageState === 'step2_recording' && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-semibold text-primary animate-pulse">녹음 중 — 크게!</p>
                <canvas ref={canvasRef} className="w-full h-12 rounded-xl" />
                <p className="text-xs text-muted-foreground tabular-nums">{recorder.duration}초</p>
                <button
                  onClick={() => recorder.stop()}
                  className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <Square size={20} className="text-white fill-white" />
                </button>
              </div>
            )}

            {pageState === 'step2_analyzing' && (
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-xs text-muted-foreground">분석 중...</p>
              </div>
            )}
          </div>
        )}

        {/* ── RESULT ──────────────────────────────────────────────────── */}
        {pageState === 'result' && (
          <div className="space-y-4">
            {/* Volume comparison */}
            <div className="glass rounded-3xl p-5 space-y-4">
              <p className="text-sm font-bold text-foreground">볼륨 비교 결과</p>

              {/* Baseline bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>기준 (평소)</span>
                  <span>{(baselineRms * 1000).toFixed(1)}</span>
                </div>
                <div className="h-3 bg-secondary/60 rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: '40%' }} />
                </div>
              </div>

              {/* Loud bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className={passed ? 'text-emerald-400' : 'text-orange-400'}>크게 말하기</span>
                  <span className={passed ? 'text-emerald-400' : 'text-orange-400'}>{(loudRms * 1000).toFixed(1)}</span>
                </div>
                <div className="h-3 bg-secondary/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${passed ? 'bg-emerald-400' : 'bg-orange-400'}`}
                    style={{ width: `${Math.min(100, (ratio / TARGET_RATIO) * 40)}%` }}
                  />
                </div>
              </div>

              {/* Ratio */}
              <div className={`rounded-2xl px-4 py-3 text-center ${
                passed ? 'bg-emerald-400/10 border border-emerald-400/30' : 'bg-orange-400/10 border border-orange-400/30'
              }`}>
                <p className={`text-3xl font-black ${passed ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {ratio.toFixed(2)}배
                </p>
                <p className={`text-xs font-semibold mt-1 ${passed ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {passed
                    ? `🎉 목표 달성! (목표: ${TARGET_RATIO}배 이상)`
                    : `목표 ${TARGET_RATIO}배에 ${(TARGET_RATIO - ratio).toFixed(2)}배 부족해요`}
                </p>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {passed
                  ? '평소보다 확실히 크게 말했어요! 이 정도 볼륨이면 자신감 있어 보이는 목소리예요.'
                  : '조금 더 배에 힘을 주고 크게 말해보세요. 처음엔 과장되게 느껴져도 괜찮아요.'}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {passed && !alreadyDone && (
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
              {alreadyDone && passed && (
                <button
                  onClick={() => router.back()}
                  className="w-full h-14 rounded-2xl bg-secondary text-foreground font-bold text-base active:scale-95 transition-transform"
                >
                  훈련 목록으로
                </button>
              )}
              <button
                onClick={retryStep1}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary/60 text-sm text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              >
                <RotateCcw size={14} />
                처음부터 다시 하기
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
