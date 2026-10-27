import { getSupabase } from './supabase'
import type { AudioFeatures } from './extractAudioFeatures'
import { clearLocalPlan, writePendingOnboarding } from './plan'
import { takePostLoginPath } from './postLogin'
import { SPEAK_PROMPT_KEY } from './speakPrompts'

/**
 * 목소리 분석 결과(감정 점수, 음향 수치)를 계정에 남긴다. 녹음은 남기지 않는다.
 * - 로그인한 채 분석하면 바로 저장한다.
 * - 로그인 전에 분석했으면, 로그인하러 갈 때 사본을 옮겨 두었다가 돌아와서 저장한다.
 * 이 탭의 결과를 이미 저장했으면 다시 저장하지 않는다. 같은 결과가 두 번, 또는 다른 계정에 들어가지 않게.
 */
const SAVED_KEY = 'voiceRecordSaved'
const PENDING_KEYS = ['pendingVoiceEmotions', 'pendingAudioFeatures', 'pendingVoiceSavedAt'] as const
/** 로그인하러 가며 옮겨 둔 사본은 이 시간 안에 돌아와야 쓴다. 로그인을 그만두면 다음에 로그인하는 사람에게 넘어가지 않게. */
const PENDING_TTL_MS = 30 * 60_000

async function insertRecord(userId: string, emotions: unknown, audio_features: unknown): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (getSupabase().from('user_voice_records') as any).insert({ user_id: userId, emotions, audio_features })
  if (error) console.error('[voice record] save failed:', error)
  return !error
}

function markSaved() {
  try { sessionStorage.setItem(SAVED_KEY, '1') } catch { /* noop */ }
}

function clearPending() {
  try { PENDING_KEYS.forEach((k) => localStorage.removeItem(k)) } catch { /* noop */ }
}

/** 새로 분석했을 때. 로그인했으면 바로 저장하고, 아니면 로그인할 때 저장한다. */
export async function saveNewAnalysis(emotions: Record<string, number>, features: AudioFeatures | null) {
  try {
    sessionStorage.removeItem(SAVED_KEY)
    const { data } = await getSupabase().auth.getSession()
    const userId = data.session?.user.id
    if (userId && await insertRecord(userId, emotions, features)) markSaved()
  } catch { /* 저장은 실패해도 결과 화면은 그대로 */ }
}

/** OAuth 리다이렉트 전에 아직 저장하지 않은 결과를 localStorage에 옮겨 둔다 */
export function savePendingGuestData() {
  try {
    clearPending()
    if (sessionStorage.getItem(SAVED_KEY)) return
    const emotions = sessionStorage.getItem('voiceEmotions')
    if (!emotions) return
    const audioFeatures = sessionStorage.getItem('audioFeatures')
    localStorage.setItem('pendingVoiceEmotions', emotions)
    if (audioFeatures) localStorage.setItem('pendingAudioFeatures', audioFeatures)
    localStorage.setItem('pendingVoiceSavedAt', String(Date.now()))
  } catch { /* noop */ }
}

/** 로그인 후 옮겨 둔 결과를 계정에 저장한다. 저장했으면 true. */
export async function migrateGuestData(userId: string): Promise<boolean> {
  try {
    const emotionsRaw = localStorage.getItem('pendingVoiceEmotions')
    if (!emotionsRaw) return false
    const savedAt = Number(localStorage.getItem('pendingVoiceSavedAt'))
    if (!savedAt || Date.now() - savedAt > PENDING_TTL_MS) {
      clearPending()
      return false
    }
    const audioFeaturesRaw = localStorage.getItem('pendingAudioFeatures')
    const ok = await insertRecord(userId, JSON.parse(emotionsRaw), audioFeaturesRaw ? JSON.parse(audioFeaturesRaw) : null)
    clearPending()
    if (ok) markSaved()
    return ok
  } catch (err) {
    console.error('[migration] failed:', err)
    clearPending()
    return false
  }
}

/**
 * 로그아웃할 때 이 기기에 남은 분석 결과, 계획, 온보딩 답을 지운다.
 * 같은 브라우저에서 다음에 로그인하는 사람의 계정에 앞사람 결과가 들어가거나 계획이 이어지지 않게.
 */
export function clearDeviceUserData() {
  try {
    ['voiceEmotions', 'audioFeatures', 'voiceAnalysisMeta', SAVED_KEY, SPEAK_PROMPT_KEY].forEach((k) => sessionStorage.removeItem(k))
  } catch { /* noop */ }
  clearPending()
  clearLocalPlan()
  writePendingOnboarding(null)
  takePostLoginPath()
}
