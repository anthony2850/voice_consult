'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mic, Square, RotateCcw, CheckCircle } from 'lucide-react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveform } from '@/hooks/useWaveform'
import { getSupabase } from '@/lib/supabase'
import { STAGES } from '@/lib/curriculum'
import StreakPopup from '@/components/StreakPopup'
import Stage1Training from './stages/Stage1Training'
import Stage2Training from './stages/Stage2Training'
import Stage3Training from './stages/Stage3Training'
import Stage4Training from './stages/Stage4Training'

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

type RecordState = 'idle' | 'recording' | 'review'

export default function DayTrainingClient({ dayIndex }: { dayIndex: number }) {
  const router = useRouter()
  const stage = STAGES[dayIndex]
  const todayStr = toDateStr(new Date())

  const [isCompleted, setIsCompleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [showRecordGuide, setShowRecordGuide] = useState(false)
  const [showStreak, setShowStreak] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [allLogDates, setAllLogDates] = useState<string[]>([])

  const recorder = useAudioRecorder(120)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useWaveform({ analyser: recorder.analyserNode, canvasRef, active: recorder.state === 'recording' })

  // Check completion & load all log dates for streak display
  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_training_logs')
        .select('stage_num, log_date')
        .eq('user_id', user.id)
      if (data) {
        const completed = data.some((r: { stage_num: number }) => r.stage_num === stage.stageNum)
        setIsCompleted(completed)
        setAllLogDates(data.map((r: { log_date: string }) => r.log_date))
      }
    }
    load()
  }, [stage.stageNum])

  useEffect(() => {
    if (recorder.state === 'recorded') setRecordState('review')
  }, [recorder.state])

  async function handleComplete() {
    if (recordState !== 'review') {
      setShowRecordGuide(true)
      return
    }
    setSaving(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('user_training_logs').upsert(
        { user_id: user.id, log_date: todayStr, theme: stage.theme, score: 100, stage_num: stage.stageNum },
        { onConflict: 'user_id,stage_num' },
      )

      // Refetch all log dates to compute streak
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_training_logs')
        .select('log_date')
        .eq('user_id', user.id)
      const dates: string[] = data?.map((r: { log_date: string }) => r.log_date) ?? []
      // Ensure today is counted
      const datesWithToday = [...new Set([...dates, todayStr])]
      setAllLogDates(datesWithToday)
      setStreakCount(calcStreak(datesWithToday))
      setIsCompleted(true)
      setShowStreak(true)
    } finally {
      setSaving(false)
    }
  }

  if (stage.stageNum === 4) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-84px)]">
        <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-6 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10">
            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-white/70 hover:text-white mb-4 transition-colors">
              <ArrowLeft size={16} /><span className="text-xs">훈련 목록</span>
            </button>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">⚡</span>
              <h1 className="text-xl font-black text-white">4단계 · 속도 훈련</h1>
            </div>
            <p className="text-white/70 text-sm">뉴스 앵커처럼 일정한 속도로 읽어보세요</p>
          </div>
        </div>
        <Stage4Training />
      </div>
    )
  }

  if (!stage) return null

  // Stage-specific custom training components
  if (stage.stageNum === 1) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-84px)]">
        <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-6 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10">
            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-white/70 hover:text-white mb-4 transition-colors">
              <ArrowLeft size={16} /><span className="text-xs">훈련 목록</span>
            </button>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🫁</span>
              <h1 className="text-xl font-black text-white">1단계 · 호흡 훈련</h1>
            </div>
            <p className="text-white/70 text-sm">아- 소리를 흔들림 없이 5초 이상 유지해보세요</p>
          </div>
        </div>
        <Stage1Training />
      </div>
    )
  }

  if (stage.stageNum === 2) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-84px)]">
        <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-6 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10">
            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-white/70 hover:text-white mb-4 transition-colors">
              <ArrowLeft size={16} /><span className="text-xs">훈련 목록</span>
            </button>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">📢</span>
              <h1 className="text-xl font-black text-white">2단계 · 볼륨 훈련</h1>
            </div>
            <p className="text-white/70 text-sm">평소보다 1.5배 더 크게 말하는 연습을 해보세요</p>
          </div>
        </div>
        <Stage2Training />
      </div>
    )
  }

  if (stage.stageNum === 3) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-84px)]">
        <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-6 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10">
            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-white/70 hover:text-white mb-4 transition-colors">
              <ArrowLeft size={16} /><span className="text-xs">훈련 목록</span>
            </button>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🎯</span>
              <h1 className="text-xl font-black text-white">3단계 · 강세 훈련</h1>
            </div>
            <p className="text-white/70 text-sm">강조 단어를 짚어가며 밋밋한 말투에서 벗어나보세요</p>
          </div>
        </div>
        <Stage3Training />
      </div>
    )
  }

  return (
    <>
      {showStreak && (
        <StreakPopup
          streak={streakCount}
          logDates={allLogDates}
          onClose={() => { setShowStreak(false); router.back() }}
        />
      )}

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
              <span className="text-2xl">{stage.emoji}</span>
              <h1 className="text-xl font-black text-white">
                {stage.stageNum}단계 · {stage.name}
              </h1>
            </div>
            <p className="text-white/70 text-sm">{stage.description}</p>
          </div>
        </div>

        <div className="mt-4 px-4 space-y-4">
          {/* Completed banner */}
          {isCompleted && (
            <div className="flex items-center gap-3 bg-orange-400/10 border border-orange-400/30 rounded-2xl px-4 py-3">
              <span className="text-xl">🔥</span>
              <p className="text-sm font-semibold text-orange-400">이 단계를 완료했어요!</p>
            </div>
          )}

          {/* Script */}
          <div className="glass rounded-3xl p-5">
            <p className="text-[11px] font-semibold text-primary mb-2 uppercase tracking-wide">훈련 스크립트</p>
            <p className="text-sm text-foreground leading-relaxed font-medium">
              &ldquo;{stage.script.text}&rdquo;
            </p>
            <p className="text-[11px] text-muted-foreground mt-3">{stage.script.description}</p>
          </div>

          {/* Tips */}
          <div className="glass rounded-3xl p-5 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground">💡 훈련 포인트</p>
            <p className="text-xs text-foreground leading-relaxed">{stage.tip.tip}</p>
            <div className="rounded-xl bg-secondary/60 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">🎤 연습 방법</p>
              <p className="text-xs text-foreground leading-relaxed">{stage.tip.exercise}</p>
            </div>
          </div>

          {/* Recording */}
          <div className="glass rounded-3xl p-5">
            <p className="text-[11px] font-semibold text-muted-foreground mb-4">🎙 소리 내어 읽기 (연습용)</p>

            {recordState === 'idle' && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-muted-foreground text-center">스크립트를 읽고 내 목소리를 들어보세요</p>
                <button
                  onClick={() => { setRecordState('recording'); setShowRecordGuide(false); recorder.start() }}
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
                  className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
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

          {/* Record guide */}
          {showRecordGuide && recordState !== 'review' && (
            <div className="flex items-start gap-3 bg-amber-400/10 border border-amber-400/30 rounded-2xl px-4 py-3">
              <span className="text-lg shrink-0">🎙</span>
              <p className="text-sm text-amber-400 font-medium leading-relaxed">
                위 스크립트를 먼저 녹음해주세요. 녹음을 완료한 후에 훈련을 마칠 수 있어요.
              </p>
            </div>
          )}

          {/* Complete button */}
          {!isCompleted ? (
            <button
              onClick={handleComplete}
              disabled={saving}
              className="w-full h-14 rounded-2xl gradient-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-primary/30 active:scale-95 transition-transform disabled:opacity-70"
            >
              {saving
                ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : <><CheckCircle size={20} />훈련 완료하기</>}
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
    </>
  )
}
