import Image from 'next/image'
import { Activity, AudioWaveform, Gauge, Volume2 } from 'lucide-react'
import StartRecordButton, { StartRecordMic } from '@/components/StartRecordButton'
import HomeHero from '@/components/HomeHero'
import { LegalLinks } from '@/components/legal/LegalPage'

// What the analysis actually measures — keep in sync with lib/voiceScores.ts.
const METRICS = [
  { icon: AudioWaveform, name: '목소리 떨림', how: '"아~" 3초로 재요' },
  { icon: Gauge, name: '말 속도', how: '1초에 말한 글자 수' },
  { icon: Activity, name: '억양 변화', how: '높낮이가 출렁이는 정도' },
  { icon: Volume2, name: '세기 변화', how: '소리 크기가 출렁이는 정도' },
]

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)]">
      {/* ── Top Bar ────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <Image src="/logo.png" alt="MyTone" width={96} height={32} className="object-contain" />
      </header>

      {/* ── Hero ───────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center px-5 pt-6 pb-8 text-center">
        <p className="eyebrow mb-4">AI 보이스 코치</p>

        <HomeHero />

        {/* microphone animation — also tappable */}
        <StartRecordMic />

        {/* CTA button */}
        <StartRecordButton />
      </section>

      {/* ── What we measure ────────────────────────── */}
      <section className="px-5 pb-6">
        <div className="rounded-[28px] bg-secondary p-5">
          <p className="text-[16px] font-black text-foreground text-center mb-4">4가지를 수치로 재요</p>
          <div className="grid grid-cols-2 gap-2">
            {METRICS.map(({ icon: Icon, name, how }) => (
              <div key={name} className="rounded-2xl bg-card px-3.5 py-3">
                <Icon size={18} className="text-accent" aria-hidden="true" />
                <p className="mt-1.5 text-[14px] font-bold text-foreground">{name}</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">{how}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LegalLinks className="pb-4" />
    </div>
  )
}
