'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { trackEvent } from '@/lib/analytics'

const REPORT_SECTIONS = [
  { icon: '🎙', title: '목소리가 말하는 나의 본모습', desc: '감정 패턴이 드러내는 성격과 내면' },
  { icon: '💬', title: '대인관계에서 내 목소리의 영향', desc: '상대방이 받는 인상과 소통 강점' },
  { icon: '⚡', title: '스트레스 상황에서 목소리 변화', desc: '감정이 격해질 때의 변화와 관리법' },
  { icon: '💼', title: '직업/커리어에서 목소리 활용법', desc: '내 감정 패턴에 잘 맞는 역할' },
  { icon: '🌱', title: '목소리로 성장하는 방법', desc: '매력을 높이는 구체적 연습 팁' },
]

// ── 990원 리포트 페이월 티저 ──────────────────────────────
export default function ReportTeaser() {
  const router = useRouter()
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    // Client-only read: localStorage isn't available during SSR/first paint,
    // so paid status is determined post-hydration to avoid a mismatch.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaid(!!localStorage.getItem('paidOrderId'))
    } catch { /* noop */ }
  }, [])

  const handleClick = () => {
    if (paid) {
      router.push('/report')
      return
    }
    trackEvent('funnel_report_cta_click')
    router.push('/checkout')
  }

  return (
    <div className="glass rounded-3xl p-5 border border-primary/20">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-foreground">AI 상세 리포트</h2>
        {!paid && (
          <Badge className="bg-primary/20 text-primary border-0 text-[10px]">990원</Badge>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {REPORT_SECTIONS.map(({ icon, title, desc }) => (
          <div key={title} className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
            <span className="text-xl w-8 text-center shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">{title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
            </div>
            {!paid && <Lock size={14} className="text-muted-foreground/60 shrink-0" />}
          </div>
        ))}
      </div>

      <button
        onClick={handleClick}
        className="w-full h-13 px-4 py-3.5 rounded-2xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
      >
        {paid ? '내 리포트 보기 →' : '990원으로 전체 리포트 보기 →'}
      </button>
      {!paid && (
        <p className="text-center text-[11px] text-muted-foreground mt-2">
          <span className="line-through mr-1">3,900원</span>75% 할인 · 결제 후 즉시 열람
        </p>
      )}
    </div>
  )
}
