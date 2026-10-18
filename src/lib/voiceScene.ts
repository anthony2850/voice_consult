/**
 * 목소리 장면 판정 — 순수 함수.
 * 설계: docs/superpowers/specs/2026-10-18-voice-scene-persona-design.md (5절)
 *
 * - 에너지(들뜸↔차분): 음향 각성 60% + 모델 각성 40%. 음향이 없으면 모델만.
 *   음향은 성별·마이크 차이를 피하려고 상대값(변동계수)만 쓴다.
 * - 기분(맑음↔흐림): 모델 감정 원점수. 음향만으로는 기분이 덜 정확하다(Juslin & Laukka, 2003).
 */
import type { AudioFeatures } from './voiceDB'
import { EMOTION_KO } from './emotions'
import { JITTER_LIMIT } from './trainingCycle'
import { PERSONAS, getPersona, type Persona, type PersonaId, type Quadrant } from './personas'

// ─── 모델에게 물을 감정 ───────────────────────────────────────────────────────

const AROUSAL_HIGH = ['Excitement', 'Ecstasy', 'Triumph', 'Amusement', 'Anxiety']
const AROUSAL_LOW = ['Calmness', 'Tiredness', 'Boredom', 'Contemplation']
const MOOD_CLEAR = [
  'Joy', 'Excitement', 'Ecstasy', 'Triumph', 'Amusement', 'Adoration', 'Love',
  'Calmness', 'Contentment', 'Relief', 'Aesthetic Appreciation', 'Romance',
]
const MOOD_CLOUDY: [string, number][] = [
  ['Tiredness', 1], ['Boredom', 1], ['Disappointment', 1], ['Sadness', 1], ['Awkwardness', 1],
  ['Embarrassment', 1], ['Anxiety', 1], ['Doubt', 1], ['Nostalgia', 0.5],
]

/** /api/analyze-voice가 모델에게 묻는 감정 (22개). 목록이 길면 gpt-audio가 거절한다. */
export const SCENE_EMOTIONS: string[] = [
  ...new Set([
    ...MOOD_CLEAR, ...MOOD_CLOUDY.map(([e]) => e), ...AROUSAL_HIGH, ...AROUSAL_LOW,
    ...PERSONAS.flatMap((p) => p.signature),
  ]),
].sort()

// ─── 기준값 ─────────────────────────────────────────────────────────────────
// 출발점 추정치. 2026-10 기준 지금 분석 방식의 기록이 없어 연구·훈련 기준으로 정했다.
// 실제 분포가 쌓이면 다시 맞춘다 (설계 6절).
// 감정 축: gpt-audio는 대부분 0, 나머지는 0.1 단위로 답한다(2026-10-18 실측). 그래서 평균 차가 ±0.1 안팎이다.
export const SCENE_REF = {
  pitchCV: { mean: 0.18, sd: 0.06 },
  // onsets_per_second는 음절이 아니라 '소리가 1.3배 이상 커지는 순간' 수라 실측이 초당 1회 안팎이다
  // (2026-10 기록 13건 평균 0.8, 예시 녹음 1.26). 음절 기준(4~5회)으로 두면 모두 '느림'이 된다.
  rate: { mean: 1.0, sd: 0.35 },
  rmsCV: { mean: 1.0, sd: 0.2 },
  arousalEm: { mean: 0, sd: 0.12 },
  mood: { mean: 0, sd: 0.06 },
}
/** 이 안쪽이면 두 칸의 경계 */
export const BORDER = 0.1
/** 칸 안 두 장면의 대표 감정 차이가 이보다 작으면 음향으로 가른다 */
const SIGNATURE_TIE = 0.05

const clamp = (x: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, x))
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const z = (x: number, ref: { mean: number; sd: number }) => (x - ref.mean) / ref.sd
const sc = (e: Record<string, number>, k: string) => (Number.isFinite(e[k]) ? e[k] : 0)

// ─── 축 점수 ────────────────────────────────────────────────────────────────

export interface AcousticZ {
  pitchCV: number | null
  rate: number | null
  rmsCV: number | null
  /** 떨림 — 기준치 대비. 0.7 근처가 보통 */
  jitter: number | null
}

export function acousticZ(f: AudioFeatures | null | undefined): AcousticZ | null {
  if (!f) return null
  const pm = f.pitch?.mean_hz, ps = f.pitch?.std_hz
  const rm = f.energy?.rms_mean, rs = f.energy?.rms_std
  const rate = f.rhythm?.onsets_per_second
  const vq = f.voice_quality
  const limit = vq?.source === 'praat' ? JITTER_LIMIT.praat : JITTER_LIMIT.frame
  const out: AcousticZ = {
    pitchCV: pm && pm > 0 && Number.isFinite(ps) ? z(ps / pm, SCENE_REF.pitchCV) : null,
    rate: Number.isFinite(rate) && rate > 0 ? z(rate, SCENE_REF.rate) : null,
    rmsCV: rm && rm > 0 && Number.isFinite(rs) ? z(rs / rm, SCENE_REF.rmsCV) : null,
    jitter: vq && Number.isFinite(vq.jitter_rel_pct) && vq.jitter_rel_pct > 0 ? (vq.jitter_rel_pct / limit - 0.7) / 0.3 : null,
  }
  return out.pitchCV == null && out.rate == null && out.rmsCV == null ? null : out
}

