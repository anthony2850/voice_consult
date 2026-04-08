'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, ChevronRight, ChevronLeft, Play, Loader2, TrendingUp, Flame } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getSupabase } from '@/lib/supabase'
import { getTrainingAudioUrl } from '@/lib/uploadTrainingAudio'

// ─── Types ────────────────────────────────────────────────────────────────────
interface TrainingLog {
  stage_num: number
  log_date: string
  audio_url: string | null
}

interface VoiceQualityLog {
  stability_score: number
  pace_score: number
  expressiveness_score: number
  logged_at: string
}

interface MetricStats {
  min: number
  max: number
  diff: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Returns [월~일] date strings for the week containing referenceDate */
function getWeekDates(referenceDate: Date): string[] {
  const dow = referenceDate.getDay() // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(referenceDate)
  monday.setDate(referenceDate.getDate() + mondayOffset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return toDateStr(d)
  })
}

function calcMetricStats(logs: VoiceQualityLog[], key: keyof Pick<VoiceQualityLog, 'stability_score' | 'pace_score' | 'expressiveness_score'>): MetricStats | null {
  if (logs.length === 0) return null
  const vals = logs.map((l) => l[key] as number)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  return { min, max, diff: max - min }
}

const METRIC_CONFIG = [
  { key: 'stability_score' as const,     label: '목소리 안정감',       emoji: '🫁', desc: 'Jitter·Shimmer 기반' },
  { key: 'pace_score' as const,          label: '말하기 여유 및 전달력', emoji: '🎙', desc: '발화 속도 기반' },
  { key: 'expressiveness_score' as const, label: '생동감·표현력',       emoji: '✨', desc: '피치 변화·볼륨 기반' },
]

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일']

// ─── TrendChart ───────────────────────────────────────────────────────────────
const CW = 320, CH = 140
const PAD = { l: 28, r: 8, t: 10, b: 26 }
const PW = CW - PAD.l - PAD.r
const PH = CH - PAD.t - PAD.b

const TREND_METRICS = [
  { key: 'stability_score' as const,       short: '안정감',    color: '#8b5cf6' },
  { key: 'pace_score' as const,            short: '말하기 여유', color: '#06b6d4' },
  { key: 'expressiveness_score' as const,  short: '표현력',    color: '#f59e0b' },
]

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return `M ${pts[0]?.[0] ?? 0} ${pts[0]?.[1] ?? 0}`
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]
    const [cx, cy] = pts[i]
    const mx = (px + cx) / 2
    d += ` C ${mx.toFixed(1)} ${py.toFixed(1)}, ${mx.toFixed(1)} ${cy.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`
  }
  return d
}

