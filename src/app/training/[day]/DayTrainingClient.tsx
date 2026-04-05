'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mic, Square, RotateCcw, CheckCircle, Flame } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import { getSupabase } from '@/lib/supabase'
import { THEME_BY_DOW, THEME_INFO, THEME_TIPS, SCRIPTS_BY_THEME, type Theme } from '@/lib/curriculum'

const INDEX_TO_DOW = [1, 2, 3, 4, 5, 6, 0]
const DAY_KO = ['월', '화', '수', '목', '금', '토', '일']

function getDateForDayIndex(dayIndex: number): Date {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow))
  monday.setHours(0, 0, 0, 0)
  const d = new Date(monday)
  d.setDate(monday.getDate() + dayIndex)
  return d
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function pickScript(dayIndex: number, theme: Theme) {
  const scripts = SCRIPTS_BY_THEME[theme]
  return scripts[dayIndex % scripts.length]
}

type RecordState = 'idle' | 'recording' | 'review'

interface Props {
  dayIndex: number // 0=Mon … 6=Sun
}

export default function DayTrainingClient({ dayIndex }: Props) {
  const router = useRouter()
  const date = useMemo(() => getDateForDayIndex(dayIndex), [dayIndex])
  const dateStr = useMemo(() => toDateStr(date), [date])
  const todayStr = useMemo(() => toDateStr(new Date()), [])
  const isToday = dateStr === todayStr

  const dow = INDEX_TO_DOW[dayIndex]
  const theme = THEME_BY_DOW[dow]
  const info = THEME_INFO[theme]
  const script = useMemo(() => pickScript(dayIndex, theme), [dayIndex, theme])
  const tips = THEME_TIPS[theme]
  const tip = tips[dayIndex % tips.length]

  const [isCompleted, setIsCompleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recordState, setRecordState] = useState<RecordState>('idle')

  const recorder = useAudioRecorder(120)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useWaveform({ analyser: recorder.analyserNode, canvasRef, active: recorder.state === 'recording' })

  // Check if already stamped
  useEffect(() => {
    async function check() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_training_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('log_date', dateStr)
        .maybeSingle()
      if (data) setIsCompleted(true)
    }
    check()
  }, [dateStr])

  // Auto-transition to review when recording stops
  useEffect(() => {
    if (recorder.state === 'recorded') setRecordState('review')
  }, [recorder.state])

  async function handleComplete() {
    setSaving(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('user_training_logs').upsert(
          { user_id: user.id, log_date: dateStr, theme, score: 100 },
          { onConflict: 'user_id,log_date' },
        )
      }
      setIsCompleted(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-white/70 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="text-xs">훈련 목록</span>
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{info.emoji}</span>
            <h1 className="text-xl font-black text-white">{info.label}</h1>
          </div>
          <p className="text-white/70 text-sm">
            {DAY_KO[dayIndex]}요일{isToday ? ' (오늘)' : ''} · {info.description}
          </p>
        </div>
      </div>

      <div className="mt-4 px-4 space-y-4">
        {/* Completed banner */}
        {isCompleted && (
          <div className="flex items-center gap-3 bg-orange-400/10 border border-orange-400/30 rounded-2xl px-4 py-3">
            <Flame size={20} className="text-orange-400 shrink-0" />
            <p className="text-sm font-semibold text-orange-400">오늘 훈련 완료! 스탬프를 획득했어요 🎉</p>
          </div>
        )}

        {/* Script card */}
        <div className="glass rounded-3xl p-5">
          <p className="text-[11px] font-semibold text-primary mb-2 uppercase tracking-wide">오늘의 스크립트</p>
          <p className="text-sm text-foreground leading-relaxed font-medium">
            &ldquo;{script.text}&rdquo;
          </p>
          <p className="text-[11px] text-muted-foreground mt-3">{script.description}</p>
        </div>

        {/* Tips */}
        <div className="glass rounded-3xl p-5 space-y-3">
          <p className="text-[11px] font-semibold text-muted-foreground">💡 훈련 포인트</p>
          <p className="text-xs text-foreground leading-relaxed">{tip.tip}</p>
          <div className="rounded-xl bg-secondary/60 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">🎤 연습 방법</p>
            <p className="text-xs text-foreground leading-relaxed">{tip.exercise}</p>
          </div>
        </div>

        {/* Recording practice */}
        <div className="glass rounded-3xl p-5">
          <p className="text-[11px] font-semibold text-muted-foreground mb-4">🎙 소리 내어 읽기 (연습용)</p>

          {recordState === 'idle' && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-muted-foreground text-center">
                스크립트를 읽고 내 목소리를 들어보세요
              </p>
              <button
                onClick={() => { setRecordState('recording'); recorder.start() }}
                className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform"
              >
                <Mic size={22} className="text-white" />
              </button>
            </div>
          )}

          {recordState === 'recording' && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs font-semibold text-primary animate-pulse">녹음 중...</p>
              <canvas ref={canvasRef} className="w-full h-12 rounded-xl" />
              <p className="text-xs text-muted-foreground tabular-nums">{recorder.duration}초</p>
              <button
                onClick={() => recorder.stop()}
                className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 active:scale-95 transition-transform"
              >
                <Square size={20} className="text-white fill-white" />
              </button>
            </div>
          )}

          {recordState === 'review' && recorder.audioUrl && (
            <div className="flex flex-col gap-3">
              <audio controls src={recorder.audioUrl} className="w-full h-10" />
              <button
                onClick={() => { recorder.reset(); setRecordState('idle') }}
                className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw size={13} />
                다시 녹음하기
              </button>
            </div>
          )}
        </div>

        {/* Complete button */}
        {!isCompleted ? (
          <button
            onClick={handleComplete}
            disabled={saving}
            className="w-full h-14 rounded-2xl gradient-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-primary/30 active:scale-95 transition-transform disabled:opacity-70"
          >
            {saving ? (
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <>
                <CheckCircle size={20} />
                훈련 완료하기
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => router.back()}
            className="w-full h-14 rounded-2xl bg-secondary text-foreground font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <ArrowLeft size={20} />
            훈련 목록으로
          </button>
        )}
      </div>
    </div>
  )
}
