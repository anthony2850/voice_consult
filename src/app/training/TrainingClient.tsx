'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { Mic, Square, RotateCcw, Flame } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import { getSupabase } from '@/lib/supabase'
import { getTodayCurriculum } from '@/lib/curriculum'
import { Badge } from '@/components/ui/badge'

// ─── Scoring ─────────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const prev = Array.from({ length: n + 1 }, (_, i) => i)
  const curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]
}

function textSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.replace(/[\s.,!?~·…—。]/g, '').toLowerCase()
  const s1 = norm(a), s2 = norm(b)
  const maxLen = Math.max(s1.length, s2.length)
  if (maxLen === 0) return 100
  return Math.round((1 - levenshtein(s1, s2) / maxLen) * 100)
}

interface ScoreResult {
  score: number
  passed: boolean
  feedback: string
}

function scoreAccuracy(transcript: string, script: string): ScoreResult {
  const score = textSimilarity(transcript, script)
  const passed = score >= 70
  const feedback =
    score >= 90 ? '완벽해요! 발음이 매우 정확해요 🎉' :
    score >= 70 ? '잘 하셨어요! 조금만 더 연습하면 완벽해져요 👍' :
    score >= 50 ? '절반 정도 맞았어요. 다시 한번 도전해보세요 💪' :
                  '조금 더 집중해서 읽어보세요. 천천히 해도 괜찮아요 🙂'
  return { score, passed, feedback }
}

