/**
 * 훈련 커리큘럼 — 한 고민, 한 트랙, 전이 사다리.
 *
 * - 사용자는 목표 장면(면접, 발표, 전화, 일상)을 고르고 고민 하나(트랙)를 확정한다.
 * - 모든 트랙은 같은 6단 사다리를 오른다 (5교시 캐리어-변조 계층 순서).
 *   트랙마다 다른 것은 "무엇을 들을 것인가"(핵심 정보)와 성공 기준, 변형 목록이다.
 * - 지시문은 결과, 비유 언어로 쓴다. 금지문 없음. 마지막 줄은 결과를 향한다.
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
  call: { label: '전화와 회의', emoji: '📞', hint: '얼굴 없이 목소리만으로' },
  daily: { label: '일상 대화', emoji: '☕', hint: '친구, 가족과의 대화' },
}

export interface SceneScript {
  /** 기준 문장. 사다리 2, 4단과 파지, 수행 체크에서 트랙 내내 같은 문장으로 쓴다. */
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
 * 유성자음(ㄴ, ㄹ, ㅁ, ㅇ)과 모음으로만 된 "소리 잇기" 문장 (3단).
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
  /** 결과, 비유 언어. 마지막 줄은 결과를 향한다. */
  instructions: string[]
  /** 진단용 한 줄. 진단은 평소 목소리를 재는 곳이라 성공 기준을 보여 주지 않는다. */
  diagnoseHint?: string
  /** 연습용 한 줄. 문장만 보고도 할 수 있는 단계(4, 5단계)는 비워 둔다. */
  practiceHint?: string
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
    practiceHint: '입을 다물고 "음~"을 한 높이로 5초 이어 가요.',
    diagnoseHint: '입을 다물고 "음~"을 편하게 5초 내요.',
    title: '"음~" 허밍',
    keeps: '소리만',
    adds: '소리만',
    instructions: [
      '입을 다물고 "음~" 소리를 편한 높이로 냅니다.',
      '콧노래 부르듯 가볍게, 한 높이로 쭉 이어 갑니다.',
      '5초 동안 소리가 끊김 없이 같은 크기로 이어지면 성공입니다.',
    ],
    maxSec: 8,
    targetSec: 5,
    scriptLabel: '소리',
    script: () => null,
  },
  {
    level: 2,
    id: 'rung-2-vowel-contour',
    practiceHint: '말할 때처럼 높낮이만 살려요.',
    diagnoseHint: '아래 문장을 "아~" 소리로만, 말하듯 높낮이를 살려 말해요.',
    title: '"아~"로 말 흉내 내기',
    keeps: '소리 + 말의 높낮이',
    adds: '말의 높낮이',
    instructions: [
      '아래 문장을 단어 대신 "아~" 소리로만 말해 봅니다.',
      '말할 때처럼 높낮이만 살려요. 외계어로 말하는 느낌이에요.',
      '문장 끝까지 "아~"가 숨 쉬는 틈 없이 한 번에 이어지면 성공입니다.',
    ],
    maxSec: 10,
    scriptLabel: '이 문장을 "아~"로만 말하기',
    script: (scene) => SCENE_SCRIPTS[scene].short,
  },
  {
    level: 3,
    id: 'rung-3-sonorant',
    practiceHint: '글자를 붙여 노래 가사처럼 이어 읽어요.',
    diagnoseHint: '아래 문장을 노래 가사처럼 이어 읽어요.',
    title: '부드러운 자음 문장',
    keeps: '소리 + 높낮이 + 부드러운 자음',
    adds: '부드러운 자음(ㄴ, ㄹ, ㅁ, ㅇ)',
    instructions: [
      '문장 속 ㄴ, ㄹ, ㅁ, ㅇ 소리를 길게 이어 갑니다.',
      '글자와 글자를 붙여서, 노래 가사처럼 이어 읽습니다.',
      '녹음을 들었을 때 문장 중간에 소리가 뚝 끊기는 곳이 없으면 성공입니다.',
    ],
    maxSec: 10,
    scriptLabel: '읽어 주세요',
    script: (_scene, i) => SONORANT_SCRIPTS[i % SONORANT_SCRIPTS.length],
  },
  {
    level: 4,
    id: 'rung-4-base-sentence',
    diagnoseHint: '앞사람에게 말하듯 평소처럼 읽어요.',
    title: '실제 첫 문장',
    keeps: '실제 문장',
    adds: '끊기는 자음(ㄱ, ㄷ, ㅂ, ㅅ 등)',
    instructions: [
      '2m 앞 사람에게 말하듯 읽습니다.',
      'ㄱ, ㄷ, ㅂ 뒤 글자도 앞 글자와 같은 크기로 냅니다.',
      '마지막 글자까지 첫 글자와 같은 크기로 들리면 성공입니다.',
    ],
    maxSec: 12,
    scriptLabel: '읽어 주세요',
    script: (scene) => SCENE_SCRIPTS[scene].short,
  },
  {
    level: 5,
    id: 'rung-5-full',
    title: '두 문장 이어 말하기',
    keeps: '실제 문장',
    adds: '문장 길이',
    instructions: [
      '두 문장을 한 사람에게 이어서 말합니다.',
      '둘째 문장도 첫 문장처럼 말합니다.',
      '마지막 단어까지 첫 단어와 같은 크기와 빠르기로 들리면 성공입니다.',
    ],
    maxSec: 20,
    scriptLabel: '읽어 주세요',
    script: (scene) => SCENE_SCRIPTS[scene].full,
  },
  {
    level: 6,
    id: 'rung-6-pause-prep',
    practiceHint: '"/"에서 숨을 쉬고 바로 이어 가요.',
    title: '쉬어 가며 바로 시작하기',
    keeps: '실제 문장',
    adds: '숨 쉬는 자리 + 짧은 준비 시간',
    instructions: [
      '"/" 표시가 있는 곳에서 잠깐 멈추고 숨을 들이마십니다.',
      '준비 시간 3초 뒤 바로 시작합니다.',
      '숨을 쉰 뒤 첫 글자가 멈추기 전과 같은 크기로 나오면 성공입니다.',
    ],
    maxSec: 20,
    prepSec: 3,
    scriptLabel: '"/"에서 멈추고 숨 쉬기',
    script: (scene) => SCENE_SCRIPTS[scene].paused,
  },
]

