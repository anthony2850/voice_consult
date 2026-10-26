/**
 * 발음 또렷함: 녹음을 글자로 바꾼 결과가 원래 문장과 몇 % 맞는지.
 * "처음 듣는 사람도 알아듣는가"를 음성 인식이 대신 판단한다. 본인은 문장을 알고 있어서
 * 다시 들으면 뭉개진 글자도 들리기 때문에, 자기 판단만으로는 거의 늘 통과한다.
 */
import { getSupabase } from './supabase'

/** 비교 전에 띄어쓰기, 문장부호, "/" 같은 표시를 지운다. */
export function normalizeForClarity(s: string): string {
  return s.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
}

/** 글자 단위 편집 거리 */
function editDistance(a: string, b: string): number {
  const A = [...a], B = [...b]
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j)
  for (let i = 1; i <= A.length; i++) {
    const cur = [i]
    for (let j = 1; j <= B.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[B.length]
}

/** 원래 문장 대비 맞은 글자 비율(0~100). 문장에 글자가 없으면 null. */
export function clarityPct(script: string, heard: string): number | null {
  const ref = normalizeForClarity(script)
  if (!ref) return null
  const d = editDistance(ref, normalizeForClarity(heard))
  return Math.max(0, Math.round((1 - d / [...ref].length) * 1000) / 10)
}

/** 녹음을 글자로 바꾼다. 로그인한 사용자만 쓸 수 있다. 실패하면 null. */
export async function transcribe(blob: Blob): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession()
    const token = data.session?.access_token
    if (!token) return null
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type || 'audio/webm' },
      body: blob,
    })
    if (!res.ok) return null
    const json = await res.json()
    return typeof json.text === 'string' ? json.text : null
  } catch {
    return null
  }
}
