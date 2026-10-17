/**
 * 훈련 커리큘럼 — 한 고민, 한 트랙, 전이 사다리.
 *
 * - 사용자는 목표 장면(면접·발표·전화·일상)을 고르고 고민 하나(트랙)를 확정한다.
 * - 모든 트랙은 같은 6단 사다리를 오른다 (5교시 캐리어-변조 계층 순서).
 *   트랙마다 다른 것은 "무엇을 들을 것인가"(핵심 정보)와 성공 기준, 변형 목록이다.
 * - 지시문은 결과·비유 언어로 쓴다. 금지문 없음. 마지막 줄은 결과를 향한다.
 *
 * 사양: docs/superpowers/specs/2026-10-17-training-track-design.md
 */

export type ConcernSlug = 'small_voice' | 'trembling' | 'fast' | 'diction'

export const CONCERN_LABELS: Record<ConcernSlug, string> = {
  small_voice: '작은 목소리',
  trembling: '떨리는 목소리',
  fast: '빨라지는 목소리',
  diction: '발음 웅얼거림',
}

export const CONCERN_ORDER: ConcernSlug[] = ['trembling', 'small_voice', 'fast', 'diction']

// ─── 목표 장면 ────────────────────────────────────────────────────────────────

export type Scene = 'interview' | 'presentation' | 'call' | 'daily'

export const SCENE_ORDER: Scene[] = ['interview', 'presentation', 'call', 'daily']

export const SCENE_LABELS: Record<Scene, { label: string; emoji: string; hint: string }> = {
  interview: { label: '면접', emoji: '🤝', hint: '첫인사부터 답변까지' },
  presentation: { label: '발표', emoji: '🎤', hint: '여러 사람 앞에서 말하기' },
  call: { label: '전화·회의', emoji: '📞', hint: '얼굴 없이 목소리만으로' },
  daily: { label: '일상 대화', emoji: '☕', hint: '친구·가족과의 대화' },
}

export interface SceneScript {
  /** 기준 문장. 사다리 2·4단과 파지·수행 체크에서 트랙 내내 같은 문장으로 쓴다. */
  short: string
  /** 두 문장짜리 전체 답변 (5단) */
  full: string
  /** 쉼 자리를 "/"로 표시한 문장 (6단) */
  paused: string
}

export const SCENE_SCRIPTS: Record<Scene, SceneScript> = {
  interview: {
    short: '안녕하세요. 이 자리에 지원하게 되어 반갑습니다.',
    full: '안녕하세요. 이 자리에 지원하게 되어 반갑습니다. 제가 쌓아 온 경험이 이 팀에 보탬이 될 거라고 생각합니다.',
    paused: '안녕하세요. / 이 자리에 지원하게 되어 / 반갑습니다. / 제가 쌓아 온 경험이 / 이 팀에 보탬이 될 거라고 생각합니다.',
  },
  presentation: {
    short: '안녕하세요. 오늘 발표를 맡게 되었습니다.',
    full: '안녕하세요. 오늘 발표를 맡게 되었습니다. 핵심은 세 가지이고, 하나씩 차례로 말씀드리겠습니다.',
    paused: '안녕하세요. / 오늘 발표를 맡게 되었습니다. / 핵심은 세 가지이고, / 하나씩 차례로 / 말씀드리겠습니다.',
  },
  call: {
    short: '네, 안녕하세요. 지금 통화 괜찮으신가요?',
    full: '네, 안녕하세요. 지금 통화 괜찮으신가요? 지난번에 말씀하신 건으로 확인차 연락드렸습니다.',
    paused: '네, 안녕하세요. / 지금 통화 괜찮으신가요? / 지난번에 말씀하신 건으로 / 확인차 연락드렸습니다.',
  },
  daily: {
    short: '오늘 하루 어땠어요? 저는 오후에 산책을 다녀왔어요.',
    full: '오늘 하루 어땠어요? 저는 오후에 산책을 다녀왔어요. 날씨가 생각보다 좋아서 한참을 걸었어요.',
    paused: '오늘 하루 어땠어요? / 저는 오후에 / 산책을 다녀왔어요. / 날씨가 생각보다 좋아서 / 한참을 걸었어요.',
  },
}

/**
 * 유성자음(ㄴ·ㄹ·ㅁ·ㅇ)과 모음으로만 된 "소리 잇기" 문장 (3단).
 * 무성자음이 없어 소리가 끊기지 않는다. 뜻보다 소리의 연결이 목적이다.
 */
