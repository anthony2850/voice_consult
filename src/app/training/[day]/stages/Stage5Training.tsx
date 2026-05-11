'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, RotateCcw, CheckCircle } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { markStageComplete, getTodayCompleted } from '@/lib/trainingProgress'
import { calcPER } from '@/lib/phonemeErrorRate'
import StreakPopup from '@/components/StreakPopup'

// ─── Constants ────────────────────────────────────────────────────────────────
const SCRIPT_TEXT = '간장 공장 공장장은 강 공장장이고 된장 공장 공장장은 장 공장장이다.'
const SCRIPT_DESCRIPTION = "자음 'ㄱ'과 'ㅈ'의 정확한 발음을 연습하는 문장이에요."
const PER_PASS_THRESHOLD = 0.25

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function calcStreak(dates: string[]) {
  const unique = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  const today = toDateStr(new Date())
  let count = 0, expected = today
  for (const date of unique) {
    if (date === expected) { count++; const d = new Date(expected); d.setDate(d.getDate() - 1); expected = toDateStr(d) }
    else if (date < expected) break
  }
  return count
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechRecognition(): any | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  return SR ? new SR() : null
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnalysisResult {
  per: number
  accuracy: number
  transcript: string
  passed: boolean
}

type PageState = 'instruction' | 'recording' | 'result'
type SpeechError = 'unsupported' | 'no-speech' | 'not-allowed' | 'network' | null

// ─── Component ────────────────────────────────────────────────────────────────
export default function Stage5Training() {
  const todayStr = toDateStr(new Date())

  const [pageState, setPageState] = useState<PageState>('instruction')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [showStreak, setShowStreak] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [allLogDates, setAllLogDates] = useState<string[]>([])
  const [speechError, setSpeechError] = useState<SpeechError>(null)
  const [dots, setDots] = useState('.')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const dotsRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check completion status
  useEffect(() => {
    async function checkDone() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('user_training_logs').select('stage_num, log_date').eq('user_id', user.id)
      if (data) {
        setAlreadyDone(data.some((r: { stage_num: number; log_date: string }) => r.stage_num === 5 && r.log_date === todayStr))
        setAllLogDates(data.map((r: { log_date: string }) => r.log_date))
      }
    }
    checkDone()
  }, [todayStr])

  function startRecording() {
    setSpeechError(null)
    const recognition = getSpeechRecognition()
    if (!recognition) {
      setSpeechError('unsupported')
      return
    }

    recognition.lang = 'ko-KR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    // Allow longer speech before auto-stopping
    recognition.continuous = false
    recognitionRef.current = recognition

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      stopDots()
      runAnalysis(transcript)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      stopDots()
      setPageState('instruction')
      if (event.error === 'no-speech') setSpeechError('no-speech')
      else if (event.error === 'not-allowed') setSpeechError('not-allowed')
      else if (event.error === 'network') setSpeechError('network')
      else setSpeechError('no-speech')
    }

    recognition.onend = () => {
      stopDots()
      // If still in recording state with no result → no-speech
      setPageState(prev => {
        if (prev === 'recording') { setSpeechError('no-speech'); return 'instruction' }
        return prev
      })
    }

    recognition.start()
    setPageState('recording')
    startDots()
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    stopDots()
  }

  function startDots() {
    let i = 0
    dotsRef.current = setInterval(() => {
      i = (i + 1) % 3
      setDots('.'.repeat(i + 1))
    }, 500)
  }

  function stopDots() {
    if (dotsRef.current) { clearInterval(dotsRef.current); dotsRef.current = null }
  }

  function runAnalysis(transcript: string) {
    if (!transcript.trim()) {
      setSpeechError('no-speech')
      setPageState('instruction')
      return
    }
    const per = calcPER(SCRIPT_TEXT, transcript)
    const accuracy = Math.max(0, Math.round((1 - per) * 100))
    setResult({ per, accuracy, transcript, passed: per <= PER_PASS_THRESHOLD })
    setPageState('result')
  }

  async function handleComplete() {
    if (!result?.passed) return
    const isFirstToday = getTodayCompleted().length === 0
    markStageComplete(5)
    setSaving(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: saveError } = await (supabase as any).from('user_training_logs').insert(
        { user_id: user.id, log_date: todayStr, theme: 'accuracy', score: result.accuracy, stage_num: 5 },
      )
      if (saveError && saveError.code !== '23505') console.error('[stage5] save failed:', saveError)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('user_training_logs').select('log_date').eq('user_id', user.id)
      const dates: string[] = [...new Set([...(data?.map((r: { log_date: string }) => r.log_date) ?? []), todayStr])]
      setAllLogDates(dates)
      setStreakCount(calcStreak(dates))
      setAlreadyDone(true)
      if (isFirstToday) setShowStreak(true)
      else window.location.replace('/training')
    } finally {
      setSaving(false)
    }
  }

  function handleRetry() {
    setResult(null)
    setSpeechError(null)
    setPageState('instruction')
  }

  useEffect(() => () => { recognitionRef.current?.abort(); stopDots() }, [])

  // ─── Accuracy colors ───────────────────────────────────────────────────────
  function accuracyColor(acc: number) {
    if (acc >= 80) return 'text-emerald-400'
    if (acc >= 60) return 'text-cyan-400'
    if (acc >= 40) return 'text-amber-400'
    return 'text-rose-400'
  }
  function accuracyBarColor(acc: number) {
    if (acc >= 80) return 'bg-emerald-400'
    if (acc >= 60) return 'bg-cyan-400'
    if (acc >= 40) return 'bg-amber-400'
    return 'bg-rose-400'
  }

  const errorMessages: Record<NonNullable<SpeechError>, string> = {
    unsupported: '이 브라우저는 음성 인식을 지원하지 않아요. Chrome 또는 Safari를 사용해주세요.',
    'no-speech': '목소리가 인식되지 않았어요. 마이크에 가까이 대고 또렷하게 읽어보세요.',
    'not-allowed': '마이크 접근 권한이 필요해요. 브라우저 설정에서 허용해주세요.',
    network: '네트워크 오류가 발생했어요. 인터넷 연결을 확인해주세요.',
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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

        {speechError && (
          <div className="flex items-start gap-3 bg-rose-400/10 border border-rose-400/30 rounded-2xl px-4 py-3">
            <span className="text-lg shrink-0">⚠️</span>
            <p className="text-sm text-rose-400 font-medium leading-relaxed">
              {errorMessages[speechError]}
            </p>
          </div>
        )}

        {/* Script card */}
        <div className="glass rounded-3xl p-5 space-y-3">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">훈련 스크립트</p>
          <p className="text-base leading-relaxed font-bold text-foreground">
            &ldquo;{SCRIPT_TEXT}&rdquo;
          </p>
          <p className="text-[11px] text-muted-foreground">{SCRIPT_DESCRIPTION}</p>
          <div className="flex items-start gap-2 pt-1 border-t border-border/40">
            <span className="text-primary mt-0.5">💡</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              각 음절을 또렷하게 끊어 읽어보세요. 브라우저 음성 인식이 받아적은 내용을 기준 문장과 비교해 정확도를 측정해요.
            </p>
          </div>
        </div>

        {/* Instruction */}
        {pageState === 'instruction' && (
          <div className="glass rounded-3xl p-6 flex flex-col items-center gap-5 text-center">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">위 문장을 소리 내어 읽어보세요</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                버튼을 누른 뒤 문장을 처음부터 끝까지 읽어주세요.<br />
                다 읽으면 자동으로 인식이 완료돼요.
              </p>
            </div>
            <button
              onClick={startRecording}
              className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center shadow-xl shadow-primary/30 active:scale-95 transition-transform"
            >
              <Mic size={26} className="text-white" />
            </button>
            <p className="text-[11px] text-muted-foreground">버튼을 누르는 즉시 인식이 시작돼요</p>
          </div>
        )}

        {/* Recording */}
        {pageState === 'recording' && (
          <div className="glass rounded-3xl p-6 flex flex-col items-center gap-5 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
              <Mic size={26} className="text-primary animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary">듣고 있어요{dots}</p>
              <p className="text-xs text-muted-foreground">문장을 처음부터 끝까지 또렷하게 읽어주세요</p>
            </div>
            <button
              onClick={stopRecording}
              className="px-6 py-2.5 rounded-xl bg-secondary/80 text-sm text-muted-foreground active:scale-95 transition-all"
            >
              취소
            </button>
          </div>
        )}

        {/* Result */}
        {pageState === 'result' && result && (
          <div className="space-y-4">
            <div className={`rounded-3xl px-5 py-4 flex items-center gap-3 ${
              result.passed ? 'bg-emerald-400/10 border border-emerald-400/30' : 'bg-secondary/60'
            }`}>
              <span className="text-2xl">{result.passed ? '🗣️' : '💪'}</span>
              <div>
                <p className={`text-sm font-bold ${result.passed ? 'text-emerald-400' : 'text-foreground'}`}>
                  {result.passed ? '발음 훈련 통과!' : '조금 더 또렷하게 읽어봐요'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {result.passed ? `정확도 ${result.accuracy}% — 훌륭한 발음이에요` : `정확도 ${result.accuracy}% — 목표 75% 이상`}
                </p>
              </div>
            </div>

            <div className="glass rounded-3xl p-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🗣️</span>
                    <p className="text-xs font-semibold text-foreground">음소 정확도</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-black tabular-nums ${accuracyColor(result.accuracy)}`}>
                      {result.accuracy}%
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      result.passed ? 'bg-emerald-400/20 text-emerald-400' : 'bg-orange-400/20 text-orange-400'
                    }`}>
                      {result.passed ? '통과' : '개선 필요'}
                    </span>
                  </div>
                </div>
                <div className="relative h-2.5 bg-secondary/60 rounded-full overflow-hidden">
                  <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-400/60 z-10" style={{ left: '75%' }} />
                  <div
                    className={`h-full rounded-full transition-all ${accuracyBarColor(result.accuracy)}`}
                    style={{ width: `${result.accuracy}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0%</span>
                  <span className="text-emerald-400">통과 기준 75%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="border-t border-border/40" />

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground">인식된 발음</p>
                <div className="rounded-xl bg-secondary/40 px-3 py-2.5">
                  <p className="text-xs text-foreground leading-relaxed">
                    {result.transcript || <span className="text-muted-foreground italic">인식 결과 없음</span>}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground">기준 문장과 다른 부분을 확인하고 다시 연습해보세요</p>
              </div>
            </div>

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
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary/60 text-sm text-muted-foreground active:scale-95 transition-all"
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
