'use client'

import { getSupabase } from './supabase'

const BUCKET = 'training-recordings'

function getExt(blob: Blob): string {
  const type = blob.type.split(';')[0]
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('mp4') || type.includes('m4a')) return 'mp4'
  return 'webm'
}

export async function uploadTrainingAudio(
  userId: string,
  stageNum: number,
  date: string,
  blob: Blob,
): Promise<string | null> {
  try {
    const supabase = getSupabase()
    const ext = getExt(blob)
    const path = `${userId}/${date}/stage_${stageNum}.${ext}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: blob.type || 'audio/webm' })
    if (error) {
      console.error('[uploadTrainingAudio]', error)
      return null
    }
    return path
  } catch (err) {
    console.error('[uploadTrainingAudio]', err)
    return null
  }
}

export async function getTrainingAudioUrl(path: string): Promise<string | null> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600) // valid for 1 hour
    if (error || !data) return null
    return data.signedUrl
  } catch {
    return null
  }
}