function TrendChart({ logs }: { logs: VoiceQualityLog[] }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const metric = TREND_METRICS[activeIdx]

  const recentLogs = logs.slice(-7)
  if (recentLogs.length === 0) return null

  const points = recentLogs.map((l) => ({
    date: l.logged_at.slice(5, 10).replace('-', '/'),
    value: l[metric.key] as number,
  }))

  const values = points.map((p) => p.value)
  const yMin = Math.max(55, Math.floor(Math.min(...values) / 5) * 5 - 5)
  const yMax = Math.min(100, Math.ceil(Math.max(...values) / 5) * 5 + 5)
  const yRange = yMax - yMin || 1

  const xPos = (i: number) =>
    PAD.l + (points.length === 1 ? PW / 2 : (i / (points.length - 1)) * PW)
  const yPos = (v: number) => PAD.t + (1 - (v - yMin) / yRange) * PH

  const coords: [number, number][] = points.map((p, i) => [xPos(i), yPos(p.value)])
  const linePath = smoothPath(coords)
  const areaPath = `${linePath} L ${coords[coords.length - 1][0].toFixed(1)} ${(PAD.t + PH).toFixed(1)} L ${coords[0][0].toFixed(1)} ${(PAD.t + PH).toFixed(1)} Z`

  const tickStep = yRange <= 10 ? 5 : 10
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax; v += tickStep) yTicks.push(v)

  const first = points[0].value
  const last = points[points.length - 1].value
  const diff = last - first
  const gradId = `tg${activeIdx}`

  return (
    <div className="glass rounded-3xl p-4 space-y-3">
      <p className="text-sm font-bold text-foreground">개선 추이</p>

      {/* Metric tabs */}
      <div className="flex gap-1.5">
        {TREND_METRICS.map((m, i) => (
          <button
            key={m.key}
            onClick={() => setActiveIdx(i)}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95
              ${activeIdx === i ? 'text-white shadow-sm' : 'bg-secondary/60 text-muted-foreground'}`}
            style={activeIdx === i ? { backgroundColor: m.color } : {}}
          >
            {m.short}
          </button>
        ))}
      </div>

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ height: 140 }} aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={metric.color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Y grid + labels */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} y1={yPos(v)} x2={CW - PAD.r} y2={yPos(v)} stroke="#888" strokeOpacity={0.13} strokeWidth={1} />
            <text x={PAD.l - 4} y={yPos(v) + 3.5} textAnchor="end" fontSize={8} fill="#888">{v}</text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={metric.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.5} fill={metric.color} stroke="white" strokeWidth={1.5} />
        ))}

        {/* X labels */}
        {points.map((p, i) => (
          <text key={i} x={xPos(i)} y={CH - 4} textAnchor="middle" fontSize={8} fill="#888">{p.date}</text>
        ))}
      </svg>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">시작</p>
          <p className="text-sm font-bold text-muted-foreground">{first}pt</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">변화</p>
          <p className={`text-sm font-bold ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>
            {diff > 0 ? `+${diff}` : `${diff}`}pt
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">현재</p>
          <p className="text-sm font-bold" style={{ color: metric.color }}>{last}pt</p>
        </div>
      </div>
    </div>
  )
}

const STAGE_INFO: Record<number, { name: string; emoji: string }> = {
  1: { name: '호흡 훈련', emoji: '🫁' },
  2: { name: '볼륨 훈련', emoji: '📢' },
  3: { name: '강세 훈련', emoji: '🎯' },
  4: { name: '속도 훈련', emoji: '⚡' },
  5: { name: '종합 훈련', emoji: '🏆' },
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
        {loading ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} className="fill-primary" />}
        {open ? '닫기' : '듣기'}
      </button>
      {open && url && <audio controls autoPlay src={url} className="w-full h-9 mt-2 rounded-xl" />}
    </div>
  )
}

// ─── TrainingCalendar ─────────────────────────────────────────────────────────
interface CalendarProps {
  trainingDates: Set<string>
  selectedDate: string | null
  onSelectDate: (d: string) => void
  currentMonth: Date
  onPrevMonth: () => void
  onNextMonth: () => void
}

