import { describe, it, expect, vi, beforeEach } from 'vitest'

const inserted: unknown[] = []
let sessionUser: string | null = null
vi.mock('./supabase', () => ({
  getSupabase: () => ({
    from: () => ({ insert: async (row: unknown) => { inserted.push(row); return { error: null } } }),
    auth: { getSession: async () => ({ data: { session: sessionUser ? { user: { id: sessionUser } } : null } }) },
  }),
}))

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size },
  }
}

const { savePendingGuestData, migrateGuestData, saveNewAnalysis, clearDeviceUserData } = await import('./guest-migration')

beforeEach(() => {
  vi.stubGlobal('sessionStorage', memoryStorage())
  vi.stubGlobal('localStorage', memoryStorage())
  inserted.length = 0
  sessionUser = null
})

const result = () => {
  sessionStorage.setItem('voiceEmotions', '{"Joy":0.3}')
  sessionStorage.setItem('audioFeatures', '{"duration_sec":20}')
}

describe('voice record saving', () => {
  it('moves a guest result to the account that logs in, once', async () => {
    result()
    savePendingGuestData()
    expect(await migrateGuestData('a')).toBe(true)
    expect(inserted).toHaveLength(1)
    // 같은 탭에서 다시 로그인해도 같은 결과를 또 넣지 않는다
    savePendingGuestData()
    expect(await migrateGuestData('a')).toBe(false)
    expect(inserted).toHaveLength(1)
  })

  it('does not hand a stale copy to whoever logs in later', async () => {
    result()
    savePendingGuestData()
    localStorage.setItem('pendingVoiceSavedAt', String(Date.now() - 31 * 60_000))
    expect(await migrateGuestData('b')).toBe(false)
    expect(inserted).toHaveLength(0)
    expect(localStorage.getItem('pendingVoiceEmotions')).toBeNull()
  })

  it('saves an analysis right away when signed in, and not again at the next login', async () => {
    result()
    sessionUser = 'a'
    await saveNewAnalysis({ Joy: 0.3 }, null)
    expect(inserted).toHaveLength(1)
    savePendingGuestData()
    expect(localStorage.getItem('pendingVoiceEmotions')).toBeNull()
  })

  it('logout clears the result, so the next account does not get it', async () => {
    result()
    localStorage.setItem('mytonePlan', '{}')
    clearDeviceUserData()
    expect(sessionStorage.getItem('voiceEmotions')).toBeNull()
    expect(localStorage.getItem('mytonePlan')).toBeNull()
    savePendingGuestData()
    expect(await migrateGuestData('b')).toBe(false)
    expect(inserted).toHaveLength(0)
  })
})
