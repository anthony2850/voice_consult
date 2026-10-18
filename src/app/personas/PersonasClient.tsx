'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Mic } from 'lucide-react'
import { PERSONAS, QUADRANT_LABEL, sceneInk, sceneTint, type Quadrant } from '@/lib/personas'
import { trackEvent } from '@/lib/analytics'

const ORDER: Quadrant[] = ['up-clear', 'down-clear', 'down-cloudy', 'up-cloudy']

/** 여덟 가지 목소리 장면을 지도의 네 칸 순서로 보여 준다. */
export default function PersonasClient() {
  const router = useRouter()

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      <div className="px-4 pt-6 pb-2">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 active:opacity-60"
        >
          <ArrowLeft size={16} />
          돌아가기
        </button>
        <h1 className="text-xl font-black text-foreground">여덟 가지 목소리 장면</h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          목소리의 에너지(들뜸·차분)와 기분(맑음·흐림)으로 나눈 지도예요. 같은 사람도 날마다 다른 장면이 나올 수 있어요.
        </p>
      </div>

      <div className="px-4 space-y-5 mt-3">
        {ORDER.map((q) => (
          <section key={q} className="space-y-2">
            <h2 className="text-xs font-bold text-muted-foreground px-1">
              {QUADRANT_LABEL[q].energy} · {QUADRANT_LABEL[q].mood}
            </h2>
            {PERSONAS.filter((p) => p.quadrant === q).map((p) => (
              <article key={p.id} className="rounded-3xl p-5 space-y-2" style={{ background: sceneTint(p.color, 16) }}>
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full shrink-0" style={{ background: p.color }} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-foreground leading-snug">{p.name}</p>
                    <p className="text-xs font-medium" style={{ color: sceneInk(p.color) }}>{p.tagline}</p>
                  </div>
                </div>
                <p className="text-[13px] text-foreground/80 leading-relaxed">&ldquo;{p.script}&rdquo;</p>
              </article>
            ))}
          </section>
        ))}

        <button
          onClick={() => {
            trackEvent('personas_record_clicked')
            router.push('/record')
          }}
          className="w-full h-13 px-4 py-3.5 rounded-2xl gradient-primary text-gray-900 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#FFD700]/30 active:scale-[0.98] transition-transform"
        >
          <Mic size={16} />
          내 목소리는 어떤 장면일까?
        </button>
      </div>
    </div>
  )
}
