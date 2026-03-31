'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Sparkles, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk'

type Step = 'summary' | 'widget' | 'processing'

const FEATURES = [
  { icon: '🎙', title: 'AI 감정 분석', desc: '49가지 감정 지표 정밀 측정' },
  { icon: '💬', title: '대인관계 스타일 분석', desc: '내 목소리가 주는 인상과 소통 패턴' },
  { icon: '⚡', title: '스트레스 반응 패턴', desc: '감정이 목소리에 미치는 영향' },
  { icon: '💼', title: '커리어 인사이트', desc: '목소리 강점을 살릴 수 있는 분야' },
  { icon: '🌱', title: '맞춤 성장 가이드', desc: '목소리 매력을 높이는 구체적 팁' },
]

const AMOUNT = 990
const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? 'test_ck_placeholder'

export default function CheckoutClient() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('summary')
  const [fakeProgress, setFakeProgress] = useState(0)
  const [orderId] = useState(() => `voice-mbti-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const widgetRef = useRef<PaymentWidgetInstance | null>(null)
  const paymentMethodRef = useRef<ReturnType<PaymentWidgetInstance['renderPaymentMethods']> | null>(null)

  // Load Toss widget when step === 'widget'
  useEffect(() => {
    if (step !== 'widget') return
    let cancelled = false

    ;(async () => {
      const { loadPaymentWidget } = await import('@tosspayments/payment-widget-sdk')
      if (cancelled) return
      const widget = await loadPaymentWidget(CLIENT_KEY, PaymentWidget.ANONYMOUS)
      if (cancelled) return
      widgetRef.current = widget
      paymentMethodRef.current = widget.renderPaymentMethods(
        '#toss-payment-widget',
        { value: AMOUNT },
        { variantKey: 'DEFAULT' }
      )
      widget.renderAgreement('#toss-agreement', { variantKey: 'AGREEMENT' })
    })()

    return () => { cancelled = true }
  }, [step])

  // AI 분석 fake progress (결제 후)
  useEffect(() => {
    if (step !== 'processing') return
    let v = 0
    const id = setInterval(() => {
      v += Math.random() * 8 + 2
      if (v >= 100) {
        v = 100
        clearInterval(id)
        setTimeout(() => router.push('/result?paid=1'), 600)
      }
      setFakeProgress(Math.min(v, 100))
    }, 200)
    return () => clearInterval(id)
  }, [step, router])

  const handleRequestPayment = async () => {
    if (!widgetRef.current) return
    try {
      await widgetRef.current.requestPayment({
        orderId,
        orderName: '목소리 음성 분석 리포트',
        successUrl: `${window.location.origin}/result/success`,
        failUrl: `${window.location.origin}/checkout?error=payment_failed`,
        customerName: '고객',
      })
    } catch (err: unknown) {
      const tosErr = err as { code?: string; message?: string }
      if (tosErr?.code === 'USER_CANCEL') return   // 사용자 취소 — 조용히 처리
      console.error('[Payment request error]', tosErr)
    }
  }

  // ── AI 분석 로딩 화면 ───────────────────────────────────
  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-84px)] px-5 text-center">
        <div className="relative mb-8">
          <span className="absolute inset-0 rounded-full gradient-primary opacity-20 animate-ping scale-150" />
          <div className="relative w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-2xl shadow-primary/40">
            <Sparkles size={32} className="text-white animate-spin" style={{ animationDuration: '2s' }} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">AI가 분석 중이에요</h2>
        <p className="text-sm text-muted-foreground mb-8">목소리의 파형·음색·에너지 패턴을 읽고 있어요</p>
        <div className="w-full max-w-[280px]">
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div className="h-full gradient-primary rounded-full transition-all duration-200" style={{ width: `${fakeProgress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{Math.floor(fakeProgress)}%</p>
        </div>
        <div className="mt-10 space-y-2">
          {[
            { at: 0,  text: '음성 파형 추출 중...' },
            { at: 30, text: '음색 특성 분류 중...' },
            { at: 60, text: '성격 유형 매핑 중...' },
            { at: 85, text: '리포트 생성 중...' },
          ].map(({ at, text }) => (
            <p key={text} className={`text-xs transition-colors duration-500 ${fakeProgress >= at ? 'text-primary' : 'text-muted-foreground/30'}`}>
              {fakeProgress >= at ? '✓' : '○'} {text}
            </p>
          ))}
        </div>
      </div>
    )
  }

  // ── 토스 결제 위젯 화면 ─────────────────────────────────
  if (step === 'widget') {
    return (
      <div className="flex flex-col min-h-[calc(100vh-84px)] px-5 pt-6 pb-4">
        <button onClick={() => setStep('summary')} className="text-sm text-muted-foreground mb-4 flex items-center gap-1 hover:text-foreground transition-colors">
          ← 뒤로
        </button>
        <h2 className="text-lg font-bold text-foreground mb-4">결제 수단 선택</h2>

        {/* Toss widget mount points */}
        <div id="toss-payment-widget" className="mb-3" />
        <div id="toss-agreement" className="mb-5" />

        <div className="flex-1" />

        <button
          onClick={handleRequestPayment}
          className="w-full h-14 text-base font-bold rounded-2xl gradient-primary text-white shadow-xl shadow-primary/30 active:scale-95 transition-transform"
        >
          990원 결제하기
        </button>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mt-2">
          <Lock size={11} />
          <span>토스페이먼츠 안전 결제</span>
        </div>
      </div>
    )
  }

  // ── 요약 화면 (default) ────────────────────────────────
  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] px-5 pt-6 pb-4">
      <div className="mb-6">
        <Badge className="mb-2 bg-primary/20 text-primary border-0 text-[11px]">음성 분석 리포트</Badge>
        <h1 className="text-xl font-bold text-foreground">AI 맞춤 리포트 받기</h1>
        <p className="text-sm text-muted-foreground mt-1">AI 감정 분석 기반 상세 리포트를 제공합니다</p>
      </div>

      <div className="space-y-3 mb-6">
        {FEATURES.map(({ icon, title, desc }) => (
          <div key={title} className="glass rounded-2xl p-3.5 flex items-center gap-3">
            <span className="text-2xl w-10 text-center shrink-0">{icon}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <ShieldCheck size={16} className="ml-auto text-primary shrink-0" />
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-4 mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">분석 리포트 열람</p>
          <p className="text-2xl font-black text-foreground">
            990<span className="text-base font-normal text-muted-foreground ml-0.5">원</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground line-through">3,900원</p>
          <Badge className="bg-accent/20 text-accent border-0 text-[11px]">75% 할인</Badge>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-5">
        <Lock size={11} />
        <span>토스페이먼츠 안전 결제 · 카드/카카오페이/네이버페이</span>
      </div>

      <div className="flex-1" />

      <button
        onClick={() => setStep('widget')}
        className="w-full h-14 text-base font-bold rounded-2xl gradient-primary text-white shadow-xl shadow-primary/30 active:scale-95 transition-transform"
      >
        990원으로 결과 보기 →
      </button>
      <p className="text-center text-[11px] text-muted-foreground mt-2">결제 후 즉시 분석 결과를 확인할 수 있어요</p>
    </div>
  )
}

// Toss anonymous customer key constant
const PaymentWidget = { ANONYMOUS: 'ANONYMOUS' as const }
