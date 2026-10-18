import { Suspense } from 'react'
import OnboardingClient from './OnboardingClient'

/** 훈련 온보딩 — 로그인 없이 답하고, 마지막에 "계획을 저장하려면 로그인"으로 잇는다. */
export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingClient />
    </Suspense>
  )
}
