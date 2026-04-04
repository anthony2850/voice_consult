import { getSupabase } from './supabase'

/** OAuth 리다이렉트 전에 sessionStorage 데이터를 localStorage에 백업 */
export function savePendingGuestData() {
  try {
    const emotions = sessionStorage.getItem('voiceEmotions')
    const audioFeatures = sessionStorage.getItem('audioFeatures')
    if (emotions) localStorage.setItem('pendingVoiceEmotions', emotions)
    if (audioFeatures) localStorage.setItem('pendingAudioFeatures', audioFeatures)
  } catch { /* noop */ }
}

/** 로그인 후 localStorage 임시 데이터를 Supabase로 이관 */
export async function migrateGuestData(userId: string): Promise<boolean> {
  try {
    const emotionsRaw = localStorage.getItem('pendingVoiceEmotions')
    if (!emotionsRaw) return false

    const emotions = JSON.parse(emotionsRaw)
    const audioFeaturesRaw = localStorage.getItem('pendingAudioFeatures')
    const audio_features = audioFeaturesRaw ? JSON.parse(audioFeaturesRaw) : null

    const supabase = getSupabase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('user_voice_records') as any).insert({
      user_id: userId,
      emotions,
      audio_features,
    })

    if (error) {
      console.error('[migration] supabase insert failed:', error)
      return false
    }

    localStorage.removeItem('pendingVoiceEmotions')
    localStorage.removeItem('pendingAudioFeatures')
    return true
  } catch (err) {
    console.error('[migration] failed:', err)
    return false
  }
}
