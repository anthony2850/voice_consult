'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, FileText, ChevronRight, LogIn, Clock, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import VoiceCompare from '@/components/VoiceCompare'

interface HistoryEntry {
  topEmotions: string[]
  analyzedAt: string
  hasPaidReport: boolean
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem('voiceEmotionHistory')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToHistory(emotions: Record<string, number> | null, hasPaidReport: boolean) {
  try {
    const top3 = emotions
      ? Object.entries(emotions).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name)
      : []
    const history = loadHistory()
    const entry: HistoryEntry = { topEmotions: top3, analyzedAt: new Date().toISOString(), hasPaidReport }
    const today = new Date().toDateString()
    const filtered = history.filter((h) => new Date(h.analyzedAt).toDateString() !== today)
    localStorage.setItem('voiceEmotionHistory', JSON.stringify([entry, ...filtered].slice(0, 10)))
  } catch { /* noop */ }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="glass rounded-2xl p-3 text-center">
      <p className="text-xl font-black gradient-text">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
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

export default function MyPage() {
  const router = useRouter()
  const [topEmotions, setTopEmotions] = useState<string[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [hasPaidReport, setHasPaidReport] = useState(false)
  const [hasAnalysis, setHasAnalysis] = useState(false)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('voiceEmotions')
      const emotions: Record<string, number> | null = stored ? JSON.parse(stored) : null
      const paid = sessionStorage.getItem('paidReport') === '1'
      setHasPaidReport(paid)

      if (emotions) {
        const top = Object.entries(emotions).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name)
        setTopEmotions(top)
        setHasAnalysis(true)
        saveToHistory(emotions, paid)
      }
      setHistory(loadHistory())
    } catch {
      setHistory(loadHistory())
    }
  }, [])

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">
            내 목소리 프로필
          </Badge>
          <h1 className="text-3xl font-black text-white mb-2">Voice Emotion</h1>
          {hasAnalysis && topEmotions.length > 0 ? (
            <div className="flex gap-2 flex-wrap mt-3">
              {topEmotions.map((e) => (
                <span key={e} className="bg-white/20 backdrop-blur text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                  {EMOTION_KO[e] ?? e}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-white/70 text-sm">아직 분석 결과가 없어요</p>
          )}
        </div>
      </div>

      <div className="mt-4 px-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard value={history.length} label="분석 횟수" />
          <StatCard value={hasPaidReport ? '1' : '0'} label="리포트 구매" />
        </div>

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

          {hasPaidReport ? (
            <button
              onClick={() => router.push('/report')}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-secondary/60 hover:bg-secondary active:scale-95 transition-all"
            >
              <span className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-md shrink-0">
                <FileText size={16} className="text-white" />
              </span>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">상세 리포트 보기</p>
                <p className="text-[11px] text-muted-foreground">구매한 AI 리포트를 확인해요</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          ) : (
            <button
              onClick={() => router.push('/checkout')}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-primary/10 border border-primary/20 active:scale-95 transition-all"
            >
              <span className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-md shrink-0">
                <FileText size={16} className="text-white" />
              </span>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">상세 리포트 받기</p>
                <p className="text-[11px] text-muted-foreground">AI 감정 분석 기반 · 990원</p>
              </div>
              <Badge className="bg-accent/20 text-accent border-0 text-[10px]">75% 할인</Badge>
            </button>
          )}
        </div>

        {/* Before / After 목소리 비교 대시보드 */}
        <VoiceCompare />

        {/* History */}
        {history.length > 0 && (
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground">분석 기록</h2>
            </div>
            <div className="space-y-2">
              {history.slice(0, 5).map((entry, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <span className="text-xl">🎤</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">
                      {entry.topEmotions.map((e) => EMOTION_KO[e] ?? e).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-muted-foreground">{formatDate(entry.analyzedAt)}</p>
                    {entry.hasPaidReport && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[9px] mt-0.5">리포트</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Login prompt */}
        <div className="glass rounded-3xl p-5 border border-border/60">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl">🔐</span>
            <div>
              <p className="text-sm font-bold text-foreground">카카오 로그인으로 저장하기</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                분석 결과와 리포트를 클라우드에 저장하고 어디서든 확인하세요
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => router.push('/api/auth/signin')}
            className="w-full h-12 rounded-2xl bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] border-0 font-bold active:scale-95 transition-transform gap-2"
          >
            <LogIn size={16} />
            카카오로 시작하기
          </Button>
        </div>

        <Button
          variant="outline"
          size="lg"
          onClick={() => router.push('/record')}
          className="w-full h-12 rounded-2xl border-border bg-secondary hover:bg-secondary/80 active:scale-95 transition-transform gap-2"
        >
          <RotateCcw size={16} />
          목소리 다시 분석하기
        </Button>
      </div>
    </div>
  )
}
