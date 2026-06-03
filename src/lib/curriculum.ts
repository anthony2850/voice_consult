/**
 * 훈련 커리큘럼 — outcome 기반 5-Day 사이클.
 * - Day 1~4: 4개 outcome (안정/전달력/명료성/표현력). 각 Day는 그 영역의 L1~L4 운동 4개.
 * - Day 5: elective. 런타임에 사용자가 outcome을 골라 그 Day의 운동 진행.
 * - concern은 focus 마커 (콘텐츠 게이트 아님). 모든 사용자가 모든 Day 진행.
 * - 운동 콘텐츠는 임상 검증 기법(VFE/SOVT/LSVT/Lessac/RVT) 기반.
 *
 * 사양: docs/superpowers/specs/2026-06-03-training-system-redesign-design.md
 */

export type ConcernSlug = 'small_voice' | 'trembling' | 'fast' | 'diction'

export const CONCERN_LABELS: Record<ConcernSlug, string> = {
  small_voice: '작은 목소리',
  trembling: '떨리는 목소리',
  fast: '빨라지는 목소리',
  diction: '발음 웅얼거림',
}

export type Outcome = 'stability' | 'projection' | 'clarity' | 'expression'

export const OUTCOME_LABELS: Record<Outcome, string> = {
  stability: '안정',
  projection: '전달력',
  clarity: '명료성',
  expression: '표현력',
}

/**
 * Concern → outcome 1:1 매핑.
 * 사용자의 자기 선언(concerns)이 어떤 outcome Day와 매칭되는지 결정.
 */
export const CONCERN_TO_OUTCOME: Record<ConcernSlug, Outcome> = {
  trembling: 'stability',
  small_voice: 'projection',
  diction: 'clarity',
  fast: 'expression',
}

export type Interaction = 'guided' | 'record' | 'metronome' | 'breath-pacer'

export interface BreathPhase {
  label: string         // e.g. "들이마시기", "멈춤", "내쉬기"
  durationSec: number
}

export interface ExerciseUnit {
  id: string
  title: string
  description: string
  instructions: string[]
  durationSec: number
  interaction: Interaction
  scriptPool?: string[]
  metronomeBPM?: number       // 'metronome' 용
  breathPhases?: BreathPhase[]  // 'breath-pacer' 용 — 한 사이클의 단계들
  repetitions?: number          // 'breath-pacer' 용 — 사이클 반복 횟수
}

/**
 * Day 유형. Day 1~4는 outcome, Day 5는 elective.
 */
export interface TrainingDay {
  dayNum: 1 | 2 | 3 | 4 | 5
  outcome: Outcome | 'elective'
  theme: string                    // "안정", "전달력", ..., "선택"
  subtitle: string                 // aspirational framing
  emoji: string
  matchingConcern?: ConcernSlug    // 매칭 concern (Day 5는 없음)
  exercises: ExerciseUnit[]        // Day 1~4는 정확히 4개. Day 5는 빈 배열 (런타임 픽).
}

// ─── 16개 운동 정의 ───────────────────────────────────────────────────────────

// Day 1 안정 — trembling concern (B-L1~L4)
const STABILITY_EXERCISES: ExerciseUnit[] = [
  {
    id: 'stab-l1-478breath',
    title: '4-7-8 호흡',
    description: '부교감 활성화로 떨림 진정',
    instructions: [
      '코로 천천히 들이마시고, 잠시 멈추고, 입으로 천천히 내쉬기',
      '아래 단계 가이드를 따라 자연스럽게 호흡',
    ],
    durationSec: 57,  // (4+7+8) × 3
    interaction: 'breath-pacer',
    breathPhases: [
      { label: '들이마시기 (코)', durationSec: 4 },
      { label: '멈춤', durationSec: 7 },
      { label: '내쉬기 (입)', durationSec: 8 },
    ],
    repetitions: 3,
  },
  {
    id: 'stab-l2-sustained-vowel',
    title: '모음 길게 유지',
    description: '발성 안정성 측정·훈련',
    instructions: [
      '편안한 자세로 앉기',
      '"아~" 소리를 한 호흡으로 최대한 길게 유지',
      '흔들림 없이, 5-10초 목표',
    ],
    durationSec: 90,
    interaction: 'record',
  },
  {
    id: 'stab-l3-liptrill-scale',
    title: '립 트릴 음계',
    description: '후두 긴장 풀기',
    instructions: [
      '입술을 부르르 떨며 소리 내기',
      '도-미-솔-미-도 음계 따라 진행',
      '입술 진동이 끊기지 않게 유지',
    ],
    durationSec: 90,
    interaction: 'record',
  },
  {
    id: 'stab-l4-stable-reading',
    title: '안정된 문장 읽기',
    description: '흔들림 없이 한 문장을 끝까지',
    instructions: [
      '아래 문장을 천천히, 흔들림 없이 읽기',
      '한 호흡으로 끝까지 읽기 목표',
    ],
    durationSec: 60,
    interaction: 'record',
    scriptPool: [
      '오늘도 내 목소리는 단단하게 자리를 잡습니다.',
      '한 음 한 음 흔들림 없이 전달합니다.',
      '편안하게, 그러나 또렷하게 말합니다.',
    ],
  },
]

