import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const VOICE_ANALYSIS_MODEL = 'gpt-audio-1.5'
const EMOTION_TOOL_NAME = 'record_voice_emotions'

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
 * Returns a 0–1 score per emotion, or null if the analysis is unusable.
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
      model: VOICE_ANALYSIS_MODEL,
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
                '강도(0.0~1.0)를 추정하고 제공된 함수로 기록하세요. ' +
                '키는 정확히 아래 영문 표기를 사용하세요.\n\n' +
                `감정 목록: ${EMOTIONS_TO_RATE.join(', ')}`,
            },
          ],
        },
      ],
      tools: [{
        type: 'function',
        function: {
          name: EMOTION_TOOL_NAME,
          description: '목소리에서 추정한 감정별 강도를 기록합니다.',
          parameters: {
            type: 'object',
            properties: Object.fromEntries(
              EMOTIONS_TO_RATE.map((name) => [name, {
                type: 'number',
                minimum: 0,
                maximum: 1,
              }]),
            ),
            required: EMOTIONS_TO_RATE,
            additionalProperties: false,
          },
        },
      }],
      tool_choice: {
        type: 'function',
        function: { name: EMOTION_TOOL_NAME },
      },
    }),
  })

  if (!response.ok) {
    console.error('[analyze-voice] OpenAI HTTP', response.status, (await response.text()).slice(0, 300))
    return null
  }

  const completion = await response.json()
  const toolCall = completion.choices?.[0]?.message?.tool_calls?.find(
    (call: { function?: { name?: string } }) => call.function?.name === EMOTION_TOOL_NAME,
  )
  const raw = toolCall?.function?.arguments
  if (!raw) {
    console.error('[analyze-voice] missing emotion tool call:', JSON.stringify(completion).slice(0, 500))
    return null
  }

  const parsed = parseEmotionJson(raw)
  if (!parsed) {
    console.error('[analyze-voice] unparseable content:', raw.slice(0, 500))
    return null
  }

  const hasCompleteValidScores = EMOTIONS_TO_RATE.every((name) => {
    const value = parsed[name]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
  })
  if (!hasCompleteValidScores) {
    console.error('[analyze-voice] incomplete or invalid emotion scores:', raw.slice(0, 500))
    return null
  }

  // Map the validated subset onto the canonical 49-emotion space.
  const emotions: Record<string, number> = {}
  for (const name of ALL_EMOTIONS) {
    const v = parsed[name]
    emotions[name] = typeof v === 'number' ? v : 0
  }
  return emotions
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { error: 'audio_file_required', retryable: false },
      { status: 400 },
    )
  }
  const audioFile = formData.get('audio') as Blob | null

  if (!process.env.OPENAI_API_KEY) {
    console.error('[analyze-voice] OPENAI_API_KEY not set')
    return NextResponse.json(
      { error: 'analysis_not_configured', retryable: false },
      { status: 503 },
    )
  }

  if (!audioFile) {
    return NextResponse.json(
      { error: 'audio_file_required', retryable: false },
      { status: 400 },
    )
  }

  let emotions: Record<string, number> | null = null
  try {
    console.log('[analyze-voice] Calling OpenAI, audio type:', audioFile.type, 'size:', audioFile.size)
    emotions = await analyzeWithOpenAI(audioFile)
    console.log('[analyze-voice] OpenAI result:', emotions ? `${Object.keys(emotions).length} emotions` : 'null (unusable response)')
  } catch (err) {
    console.error('[analyze-voice] OpenAI API error:', err)
  }

  if (!emotions) {
    return NextResponse.json(
      { error: 'analysis_unavailable', retryable: true },
      { status: 502 },
    )
  }

  console.log('[analyze-voice] Returning REAL data')

  return NextResponse.json({ emotions, source: 'openai', model: VOICE_ANALYSIS_MODEL })
}
