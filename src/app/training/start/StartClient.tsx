'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SCENE_LABELS, SCENE_ORDER, SCENE_SCRIPTS, type Scene } from '@/lib/curriculum'
import PrinciplesCard from '@/components/training/PrinciplesCard'
import { trackEvent } from '@/lib/analytics'
import { OptionCard, PageHeader, PrimaryButton, SCENE_ICON } from '@/components/ds'

/**
 * 새 트랙 시작: 상황 고르기 → 진단.
 * 고른 상황은 프로필에 저장하지 않는다. 진단을 마쳐야 트랙(상황 × 고민)이 바뀐다.
 */
export default function StartClient() {
  const router = useRouter()
  const [scene, setScene] = useState<Scene | null>(null)

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      <PageHeader
        back={{ label: '내 훈련', onClick: () => router.push('/training') }}
        eyebrow="새 트랙"
        title="어떤 상황에서 말하나요?"
        sub="그 상황의 문장으로 처음부터 끝까지 훈련해요."
      />

      <div className="px-5 pt-4 space-y-4">
        <div className="space-y-3" role="radiogroup" aria-label="상황">
          {SCENE_ORDER.map((s) => (
            <OptionCard
              key={s}
              icon={SCENE_ICON[s]}
              title={SCENE_LABELS[s].label}
              sub={SCENE_LABELS[s].hint}
              selected={scene === s}
              onSelect={() => { setScene(s); trackEvent('training_scene_selected', { scene: s }) }}
            />
          ))}
        </div>

        {scene && (
          <section className="rounded-[28px] border-2 border-border px-5 py-4">
            <p className="eyebrow">훈련 내내 연습할 문장</p>
            <p className="mt-1.5 text-[15px] text-foreground leading-relaxed">&ldquo;{SCENE_SCRIPTS[scene].short}&rdquo;</p>
          </section>
        )}

        <PrinciplesCard />

        <PrimaryButton
          disabled={!scene}
          onClick={() => {
            if (!scene) return
            trackEvent('training_diagnosis_cta', { scene })
            router.push(`/training/diagnose?scene=${scene}`)
          }}
        >
          진단 시작하기, 녹음 4번 약 3분
        </PrimaryButton>
        <p className="-mt-1 text-[13px] text-muted-foreground text-center leading-relaxed">
          쉬운 소리부터 실제 문장까지 차례로 녹음해서, 어디서부터 어려워지는지 찾아요. 고민은 진단 결과를 보고 골라요.
        </p>
      </div>
    </div>
  )
}