export function getRung(level: RungLevel): Rung {
  return LADDER[level - 1]
}

// ─── 트랙 ────────────────────────────────────────────────────────────────────

export type Metric = 'jitter' | 'pace' | 'loudness' | 'clarity'

export type VariationAxis = 'sound' | 'time' | 'body' | 'approach'

export const VARIATION_AXIS_LABELS: Record<VariationAxis, string> = {
  sound: '소리',
  time: '시간',
  body: '몸과 환경',
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
    keyInfo: '문장 끝에서 목소리가 떨리지 않았나',
    goal: '문장 끝까지 목소리가 떨림 없이 고르게 나오면 성공이에요.',
    lastWord: '2m 앞 한 사람에게 편하게 말을 건네듯이.',
    variations: [
      { id: 'tr-quiet', axis: 'sound', label: '조금 작게', change: '평소보다 조금 작은 목소리로', hold: '문장과 빠르기는 그대로', observe: '끝까지 떨리지 않는가', strength: 1 },
      { id: 'tr-slow', axis: 'time', label: '조금 느리게', change: '평소보다 느리게', hold: '목소리 크기와 문장은 그대로', observe: '끝까지 떨리지 않는가', strength: 1 },
      { id: 'tr-soft-start', axis: 'approach', label: '작게 시작해 키우기', change: '첫 단어는 속삭이듯 작게, 둘째 단어부터 평소 크기로', hold: '문장은 그대로', observe: '크기를 키운 뒤에도 떨리지 않는가', strength: 2 },
      { id: 'tr-eyes', axis: 'body', label: '눈 감고', change: '눈을 감고 내 목소리에만 귀 기울이기', hold: '목소리 크기와 빠르기는 그대로', observe: '끝까지 떨리지 않는가', strength: 2 },
    ],
  },
  small_voice: {
    concern: 'small_voice',
    label: '전달력',
    emoji: '📢',
    metric: 'loudness',
    keyInfo: '문장 끝이 처음만큼 크게 들리는가',
    goal: '진단 때 낸 목소리 크기를 문장 끝까지 유지하면 성공이에요.',
    lastWord: '방 반대편 사람에게도 들리게 말합니다.',
    variations: [
      { id: 'sv-3m', axis: 'sound', label: '3m 앞 사람에게', change: '상대가 3m 떨어져 있다고 생각하고 말하기', hold: '문장과 빠르기는 그대로', observe: '끝까지 같은 크기인가', strength: 1 },
      { id: 'sv-stand', axis: 'body', label: '서서', change: '일어서서 말하기', hold: '목소리 크기와 문장은 그대로', observe: '끝까지 같은 크기인가', strength: 1 },
      { id: 'sv-soft-start', axis: 'approach', label: '작게 시작해 키우기', change: '첫 단어는 작게, 둘째 단어부터 평소 크기로', hold: '문장은 그대로', observe: '키운 크기가 끝까지 유지되는가', strength: 2 },
      { id: 'sv-breath', axis: 'time', label: '문장 사이에 숨 한 번', change: '첫 문장이 끝나면 숨을 한 번 들이마시고 둘째 문장 시작', hold: '목소리 크기는 그대로', observe: '둘째 문장도 같은 크기인가', strength: 2 },
    ],
  },
  fast: {
    concern: 'fast',
    label: '여유',
    emoji: '⏱️',
    metric: 'pace',
    keyInfo: '문장 사이에서 실제로 멈췄는가',
    goal: '문장 사이에서 멈추고, 말 빠르기가 적당한 범위 안이면 성공이에요.',
    lastWord: '상대가 받아 적을 수 있는 빠르기로.',
    variations: [
      { id: 'fa-pause', axis: 'time', label: '쉼 1초', change: '문장이 끝나면 속으로 "하나"를 센 뒤 다음 문장 시작', hold: '목소리 크기와 문장은 그대로', observe: '멈춘 게 녹음에서도 들리는가', strength: 1 },
      { id: 'fa-low', axis: 'sound', label: '낮은 톤으로', change: '평소보다 조금 낮은 목소리로', hold: '문장과 멈추는 자리는 그대로', observe: '말 빠르기도 같이 느려지는가', strength: 1 },
      { id: 'fa-slow-start', axis: 'approach', label: '느리게 시작해 평소로', change: '첫 문장은 아주 느리게, 둘째 문장부터 평소 빠르기로', hold: '문장은 그대로', observe: '둘째 문장에서도 멈추는 자리가 있는가', strength: 2 },
      { id: 'fa-hands', axis: 'body', label: '손을 무릎에', change: '두 손을 무릎에 두고 말하기', hold: '목소리 크기와 문장은 그대로', observe: '멈춘 게 녹음에서도 들리는가', strength: 2 },
    ],
  },
  diction: {
    concern: 'diction',
    label: '또렷함',
    emoji: '🗣️',
    metric: 'clarity',
    keyInfo: '글자 하나하나가 또렷이 들렸는가 (특히 받침)',
    goal: '처음 듣는 사람도 알아듣게, 문장 글자의 95% 이상을 알아들으면 성공이에요.',
    lastWord: '처음 듣는 사람도 한 번에 알아듣게.',
    variations: [
      { id: 'di-coda', axis: 'sound', label: '받침 살리기', change: '받침 있는 글자는 받침 소리까지 분명하게 낸 뒤 다음 글자로', hold: '빠르기와 문장은 그대로', observe: '받침이 들리는가', strength: 1 },
      { id: 'di-slow', axis: 'time', label: '느리게', change: '평소보다 느리게', hold: '목소리 크기와 문장은 그대로', observe: '글자 첫소리가 분명한가', strength: 1 },
      { id: 'di-open', axis: 'body', label: '입을 크게', change: '"아, 오, 우" 같은 소리마다 입을 평소보다 크게 벌리기', hold: '빠르기와 문장은 그대로', observe: '글자가 하나하나 구분되는가', strength: 2 },
      { id: 'di-first-word', axis: 'approach', label: '첫 단어만 또렷하게', change: '첫 단어만 한 글자씩 또박또박, 나머지는 평소대로', hold: '문장은 그대로', observe: '뒤 단어들도 첫 단어만큼 또렷한가', strength: 2 },
    ],
  },
}