export const SONORANT_SCRIPTS: string[] = [
  '나의 마음은 늘 이 안에 머물러요.',
  '오늘 우리 모임은 여유로이 열려요.',
  '노을이 온 마을에 오래 머물러요.',
]

// ─── 전이 사다리 ──────────────────────────────────────────────────────────────

export type RungLevel = 1 | 2 | 3 | 4 | 5 | 6
export const MAX_RUNG: RungLevel = 6
/** 진단에서 오르는 계단 */
export const DIAGNOSIS_LEVELS: RungLevel[] = [1, 2, 3, 4]

export interface Rung {
  level: RungLevel
  id: string
  title: string
  /** 이 계단이 남기는 것 (캐리어 기준) */
  keeps: string
  /** 이 계단에서 더해지는 변조 */
  adds: string
  /** 결과·비유 언어. 마지막 줄은 결과를 향한다. */
  instructions: string[]
  /** 녹음 상한(초). 한계까지 가지 않는다. */
  maxSec: number
  /** 1단 지속 목표(초) */
  targetSec?: number
  /** 6단: 준비 시간(초) — 실제 상황의 시간 압박 */
  prepSec?: number
  scriptLabel: string
  /** 계단별 대본. null이면 대본 없음(1단). */
  script: (scene: Scene, sonorantIndex: number) => string | null
}

export const LADDER: Rung[] = [
  {
    level: 1,
    id: 'rung-1-hum',
    title: '허밍 한 음 잇기',
    keeps: '발성 자체(캐리어)만',
    adds: '없음',
    instructions: [
      '입을 다물고 "음~" 한 음을 편한 높이로 냅니다.',
      '소리가 입술 앞 손바닥에 닿는다고 생각하며 잇습니다.',
      '5초가 목표예요. 끝까지 같은 굵기로 이어지면 성공입니다.',
    ],
    maxSec: 8,
    targetSec: 5,
    scriptLabel: '소리',
    script: () => null,
  },
  {
    level: 2,
    id: 'rung-2-vowel-contour',
    title: '한 모음으로 억양만',
    keeps: '발성 + 억양·강세',
    adds: '운율',
    instructions: [
      '아래 문장을 "아~" 소리 하나로, 말할 때의 높낮이만 살려 냅니다.',
      '말을 건네는 상대가 2m 앞에 있다고 상상합니다.',
      '소리가 끊기지 않고 문장 끝까지 한 줄로 이어지면 성공입니다.',
    ],
    maxSec: 10,
    scriptLabel: '이 문장의 억양을 "아~"로',
    script: (scene) => SCENE_SCRIPTS[scene].short,
  },
  {
    level: 3,
    id: 'rung-3-sonorant',
    title: '소리 잇기 문장',
    keeps: '발성 + 운율 + 끊기지 않는 자음',
    adds: '유성자음(ㄴ·ㄹ·ㅁ·ㅇ)',
    instructions: [
      '아래 문장은 소리가 끊기지 않는 자음으로만 되어 있어요.',
      '앞 글자의 울림을 다음 글자로 그대로 넘긴다고 생각합니다.',
      '문장 끝까지 한 줄의 소리로 들리면 성공입니다.',
    ],
    maxSec: 10,
    scriptLabel: '읽어 주세요',
    script: (_scene, i) => SONORANT_SCRIPTS[i % SONORANT_SCRIPTS.length],
  },
  {
    level: 4,
    id: 'rung-4-base-sentence',
    title: '기준 문장',
    keeps: '실제 문장 전체',
    adds: '무성자음(ㄱ·ㄷ·ㅂ·ㅅ…)',
    instructions: [
      '실제 상황의 첫 문장이에요. 2m 앞 한 사람에게 건넵니다.',
      'ㄱ·ㄷ·ㅂ 같은 자음 뒤에도 앞의 울림이 돌아오게 둡니다.',
      '문장 끝이 처음과 같은 굵기로 끝나면 성공입니다.',
    ],
    maxSec: 12,
    scriptLabel: '읽어 주세요',
    script: (scene) => SCENE_SCRIPTS[scene].short,
  },
  {
    level: 5,
    id: 'rung-5-full',
    title: '전체 답변',
    keeps: '실제 문장 전체',
    adds: '길이',
    instructions: [
      '두 문장을 한 사람에게 이어서 건넵니다.',
      '첫 문장의 울림이 둘째 문장까지 이어지는지 들어 봅니다.',
      '마지막 단어까지 상대에게 닿으면 성공입니다.',
    ],
    maxSec: 20,
    scriptLabel: '읽어 주세요',
    script: (scene) => SCENE_SCRIPTS[scene].full,
  },
  {
    level: 6,
    id: 'rung-6-pause-prep',
    title: '쉼과 준비',
    keeps: '실제 문장 전체',
    adds: '호흡 위치 + 시간 압박',
    instructions: [
      '"/" 자리에서 숨을 바꾸고, 그 뒤 첫 글자를 앞과 같은 굵기로 냅니다.',
      '준비 시간은 3초뿐이에요. 실제 상황처럼 바로 시작합니다.',
      '쉼 뒤 첫 글자가 앞과 같은 굵기면 성공입니다.',
    ],
    maxSec: 20,
    prepSec: 3,
    scriptLabel: '"/"에서 숨을 바꾸며',
    script: (scene) => SCENE_SCRIPTS[scene].paused,
  },
]

