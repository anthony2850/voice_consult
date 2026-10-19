/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    fbq?: (...args: any[]) => void
    dataLayer?: any[]
  }
}

export type EventParams = Record<string, string | number | boolean>

/**
 * GA4는 이벤트 값 이름 source, medium, campaign, term, content를 유입 경로로 해석해
 * 세션 출처를 덮어쓴다(2026-10-19: 녹음 버튼의 source:'button'이 유입 경로로 잡힘).
 * 이 이름은 쓰지 말고 from 같은 다른 이름을 쓴다. 개발 중에는 경고로 알린다.
 */
const RESERVED_PARAMS = ['source', 'medium', 'campaign', 'term', 'content']

/**
 * GA4 + Meta Pixel 동시 이벤트 트래킹 유틸리티
 */
export function trackEvent(eventName: string, params?: EventParams) {
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV !== 'production' && params) {
    const bad = Object.keys(params).filter((k) => RESERVED_PARAMS.includes(k))
    if (bad.length) console.warn(`[analytics] ${eventName}: ${bad.join(', ')}는 GA가 유입 경로로 읽는 이름이에요. from 등으로 바꾸세요.`)
  }

  // Google Analytics 4
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }

  // Meta (Facebook) Pixel
  if (typeof window.fbq === 'function') {
    window.fbq('trackCustom', eventName, params)
  }
}
