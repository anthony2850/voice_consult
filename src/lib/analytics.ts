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
 * GA4 + Meta Pixel 동시 이벤트 트래킹 유틸리티
 */
export function trackEvent(eventName: string, params?: EventParams) {
  if (typeof window === 'undefined') return

  // Google Analytics 4
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }

  // Meta (Facebook) Pixel
  if (typeof window.fbq === 'function') {
    window.fbq('trackCustom', eventName, params)
  }
}
