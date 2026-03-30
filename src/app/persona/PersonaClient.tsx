'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PERSONAS, type Persona } from '@/lib/personas'

const EMOTION_KO: Record<string, string> = {
  'Admiration': '감탄',
  'Adoration': '경애',
  'Aesthetic Appreciation': '미적 감상',
  'Amusement': '즐거움',
  'Awe': '경외감',
  'Awkwardness': '어색함',
  'Calmness': '차분함',
  'Concentration': '집중',
  'Contemplation': '사색',
  'Contentment': '만족감',
  'Craving': '갈망',
  'Determination': '결단력',
  'Disappointment': '실망',
  'Doubt': '의심',
  'Ecstasy': '황홀감',
  'Empathic Pain': '공감적 아픔',
  'Enthusiasm': '열정',
  'Excitement': '흥분',
  'Interest': '호기심',
  'Joy': '기쁨',
  'Love': '사랑',
  'Nostalgia': '향수',
  'Pain': '아파함',
  'Pride': '자부심',
  'Realization': '깨달음',
  'Relief': '안도감',
  'Romance': '설렘',
  'Sympathy': '공감·위로',
  'Triumph': '승리감',
  'Surprise (positive)': '기분 좋은 놀람',
}

function PersonaCard({
  persona,
  selected,
  onSelect,
}: {
  persona: Persona
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-3xl p-4 border-2 transition-all duration-200 active:scale-[0.98] ${
        selected
          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
          : 'border-border/50 glass hover:border-primary/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{persona.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[10px] font-semibold text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full">
              {persona.category}
            </span>
          </div>
          <p className="text-sm font-bold text-foreground leading-snug">{persona.name}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{persona.description}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {persona.emotions.map((e) => (
              <span
                key={e}
                className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
              >
                {EMOTION_KO[e] ?? e}
              </span>
            ))}
          </div>
        </div>
        {selected && (
          <span className="shrink-0 w-5 h-5 rounded-full gradient-primary flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
    </button>
  )
}

export default function PersonaClient() {
  const router = useRouter()
  const [selected, setSelected] = useState<Persona | null>(null)

  const handleStart = () => {
    if (!selected) return
    sessionStorage.setItem('selectedPersona', JSON.stringify(selected))
    router.push('/record')
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] px-5 pt-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary mb-1">STEP 1</p>
        <h1 className="text-xl font-black text-foreground leading-tight">
          원하는 목소리 페르소나를
          <br />
          선택해 주세요
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          선택한 페르소나와 내 목소리의 차이를 분석해 드려요
        </p>
      </div>

      {/* Persona list */}
      <div className="space-y-3 mb-6">
        {PERSONAS.map((p) => (
          <PersonaCard
            key={p.id}
            persona={p}
            selected={selected?.id === p.id}
            onSelect={() => setSelected(p)}
          />
        ))}
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-[84px] left-0 right-0 px-5 pb-3 z-20">
        <div className="max-w-[480px] mx-auto">
          <Button
            size="lg"
            onClick={handleStart}
            disabled={!selected}
            className="w-full h-14 text-base font-bold rounded-2xl gradient-primary border-0 shadow-2xl shadow-primary/40 active:scale-95 transition-all disabled:opacity-40"
          >
            {selected ? (
              <>
                {selected.emoji}&nbsp;{selected.name}으로 분석하기
                <ChevronRight size={18} className="ml-1 opacity-80" />
              </>
            ) : (
              '페르소나를 선택해 주세요'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
