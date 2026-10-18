/**
 * 목소리 페르소나 녹음 — 자유 발화 질문.
 *
 * 분류는 "무엇에 대해"가 아니라 "어떻게 말하는지"(말하기 방식)로 나눈다.
 * - 누구나 답할 수 있다(직업, 소속과 무관).
 * - 자기소개, 설명, 이야기, 의견은 말하기 과제의 대표 갈래라 리듬과 억양이 서로 다르다.
 * - 네 갈래가 훈련의 네 상황(면접, 발표, 일상 대화, 전화와 회의)에 하나씩 맞는다.
 * 질문은 기분을 미리 정하지 않게 쓴다("웃겼던 일", "짜증 났던 일" 금지). 그래야 페르소나가 목소리를 잰 결과가 된다.
 */
import type { Scene } from './curriculum'

export type SpeakCategory = 'intro' | 'explain' | 'story' | 'opinion'

export interface SpeakPrompt {
  q: string
  hints: string[]
}

export interface SpeakCategoryInfo {
  id: SpeakCategory
  label: string
  sub: string
  /** 연결되는 훈련 상황 */
  scene: Scene
  prompts: SpeakPrompt[]
}

export const SPEAK_CATEGORIES: SpeakCategoryInfo[] = [
  {
    id: 'intro', label: '나를 소개하기', sub: '면접에서 말하듯', scene: 'interview',
    prompts: [
      { q: '처음 만난 사람에게 나를 30초로 소개해 주세요.', hints: ['요즘 하는 일', '좋아하는 것', '나를 한 단어로'] },
      { q: '요즘 가장 시간을 많이 쓰는 일을 소개해 주세요.', hints: ['무엇을', '얼마나', '왜'] },
      { q: '주변 사람들이 말하는 나는 어떤 사람인지 말해 주세요.', hints: ['자주 듣는 말', '내 생각', '예시 하나'] },
      { q: '요즘 새로 시작했거나 해 보고 싶은 것을 말해 주세요.', hints: ['무엇을', '계기', '기대되는 점'] },
    ],
  },
  {
    id: 'explain', label: '무언가 설명하기', sub: '발표하듯', scene: 'presentation',
    prompts: [
      { q: '좋아하는 음식 하나를 처음 먹어 보는 사람에게 설명해 주세요.', hints: ['어떤 맛', '어디서', '먹는 법'] },
      { q: '자주 가는 장소 하나를 안 가 본 사람에게 소개해 주세요.', hints: ['어디', '분위기', '추천 이유'] },
      { q: '잘하는 일 하나를 처음 해 보는 사람에게 알려 주세요.', hints: ['첫 단계', '요령', '조심할 점'] },
      { q: '최근에 본 영화나 영상 하나를 안 본 사람에게 소개해 주세요.', hints: ['어떤 내용', '좋았던 장면', '누구에게 추천'] },
    ],
  },
  {
    id: 'story', label: '이야기 들려주기', sub: '친구와 수다 떨듯', scene: 'daily',
    prompts: [
      { q: '최근에 있었던 일 중 기억에 남는 것을 친구에게 말하듯 들려주세요.', hints: ['언제', '무슨 일', '그때 기분'] },
      { q: '최근에 처음 해 본 일을 들려주세요.', hints: ['무엇을', '해 보니 어땠는지'] },
      { q: '어릴 때 기억에 남는 하루를 들려주세요.', hints: ['몇 살쯤', '어디서', '떠오르는 장면'] },
      { q: '오늘 아침부터 지금까지를 짧게 들려주세요.', hints: ['일어나서', '가장 길었던 일', '지금'] },
    ],
  },
  {
    id: 'opinion', label: '내 생각 말하기', sub: '회의에서 의견 내듯', scene: 'call',
    prompts: [
      { q: '아침형과 저녁형 중 나는 어느 쪽인지 이유와 함께 말해 주세요.', hints: ['내 쪽', '이유', '예시 하나'] },
      { q: '여행 갈 때 계획을 세우는 편인지 즉흥적인 편인지 말해 주세요.', hints: ['내 쪽', '이유', '기억나는 경험'] },
      { q: '하루가 25시간이 된다면 남는 한 시간에 무엇을 할지 말해 주세요.', hints: ['무엇을', '왜'] },
      { q: '평생 한 가지 음식만 먹어야 한다면 무엇을 고를지 말해 주세요.', hints: ['고른 음식', '이유', '포기하기 아까운 것'] },
    ],
  },
]

export function getSpeakCategory(id: SpeakCategory): SpeakCategoryInfo {
  return SPEAK_CATEGORIES.find((c) => c.id === id) ?? SPEAK_CATEGORIES[0]
}

export function isSpeakCategory(v: unknown): v is SpeakCategory {
  return typeof v === 'string' && SPEAK_CATEGORIES.some((c) => c.id === v)
}

/** 분류 안에서 질문 하나를 고른다. exclude(지금 질문)는 피한다. */
export function pickPromptIndex(category: SpeakCategory, exclude: number | null = null, rand: () => number = Math.random): number {
  const n = getSpeakCategory(category).prompts.length
  if (n <= 1) return 0
  let i = Math.floor(rand() * n)
  if (exclude != null && i === exclude) i = (i + 1) % n
  return i
}

/** 녹음에 쓴 분류와 질문 — 결과 화면과 훈련 온보딩이 읽는다. */
export const SPEAK_PROMPT_KEY = 'voicePrompt'
export interface StoredSpeakPrompt { category: SpeakCategory; index: number }

export function readStoredPrompt(): StoredSpeakPrompt | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(SPEAK_PROMPT_KEY) ?? 'null')
    return v && isSpeakCategory(v.category) && Number.isInteger(v.index) ? v : null
  } catch {
    return null
  }
}