function scoreSpeed(transcript: string, durationSec: number): ScoreResult {
  const charCount = transcript.replace(/\s/g, '').length
  const cps = durationSec > 0 ? charCount / durationSec : 0
  const diff = Math.abs(cps - 5.5)
  const score = Math.round(Math.max(0, 100 - diff * 18))
  const passed = score >= 60
  const feedback =
    cps < 3.5 ? `조금 더 빠르게 읽어보세요. (현재 ${cps.toFixed(1)}자/초, 목표 5~6자/초) 🐢` :
    cps < 4.5 ? `거의 다 왔어요! 조금만 속도를 높여보세요. (${cps.toFixed(1)}자/초) 🏃` :
    cps <= 6.5 ? `딱 좋은 속도예요! (${cps.toFixed(1)}자/초) 🎯` :
                 `조금 천천히 읽어보세요. 정확성도 중요해요. (${cps.toFixed(1)}자/초) 🏎️`
  return { score, passed, feedback }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getWeekDates(): Date[] {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ─── Component ────────────────────────────────────────────────────────────────

type PageState = 'idle' | 'recording' | 'transcribing' | 'scored' | 'error'
const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const PASS_THRESHOLD = 60

export default function TrainingClient() {
  const [curriculum] = useState(getTodayCurriculum)
  const weekDates = useMemo(getWeekDates, [])
  const todayStr = useMemo(() => toDateStr(new Date()), [])

  const recorder = useAudioRecorder(120)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useWaveform({ analyser: recorder.analyserNode, canvasRef, active: recorder.state === 'recording' })

  const [pageState, setPageState] = useState<PageState>('idle')
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [transcript, setTranscript] = useState('')
  const [stampedDates, setStampedDates] = useState<string[]>([])
  const [stampError, setStampError] = useState(false)

  const durationRef = useRef(0)
  const transcribingRef = useRef(false)

  // Load this week's stamps
  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_training_logs')
        .select('log_date')
        .eq('user_id', user.id)
        .gte('log_date', toDateStr(weekDates[0]))
        .lte('log_date', toDateStr(weekDates[6]))
      if (data) setStampedDates(data.map((r: { log_date: string }) => r.log_date))
    }
    load()
  }, [weekDates])

  // Trigger transcription once recording blob is ready
  useEffect(() => {
    if (recorder.state === 'recorded' && recorder.audioBlob && !transcribingRef.current) {
      transcribingRef.current = true
      durationRef.current = recorder.duration
      handleTranscribeAndScore(recorder.audioBlob)
    }
    if (recorder.state === 'idle') {
      transcribingRef.current = false
    }
  }, [recorder.state, recorder.audioBlob]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTranscribeAndScore(blob: Blob) {
    setPageState('transcribing')
    try {
      const form = new FormData()
      form.append('audio', blob, 'voice.webm')
      const res = await fetch('/api/transcribe', { method: 'POST', body: form })
      if (!res.ok) throw new Error('transcribe failed')
      const { text } = await res.json()
      setTranscript(text ?? '')

      let result: ScoreResult
      if (curriculum.theme === 'emotion') {
        result = {
          score: 100,
          passed: true,
          feedback: '오늘의 감정 훈련을 완료했어요! 감정을 담아 읽는 연습이 차곡차곡 쌓이고 있어요 🎭',
        }
      } else if (curriculum.theme === 'accuracy') {
        result = scoreAccuracy(text ?? '', curriculum.script.text)
      } else {
        result = scoreSpeed(text ?? '', durationRef.current)
      }

      setScoreResult(result)
      setPageState('scored')
      await saveStamp(result.score)
    } catch (err) {
      console.error('[transcribe] error:', err)
      setPageState('error')
    }
  }

  async function saveStamp(score: number) {
    if (score < PASS_THRESHOLD && curriculum.theme !== 'emotion') return
    setStampError(false)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('user_training_logs').upsert(
        { user_id: user.id, log_date: todayStr, theme: curriculum.theme, score },
        { onConflict: 'user_id,log_date' },
      )
      if (error) throw error
      setStampedDates((prev) => [...new Set([...prev, todayStr])])
    } catch {
      setStampError(true)
    }
  }

  function handleRetry() {
    setPageState('idle')
    recorder.reset()
    setScoreResult(null)
    setTranscript('')
  }

  const todayStamped = stampedDates.includes(todayStr)

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">
            오늘의 훈련
          </Badge>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{curriculum.emoji}</span>
            <h1 className="text-2xl font-black text-white">{curriculum.label}</h1>
          </div>
          <p className="text-white/70 text-sm">{curriculum.description}</p>
        </div>
      </div>

      <div className="mt-4 px-4 space-y-4">
        {/* Script card */}
        <div className="glass rounded-3xl p-5">
          <p className="text-[11px] font-semibold text-primary mb-2 uppercase tracking-wide">
            오늘의 스크립트
          </p>
          <p className="text-sm text-foreground leading-relaxed font-medium">
            &ldquo;{curriculum.script.text}&rdquo;
          </p>
          <p className="text-[11px] text-muted-foreground mt-3">{curriculum.script.description}</p>
        </div>

        {/* Recording states */}
        {pageState === 'idle' && (
          <div className="glass rounded-3xl p-6 flex flex-col items-center gap-4">
            {todayStamped ? (
              <>
                <Flame size={32} className="text-orange-400" />
                <p className="text-sm font-semibold text-foreground">오늘 훈련 완료!</p>
                <p className="text-xs text-muted-foreground text-center">
                  오늘의 스탬프를 획득했어요. 내일 또 만나요 🔥
                </p>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw size={13} />
                  다시 도전하기
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  위 스크립트를 읽은 뒤 녹음 버튼을 눌러주세요
                </p>
                <button
                  onClick={() => { setPageState('recording'); recorder.start() }}
                  className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center shadow-xl shadow-primary/30 active:scale-95 transition-transform"
                >
                  <Mic size={28} className="text-white" />
                </button>
              </>
            )}
          </div>
        )}

        {pageState === 'recording' && (
          <div className="glass rounded-3xl p-5 flex flex-col items-center gap-4">
            <p className="text-sm font-semibold text-primary animate-pulse">녹음 중...</p>
            <canvas ref={canvasRef} className="w-full h-14 rounded-xl" />
            <p className="text-xs text-muted-foreground tabular-nums">{recorder.duration}초</p>
            <button
              onClick={() => recorder.stop()}
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-xl shadow-red-500/30 active:scale-95 transition-transform"
            >
              <Square size={24} className="text-white fill-white" />
            </button>
          </div>
        )}

        {pageState === 'error' && (
          <div className="glass rounded-3xl p-6 flex flex-col items-center gap-3 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="text-sm font-semibold text-foreground">음성 분석에 실패했어요</p>
            <p className="text-xs text-muted-foreground">
              네트워크 오류이거나 서버 설정 문제일 수 있어요.<br />잠시 후 다시 시도해주세요.
            </p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 text-sm text-primary font-medium mt-1"
            >
              <RotateCcw size={14} />
              다시 시도하기
            </button>
          </div>
        )}

        {pageState === 'transcribing' && (
          <div className="glass rounded-3xl p-8 flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">음성을 분석하는 중이에요...</p>
          </div>
        )}

        {pageState === 'scored' && scoreResult && (
          <div className="glass rounded-3xl p-5 space-y-4">
            <div className="text-center py-2">
              {curriculum.theme === 'emotion' ? (
                <div className="text-5xl mb-2">🎭</div>
              ) : (
                <p className="text-6xl font-black gradient-text mb-1">{scoreResult.score}점</p>
              )}
              <p className={`text-sm font-semibold mt-1 ${
                scoreResult.passed ? 'text-orange-400' : 'text-muted-foreground'
              }`}>
                {scoreResult.passed
                  ? stampError ? '훈련 완료! (스탬프 저장 실패)' : '🔥 스탬프 획득!'
                  : `목표 점수 ${PASS_THRESHOLD}점 미달 — 다시 도전해보세요`}
              </p>
            </div>

            <div className="rounded-2xl bg-secondary/60 p-4">
              <p className="text-xs text-foreground leading-relaxed">{scoreResult.feedback}</p>
            </div>

            {transcript && curriculum.theme !== 'emotion' && (
              <div className="rounded-2xl bg-secondary/40 p-3">
                <p className="text-[11px] text-muted-foreground mb-1">인식된 텍스트</p>
                <p className="text-xs text-foreground leading-relaxed">&ldquo;{transcript}&rdquo;</p>
              </div>
            )}

            <button
              onClick={handleRetry}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary/60 text-sm text-muted-foreground hover:text-foreground active:scale-95 transition-all"
            >
              <RotateCcw size={14} />
              다시 도전하기
            </button>
          </div>
        )}

        {/* Weekly stamps */}
        <div className="glass rounded-3xl p-5">
          <p className="text-xs font-semibold text-muted-foreground mb-4">이번 주 훈련 현황</p>
          <div className="flex justify-between">
            {weekDates.map((date, i) => {
              const dateStr = toDateStr(date)
              const isToday = dateStr === todayStr
              const stamped = stampedDates.includes(dateStr)
              return (
                <div key={dateStr} className="flex flex-col items-center gap-1.5">
                  <div className={`
                    w-10 h-10 rounded-2xl flex items-center justify-center
                    ${stamped ? 'bg-orange-400/20' : 'bg-secondary/60'}
                    ${isToday ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
                  `}>
                    {stamped
                      ? <Flame size={20} className="text-orange-400" />
                      : <span className="text-muted-foreground text-sm">○</span>}
                  </div>
                  <span className={`text-[10px] font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {DAY_LABELS[i]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
