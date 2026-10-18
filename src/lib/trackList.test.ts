import { describe, it, expect } from 'vitest'
import { listTracks, relativeDay, type TrackRow } from './trackList'

function row(over: Partial<TrackRow>): TrackRow {
  return { kind: 'session', created_at: '2026-10-10T12:00:00', concern: 'trembling', scene: 'presentation', rung: 2, next_rung: 2, ...over }
}

describe('listTracks', () => {
  it('groups by scene × concern, counts sessions without the diagnosis, takes the latest rung', () => {
    const tracks = listTracks([
      row({ created_at: '2026-10-12T12:00:00', next_rung: 3 }),
      row({ created_at: '2026-10-11T12:00:00', next_rung: 2 }),
      row({ created_at: '2026-10-10T12:00:00', kind: 'diagnosis', next_rung: 2 }),
      row({ created_at: '2026-10-09T12:00:00', scene: 'interview', concern: 'fast', next_rung: 1 }),
    ], { scene: null, concern: null, rung: null })
    expect(tracks).toHaveLength(2)
    expect(tracks[0]).toMatchObject({ scene: 'presentation', concern: 'trembling', rung: 3, sessions: 2, lastAt: '2026-10-12T12:00:00' })
    expect(tracks[1]).toMatchObject({ scene: 'interview', concern: 'fast', sessions: 1 })
  })

  it('puts the current track first and uses its saved rung, even if older', () => {
    const tracks = listTracks([
      row({ created_at: '2026-10-12T12:00:00', scene: 'interview', concern: 'fast' }),
      row({ created_at: '2026-10-01T12:00:00', next_rung: 2 }),
    ], { scene: 'presentation', concern: 'trembling', rung: 4 })
    expect(tracks[0]).toMatchObject({ scene: 'presentation', concern: 'trembling', rung: 4, current: true })
    expect(tracks[1].current).toBe(false)
  })

  it('shows the current track even with no rows yet', () => {
    const tracks = listTracks([], { scene: 'call', concern: 'diction', rung: 4 })
    expect(tracks).toEqual([{ scene: 'call', concern: 'diction', rung: 4, sessions: 0, lastAt: null, current: true }])
  })

  it('skips rows without scene or concern', () => {
    expect(listTracks([row({ scene: null }), row({ concern: null })], { scene: null, concern: null, rung: null })).toEqual([])
  })
})

describe('relativeDay', () => {
  const now = new Date('2026-10-18T09:00:00')
  it('uses calendar days', () => {
    expect(relativeDay('2026-10-18T01:00:00', now)).toBe('오늘')
    expect(relativeDay('2026-10-17T23:00:00', now)).toBe('어제')
    expect(relativeDay('2026-10-15T12:00:00', now)).toBe('3일 전')
    expect(relativeDay(null, now)).toBe('아직 안 함')
  })
})
