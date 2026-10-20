/**
 * 앱 안 브라우저(인스타그램, 카카오톡 등) 감지와 탈출 링크.
 *
 * 앱 안 브라우저는 마이크 허락 창을 띄우지 못해 녹음이 바로 실패한다.
 * 그래서 마이크가 거절됐을 때만 "밖에서 열기" 안내를 띄운다.
 * 아래 주소 규칙은 대부분 비공식이라 앱 업데이트로 막힐 수 있다.
 * 그래서 버튼이 안 될 때를 위해 손으로 여는 순서도 함께 보여 준다.
 */

export type InApp = 'instagram' | 'threads' | 'facebook' | 'kakaotalk' | 'line' | 'naver' | 'other'
export type MobileOS = 'ios' | 'android' | 'other'

export const IN_APP_NAME: Record<InApp, string> = {
  instagram: '인스타그램',
  threads: '스레드',
  facebook: '페이스북',
  kakaotalk: '카카오톡',
  line: '라인',
  naver: '네이버 앱',
  other: '이 앱',
}

export function detectInApp(ua: string): InApp | null {
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/Barcelona/i.test(ua)) return 'threads'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook'
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk'
  if (/\bLine\//i.test(ua)) return 'line'
  if (/NAVER\(inapp/i.test(ua)) return 'naver'
  // 안드로이드 웹뷰는 "; wv)"가 붙는다
  if (/Android/i.test(ua) && /; wv\)/i.test(ua)) return 'other'
  return null
}

export function detectOS(ua: string): MobileOS {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

export interface EscapePlan {
  app: InApp
  os: MobileOS
  /** 외부 브라우저로 여는 링크. 없으면 손으로 여는 방법만 보여 준다 */
  button: { label: string; href: string } | null
  /** 버튼이 안 될 때 손으로 여는 순서 */
  manual: string[]
}

const enc = (url: string) => encodeURIComponent(url)

export function buildEscapePlan(url: string, ua: string): EscapePlan | null {
  const app = detectInApp(ua)
  if (!app) return null
  const os = detectOS(ua)
  // 아래 링크는 모두 기기의 기본 브라우저를 연다. 사파리가 아닐 수 있으니 이름을 못 박지 않는다.
  const openLabel = '브라우저로 열기'

  let button: EscapePlan['button'] = null
  if (app === 'line') {
    // 라인이 공식으로 지원하는 방법
    const u = new URL(url)
    u.searchParams.set('openExternalBrowser', '1')
    button = { label: openLabel, href: u.toString() }
  } else if (app === 'kakaotalk') {
    button = { label: openLabel, href: `kakaotalk://web/openExternal?url=${enc(url)}` }
  } else if (os === 'android') {
    const bare = url.replace(/^https?:\/\//, '')
    button = {
      label: openLabel,
      href: `intent://${bare}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${enc(url)};end`,
    }
  } else if (os === 'ios') {
    if (app === 'instagram') button = { label: openLabel, href: `instagram://extbrowser/?url=${enc(url)}` }
    else if (app === 'threads') button = { label: openLabel, href: `barcelona://extbrowser/?url=${enc(url)}` }
    else button = { label: '사파리로 열기', href: url.replace(/^https?:\/\//, 'x-safari-https://') }
  }

  const manual =
    app === 'kakaotalk'
      ? ['오른쪽 아래 ⋯ 누르기', "'다른 브라우저로 열기' 누르기"]
      : app === 'line'
        ? ['오른쪽 아래 공유 버튼 누르기', "'브라우저에서 열기' 누르기"]
        : app === 'naver'
          ? ['오른쪽 아래 ⋯ 누르기', `'${openLabel}' 누르기`]
          : app === 'instagram' || app === 'threads' || app === 'facebook'
            ? ['오른쪽 위 ⋯ 누르기', "'외부 브라우저에서 열기' 누르기"]
            : ['화면의 메뉴(⋯ 또는 공유) 누르기', "'브라우저에서 열기' 누르기"]

  return { app, os, button, manual }
}
