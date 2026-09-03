export type VoiceAnalysisResult = {
  emotions: Record<string, number>
  source: 'openai'
  model: string
}

export class VoiceAnalysisError extends Error {
  code: string
  retryable: boolean

  constructor(code: string, retryable: boolean) {
    super(code)
    this.name = 'VoiceAnalysisError'
    this.code = code
    this.retryable = retryable
  }
}

export function validateEmotionMap(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const entries = Object.entries(value)
  if (entries.length === 0) return null

  const isValid = entries.every(([, score]) => (
    typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1
  ))
  return isValid ? Object.fromEntries(entries) : null
}

export async function readVoiceAnalysisResponse(response: Response): Promise<VoiceAnalysisResult> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new VoiceAnalysisError('invalid_response', true)
  }

  if (!response.ok) {
    const errorBody = body && typeof body === 'object'
      ? body as { error?: unknown; retryable?: unknown }
      : {}
    throw new VoiceAnalysisError(
      typeof errorBody.error === 'string' ? errorBody.error : 'analysis_unavailable',
      typeof errorBody.retryable === 'boolean' ? errorBody.retryable : response.status >= 500,
    )
  }

  const result = body && typeof body === 'object'
    ? body as { emotions?: unknown; source?: unknown; model?: unknown }
    : {}
  const emotions = validateEmotionMap(result.emotions)
  if (!emotions || result.source !== 'openai' || typeof result.model !== 'string') {
    throw new VoiceAnalysisError('invalid_response', true)
  }

  return { emotions, source: 'openai', model: result.model }
}