// Day 2 전달력 — small_voice concern (A-L1~L4)
const PROJECTION_EXERCISES: ExerciseUnit[] = [
  {
    id: 'proj-l1-diaphragm',
    title: '복식호흡 인지',
    description: '전달력의 토대인 복식호흡 감각 잡기',
    instructions: [
      '편안히 눕거나 의자에 앉기',
      '한 손은 가슴, 다른 손은 배에 두기',
      '코로 4초 들이마시기 — 배가 부풀어야 함',
      '입으로 6초 내쉬기 — 배가 내려가야 함',
    ],
    durationSec: 90,
    interaction: 'guided',
  },
  {
    id: 'proj-l2-straw',
    title: '빨대 호흡 (SOVT)',
    description: '성대 효율을 높이는 임상 운동',
    instructions: [
      '가는 빨대를 입에 물기',
      '"우~" 소리를 내며 음정 유지',
      '도-레-미 음계로 천천히 상승 후 하강',
    ],
    durationSec: 90,
    interaction: 'record',
  },
  {
    id: 'proj-l3-hum-to-vowel',
    title: '험 → 모음 전환',
    description: '전방 공명 훈련',
    instructions: [
      '입을 다물고 "음~" 험을 길게 — 입술/광대 진동 느끼기',
      '진동감을 유지한 채 입을 천천히 열며 "아~"로 전환',
      '진동이 코·광대 앞쪽에서 계속 느껴져야 함',
    ],
    durationSec: 90,
    interaction: 'record',
  },
  {
    id: 'proj-l4-distance',
    title: '거리감 시뮬레이션',
    description: '일상 볼륨 조절 적용',
    instructions: [
      '1m 앞 사람에게 말하듯 읽기 (보통 음량)',
      '3m 앞 사람에게 말하듯 (조금 큰 음량)',
      '5m 앞 사람에게 말하듯 (더 큰 음량, 짜내지 않게)',
    ],
    durationSec: 90,
    interaction: 'record',
    scriptPool: [
      '안녕하세요. 좋은 하루 보내고 계신가요.',
      '제 목소리가 거기까지 잘 들리시나요.',
      '오늘 날씨가 정말 좋네요.',
    ],
  },
]

// Day 3 명료성 — diction concern (D-L1~L4)
const CLARITY_EXERCISES: ExerciseUnit[] = [
  {
    id: 'clar-l1-articulator-warmup',
    title: '입술·혀 풀기',
    description: '조음기관 유연성 확보',
    instructions: [
      '입술을 부르르 떨기 30초',
      '혀를 시계방향·반시계방향으로 천천히 돌리기 30초',
      '턱을 좌우·상하로 부드럽게 풀기 30초',
    ],
    durationSec: 90,
    interaction: 'guided',
  },
  {
    id: 'clar-l2-consonant-precision',
    title: '자음 정밀화',
    description: '입 모양·혀 위치 정확히',
    instructions: [
      'ㅂ-ㅍ-ㅁ을 또렷이 5회 (입술 닫고 열기 분명히)',
      'ㄷ-ㅌ-ㄴ을 또렷이 5회 (혀끝 윗잇몸)',
      'ㄱ-ㅋ-ㅇ을 또렷이 5회 (혀뒤 연구개)',
    ],
    durationSec: 90,
    interaction: 'record',
  },
  {
    id: 'clar-l3-tongue-twister',
    title: '잰말놀이',
    description: '조음 속도와 정확도 동시 훈련',
    instructions: [
      '아래 잰말을 처음엔 느리고 또렷이',
      '점점 빠르게 — 그러나 정확하게',
      '3번 반복',
    ],
    durationSec: 90,
    interaction: 'record',
    scriptPool: [
      '간장 공장 공장장은 강 공장장이고 된장 공장 공장장은 장 공장장이다.',
      '경찰청 철창살은 외철창살이고 검찰청 철창살은 쌍철창살이다.',
      '저 분이 박 법학박사이시고 그 분이 백 법학박사이시다.',
    ],
  },
  {
    id: 'clar-l4-natural-sentence',
    title: '자연 문장 적용',
    description: '일상 발화로 명료성 전이',
    instructions: [
      '아래 문장을 또렷한 발음으로 읽기',
      '받침, 자음 하나하나 살리기',
    ],
    durationSec: 60,
    interaction: 'record',
    scriptPool: [
      '안녕하세요, 저는 □□입니다. 오늘 하루도 또렷하게 시작합니다.',
      '오늘 일정은 회의 두 건과 점심 약속이 있습니다.',
      '주말에는 가족과 산책을 할 계획입니다.',
    ],
  },
]

