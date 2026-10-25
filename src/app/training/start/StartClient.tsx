'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CONCERN_ORDER, SCENE_LABELS, SCENE_ORDER, SCENE_SCRIPTS, type ConcernSlug, type Scene } from '@/lib/curriculum'
import { getSpeakCategory, readStoredPrompt } from '@/lib/speakPrompts'
import PrinciplesCard from '@/components/training/PrinciplesCard'
import { trackEvent } from '@/lib/analytics'
import { OptionCard, PageHeader, PrimaryButton, SCENE_ICON } from '@/components/ds'

/**
 * 트랙 시작: 연습할 문장 고르기 → 진단.
 * 상황에 따라 실제로 달라지는 건 문장뿐이라, 상황 이름 대신 문장을 보여 주고 고르게 한다.
 * 고른 문장(상황)은 프로필에 저장하지 않는다. 진단을 마쳐야 트랙(상황 × 고민)이 바뀐다.
 */
export default function StartClient() {
  const router = useRouter()
  const params = useSearchParams()
  const qConcern = params.get('concern')
  const concern: ConcernSlug | null = CONCERN_ORDER.includes(qConcern as ConcernSlug) ? (qConcern as ConcernSlug) : null
  // 방금 목소리 분석에서 고른 말하기 방식에 맞는 문장을 미리 골라 둔다 (자기소개 → 면접)
  const [scene, setScene] = useState<Scene | null>(() => {
    const spoken = typeof window === 'undefined' ? null : readStoredPrompt()
    return spoken ? getSpeakCategory(spoken.category).scene : null
  })

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      <PageHeader
        back={{ label: '내 훈련', onClick: () => router.push('/training') }}
        eyebrow={concern ? '첫 트랙' : '새 트랙'}
        title="어떤 문장으로 연습할까요?"
        sub="트랙 내내 이 문장으로 재요. 다른 문장은 새 트랙으로 시작할 수 있어요."
      />

      <div className="px-5 pt-4 space-y-4">
        <div className="space-y-3" role="radiogroup" aria-label="연습 문장">
          {SCENE_ORDER.map((s) => (
            <OptionCard
              key={s}
              icon={SCENE_ICON[s]}
              title={`“${SCENE_SCRIPTS[s].short}”`}
              sub={SCENE_LABELS[s].label}
              selected={scene === s}
              onSelect={() => { setScene(s); trackEvent('training_scene_selected', { scene: s }) }}
            />
          ))}
        </div>

        <PrinciplesCard />

        <PrimaryButton
          disabled={!scene}
          onClick={() => {
            if (!scene) return
            trackEvent('training_diagnosis_cta', { scene })
            router.push(`/training/diagnose?scene=${scene}${concern ? `&concern=${concern}` : ''}`)
          }}
        >
          진단 시작하기, 녹음 4번 약 3분
        </PrimaryButton>
        <p className="-mt-1 text-[13px] text-muted-foreground text-center leading-relaxed">
          쉬운 소리부터 이 문장까지 차례로 녹음해서, 어디서부터 어려워지는지 찾아요.
        </p>
      </div>
    </div>
  )
}
