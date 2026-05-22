import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const maxDuration = 60

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

  const openai = new OpenAI({ apiKey })
  const base64 = Buffer.from(await audioBlob.arrayBuffer()).toString('base64')

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini-audio-preview',
    messages: [
      {
        role: 'system',
        content:
          '당신은 음성 감정 분석 전문가입니다. 화자의 목소리(음색, 억양, 떨림, 말 속도, ' +
          '에너지, 휴지)를 듣고 49가지 감정이 각각 얼마나 드러나는지 평가합니다.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              '이 음성을 듣고 아래 49개 감정 각각의 강도를 0.0~1.0 사이 숫자로 평가해주세요.\n\n' +
              `감정 목록: ${ALL_EMOTIONS.join(', ')}\n\n` +
              '응답은 오직 JSON 객체 하나로만 출력하세요 — 49개 감정의 영어 이름을 key, ' +
              '0~1 숫자를 value로 합니다. 마크다운 코드블록이나 설명 없이 순수 JSON만 출력하세요.',
          },
          {
            type: 'input_audio',
            input_audio: { data: base64, format: 'wav' },
          },
        ],
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content
  if (!raw) return null

  const parsed = parseEmotionJson(raw)
  if (!parsed) return null

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
  return validCount >= 10 ? emotions : null
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