// ─── 학습 원리 (9교시 41쪽) ───────────────────────────────────────────────────

export const LEARNING_PRINCIPLES: { title: string; body: string }[] = [
  { title: '연습이 조금 어려워야 실전이 쉬워져요', body: '연습마다 몸 풀기와 도전, 두 단계를 해요. 도전은 잘 안 되는 게 정상이에요.' },
  { title: '어려워지는 지점을 집중해서 연습해요', body: '진단에서 처음 어려워진 단계 주변만 연습해요. 거기가 가장 빨리 바뀌는 곳이에요.' },
  { title: '측정은 앱이 해요. 당신은 상대에게 말하는 데만 집중하세요', body: '떨림, 빠르기, 크기는 녹음으로 재요. 목이나 입 모양을 신경 쓰기보다, 앞에 있는 사람에게 말을 건네는 데 마음을 두세요.' },
  { title: '점수는 오르내리며 자라요', body: '연습 직후에 좋아진 건 몸이 풀려서일 수 있어요. 진짜 변화는 다음 연습을 시작할 때 보여요. 길게 봐요.' },
  { title: '안 되는 날은 방법을 바꿔요', body: '말하는 방식을 조금 바꾸거나 한 단계 낮춰요. 당신 탓이 아니라 방법을 바꿀 때라는 신호예요.' },
]
