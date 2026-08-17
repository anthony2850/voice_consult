'use client'

import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { CURRICULUM } from '@/lib/curriculum'
import PreRegisterForm from '@/components/PreRegisterForm'
import { trackEvent } from '@/lib/analytics'

// ── 훈련 프로그램 fake door 랜딩 — 결제 없이 수요만 검증 ──
export default function PreRegisterLanding() {
  useEffect(() => {
    trackEvent('funnel_preregister_view')
  }, [])

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* ── Hero ── */}
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-10 pb-14 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">
            🔥 사전 등록 오픈
          </Badge>
          <h1 className="text-2xl font-black text-white mb-2">AI 발성 훈련 프로그램</h1>
          <p className="text-white/80 text-sm">
            내 목소리 분석 결과에 맞춘 5일 사이클 훈련.
            <br />지금 준비 중이에요 — 등록하면 오픈 소식을 가장 먼저 받아요.
          </p>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl font-black text-white">4,900</span>
            <span className="text-white/80 text-sm">원 (정식 출시가)</span>
          </div>
        </div>
      </div>

      <div className="-mt-6 px-4 space-y-4">
        {/* ── 커리큘럼 미리보기 ── */}
        <div className="glass rounded-3xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-3">이런 훈련을 받게 돼요</h2>
          <div className="space-y-2">
            {CURRICULUM.map((day) => (
              <div key={day.dayNum} className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
                <span className="text-xl w-8 text-center shrink-0">{day.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    Day {day.dayNum} · {day.theme}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{day.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 이메일 사전등록 ── */}
        <PreRegisterForm source="training_landing" />
      </div>
    </div>
  )
}
