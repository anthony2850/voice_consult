'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, FileText, ChevronRight, ChevronLeft, Play, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getSupabase } from '@/lib/supabase'
import { getTrainingAudioUrl } from '@/lib/uploadTrainingAudio'

// ─── Types ────────────────────────────────────────────────────────────────────
interface TrainingLog {
  stage_num: number
  log_date: string
  audio_url: string | null
}


// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}


const STAGE_INFO: Record<number, { name: string; emoji: string }> = {
  1: { name: '호흡 훈련', emoji: '🫁' },
  2: { name: '볼륨 훈련', emoji: '📢' },
  3: { name: '강세 훈련', emoji: '🎯' },
  4: { name: '속도 훈련', emoji: '⚡' },
  5: { name: '종합 훈련', emoji: '🏆' },
}

const EMOTION_KO: Record<string, string> = {
  Admiration: '감탄', Adoration: '경애', 'Aesthetic Appreciation': '미적 감상',
  Amusement: '즐거움', Anger: '분노', Anxiety: '불안', Awe: '경외감',
  Awkwardness: '어색함', Boredom: '지루함', Calmness: '차분함',
  Concentration: '집중', Confusion: '혼란', Contemplation: '사색',
  Contempt: '경멸', Contentment: '만족감', Craving: '갈망', Desire: '욕망',
  Determination: '결단력', Disappointment: '실망', Disgust: '혐오',
  Distress: '고통', Doubt: '의심', Ecstasy: '황홀감', Embarrassment: '당혹감',
  'Empathic Pain': '공감적 아픔', Enthusiasm: '열정', Entrancement: '매혹',
  Envy: '질투', Excitement: '흥분', Fear: '두려움', Guilt: '죄책감',
  Horror: '공포', Interest: '호기심', Joy: '기쁨', Love: '사랑',
  Nostalgia: '향수', Pain: '통증', Pride: '자부심', Realization: '깨달음',
  Relief: '안도', Romance: '낭만', Sadness: '슬픔', Satisfaction: '성취감',
  Shame: '수치심', 'Surprise (negative)': '놀람 (부정)',
  'Surprise (positive)': '놀람 (긍정)', Sympathy: '공감',
  Tiredness: '피로감', Triumph: '승리감',
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────
function AudioPlayer({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function handlePlay() {
    if (open) { setOpen(false); return }
    if (!url) {
      setLoading(true)
      const signed = await getTrainingAudioUrl(storagePath)
      setUrl(signed)
      setLoading(false)
    }
    setOpen(true)
  }

  return (
    <div>
      <button
        onClick={handlePlay}
        className="flex items-center gap-1 text-[11px] text-primary font-semibold px-2.5 py-1 rounded-full bg-primary/10 active:scale-95 transition-transform"
      >
        {loading
          ? <Loader2 size={11} className="animate-spin" />
          : <Play size={11} className="fill-primary" />}
        {open ? '닫기' : '듣기'}
      </button>
      {open && url && (
        <audio
          controls
          autoPlay
          src={url}
          className="w-full h-9 mt-2 rounded-xl"
        />
      )}
    </div>
  )
}

// ─── TrainingCalendar ─────────────────────────────────────────────────────────
const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토']

interface CalendarProps {
  trainingDates: Set<string>
  selectedDate: string | null
  onSelectDate: (d: string) => void
  currentMonth: Date
  onPrevMonth: () => void
  onNextMonth: () => void
}

function TrainingCalendar({
  trainingDates,
  selectedDate,
  onSelectDate,
  currentMonth,
  onPrevMonth,
  onNextMonth,
}: CalendarProps) {
  const todayStr = toDateStr(new Date())
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="glass rounded-3xl p-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrevMonth}
          className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center active:scale-90 transition-transform"
        >
          <ChevronLeft size={16} className="text-muted-foreground" />
        </button>
        <p className="text-sm font-bold text-foreground">
          {year}년 {month + 1}월
        </p>
        <button
          onClick={onNextMonth}
          className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center active:scale-90 transition-transform"
        >
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DOW_LABELS.map((d, i) => (
          <p key={d} className={`text-center text-[10px] font-semibold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-muted-foreground'}`}>
            {d}
          </p>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const hasTraining = trainingDates.has(dateStr)
          const isSelected = selectedDate === dateStr
          const isToday = dateStr === todayStr
          const isSun = i % 7 === 0
          const isSat = i % 7 === 6

          return (
            <button
              key={i}
              onClick={() => hasTraining && onSelectDate(isSelected ? '' : dateStr)}
              disabled={!hasTraining}
              className={`relative flex flex-col items-center justify-center h-9 rounded-xl transition-all
                ${isSelected ? 'bg-primary shadow-md shadow-primary/30' : hasTraining ? 'bg-orange-400/15 active:scale-95' : ''}
              `}
            >
              <span className={`text-xs font-semibold leading-none
                ${isSelected ? 'text-white' : isToday ? 'text-primary' : isSun ? 'text-red-400' : isSat ? 'text-blue-400' : hasTraining ? 'text-foreground' : 'text-muted-foreground/50'}
              `}>
                {day}
              </span>
              {hasTraining && !isSelected && (
                <span className="w-1 h-1 rounded-full bg-orange-400 mt-0.5" />
              )}
              {isToday && !isSelected && (
                <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ArchivePage() {
  const router = useRouter()
  const [trainingLogs, setTrainingLogs] = useState<TrainingLog[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [hasAnalysis, setHasAnalysis] = useState(false)
  const [topEmotions, setTopEmotions] = useState<string[]>([])

  // Load training logs from Supabase
  useEffect(() => {
    async function loadLogs() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_training_logs')
        .select('stage_num, log_date, audio_url')
        .eq('user_id', user.id)
        .order('log_date', { ascending: false })
      if (data) setTrainingLogs(data)
    }
    loadLogs()
  }, [])

  // Load voice analysis from sessionStorage for header emotions
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('voiceEmotions')
      const emotions: Record<string, number> | null = stored ? JSON.parse(stored) : null
      if (emotions) {
        const top = Object.entries(emotions).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name)
        setTopEmotions(top)
        setHasAnalysis(true)
      }
    } catch { /* noop */ }
  }, [])

  // Unique training dates for calendar
  const trainingDates = useMemo(
    () => new Set(trainingLogs.map((l) => l.log_date)),
    [trainingLogs],
  )

  // Logs for selected date
  const selectedLogs = useMemo(() => {
    if (!selectedDate) return []
    return trainingLogs
      .filter((l) => l.log_date === selectedDate)
      .sort((a, b) => a.stage_num - b.stage_num)
  }, [trainingLogs, selectedDate])

  function prevMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    setSelectedDate(null)
  }
  function nextMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    setSelectedDate(null)
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">내 목소리 아카이브</Badge>
          <h1 className="text-3xl font-black text-white mb-1">Voice Archive</h1>
          {hasAnalysis && topEmotions.length > 0 ? (
            <div className="flex gap-2 flex-wrap mt-2">
              {topEmotions.map((e) => (
                <span key={e} className="bg-white/20 backdrop-blur text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                  {EMOTION_KO[e] ?? e}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-white/70 text-sm">훈련 기록과 분석 결과를 확인해요</p>
          )}
        </div>
      </div>

      <div className="mt-4 px-4 space-y-4">
        {/* Training Calendar */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-2 px-1">🗓 훈련 캘린더</p>
          <TrainingCalendar
            trainingDates={trainingDates}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            currentMonth={currentMonth}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
          />
        </div>

        {/* Selected date training list */}
        {selectedDate && selectedLogs.length > 0 && (
          <div className="glass rounded-3xl p-5 space-y-3">
            <p className="text-xs font-bold text-foreground">
              {selectedDate.replace(/-/g, '.')} 훈련 기록
            </p>
            {selectedLogs.map((log) => {
              const info = STAGE_INFO[log.stage_num]
              return (
                <div key={log.stage_num} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-sm shrink-0">
                        {info?.emoji ?? '🎤'}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{log.stage_num}단계 · {info?.name ?? '훈련'}</p>
                        <p className="text-[10px] text-emerald-400 font-semibold">완료 ✓</p>
                      </div>
                    </div>
                    {log.audio_url && <AudioPlayer storagePath={log.audio_url} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick actions */}
        <div className="glass rounded-3xl p-4 space-y-2">
          <h2 className="text-sm font-bold text-foreground mb-3">바로가기</h2>
          <button
            onClick={() => router.push('/record')}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-secondary/60 hover:bg-secondary active:scale-95 transition-all"
          >
            <span className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-md shrink-0">
              <Mic size={16} className="text-white" />
            </span>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">목소리 재분석</p>
              <p className="text-[11px] text-muted-foreground">새로운 목소리로 다시 분석해요</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
          {hasAnalysis && (
            <button
              onClick={() => router.push('/result')}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-secondary/60 hover:bg-secondary active:scale-95 transition-all"
            >
              <span className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-md shrink-0">
                <FileText size={16} className="text-white" />
              </span>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">감정 분석 결과 보기</p>
                <p className="text-[11px] text-muted-foreground">49가지 감정 지표 확인</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
