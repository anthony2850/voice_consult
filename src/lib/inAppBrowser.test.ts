import { describe, it, expect } from 'vitest'
import { buildEscapePlan, detectInApp, detectOS } from './inAppBrowser'

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0 Mobile Safari/537.36'
const URL_ = 'https://mytoneai.vercel.app/record?category=story&q=2'

describe('detectInApp', () => {
  it('recognizes the common in-app browsers', () => {
    expect(detectInApp(`${IOS} Instagram 330.0.0.0 (iPhone15,2; iOS 17_5; ko_KR)`)).toBe('instagram')
    expect(detectInApp(`${IOS} Barcelona 330.0.0.0`)).toBe('threads')
    expect(detectInApp(`${IOS} [FBAN/FBIOS;FBAV/450.0.0]`)).toBe('facebook')
    expect(detectInApp(`${ANDROID} KAKAOTALK/10.8.0`)).toBe('kakaotalk')
    expect(detectInApp(`${IOS} Line/14.5.0`)).toBe('line')
    expect(detectInApp(`${IOS} NAVER(inapp; search; 2000; 12.0.0)`)).toBe('naver')
    expect(detectInApp(ANDROID)).toBe('other')
  })
  it('leaves real browsers alone', () => {
    expect(detectInApp(`${IOS} Safari/604.1`)).toBeNull()
    expect(detectInApp('Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36')).toBeNull()
    expect(detectInApp('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15')).toBeNull()
  })
  it('tells iOS from Android', () => {
    expect(detectOS(IOS)).toBe('ios')
    expect(detectOS(ANDROID)).toBe('android')
    expect(detectOS('Mozilla/5.0 (X11; Linux x86_64)')).toBe('other')
  })
})

describe('buildEscapePlan', () => {
  it('returns nothing outside in-app browsers', () => {
    expect(buildEscapePlan(URL_, `${IOS} Safari/604.1`)).toBeNull()
  })
  it('iOS Instagram uses the extbrowser scheme and keeps the full URL', () => {
    const p = buildEscapePlan(URL_, `${IOS} Instagram 330.0.0.0`)!
    expect(p.button?.href).toBe(`instagram://extbrowser/?url=${encodeURIComponent(URL_)}`)
    expect(p.manual[0]).toContain('오른쪽 위')
  })
  it('Android in-app browsers use an intent URL with a fallback', () => {
    const p = buildEscapePlan(URL_, `${ANDROID} Instagram 330.0.0.0`)!
    expect(p.button?.href.startsWith('intent://mytoneai.vercel.app/record?category=story&q=2#Intent;scheme=https;')).toBe(true)
    expect(p.button?.href).toContain(`S.browser_fallback_url=${encodeURIComponent(URL_)};end`)
  })
  it('LINE uses its official query parameter', () => {
    const p = buildEscapePlan(URL_, `${IOS} Line/14.5.0`)!
    expect(p.button?.href).toBe(`${URL_}&openExternalBrowser=1`)
  })
  it('copy avoids middle dots', () => {
    for (const ua of [`${IOS} Instagram 1`, `${ANDROID} KAKAOTALK/1`, `${IOS} Line/1`, `${IOS} NAVER(inapp; 1)`, ANDROID]) {
      const p = buildEscapePlan(URL_, ua)!
      expect([p.button?.label ?? '', ...p.manual].join(' ')).not.toMatch(/·/)
    }
  })
})
