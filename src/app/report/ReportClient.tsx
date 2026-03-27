'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function parseReportSections(text: string) {
  const lines = text.split('\n')
  const sections: { title: string; content: string }[] = []
  let current: { title: string; content: string } | null = null
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current)
      current = { title: line.replace('## ', ''), content: '' }
    } else if (current) {
      current.content += (current.content ? '\n' : '') + line
    }
  }
  if (current) sections.push(current)
  return sections
}

export default function ReportClient() {
  const router = useRouter()
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    async function loadReport() {
      let emotions: Record<string, number> | null = null
      try {
        const e = sessionStorage.getItem('voiceEmotions')
        emotions = e ? JSON.parse(e) : null
      } catch { /* noop */ }

      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + Math.random() * 5 + 2, 90))
      }, 300)

      try {
        const res = await fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emotions }),
        })
        const data = await res.json()
        setReport(data.report)
        setProgress(100)
      } catch {
        setReport(null)
      } finally {
        clearInterval(progressInterval)
        setLoading(false)
      }
    }
    loadReport()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-84px)] px-5 text-center">
        <div className="relative mb-8">
          <span className="absolute inset-0 rounded-full gradient-primary opacity-20 animate-ping scale-150" />
          <div className="relative w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-2xl shadow-primary/40">
            <Sparkles size={32} className="text-white animate-spin" style={{ animationDuration: '2s' }} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">리포트 생성 중이에요</h2>
        <p className="text-sm text-muted-foreground mb-8">감정 분석 데이터로 맞춤 인사이트를 작성하고 있어요</p>
        <div className="w-full max-w-[280px]">
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div className="h-full gradient-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{Math.floor(progress)}%</p>
        </div>
        <div className="mt-8 space-y-1.5">
          {[
            { at: 0,  text: '감정 패턴 해석 중...' },
            { at: 30, text: '감정 데이터 매핑 중...' },
            { at: 60, text: '인사이트 생성 중...' },
            { at: 85, text: '리포트 완성 중...' },
          ].map(({ at, text }) => (
            <p key={text} className={`text-xs transition-colors duration-500 ${progress >= at ? 'text-primary' : 'text-muted-foreground/30'}`}>
              {progress >= at ? '✓' : '○'} {text}
            </p>
          ))}
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-84px)] px-5 text-center gap-4">
        <p className="text-foreground font-semibold">리포트를 불러오지 못했어요</p>
        <Button onClick={() => router.push('/result')} variant="outline" className="rounded-2xl">
          결과 페이지로 돌아가기
        </Button>
      </div>
    )
  }

  const sections = parseReportSections(report)

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-5 pt-10 pb-14 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">
            📊 Voice Emotion 리포트
          </Badge>
          <h1 className="text-3xl font-black text-white mb-1">음성 분석 리포트</h1>
          <p className="text-white/70 text-xs mt-2">Hume AI 감정 분석 기반 맞춤 리포트</p>
        </div>
      </div>

      <div className="-mt-6 px-4 space-y-4">
        {sections.map((section, i) => (
          <div key={i} className="glass rounded-3xl p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">{section.title}</h2>
            <div className="space-y-2">
              {section.content.trim().split('\n').filter(Boolean).map((line, j) => (
                <p key={j} className="text-xs text-foreground/80 leading-relaxed">{line}</p>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push('/result')}
            className="flex-1 h-12 rounded-2xl border-border bg-secondary hover:bg-secondary/80 active:scale-95 transition-transform gap-2"
          >
            감정 분석 보기
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push('/record')}
            className="h-12 px-4 rounded-2xl border-border bg-secondary hover:bg-secondary/80 active:scale-95 transition-transform"
            aria-label="다시 분석"
          >
            <RotateCcw size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