function TrainingCalendar({ trainingDates, selectedDate, onSelectDate, currentMonth, onPrevMonth, onNextMonth }: CalendarProps) {
  const todayStr = toDateStr(new Date())
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrevMonth} className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center active:scale-90 transition-transform">
          <ChevronLeft size={16} className="text-muted-foreground" />
        </button>
        <p className="text-sm font-bold text-foreground">{year}년 {month + 1}월</p>
        <button onClick={onNextMonth} className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center active:scale-90 transition-transform">
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <p key={d} className={`text-center text-[10px] font-semibold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-muted-foreground'}`}>{d}</p>
        ))}
      </div>
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
            <button key={i} onClick={() => onSelectDate(isSelected ? '' : dateStr)}
              className={`relative flex flex-col items-center justify-center h-9 rounded-xl transition-all active:scale-95 ${isSelected ? 'bg-primary shadow-md shadow-primary/30' : ''}`}>
              <span className={`text-xs font-semibold leading-none ${isSelected ? 'text-white' : isToday ? 'text-primary' : isSun ? 'text-red-400' : isSat ? 'text-blue-400' : hasTraining ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                {day}
              </span>
              {hasTraining && !isSelected && <span className="w-1 h-1 rounded-full bg-orange-400 mt-0.5" />}
              {isToday && !isSelected && <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-primary" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ArchiveClient() {
  const router = useRouter()
  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => toDateStr(today), [today])

  const [trainingLogs, setTrainingLogs] = useState<TrainingLog[]>([])
  const [qualityLogs, setQualityLogs] = useState<VoiceQualityLog[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: trainingData } = await (supabase as any)
        .from('user_training_logs')
        .select('stage_num, log_date, audio_url')
        .eq('user_id', user.id)
        .order('log_date', { ascending: false })
      if (trainingData) {
        setTrainingLogs(trainingData)
        setSelectedDate(todayStr)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: qualityData } = await (supabase as any)
        .from('voice_quality_logs')
        .select('stability_score, pace_score, expressiveness_score, logged_at')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: true })
      if (qualityData) setQualityLogs(qualityData)
    }
    loadData()
  }, [todayStr])

  // ── Derived data ────────────────────────────────────────────────────────────
  const trainingDates = useMemo(() => new Set(trainingLogs.map((l) => l.log_date)), [trainingLogs])

  const weekDates = useMemo(() => getWeekDates(today), [today])
  const weekTrainedCount = useMemo(
    () => weekDates.filter((d) => trainingDates.has(d)).length,
    [weekDates, trainingDates],
  )

  // This month's quality logs
  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const monthQualityLogs = useMemo(
    () => qualityLogs.filter((l) => l.logged_at.startsWith(monthPrefix)),
    [qualityLogs, monthPrefix],
  )

  // Monthly training count (distinct dates)
  const monthTrainingCount = useMemo(() => {
    const dates = new Set(trainingLogs.filter((l) => l.log_date.startsWith(monthPrefix)).map((l) => l.log_date))
    return dates.size
  }, [trainingLogs, monthPrefix])

  // Average score this month
  const avgScore = useMemo(() => {
    if (monthQualityLogs.length === 0) return null
    const sum = monthQualityLogs.reduce((acc, l) => acc + (l.stability_score + l.pace_score + l.expressiveness_score) / 3, 0)
    return Math.round(sum / monthQualityLogs.length)
  }, [monthQualityLogs])

  // Per-metric stats this month
  const metricStats = useMemo(() => {
    return METRIC_CONFIG.map((m) => ({
      ...m,
      stats: calcMetricStats(monthQualityLogs, m.key),
    }))
  }, [monthQualityLogs])

  // Best improvement metric
  const bestMetric = useMemo(() => {
    return metricStats
      .filter((m) => m.stats !== null && m.stats.diff > 0)
      .sort((a, b) => (b.stats!.diff) - (a.stats!.diff))[0] ?? null
  }, [metricStats])

  // Calendar
  const selectedLogs = useMemo(() => {
    if (!selectedDate) return []
    return trainingLogs.filter((l) => l.log_date === selectedDate).sort((a, b) => a.stage_num - b.stage_num)
  }, [trainingLogs, selectedDate])

  function prevMonth() { setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); setSelectedDate(null) }
  function nextMonth() { setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); setSelectedDate(null) }

  const monthLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월`

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-violet-700 to-indigo-700 px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">
            {monthLabel} · 아카이브
          </Badge>

          <h1 className="text-2xl font-black text-white leading-tight mb-1">
            목소리가 달라지고 있어요 ✨
          </h1>

          <p className="text-white/70 text-xs mb-5">
            이번 달 {monthTrainingCount}회 훈련
            {avgScore !== null ? ` · 평균 점수 ${avgScore}pt` : ''}
          </p>

          {/* Week day row */}
          <div className="flex items-center gap-1.5">
            {weekDates.map((dateStr, i) => {
              const isToday = dateStr === todayStr
              const isTrained = trainingDates.has(dateStr)
              return (
                <div key={dateStr} className="flex flex-col items-center gap-1">
                  <span className={`text-[10px] font-semibold ${isToday ? 'text-white' : isTrained ? 'text-white/90' : 'text-white/40'}`}>
                    {DOW_LABELS[i]}
                  </span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all
                    ${isToday
                      ? 'gradient-primary shadow-md shadow-primary/40 ring-2 ring-white/60'
                      : isTrained
                        ? 'bg-orange-400/80'
                        : 'bg-white/10'
                    }`}>
                    {isTrained && !isToday && <span className="text-[10px]">🔥</span>}
                    {isToday && <span className="text-[10px] font-black text-white">★</span>}
                  </div>
                </div>
              )
            })}
            <div className="ml-auto flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1">
              <Flame size={12} className="text-orange-300" />
              <span className="text-white text-[11px] font-bold">이번 주 {weekTrainedCount}일</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="px-4 mt-4 space-y-4">

        {/* Best improvement card */}
        {bestMetric ? (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-2 px-1">📊 지표 요약</p>
            <div className="rounded-3xl bg-[#1e1b4b] p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-indigo-300 font-semibold">
                    {bestMetric.label} — 이번 달 최고 성장
                  </p>
                  <p className="text-4xl font-black text-white mt-1">
                    +{bestMetric.stats!.diff}pt
                  </p>
                  <p className="text-[11px] text-indigo-200/70 mt-1">
                    {bestMetric.stats!.min}pt → {bestMetric.stats!.max}pt
                  </p>
                </div>
                <span className="text-3xl mt-1">{bestMetric.emoji}</span>
              </div>
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full gradient-primary transition-all duration-700"
                  style={{ width: `${bestMetric.stats!.max}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-indigo-200/60">
                <span>최저 {bestMetric.stats!.min}pt</span>
                <span>최고 {bestMetric.stats!.max}pt</span>
              </div>
            </div>
          </div>
        ) : monthQualityLogs.length === 0 ? (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-2 px-1">📊 지표 요약</p>
            <div className="glass rounded-3xl p-6 flex flex-col items-center gap-2 text-center">
              <span className="text-2xl">🎤</span>
              <p className="text-sm font-semibold text-foreground">아직 분석 기록이 없어요</p>
              <p className="text-xs text-muted-foreground">5단계 훈련 후 목소리 분석을 완료하면 지표가 쌓여요</p>
              <button
                onClick={() => router.push('/training/voice-check')}
                className="mt-2 flex items-center gap-1 text-xs text-primary font-semibold px-3 py-1.5 rounded-full bg-primary/10 active:scale-95 transition-transform"
              >
                지금 분석하러 가기 <ChevronRight size={13} />
              </button>
            </div>
          </div>
        ) : null}

        {/* Per-metric improvement rows */}
        {monthQualityLogs.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground px-1">📈 개선 추이 (이번 달 최저 → 최고)</p>
            {metricStats.map(({ key, label, emoji, desc, stats }) => {
              const s = stats ?? { min: 0, max: 0, diff: 0 }
              return (
                <div key={key} className="glass rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{emoji}</span>
                      <div>
                        <p className="text-xs font-bold text-foreground">{label}</p>
                        <p className="text-[10px] text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-black tabular-nums ${s.diff > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                        {s.diff > 0 ? `+${s.diff}pt` : `${s.max}pt`}
                      </span>
                      {s.diff > 0 && (
                        <p className="text-[10px] text-muted-foreground">{s.min}pt → {s.max}pt</p>
                      )}
                    </div>
                  </div>
                  {/* Dual bar: min and max */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">최저</span>
                      <div className="flex-1 h-2 bg-secondary/60 rounded-full overflow-hidden">
                        <div className="h-full bg-secondary rounded-full" style={{ width: `${s.min}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground w-6 shrink-0">{s.min}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-emerald-400 w-8 text-right shrink-0">최고</span>
                      <div className="flex-1 h-2 bg-secondary/60 rounded-full overflow-hidden">
                        <div className="h-full rounded-full gradient-primary" style={{ width: `${s.max}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-emerald-400 w-6 shrink-0">{s.max}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Trend chart */}
        {qualityLogs.length > 0 && <TrendChart logs={qualityLogs} />}

        {/* Training Calendar */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-2 px-1">🗓 훈련 캘린더</p>
          <TrainingCalendar
            trainingDates={trainingDates}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d || null)}
            currentMonth={currentMonth}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
          />
        </div>

        {/* Selected date training list */}
        {selectedDate && selectedLogs.length === 0 && (
          <div className="glass rounded-3xl p-5 flex flex-col items-center gap-2 py-8">
            <p className="text-2xl">📭</p>
            <p className="text-sm font-semibold text-foreground">{selectedDate.replace(/-/g, '.')} 훈련 기록 없음</p>
            <p className="text-xs text-muted-foreground">이 날은 훈련 기록이 없어요</p>
          </div>
        )}
        {selectedDate && selectedLogs.length > 0 && (
          <div className="glass rounded-3xl p-5 space-y-3">
            <p className="text-xs font-bold text-foreground">{selectedDate.replace(/-/g, '.')} 훈련 기록</p>
            {selectedLogs.map((log) => {
              const info = STAGE_INFO[log.stage_num]
              return (
                <div key={log.stage_num} className="flex items-center justify-between">
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
              )
            })}
          </div>
        )}

        {/* Quick action */}
        <div className="glass rounded-3xl p-4">
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
          <button
            onClick={() => router.push('/training/voice-check')}
            className="mt-2 w-full flex items-center gap-3 p-3 rounded-2xl bg-secondary/60 hover:bg-secondary active:scale-95 transition-all"
          >
            <span className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-md shrink-0">
              <TrendingUp size={16} className="text-white" />
            </span>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">훈련 후 목소리 측정</p>
              <p className="text-[11px] text-muted-foreground">목소리 변화를 기록해요</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>

      </div>
    </div>
  )
}
