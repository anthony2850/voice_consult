/**
 * 훈련 커리큘럼 — 5-day 통합 코스.
 * 사용자 concerns 배열과 매칭되는 Day에서 deep 운동이 활성화됨.
 * 테마(호흡/이완/공명/속도/발음)와 운동 콘텐츠는 잠정 안 — 추후 코치 콘텐츠 조사 후 데이터만 교체.
 */

export type ConcernSlug = 'small_voice' | 'trembling' | 'fast' | 'diction'

export const CONCERN_LABELS: Record<ConcernSlug, string> = {
  small_voice: '작은 목소리',
  trembling: '떨리는 목소리',
  fast: '빨라지는 목소리',
  diction: '발음 웅얼거림',
}

export type Interaction = 'guided' | 'record'
// 'metronome' | 'visualizer' will be added when needed.

export interface ExerciseUnit {
  id: string
  title: string
  description: string
  instructions: string[]
  durationSec: number
  interaction: Interaction
  scriptPool?: string[]
}

export interface TrainingDay {
  dayNum: 1 | 2 | 3 | 4 | 5
  theme: string
  subtitle: string  // aspirational framing — "당신의 □□가 △△하도록"
  emoji: string
  matchingConcerns: ConcernSlug[]
  standard: ExerciseUnit[]
  deep: ExerciseUnit[]
}

// v1 sample content — 1 sample 'record' per day to validate the framework.
// Replace these with real exercises after coach content research.
function sampleStandard(dayKey: string): ExerciseUnit[] {
  return [
    {
      id: `${dayKey}-main`,
      title: '메인 운동 (sample)',
      description: '오늘의 핵심 연습',
      instructions: ['스크립트를 읽고 녹음하세요'],
      durationSec: 120,
      interaction: 'record',
      scriptPool: [
        '안녕하세요. 오늘의 훈련을 시작합니다.',
        '천천히 정확하게 읽어보겠습니다.',
        '편안한 마음으로 연습합니다.',
      ],
    },
  ]
}

function sampleDeep(dayKey: string): ExerciseUnit[] {
  return [
    {
      id: `${dayKey}-deep-1`,
      title: '깊이 운동 (sample)',
      description: '약점 일치 day 추가 연습',
      instructions: ['좀 더 도전적인 변형을 시도하세요'],
      durationSec: 90,
      interaction: 'record',
      scriptPool: [
        '한 번 더 집중해서 읽어보겠습니다.',
        '핵심 약점을 강화하는 시간입니다.',
      ],
    },
  ]
}

export const CURRICULUM: TrainingDay[] = [
  {
    dayNum: 1,
    theme: '호흡·안정',
    subtitle: '당신의 진정성이 흔들림 없이 전달되도록',
    emoji: '🫁',
    matchingConcerns: ['trembling'],
    standard: sampleStandard('day1'),
    deep: sampleDeep('day1'),
  },
  {
    dayNum: 2,
    theme: '립트릴·이완',
    subtitle: '당신의 목소리가 자연스럽게 풀려나오도록',
    emoji: '🎵',
    matchingConcerns: ['trembling'],
    standard: sampleStandard('day2'),
    deep: sampleDeep('day2'),
  },
  {
    dayNum: 3,
    theme: '공명·볼륨',
    subtitle: '당신의 존재감이 또렷하게 닿도록',
    emoji: '📢',
    matchingConcerns: ['small_voice'],
    standard: sampleStandard('day3'),
    deep: sampleDeep('day3'),
  },
  {
    dayNum: 4,
    theme: '속도 조절',
    subtitle: '당신의 말에 여유와 무게가 담기도록',
    emoji: '⚡',
    matchingConcerns: ['fast'],
    standard: sampleStandard('day4'),
    deep: sampleDeep('day4'),
  },
  {
    dayNum: 5,
    theme: '발음·딕션',
    subtitle: '당신의 한 마디 한 마디가 또렷하게 전해지도록',
    emoji: '🗣️',
    matchingConcerns: ['diction'],
    standard: sampleStandard('day5'),
    deep: sampleDeep('day5'),
  },
]

export function getDay(dayNum: number): TrainingDay | undefined {
  return CURRICULUM.find((d) => d.dayNum === dayNum)
}
