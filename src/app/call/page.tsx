import { Suspense } from 'react'
import CallClient from './CallClient'

/** 연습 전화 — 캘린더 알림을 누르면 열린다. 로그인 없이도 받을 수 있다. */
export default function CallPage() {
  return (
    <Suspense>
      <CallClient />
    </Suspense>
  )
}
