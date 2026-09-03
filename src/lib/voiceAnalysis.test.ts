import { describe, expect, test } from 'vitest'

import { readVoiceAnalysisResponse, validateEmotionMap } from './voiceAnalysis'

describe('voice analysis response contract', () => {
  test('accepts a successful OpenAI analysis response', async () => {
    const response = new Response(JSON.stringify({
      emotions: { Calmness: 0.8, Joy: 0.6 },
      source: 'openai',
      model: 'gpt-audio-1.5',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

    await expect(readVoiceAnalysisResponse(response)).resolves.toEqual({
      emotions: { Calmness: 0.8, Joy: 0.6 },
      source: 'openai',
      model: 'gpt-audio-1.5',
    })
  })

  test('surfaces an API failure instead of accepting missing emotions', async () => {
    const response = new Response(JSON.stringify({
      error: 'analysis_unavailable',
      retryable: true,
    }), { status: 502, headers: { 'Content-Type': 'application/json' } })

    await expect(readVoiceAnalysisResponse(response)).rejects.toMatchObject({
      code: 'analysis_unavailable',
      retryable: true,
    })
  })

  test('rejects malformed stored emotion maps', () => {
    expect(validateEmotionMap(null)).toBeNull()
    expect(validateEmotionMap({ Calmness: 'high' })).toBeNull()
    expect(validateEmotionMap({ Calmness: 1.2 })).toBeNull()
    expect(validateEmotionMap({ Calmness: 0.8, Joy: 0.6 })).toEqual({ Calmness: 0.8, Joy: 0.6 })
  })
})
