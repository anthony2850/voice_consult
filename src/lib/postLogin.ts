/**
 * 로그인을 누른 화면을 기억했다가 OAuth 콜백 뒤 그리로 돌려보낸다.
 * OAuth는 다른 도메인을 거쳐 오므로 sessionStorage 대신 localStorage에 둔다.
 */
const KEY = 'mytonePostLoginPath'

/** 같은 사이트 경로만 받는다 ('/x'는 되고 '//x', 'https://x'는 안 됨) */
function isSafePath(p: unknown): p is string {
  return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//')
}

export function setPostLoginPath(path: string) {
  if (!isSafePath(path)) return
  try { localStorage.setItem(KEY, path) } catch { /* noop */ }
}

/** 읽고 지운다. 없으면 null. */
export function takePostLoginPath(): string | null {
  try {
    const p = localStorage.getItem(KEY)
    localStorage.removeItem(KEY)
    return isSafePath(p) ? p : null
  } catch {
    return null
  }
}
