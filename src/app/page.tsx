import Link from 'next/link'
import { Mic, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import StartRecordButton from '@/components/StartRecordButton'
import HomeHero from '@/components/HomeHero'

const SOCIAL_PROOF = [
  { emoji: '🎯', text: '98% 정확도' },
  { emoji: '⚡', text: '30초 분석' },
  { emoji: '🔒', text: '보이스 보안' },
]

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)]">
      {/* ── Top Bar ────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-black gradient-text">Voice Emotion</span>
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-0"
          >
            AI
          </Badge>
        </div>
        <Link href="/api/auth/signin">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground border border-border/60 rounded-full h-8 px-3 hover:bg-secondary hover:text-foreground"
          >
            카카오 로그인
          </Button>
        </Link>
      </header>

      {/* ── Hero ───────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center px-5 pt-6 pb-8 text-center">
        {/* floating badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-muted-foreground mb-6">
          <Sparkles size={12} className="text-accent" />
          <span>AI가 30만 개 목소리를 학습했어요</span>
        </div>

        {/* main headline */}
        <HomeHero />

        {/* microphone animation */}
        <div className="relative flex items-center justify-center mb-8">
          {/* pulse rings */}
          <span className="absolute w-36 h-36 rounded-full gradient-primary opacity-10 animate-ping" />
          <span className="absolute w-28 h-28 rounded-full gradient-primary opacity-15 animate-ping [animation-delay:0.3s]" />
          <div className="relative z-10 w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-2xl shadow-primary/40">
            <Mic size={34} className="text-white" strokeWidth={2} />
          </div>
        </div>

        {/* social proof chips */}
        <div className="flex items-center gap-2 mb-8">
          {SOCIAL_PROOF.map(({ emoji, text }) => (
            <span
              key={text}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full glass text-[11px] text-foreground/80 font-medium"
            >
              {emoji} {text}
            </span>
          ))}
        </div>

        {/* CTA button */}
        <StartRecordButton />
      </section>

      {/* ── Stats insight ──────────────────────────── */}
      <section className="px-5 pb-6">
        <div className="glass rounded-2xl px-5 py-5 text-center">
          <p className="text-[11px] text-muted-foreground mb-1.5">알고 계셨나요?</p>
          <p className="text-5xl font-black gradient-text mb-2">38%</p>
          <p className="text-xs text-foreground/80 leading-relaxed">
            상대방의 인상과 호감을 결정할 때<br />
            <span className="text-foreground font-semibold">목소리가 영향을 미치는 비율</span>이에요
          </p>
        </div>
      </section>
    </div>
  )
}
