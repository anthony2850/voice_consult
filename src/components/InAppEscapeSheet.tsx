'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Copy, Check, X } from 'lucide-react'
import { IN_APP_NAME, buildEscapePlan } from '@/lib/inAppBrowser'
import { trackEvent } from '@/lib/analytics'

/**
 * 앱 안 브라우저에서 마이크가 거절됐을 때 올라오는 안내 창.
 * `url`은 밖에서 다시 열었을 때 하던 자리로 돌아오는 주소다.
 */
export function InAppEscapeSheet({ url, open, onClose, sub }: { url: string; open: boolean; onClose: () => void; sub?: string }) {
  const plan = useMemo(() => (typeof navigator === 'undefined' ? null : buildEscapePlan(url, navigator.userAgent)), [url])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open && plan) trackEvent('inapp_escape_shown', { app: plan.app, os: plan.os })
  }, [open, plan])

  if (!open || !plan) return null
  const name = IN_APP_NAME[plan.app]
  const browser = plan.os === 'ios' ? '사파리' : '크롬'

  const copy = async () => {
    trackEvent('inapp_escape_clicked', { app: plan.app, method: 'copy' })
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('이 주소를 복사해서 브라우저에 붙여 넣어 주세요', url)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] mx-auto w-full max-w-[480px]" role="dialog" aria-modal="true" aria-labelledby="inapp-title">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-foreground/50" />
      {/* 오른쪽 위 메뉴를 가리키는 화살표 */}
      {plan.manual[0].includes('오른쪽 위') && (
        <ArrowUpRight size={44} strokeWidth={2.5} className="absolute top-3 right-3 text-primary animate-bounce [animation-duration:1.4s]" aria-hidden="true" />
      )}
      <div className="absolute inset-x-0 bottom-0 rounded-t-[32px] bg-background px-5 pt-5 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">마이크를 켜려면</p>
            <h2 id="inapp-title" className="mt-1 text-[22px] leading-tight font-black tracking-[-0.02em] text-foreground">
              {name} 안에서는
              <br />
              마이크를 켤 수 없어요
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="shrink-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground">
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {browser}에서 열면 {sub ?? '고른 질문 그대로 바로 이어서 해요'}. 녹음은 저장하지 않아요.
        </p>

        {plan.button && (
          <a
            href={plan.button.href}
            onClick={() => trackEvent('inapp_escape_clicked', { app: plan.app, method: 'button' })}
            className="mt-5 flex w-full h-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-[17px] font-bold active:scale-[0.98] transition-transform"
          >
            {plan.button.label}
          </a>
        )}

        <div className="mt-4 rounded-2xl bg-secondary px-4 py-3.5">
          <p className="text-[12px] font-bold text-muted-foreground">{plan.button ? '버튼이 안 되면' : '여는 방법'}</p>
          <ol className="mt-1.5 space-y-1">
            {plan.manual.map((step, i) => (
              <li key={step} className="flex items-start gap-2.5 text-[15px] font-semibold text-foreground">
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-foreground text-white text-[11px] font-bold flex items-center justify-center tabular-nums">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <button
          type="button"
          onClick={copy}
          className="mt-3 w-full h-12 rounded-full border-2 border-border text-[15px] font-bold text-foreground inline-flex items-center justify-center gap-2 active:bg-secondary"
        >
          {copied ? <><Check size={17} /> 복사했어요</> : <><Copy size={17} /> 링크 복사</>}
        </button>
      </div>
    </div>
  )
}
