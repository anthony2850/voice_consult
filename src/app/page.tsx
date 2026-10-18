import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import StartRecordButton, { StartRecordMic } from '@/components/StartRecordButton'
import HomeHero from '@/components/HomeHero'
import { LegalLinks } from '@/components/legal/LegalPage'

// What the analysis actually measures — keep in sync with lib/voiceScores.ts.
const METRICS = [
  { emoji: '〰️', name: '목소리 떨림', how: 'Jitter·Shimmer' },
  { emoji: '⏱️', name: '말 속도', how: '초당 음절 수' },
  { emoji: '🎵', name: '억양 변화', how: '피치 변화폭' },
  { emoji: '🔊', name: '목소리 크기', how: '평균 음량' },
]

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)]">
      {/* ── Top Bar ────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <div className="flex items-center gap-1.5">
          <Image src="/logo.png" alt="MyTone" width={96} height={32} className="object-contain" />
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-0"
          >
            AI
          </Badge>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center px-5 pt-6 pb-8 text-center">
        <div className="px-3 py-1.5 rounded-full glass text-xs text-muted-foreground mb-6">
          AI 보이스 코치
        </div>

        <HomeHero />

        {/* microphone animation — also tappable */}
        <StartRecordMic />

        {/* CTA button */}
        <StartRecordButton />
      </section>

      {/* ── What we measure ────────────────────────── */}
      <section className="px-5 pb-6">
        <div className="glass rounded-2xl px-5 py-5">
          <p className="text-sm font-bold text-foreground text-center mb-4">
            4가지를 수치로 측정해요
          </p>
          <div className="grid grid-cols-2 gap-2">
            {METRICS.map(({ emoji, name, how }) => (
              <div key={name} className="rounded-xl bg-secondary/60 px-3 py-2.5">
                <p className="text-xs font-semibold text-foreground">
                  <span className="mr-1">{emoji}</span>{name}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{how}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LegalLinks className="pb-4" />
    </div>
  )
}
