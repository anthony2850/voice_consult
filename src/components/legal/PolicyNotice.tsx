'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { NOTICE_DAYS, PRIVACY_REVISIONS } from '@/lib/legal'

const DISMISS_KEY = 'mytonePolicyNoticeSeen'

/** 개인정보처리방침을 바꾼 뒤 NOTICE_DAYS 동안 홈 화면에 띄우는 한 줄 (방침 10절). 닫으면 다시 띄우지 않는다. */
export default function PolicyNotice() {
  const latest = PRIVACY_REVISIONS[0]
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!latest) return
    const until = new Date(`${latest.isoDate}T00:00:00`).getTime() + NOTICE_DAYS * 86_400_000
    let seen = false
    try { seen = localStorage.getItem(DISMISS_KEY) === latest.isoDate } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(Date.now() < until && !seen)
  }, [latest])

  if (!show || !latest) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, latest.isoDate) } catch { /* noop */ }
    setShow(false)
  }

  return (
    <div className="mx-5 mt-2 flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3" role="status">
      <p className="flex-1 text-[13px] text-foreground leading-snug">
        {latest.date}에 개인정보처리방침을 고쳤어요.{' '}
        <Link href="/privacy#changes" className="font-semibold underline underline-offset-2">바뀐 내용 보기</Link>
      </p>
      <button type="button" onClick={dismiss} aria-label="안내 닫기" className="w-8 h-8 -mr-1 shrink-0 flex items-center justify-center rounded-full text-muted-foreground active:bg-card">
        <X size={16} />
      </button>
    </div>
  )
}