/** 에너지 −1(차분) ~ +1(들뜸) */
export function energyScore(emotions: Record<string, number>, az: AcousticZ | null): number {
  const em = clamp(z(mean(AROUSAL_HIGH.map((k) => sc(emotions, k))) - mean(AROUSAL_LOW.map((k) => sc(emotions, k))), SCENE_REF.arousalEm) / 2)
  if (!az) return em
  const parts = [az.pitchCV, az.rate, az.rmsCV].filter((x): x is number => x != null)
  const ac = clamp(mean(parts) / 2)
  return clamp(0.6 * ac + 0.4 * em)
}

/** 기분 −1(흐림) ~ +1(맑음) */
export function moodScore(emotions: Record<string, number>): number {
  const clear = mean(MOOD_CLEAR.map((k) => sc(emotions, k)))
  const wsum = MOOD_CLOUDY.reduce((a, [, w]) => a + w, 0)
  const cloudy = MOOD_CLOUDY.reduce((a, [k, w]) => a + sc(emotions, k) * w, 0) / wsum
  return clamp(z(clear - cloudy, SCENE_REF.mood) / 2)
}

export function quadrantOf(energy: number, mood: number): Quadrant {
  if (energy >= 0) return mood >= 0 ? 'up-clear' : 'up-cloudy'
  return mood >= 0 ? 'down-clear' : 'down-cloudy'
}

// ─── 장면 고르기 ─────────────────────────────────────────────────────────────

const signatureScore = (p: Persona, e: Record<string, number>) => mean(p.signature.map((k) => sc(e, k)))

/** 대표 감정이 비슷할 때 칸 안의 둘을 음향으로 가른다. true면 칸의 첫째 장면. */
function acousticTieBreak(q: Quadrant, az: AcousticZ): boolean | null {
  const v = (x: number | null) => x ?? 0
  switch (q) {
    case 'up-clear': // concert: 세기·속도가 더 큼 / puppy: 억양 출렁임이 더 큼
      return (v(az.rmsCV) + v(az.rate)) / 2 >= v(az.pitchCV)
    case 'down-clear': // cafe-book: 속도 보통 / sunday: 더 느림
      return az.rate == null ? null : az.rate >= -0.5
    case 'down-cloudy': // clock-out: 억양이 더 평평 / 3am: 더 느리고 작음
      return az.pitchCV == null ? null : az.pitchCV <= (v(az.rate) + v(az.rmsCV)) / 2
    case 'up-cloudy': // holiday: 떨림이 더 큼 / crush: 억양 출렁임이 더 큼
      return v(az.jitter) >= v(az.pitchCV)
  }
}

export type CueKey = 'fast' | 'slow' | 'wide' | 'flat' | 'strong' | 'soft' | 'shaky' | 'steady' | 'emotion'

export interface Cue {
  key: CueKey
  /** key === 'emotion'일 때 감정 이름 (영문 키) */
  emotion?: string
}

export interface SceneResult {
  id: PersonaId
  second: PersonaId
  energy: number
  mood: number
  border: boolean
  cues: Cue[]
}

export function pickScene(emotions: Record<string, number>, features?: AudioFeatures | null): SceneResult {
  const az = acousticZ(features)
  const energy = energyScore(emotions, az)
  const mood = moodScore(emotions)
  const q = quadrantOf(energy, mood)
  const [a, b] = PERSONAS.filter((p) => p.quadrant === q)
  const sa = signatureScore(a, emotions), sb = signatureScore(b, emotions)
  const close = Math.abs(sa - sb) < SIGNATURE_TIE
  const tie = close && az ? acousticTieBreak(q, az) : null
  const first = tie == null ? sa >= sb : tie
  const chosen = first ? a : b
  const sibling = first ? b : a

  let second: Persona = sibling
  if (!close) {
    // 0에 더 가까운 축의 건너편 칸
    const flipped = Math.abs(energy) < Math.abs(mood) ? quadrantOf(-energy || -0.01, mood) : quadrantOf(energy, -mood || -0.01)
    const [c, d] = PERSONAS.filter((p) => p.quadrant === flipped)
    second = signatureScore(c, emotions) >= signatureScore(d, emotions) ? c : d
  }

  return {
    id: chosen.id,
    second: second.id,
    energy: round2(energy),
    mood: round2(mood),
    border: Math.abs(energy) < BORDER || Math.abs(mood) < BORDER,
    cues: pickCues(chosen, emotions, az),
  }
}

const round2 = (x: number) => Math.round(x * 100) / 100