// Day 4 표현력 — fast concern (C-L1~L4)
const EXPRESSION_EXERCISES: ExerciseUnit[] = [
  {
    id: 'expr-l1-metronome',
    title: '메트로놈 음절 읽기',
    description: '외적 페이스로 내적 리듬 잡기',
    instructions: [
      '메트로놈 박자에 맞춰 한 음절씩',
      '"가-나-다-라" 처럼 한 박자에 한 음절',
      '점점 박자에 익숙해지기',
    ],
    durationSec: 60,
    interaction: 'metronome',
    metronomeBPM: 60,
    scriptPool: [
      '가-나-다-라-마-바-사-아-자-차',
      '안-녕-하-세-요-반-갑-습-니-다',
    ],
  },
  {
    id: 'expr-l2-pauses',
    title: '의도적 휴지',
    description: '의미 단위로 끊어 읽기',
    instructions: [
      '아래 문장에서 "/" 자리마다 1초 휴지',
      '천천히, 휴지를 충분히',
    ],
    durationSec: 60,
    interaction: 'record',
    scriptPool: [
      '오늘은 / 정말 좋은 / 하루였습니다.',
      '제가 / 말씀드리고 싶은 것은 / 바로 이 점입니다.',
      '천천히 / 그러나 분명하게 / 전달합니다.',
    ],
  },
  {
    id: 'expr-l3-shadowing',
    title: '슬로우 섀도잉',
    description: '차분한 페이스 모방',
    instructions: [
      '아래 문장을 차분한 뉴스 앵커처럼',
      '한 음절 한 음절 차분히',
      '평소보다 0.7배 속도',
    ],
    durationSec: 90,
    interaction: 'record',
    scriptPool: [
      '오늘의 주요 소식을 전해드리겠습니다.',
      '청취자 여러분, 좋은 저녁입니다.',
      '날씨 정보를 알려드리겠습니다.',
    ],
  },
  {
    id: 'expr-l4-target-bpm',
    title: '목표 페이스 발화',
    description: '자유 발화 페이스 자가 측정',
    instructions: [
      '아래 주제로 30초간 자유롭게 말하기',
      '평소 페이스로 자연스럽게',
    ],
    durationSec: 60,
    interaction: 'record',
    scriptPool: [
      '오늘 아침에 있었던 일을 말해보세요.',
      '주말 계획을 설명해보세요.',
      '좋아하는 음식 하나를 추천해보세요.',
    ],
  },
]

// ─── CURRICULUM 정의 ─────────────────────────────────────────────────────────

export const CURRICULUM: TrainingDay[] = [
  {
    dayNum: 1,
    outcome: 'stability',
    theme: '안정',
    subtitle: '당신의 진정성이 흔들림 없이 전달되도록',
    emoji: '🫁',
    matchingConcern: 'trembling',
    exercises: STABILITY_EXERCISES,
  },
  {
    dayNum: 2,
    outcome: 'projection',
    theme: '전달력',
    subtitle: '당신의 존재감이 또렷하게 닿도록',
    emoji: '📢',
    matchingConcern: 'small_voice',
    exercises: PROJECTION_EXERCISES,
  },
  {
    dayNum: 3,
    outcome: 'clarity',
    theme: '명료성',
    subtitle: '당신의 한 마디 한 마디가 또렷하게 전해지도록',
    emoji: '🗣️',
    matchingConcern: 'diction',
    exercises: CLARITY_EXERCISES,
  },
  {
    dayNum: 4,
    outcome: 'expression',
    theme: '표현력',
    subtitle: '당신의 말에 여유와 무게가 담기도록',
    emoji: '🎵',
    matchingConcern: 'fast',
    exercises: EXPRESSION_EXERCISES,
  },
  {
    dayNum: 5,
    outcome: 'elective',
    theme: '선택',
    subtitle: '한 번 더 다듬을 영역을 골라요',
    emoji: '🎯',
    exercises: [],  // 런타임에 사용자가 outcome을 픽하면 그 Day의 exercises 사용
  },
]

export function getDay(dayNum: number): TrainingDay | undefined {
  return CURRICULUM.find((d) => d.dayNum === dayNum)
}
