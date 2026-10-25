import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { CALL_QUESTIONS, callQuestionAudio, onsetFeedback, paceFeedback, pickCallIndex, pickCallQuestion } from './callPractice'

describe('call practice', () => {
  it('every question opens like a phone call and avoids middle dots', () => {
    for (const q of CALL_QUESTIONS) {
      expect(q.startsWith('여보세요')).toBe(true)
      expect(q).not.toMatch(/·/)
    }
    expect(CALL_QUESTIONS).toContain(pickCallQuestion(() => 0.99))
  })
  it('every question has a recorded coach voice file', () => {
    for (let i = 0; i < CALL_QUESTIONS.length; i++) {
      expect(existsSync(`public${callQuestionAudio(i)}`), callQuestionAudio(i)).toBe(true)
    }
    expect(pickCallIndex(() => 0.99)).toBe(CALL_QUESTIONS.length - 1)
  })
  it('onset feedback bands', () => {
    expect(onsetFeedback(0.8).tone).toBe('good')
    expect(onsetFeedback(2.4).label).toBe('자연스러움')
    expect(onsetFeedback(4).tone).toBe('caution')
    expect(onsetFeedback(null).tone).toBe('neutral')
  })
  it('pace feedback bands', () => {
    expect(paceFeedback(5.5).label).toBe('적당')
    expect(paceFeedback(7.6).label).toBe('빠름')
    expect(paceFeedback(4).label).toBe('느긋')
    expect(paceFeedback(null).tone).toBe('neutral')
  })
})