export function getRung(level: RungLevel): Rung {
  return LADDER[level - 1]
}

// ─── 트랙 ────────────────────────────────────────────────────────────────────

export type Metric = 'jitter' | 'pace' | 'loudness' | 'self'

export type VariationAxis = 'sound' | 'time' | 'body' | 'approach'

export const VARIATION_AXIS_LABELS: Record<VariationAxis, string> = {
  sound: '소리',
  time: '시간',
  body: '몸·환경',
  approach: '접근 경로',
}

/** 관찰할 결과 / 바꿀 조건 / 유지할 조건을 분리해 정의한다 (5교시 5쪽). */
export interface Variation {
  id: string
  axis: VariationAxis
  label: string
  change: string
  hold: string
  observe: string
  /** 1 = 약한 변동. 진단에서 흔들림이 큰 사용자에게는 1만 쓴다 (8교시 30쪽). */
  strength: 1 | 2
}

export interface Track {
  concern: ConcernSlug
  label: string
  emoji: string
  metric: Metric
  /** 핵심 정보 한 줄 — 녹음 화면에는 이것만 보인다 (3교시). */
  keyInfo: string
  /** 결과 기준을 사람 말로 */
  goal: string
  /** 녹음 직전 마지막 한마디 — 결과를 향한다 (8교시 47쪽). */
  lastWord: string
  variations: Variation[]
}

