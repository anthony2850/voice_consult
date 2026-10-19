import { describe, it, expect } from 'vitest'
import { buildPracticeIcs, daysTrainedThisWeek, isPlan } from './plan'

describe('daysTrainedThisWeek', () => {
  const wed = new Date('2026-10-21T12:00:00') // Wednesday
  it('counts distinct days from Monday through today', () => {
    expect(daysTrainedThisWeek(['2026-10-19', '2026-10-19', '2026-10-21', '2026-10-18'], wed)).toBe(2)
  })
  it('Sunday belongs to the week that started the previous Monday', () => {
    const sun = new Date('2026-10-25T09:00:00')
    expect(daysTrainedThisWeek(['2026-10-19', '2026-10-25'], sun)).toBe(2)
  })
})

describe('buildPracticeIcs', () => {
  const now = new Date('2026-10-21T12:00:00')
  it('repeats on the right weekdays at the chosen time, starting tomorrow', () => {
    const ics = buildPracticeIcs({ weeklyGoal: 3, time: 'evening', selfConcern: null }, now)
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR')
    expect(ics).toContain('DTSTART:20261022T210000')
    expect(ics).toContain('DTEND:20261022T211000')
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('URL:https://mytoneai.vercel.app/call?from=calendar')
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR')
  })
  it('daily goal uses all seven days', () => {
    expect(buildPracticeIcs({ weeklyGoal: 7, time: 'morning', selfConcern: 'fast' }, now)).toContain('BYDAY=MO,TU,WE,TH,FR,SA,SU')
  })
})

describe('isPlan', () => {
  it('accepts a valid plan and rejects junk', () => {
    expect(isPlan({ weeklyGoal: 5, time: 'midday', selfConcern: 'trembling' })).toBe(true)
    expect(isPlan({ weeklyGoal: 4, time: 'midday', selfConcern: null })).toBe(false)
    expect(isPlan(null)).toBe(false)
  })
})