/** 장면과 방향이 맞는 음향 단서 최대 2개 + 부족하면 대표 감정 하나 */
function pickCues(p: Persona, emotions: Record<string, number>, az: AcousticZ | null): Cue[] {
  const up = p.quadrant === 'up-clear' || p.quadrant === 'up-cloudy'
  const cands: { key: CueKey; s: number }[] = []
  if (az) {
    const add = (zv: number | null, hi: CueKey, lo: CueKey) => {
      if (zv == null || Math.abs(zv) < 0.5) return
      if (zv > 0 === up) cands.push({ key: zv > 0 ? hi : lo, s: Math.abs(zv) })
    }
    add(az.rate, 'fast', 'slow')
    add(az.pitchCV, 'wide', 'flat')
    add(az.rmsCV, 'strong', 'soft')
    if (az.jitter != null) {
      if (az.jitter > 1 && p.quadrant === 'up-cloudy') cands.push({ key: 'shaky', s: az.jitter })
      if (az.jitter < -0.5 && !up) cands.push({ key: 'steady', s: -az.jitter })
    }
  }
  const cues: Cue[] = cands.sort((x, y) => y.s - x.s).slice(0, 2).map(({ key }) => ({ key }))
  if (cues.length < 2) {
    const top = [...p.signature].sort((x, y) => sc(emotions, y) - sc(emotions, x))[0]
    if (top && sc(emotions, top) > 0) cues.push({ key: 'emotion', emotion: top })
  }
  return cues
}

// ─── 문장 ───────────────────────────────────────────────────────────────────

/** 문장에 넣을 때 더 쉬운 말 */
const CUE_EMOTION_KO: Record<string, string> = {
  Excitement: '신남', Adoration: '다정함', Nostalgia: '그리움', Tiredness: '피곤함', Embarrassment: '민망함',
}
export const emotionWord = (k: string) => CUE_EMOTION_KO[k] ?? EMOTION_KO[k] ?? k

/** 받침 있으면 '이', 없으면 '가' */
function iGa(word: string): string {
  const c = word.charCodeAt(word.length - 1)
  if (c < 0xac00 || c > 0xd7a3) return '이'
  return (c - 0xac00) % 28 ? '이' : '가'
}

const CUE_TEXT: Record<Exclude<CueKey, 'emotion'>, [string, string]> = {
  fast: ['말이 빠르고', '말이 빨라서'],
  slow: ['말이 느긋하고', '말이 느긋해서'],
  wide: ['억양이 크게 출렁이고', '억양이 크게 출렁여서'],
  flat: ['억양이 고르게 이어지고', '억양이 고르게 이어져서'],
  strong: ['소리에 힘이 실리고', '소리에 힘이 실려서'],
  soft: ['소리가 잔잔하고', '소리가 잔잔해서'],
  shaky: ['목소리가 살짝 흔들리고', '목소리가 살짝 흔들려서'],
  steady: ['목소리가 안정적이고', '목소리가 안정적이어서'],
}

function cuePhrase(c: Cue, last: boolean): string {
  if (c.key === 'emotion') {
    const w = emotionWord(c.emotion ?? '')
    return `목소리에 ${w}${iGa(w)} 묻어나${last ? '서' : '고'}`
  }
  return CUE_TEXT[c.key][last ? 1 : 0]
}

/** "말이 빠르고 억양이 크게 출렁여서 콘서트 직관 중인 팬처럼 들려요." */
export function whySentence(r: Pick<SceneResult, 'id' | 'cues'>): string {
  const name = getPersona(r.id).name
  if (r.cues.length === 0) return `오늘 목소리는 ${name}처럼 들려요.`
  const parts = r.cues.map((c, i) => cuePhrase(c, i === r.cues.length - 1))
  return `${parts.join(' ')} ${name}처럼 들려요.`
}

// ─── 공유 링크용 직렬화 ──────────────────────────────────────────────────────

const CUE_KEYS: CueKey[] = ['fast', 'slow', 'wide', 'flat', 'strong', 'soft', 'shaky', 'steady', 'emotion']
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** 바깥에서 온 값(공유 링크·DB)을 SceneResult로 검증한다. 아니면 null. */
export function parseSceneResult(v: unknown): SceneResult | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const ids = PERSONAS.map((p) => p.id) as string[]
  if (typeof o.id !== 'string' || !ids.includes(o.id)) return null
  if (typeof o.second !== 'string' || !ids.includes(o.second)) return null
  if (!isNum(o.energy) || !isNum(o.mood)) return null
  const cues = Array.isArray(o.cues)
    ? o.cues.filter((c): c is Cue => !!c && typeof c === 'object' && CUE_KEYS.includes((c as Cue).key)
      && ((c as Cue).key !== 'emotion' || typeof (c as Cue).emotion === 'string')).slice(0, 3)
      .map((c) => (c.key === 'emotion' ? { key: c.key, emotion: c.emotion } : { key: c.key }))
    : []
  return {
    id: o.id as PersonaId, second: o.second as PersonaId,
    energy: clamp(o.energy), mood: clamp(o.mood), border: o.border === true, cues,
  }
}

export function encodeScene(r: SceneResult): string {
  return btoa(encodeURIComponent(JSON.stringify(r))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function decodeScene(s: string): SceneResult | null {
  try {
    const b = s.replace(/-/g, '+').replace(/_/g, '/')
    return parseSceneResult(JSON.parse(decodeURIComponent(atob(b + '=='.slice(0, (4 - (b.length % 4)) % 4)))))
  } catch {
    return null
  }
}
