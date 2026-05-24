import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// Full 49-emotion space — kept for the output contract (persona matching expects
// every key to exist, with 0 for emotions not present in the model's response).
const ALL_EMOTIONS = [
  'Admiration', 'Adoration', 'Aesthetic Appreciation', 'Amusement', 'Anger',
  'Anxiety', 'Awe', 'Awkwardness', 'Boredom', 'Calmness',
  'Concentration', 'Confusion', 'Contemplation', 'Contempt', 'Contentment',
  'Craving', 'Desire', 'Determination', 'Disappointment', 'Disgust',
  'Distress', 'Doubt', 'Ecstasy', 'Embarrassment', 'Empathic Pain',
  'Enthusiasm', 'Entrancement', 'Envy', 'Excitement', 'Fear',
  'Guilt', 'Horror', 'Interest', 'Joy', 'Love',
  'Nostalgia', 'Pain', 'Pride', 'Realization', 'Relief',
  'Romance', 'Sadness', 'Satisfaction', 'Shame', 'Surprise (negative)',
  'Surprise (positive)', 'Sympathy', 'Tiredness', 'Triumph',
]

// Subset actually referenced by the current 10 personas — what we ask the model
// to rate. Asking for all 49 triggers a refusal pattern in gpt-audio; a tighter
// prompt with audio-first ordering is reliable. Expand as personas grow.
const EMOTIONS_TO_RATE = [
  'Adoration', 'Aesthetic Appreciation', 'Amusement', 'Anxiety', 'Awkwardness',
  'Boredom', 'Calmness', 'Contemplation', 'Contentment', 'Disappointment',
  'Doubt', 'Ecstasy', 'Embarrassment', 'Empathic Pain', 'Excitement',
  'Joy', 'Love', 'Nostalgia', 'Realization', 'Relief',
  'Romance', 'Sadness', 'Surprise (positive)', 'Tiredness', 'Triumph',
]

/** Extract the first balanced JSON object from a model response. */
function parseEmotionJson(text: string): Record<string, unknown> | null {
  try {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    const parsed = JSON.parse(text.slice(start, end + 1))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * Analyze voice emotion with OpenAI's audio model.
 * Returns a 0–1 score per emotion, or null if the analysis is unusable
 * (so the caller can fall back to mock data).
 */
async function analyzeWithOpenAI(audioBlob: Blob): Promise<Record<string, number> | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const base64 = Buffer.from(await audioBlob.arrayBuffer()).toString('base64')

  // Raw fetch instead of the OpenAI SDK — Next.js patches global fetch for
  // caching/dedup and the patched fetch silently drops the input_audio block
  // on large bodies when invoked through the SDK from a route handler.
  // `cache: 'no-store'` opts out of Next's caching layer explicitly.
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-audio',
      modalities: ['text'],
      // Audio block FIRST (text after) — empirically reliable. Reversing or
      // adding a system prompt makes gpt-audio refuse / ask for the audio.
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: { data: base64, format: 'wav' },
            },
            {
              type: 'text',
              text:
                '위 오디오에 담긴 화자의 목소리 톤·발성·운율을 듣고 다음 감정 각각의 ' +
                '강도(0.0~1.0)를 추정해 JSON 객체 하나로 응답하세요. ' +
                'JSON 외 다른 텍스트, 설명, 거절 메시지는 절대 포함하지 마세요. ' +
                '키는 정확히 아래 영문 표기를 사용하세요.\n\n' +
                `예시 응답: {"Joy": 0.7, "Calmness": 0.4, "Sadness": 0.1, ...}\n\n` +
                `감정 목록: ${EMOTIONS_TO_RATE.join(', ')}`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    console.error('[analyze-voice] OpenAI HTTP', response.status, (await response.text()).slice(0, 300))
    return null
  }

  const completion = await response.json()
  const raw = completion.choices?.[0]?.message?.content
  if (!raw) {
    console.error('[analyze-voice] empty content from OpenAI:', JSON.stringify(completion).slice(0, 500))
    return null
  }

  const parsed = parseEmotionJson(raw)
  if (!parsed) {
    console.error('[analyze-voice] unparseable content:', raw.slice(0, 500))
    return null
  }

  // Map onto the canonical 49-emotion space, clamped to [0, 1]
  const emotions: Record<string, number> = {}
  let validCount = 0
  for (const name of ALL_EMOTIONS) {
    const v = parsed[name]
    if (typeof v === 'number' && isFinite(v)) {
      emotions[name] = Math.max(0, Math.min(1, v))
      validCount++
    } else {
      emotions[name] = 0
    }
  }

  // Require a reasonable fraction of emotions to be filled, else treat as failure
  if (validCount < 10) {
    console.error('[analyze-voice] only', validCount, 'valid emotions; raw content:', raw.slice(0, 500))
    return null
  }
  return emotions
}

function getMockEmotions(): Record<string, number> {
  return Object.fromEntries(
    ALL_EMOTIONS.map((name) => [name, Math.random() * 0.14 + 0.01])
  )
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'audio file required' }, { status: 400 })
  }
  const audioFile = formData.get('audio') as Blob | null

  let emotions: Record<string, number> | null = null

  if (!process.env.OPENAI_API_KEY) {
    console.warn('[analyze-voice] OPENAI_API_KEY not set — using mock data')
  } else if (!audioFile) {
    console.warn('[analyze-voice] No audio file received — using mock data')
  } else {
    try {
      console.log('[analyze-voice] Calling OpenAI, audio type:', audioFile.type, 'size:', audioFile.size)
      emotions = await analyzeWithOpenAI(audioFile)
      console.log('[analyze-voice] OpenAI result:', emotions ? `${Object.keys(emotions).length} emotions` : 'null (unusable response)')
    } catch (err) {
      console.error('[analyze-voice] OpenAI API error:', err)
    }
  }

  const usedMock = !emotions
  if (usedMock) emotions = getMockEmotions()
  console.log('[analyze-voice] Returning', usedMock ? 'MOCK' : 'REAL', 'data')

  return NextResponse.json({ emotions })
}