export const TRACKS: Record<ConcernSlug, Track> = {
  trembling: {
    concern: 'trembling',
    label: '떨림',
    emoji: '〰️',
    metric: 'jitter',
    keyInfo: '소리 끝이 처음과 같은 굵기인가',
    goal: '문장 끝까지 소리가 고르게 이어지면 성공이에요.',
    lastWord: '저 끝의 한 사람에게, 가볍게, 끝까지.',
    variations: [
      { id: 'tr-quiet', axis: 'sound', label: '조금 작게', change: '음량을 평소의 70%로', hold: '문장과 속도는 그대로', observe: '끝이 고른가', strength: 1 },
      { id: 'tr-slow', axis: 'time', label: '조금 느리게', change: '평소보다 느리게', hold: '음량과 문장은 그대로', observe: '끝이 고른가', strength: 1 },
      { id: 'tr-soft-start', axis: 'approach', label: '작게 시작해 키우기', change: '첫 글자는 속삭임에 가깝게, 중간부터 평소 크기로', hold: '문장은 그대로', observe: '키운 뒤에도 고른가', strength: 2 },
      { id: 'tr-eyes', axis: 'body', label: '눈 감고', change: '눈을 감고 소리만 듣기', hold: '음량과 속도는 그대로', observe: '끝이 고른가', strength: 2 },
    ],
  },
  small_voice: {
    concern: 'small_voice',
    label: '전달력',
    emoji: '📢',
    metric: 'loudness',
    keyInfo: '문장 끝이 처음만큼 멀리 가는가',
    goal: '진단 때의 크기를 문장 끝까지 유지하면 성공이에요.',
    lastWord: '방 끝 사람이 고개를 끄덕일 만큼 보냅니다.',
    variations: [
      { id: 'sv-3m', axis: 'sound', label: '3m 앞 사람에게', change: '상대가 3m 앞에 있다고 상상', hold: '문장과 속도는 그대로', observe: '끝까지 같은 크기인가', strength: 1 },
      { id: 'sv-stand', axis: 'body', label: '서서', change: '일어서서 말하기', hold: '음량과 문장은 그대로', observe: '끝까지 같은 크기인가', strength: 1 },
      { id: 'sv-soft-start', axis: 'approach', label: '작게 시작해 키우기', change: '첫 단어는 작게, 둘째 단어부터 평소 크기로', hold: '문장은 그대로', observe: '키운 크기가 끝까지 가는가', strength: 2 },
      { id: 'sv-breath', axis: 'time', label: '쉼마다 숨 다시', change: '문장 사이마다 숨을 새로 들이기', hold: '음량은 그대로', observe: '둘째 문장도 같은 크기인가', strength: 2 },
    ],
  },
  fast: {
    concern: 'fast',
    label: '여유',
    emoji: '⏱️',
    metric: 'pace',
    keyInfo: '쉼이 들렸는가',
    goal: '쉼 자리에서 실제로 멈추고, 초당 음절이 범위 안이면 성공이에요.',
    lastWord: '한 단어 한 단어, 상대 손에 건넵니다.',
    variations: [
      { id: 'fa-pause', axis: 'time', label: '쉼 1초', change: '문장 사이에서 속으로 하나를 센 뒤 이어가기', hold: '음량과 문장은 그대로', observe: '쉼이 들리는가', strength: 1 },
      { id: 'fa-low', axis: 'sound', label: '낮은 톤으로', change: '평소보다 조금 낮은 높이로', hold: '문장과 쉼은 그대로', observe: '속도가 따라 느려지는가', strength: 1 },
      { id: 'fa-slow-start', axis: 'approach', label: '느리게 시작해 평소로', change: '첫 문장은 아주 느리게, 둘째 문장부터 평소 속도로', hold: '문장은 그대로', observe: '둘째 문장에도 쉼이 남는가', strength: 2 },
      { id: 'fa-hands', axis: 'body', label: '손을 무릎에', change: '두 손을 무릎에 두고 말하기', hold: '음량과 문장은 그대로', observe: '쉼이 들리는가', strength: 2 },
    ],
  },
  diction: {
    concern: 'diction',
    label: '또렷함',
    emoji: '🗣️',
    metric: 'self',
    keyInfo: '받침과 첫 자음이 들렸는가',
    goal: '녹음을 들었을 때 모든 글자가 구분되면 성공이에요.',
    lastWord: '글자 하나하나가 상대 귀에 도착합니다.',
    variations: [
      { id: 'di-coda', axis: 'sound', label: '받침 살리기', change: '받침이 있는 글자는 받침까지 닫고 다음으로', hold: '속도와 문장은 그대로', observe: '받침이 들리는가', strength: 1 },
      { id: 'di-slow', axis: 'time', label: '느리게', change: '평소보다 느리게', hold: '음량과 문장은 그대로', observe: '첫 자음이 들리는가', strength: 1 },
      { id: 'di-open', axis: 'body', label: '입을 크게', change: '모음마다 입을 평소보다 크게', hold: '속도와 문장은 그대로', observe: '글자가 구분되는가', strength: 2 },
      { id: 'di-first-word', axis: 'approach', label: '첫 단어만 또렷하게', change: '첫 단어만 한 글자씩 끊듯이, 나머지는 평소대로', hold: '문장은 그대로', observe: '첫 단어의 또렷함이 뒤까지 가는가', strength: 2 },
    ],
  },
}

// ─── 학습 원리 (9교시 41쪽) ───────────────────────────────────────────────────

export const LEARNING_PRINCIPLES: { title: string; body: string }[] = [
  { title: '연습이 조금 어려워야 실전이 쉬워져요', body: '매 세션 한 계단 위를 함께 시도해요. 잘 안 되는 게 정상이에요.' },
  { title: '약점을 연습하는 데는 이유가 있어요', body: '진단에서 찾은 계단 주변만 집중해요. 거기가 가장 빨리 바뀌는 자리예요.' },
  { title: '목 안은 앱이 재요. 당신은 전달에만 집중하세요', body: '떨림·속도·크기는 녹음이 측정해요. 상대에게 말을 건네는 데만 마음을 두세요.' },
  { title: '점수는 오르내리며 자라요', body: '오늘 좋아진 건 워밍업일 수 있어요. 진짜 변화는 다음 세션 시작에서 보여요. 길게 봐요.' },
  { title: '안 되는 날은 조건을 바꿔요', body: '문장을 바꾸거나 계단을 내려요. 당신 탓이 아니라 조건을 바꿀 차례예요.' },
]
