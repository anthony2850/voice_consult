'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SCENE_LABELS, SCENE_ORDER, SCENE_SCRIPTS, type Scene } from '@/lib/curriculum'
import PrinciplesCard from '@/components/training/PrinciplesCard'
import { trackEvent } from '@/lib/analytics'

/**
 * 새 트랙 시작: 상황 고르기 → 진단.
 * 고른 상황은 프로필에 저장하지 않는다. 진단을 마쳐야 트랙(상황 × 고민)이 바뀐다.
 */
export default function StartClient() {
  const router = useRouter()
  const [scene, setScene] = useState<Scene | null>(null)

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-6 pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <button
            onClick={() => router.push('/training')}
            className="flex items-center gap-1 text-xs text-white/80 hover:text-white mb-4"
          >
            <ArrowLeft size={14} /> 내 훈련
          </button>
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">새 트랙</Badge>
          <h1 className="text-2xl font-black text-white mb-1">어떤 상황에서 말하나요?</h1>
          <p className="text-white/80 text-sm">그 상황의 문장으로 처음부터 끝까지 훈련해요.</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {SCENE_ORDER.map((s) => {
            const sel = scene === s
            return (
              <button
                key={s}
                onClick={() => { setScene(s); trackEvent('training_scene_selected', { scene: s }) }}
                className={`text-left rounded-2xl p-4 transition-all active:scale-[0.98] ${
                  sel ? 'bg-primary/15 border border-primary/50' : 'glass'
                }`}
              >
                <span className="text-2xl">{SCENE_LABELS[s].emoji}</span>
                <p className="text-sm font-bold text-foreground mt-1">{SCENE_LABELS[s].label}</p>
                <p className="text-[11px] text-muted-foreground">{SCENE_LABELS[s].hint}</p>
              </button>
            )
          })}
        </div>

        {scene && (
          <div className="rounded-2xl bg-secondary/60 px-4 py-3">
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">훈련 내내 연습할 문장</p>
            <p className="text-sm text-foreground leading-relaxed">&ldquo;{SCENE_SCRIPTS[scene].short}&rdquo;</p>
          </div>
        )}

        <PrinciplesCard />

        <button
          disabled={!scene}
          onClick={() => {
            if (!scene) return
            trackEvent('training_diagnosis_cta', { scene })
            router.push(`/training/diagnose?scene=${scene}`)
          }}
          className="w-full h-13 px-4 py-3.5 rounded-2xl gradient-primary text-gray-900 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#FFD700]/30 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          진단 시작하기 — 녹음 4번, 약 3분
          <ChevronRight size={16} className="opacity-70" />
        </button>
        <p className="text-[11px] text-muted-foreground text-center">
          쉬운 소리부터 실제 문장까지 차례로 녹음해서, 어디서부터 어려워지는지 찾아요. 고민은 진단 결과를 보고 골라요.
        </p>
      </div>
    </div>
  )
}
