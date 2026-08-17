'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

const LAUNCH_PRICE = 4900

// ── Pre-register (Fake Door) — 훈련 프로그램 수요 검증 ────
export default function PreRegisterForm({ source }: { source: 'result_card' | 'training_landing' }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!isValid) {
      setEmailError('올바른 이메일 주소를 입력해 주세요.')
      return
    }
    setEmailError('')
    setLoading(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getSupabase().from('pre_registrations') as any).insert({ email, source })
    setLoading(false)

    if (error && error.code !== '23505') {
      // 23505 = unique_violation (이미 등록된 이메일)
      setEmailError('저장 중 오류가 발생했어요. 다시 시도해 주세요.')
      return
    }

    trackEvent('submit_pre_register', { email_domain: email.split('@')[1], source, price: LAUNCH_PRICE })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="glass rounded-3xl p-5 border border-primary/20 text-center">
        <Sparkles size={28} className="text-primary mx-auto mb-2" />
        <p className="text-sm font-bold text-foreground">사전 예약 완료!</p>
        <p className="text-xs text-muted-foreground mt-1">출시 시 가장 먼저 알려드릴게요.</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-3xl p-5 border border-primary/20">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl">🎙️</span>
        <div>
          <p className="text-sm font-bold text-foreground">
            더 정밀한 맞춤형 AI 발성 훈련 플랜 받아보기
          </p>
          <Badge className="mt-1 bg-accent/20 text-accent border-0 text-[10px]">사전 예약</Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-1">
        목소리 분석 결과를 바탕으로 개인 맞춤 AI 발성 훈련 플랜을 제공합니다. 출시 시 우선 안내 드립니다.
      </p>
      <p className="text-xs font-semibold text-foreground mb-4">
        정식 출시가 <span className="text-primary font-bold">4,900원</span> · 사전 등록하면 오픈 소식을 가장 먼저 받아요
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="email"
          placeholder="이메일 주소를 입력해 주세요"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
          className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {emailError && (
          <p className="text-xs text-destructive">{emailError}</p>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="w-full h-12 text-sm font-bold rounded-2xl gradient-primary border-0 shadow-lg shadow-primary/20 active:scale-95 transition-transform disabled:opacity-60"
        >
          {loading ? '저장 중...' : '사전 예약하기'}
        </Button>
      </form>
    </div>
  )
}
