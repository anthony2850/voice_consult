'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, ChevronRight, Pencil } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { CURRICULUM, CONCERN_LABELS } from '@/lib/curriculum'
import { nextDayNum, isDeepDay, type TrainingLog } from '@/lib/trainingCycle'
import { useConcerns } from '@/hooks/useConcerns'
import ConcernsModal from '@/components/training/ConcernsModal'
import { trackEvent } from '@/lib/analytics'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TrainingClient() {
  const router = useRouter()
  const todayStr = useMemo(() => toDateStr(new Date()), [])
  const [logs, setLogs] = useState<TrainingLog[]>([])
  const { concerns, save: saveConcerns } = useConcerns()
  const [editing, setEditing] = useState(false)

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
      if (data) setLogs(data as TrainingLog[])
    }
    load()
  }, [])

  const streak = useMemo(() => {
    const unique = [...new Set(logs.map((l) => l.log_date))].sort((a, b) => b.localeCompare(a))
    if (unique.length === 0) return 0
    const yesterday = new Date(todayStr)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = toDateStr(yesterday)
    if (unique[0] !== todayStr && unique[0] !== yesterdayStr) return 0
    let count = 0
    let expected = unique[0]
    for (const date of unique) {
      if (date === expected) {
        count++
        const d = new Date(expected)
        d.setDate(d.getDate() - 1)
        expected = toDateStr(d)
      } else if (date < expected) break
    }
    return count
  }, [logs, todayStr])

  const todayDayNum = useMemo(() => nextDayNum(logs), [logs])
  const todayDay = useMemo(() => CURRICULUM.find((d) => d.dayNum === todayDayNum)!, [todayDayNum])
  const todayIsDeep = useMemo(() => isDeepDay(todayDay.matchingConcerns, concerns), [todayDay, concerns])
  const alreadyDoneToday = useMemo(
    () => logs.some((l) => l.log_date === todayStr),
    [logs, todayStr],
  )

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">훈련 트랙</Badge>
          <h1 className="text-2xl font-black text-white mb-1">Voice Training</h1>
          <p className="text-white/80 text-xs mb-3">5일 사이클의 통합 코스</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
              <Flame size={14} className="text-orange-300" />
              <span className="text-white text-xs font-bold">{streak}일 연속</span>
            </div>
          </div>
        </div>
      </div>

      {/* Today's day card */}
      <div className="px-4 pt-6">
        <button
          onClick={() => {
            trackEvent('training_today_clicked', { day_num: todayDay.dayNum, deep: todayIsDeep })
            router.push(`/training/session/${todayDay.dayNum}`)
          }}
          className="w-full text-left rounded-3xl bg-secondary/60 hover:bg-secondary active:scale-[0.98] transition-all p-5"
        >
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wide mb-1">
            오늘의 단계 · Day {todayDay.dayNum} / 5
          </p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{todayDay.emoji}</span>
            <p className="text-base font-bold text-foreground">{todayDay.theme}</p>
          </div>
          {todayIsDeep && (
            <p className="text-[11px] font-semibold text-orange-400 mb-1">⚡ 당신의 핵심 단계예요</p>
          )}
          {alreadyDoneToday && (
            <p className="text-[11px] text-emerald-400 font-semibold">✓ 오늘 이미 완료 · 다시 진행 가능</p>
          )}
        </button>
      </div>

      {/* Other days */}
      <div className="px-4 pt-4">
        <p className="text-[11px] font-semibold text-muted-foreground mb-2">다른 단계 둘러보기</p>
        <div className="grid grid-cols-2 gap-2">
          {CURRICULUM.filter((d) => d.dayNum !== todayDay.dayNum).map((d) => (
            <button
              key={d.dayNum}
              onClick={() => router.push(`/training/session/${d.dayNum}`)}
              className="flex items-center gap-2 rounded-2xl bg-secondary/40 hover:bg-secondary/70 p-3 active:scale-95 transition-all"
            >
              <span className="text-lg">{d.emoji}</span>
              <div className="text-left">
                <p className="text-[10px] text-muted-foreground">Day {d.dayNum}</p>
                <p className="text-xs font-semibold text-foreground">{d.theme}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* My concerns */}
      <div className="px-4 pt-6">
        <button
          onClick={() => setEditing(true)}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-secondary/30 active:scale-[0.98] transition-all"
        >
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground">현재 고민</p>
            <p className="text-xs font-semibold text-foreground">
              {concerns.length === 0 ? '아직 선언 안 함' : concerns.map((c) => CONCERN_LABELS[c]).join(', ')}
            </p>
          </div>
          <Pencil size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Voice-check CTA */}
      <div className="px-4 mt-6">
        <button
          onClick={() => {
            trackEvent('voice_check_cta_clicked', { source: 'training_landing' })
            router.push('/training/voice-check')
          }}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border border-primary/40 bg-primary/10 active:scale-[0.98] transition-all"
        >
          <span className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0 text-base">🎤</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-primary">훈련 후 목소리 변화 측정</p>
            <p className="text-[11px] text-muted-foreground">전후 목소리 품질이 얼마나 달라졌는지 확인해요</p>
          </div>
          <ChevronRight size={16} className="text-primary shrink-0" />
        </button>
      </div>

      <ConcernsModal
        open={editing}
        initial={concerns}
        onClose={() => setEditing(false)}
        onSave={saveConcerns}
        title="고민 수정"
      />
    </div>
  )
}
