import { afterEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from './route'

const VALID_EMOTIONS = {
  Adoration: 0.11,
  'Aesthetic Appreciation': 0.12,
  Amusement: 0.13,
  Anxiety: 0.14,
  Awkwardness: 0.15,
  Boredom: 0.16,
  Calmness: 0.71,
  Contemplation: 0.18,
  Contentment: 0.19,
  Disappointment: 0.2,
  Doubt: 0.21,
  Ecstasy: 0.22,
  Embarrassment: 0.23,
  'Empathic Pain': 0.24,
  Excitement: 0.25,
  Joy: 0.76,
  Love: 0.27,
  Nostalgia: 0.28,
  Realization: 0.29,
  Relief: 0.3,
  Romance: 0.31,
  Sadness: 0.08,
  'Surprise (positive)': 0.33,
  Tiredness: 0.34,
  Triumph: 0.35,
}

function requestWithAudio() {
  const form = new FormData()
  form.append('audio', new Blob(['RIFF-test-audio'], { type: 'audio/wav' }), 'voice.wav')
  return new NextRequest('http://localhost/api/analyze-voice', {
    method: 'POST',
    body: form,
  })
}

function openAIToolResponse(argumentsJson: string) {
  return new Response(JSON.stringify({
    id: 'chatcmpl_test',
    object: 'chat.completion',
    created: 1,
    model: 'gpt-audio-1.5',
    choices: [{
      index: 0,
      finish_reason: 'tool_calls',
      message: {
        role: 'assistant',
        content: null,
        refusal: null,
        tool_calls: [{
          id: 'call_test',
          type: 'function',
          function: {
            name: 'record_voice_emotions',
            arguments: argumentsJson,
          },
        }],
      },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete process.env.OPENAI_API_KEY
})

describe('POST /api/analyze-voice', () => {
  test('uses gpt-audio-1.5 function calling and identifies a real analysis response', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue(
      openAIToolResponse(JSON.stringify(VALID_EMOTIONS)),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(requestWithAudio())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      source: 'openai',
      model: 'gpt-audio-1.5',
      emotions: {
        Calmness: 0.71,
        Joy: 0.76,
        Anger: 0,
      },
    })
    expect(Object.keys(body.emotions)).toHaveLength(49)

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(requestBody.model).toBe('gpt-audio-1.5')
    expect(requestBody.tool_choice).toEqual({
      type: 'function',
      function: { name: 'record_voice_emotions' },
    })
    expect(requestBody.messages[0].content[0].type).toBe('input_audio')
  })

  test('returns a retryable error instead of random emotions when OpenAI fails', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{"error":"upstream unavailable"}', { status: 503 }),
    ))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(requestWithAudio())
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      error: 'analysis_unavailable',
      retryable: true,
    })
    expect(body).not.toHaveProperty('emotions')
  })

  test('rejects an incomplete emotion tool response', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const incompleteEmotions = { ...VALID_EMOTIONS }
    delete (incompleteEmotions as Partial<typeof VALID_EMOTIONS>).Triumph
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      openAIToolResponse(JSON.stringify(incompleteEmotions)),
    ))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(requestWithAudio())
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      error: 'analysis_unavailable',
      retryable: true,
    })
  })

  test('requires an audio file before calling OpenAI', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const request = new NextRequest('http://localhost/api/analyze-voice', {
      method: 'POST',
      body: new FormData(),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'audio_file_required',
      retryable: false,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('reports missing OpenAI configuration without returning emotions', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(requestWithAudio())

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: 'analysis_not_configured',
      retryable: false,
    })
  })
})
