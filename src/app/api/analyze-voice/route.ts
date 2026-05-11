import { NextRequest, NextResponse } from 'next/server'
import { HumeClient } from 'hume'

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

function averageEmotions(
  predictions: Array<{ emotions: Array<{ name: string; score: number }> }>
): Record<string, number> {
  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}
  for (const pred of predictions) {
    for (const e of pred.emotions) {
      sums[e.name] = (sums[e.name] ?? 0) + e.score
      counts[e.name] = (counts[e.name] ?? 0) + 1
    }
  }
  return Object.fromEntries(Object.keys(sums).map((k) => [k, sums[k] / counts[k]]))
}

async function callHumeApi(audioBlob: Blob): Promise<Record<string, number> | null> {
  const apiKey = process.env.HUME_API_KEY
  if (!apiKey) return null

  const client = new HumeClient({ apiKey })
  const buffer = Buffer.from(await audioBlob.arrayBuffer())
  const file = new File([new Uint8Array(buffer)], 'voice.webm', { type: 'audio/webm' })

  const job = await client.expressionMeasurement.batch.startInferenceJobFromLocalFile({
    file: [file],
    json: { models: { prosody: {} } },
  })

  await job.awaitCompletion()
  const predictions = await client.expressionMeasurement.batch.getJobPredictions(job.jobId)
  console.log('[hume] raw predictions count:', predictions.length)
  console.log('[hume] raw predictions[0]:', JSON.stringify(predictions[0], null, 2).slice(0, 500))

  const allPredictions: Array<{ emotions: Array<{ name: string; score: number }> }> = []
  for (const result of predictions) {
    console.log('[hume] result.results:', JSON.stringify(result.results, null, 2).slice(0, 500))
    for (const filePrediction of result.results?.predictions ?? []) {
      for (const group of filePrediction.models?.prosody?.groupedPredictions ?? []) {
        for (const pred of group.predictions) {
          allPredictions.push({
            emotions: pred.emotions.map((e) => ({ name: e.name, score: e.score })),
          })
        }
      }
    }
  }

  if (allPredictions.length === 0) return null
  return averageEmotions(allPredictions)
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

  if (!process.env.HUME_API_KEY) {
    console.warn('[analyze-voice] HUME_API_KEY not set — using mock data')
  } else if (!audioFile) {
    console.warn('[analyze-voice] No audio file received — using mock data')
  } else {
    try {
      console.log('[analyze-voice] Calling Hume API, audio type:', audioFile.type, 'size:', audioFile.size)
      emotions = await callHumeApi(audioFile)
      console.log('[analyze-voice] Hume API result:', emotions ? `${Object.keys(emotions).length} emotions` : 'null (empty predictions)')
    } catch (err) {
      console.error('[analyze-voice] Hume API error:', err)
    }
  }

  const usedMock = !emotions
  if (usedMock) emotions = getMockEmotions()
  console.log('[analyze-voice] Returning', usedMock ? 'MOCK' : 'REAL', 'data')

  return NextResponse.json({ emotions })
}
