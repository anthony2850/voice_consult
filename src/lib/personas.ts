/**
 * 목소리 장면 페르소나 — "오늘 당신 목소리는 이런 장면처럼 들려요."
 * 설계: docs/superpowers/specs/2026-10-18-voice-scene-persona-design.md
 *
 * 장면은 에너지(들뜸↔차분) × 기분(맑음↔흐림) 지도의 네 칸에 둘씩 놓인다.
 * 판정은 src/lib/voiceScene.ts.
 */

export type Quadrant = 'up-clear' | 'down-clear' | 'down-cloudy' | 'up-cloudy'

export type PersonaId =
  | 'concert' | 'puppy'
  | 'cafe-book' | 'sunday'
  | 'clock-out' | '3am'
  | 'holiday' | 'crush'

export interface Persona {
  id: PersonaId
  quadrant: Quadrant
  name: string
  /** 한 줄 */
  tagline: string
  /** "너무 나잖아" 공감 문장 세 개 */
  lines: [string, string, string]
  /** 코치 한마디 앞에 붙는 강점 한 줄 */
  strength: string
  /** 장면 목록에 쓰는 예시 대사 */
  script: string
  /** 대표색 (중간 밝기). 글자는 위에 직접 쓰지 않는다 — sceneTint / sceneInk 사용. */
  color: string
  /** 칸 안에서 둘을 가르는 대표 감정 */
  signature: string[]
}

export const PERSONAS: Persona[] = [
  {
    id: 'concert',
    quadrant: 'up-clear',
    name: '콘서트 직관 중인 팬',
    tagline: '응원봉 들고 떼창하는 목소리',
    lines: ['말하다 보면 목소리가 점점 커지는 편', '리액션 하나로 분위기를 올려요', '다음 날 목이 쉬어 있을 때가 있어요'],
    strength: '에너지가 넘쳐서 분위기를 살려요.',
    script: '꺄 미쳤다! 방금 그 고음 들었어? 나 진짜 소름 돋았어!',
    color: '#E8875A',
    signature: ['Excitement', 'Ecstasy', 'Triumph', 'Joy'],
  },
  {
    id: 'puppy',
    quadrant: 'up-clear',
    name: '강아지 본 직후인 사람',
    tagline: '"어머 너 누구야~" 한 톤 올라간 목소리',
    lines: ['아기나 동물 앞에선 저절로 목소리가 높아져요', '칭찬이 진심으로 들리는 편', '전화 받을 때 \'솔\' 톤이 나와요'],
    strength: '다정하게 들려서 듣는 사람이 편해져요.',
    script: '어머어머, 너 왜 이렇게 귀여워? 이리 와 봐, 이리 와~',
    color: '#E0A54A',
    signature: ['Adoration', 'Love', 'Joy', 'Amusement'],
  },
  {
    id: 'cafe-book',
    quadrant: 'down-clear',
    name: '혼자 카페에서 책 읽는 사람',
    tagline: '흔들림 없이 고르게 이어지는 목소리',
    lines: ['급한 상황에서도 목소리는 침착한 편', '설명을 들으면 이해가 잘 된다는 말을 들어요', '가끔 "화났어?"라는 오해를 받아요'],
    strength: '차분해서 믿음이 가요.',
    script: '이 문장 좋다. 천천히 다시 읽어 봐야겠어.',
    color: '#6FA48A',
    signature: ['Calmness', 'Contemplation', 'Aesthetic Appreciation'],
  },
  {
    id: 'sunday',
    quadrant: 'down-clear',
    name: '일요일 아침 늦잠 자고 일어난 사람',
    tagline: '이불 속에서 막 나온 듯 말랑한 목소리',
    lines: ['통화하면 상대가 편해진다고 해요', '말끝이 살짝 늘어지는 편', '급한 사람에겐 답답하게 들릴 수 있어요'],
    strength: '느긋해서 듣는 사람이 편안해져요.',
    script: '음… 몇 시야? 아 몰라, 오늘은 그냥 좀 더 누워 있을래.',
    color: '#9FB06A',
    signature: ['Contentment', 'Relief', 'Calmness'],
  },
  {
    id: 'clock-out',
    quadrant: 'down-cloudy',
    name: '퇴근만 기다리는 신입사원',
    tagline: '4시 59분의 목소리',
    lines: ['"네 알겠습니다"를 하루에 열 번 하는 톤', '에너지를 아껴 쓰는 중이에요', '커피 한 잔이면 목소리가 달라져요'],
    strength: '힘을 빼고 말해서 담백하게 들려요.',
    script: '아 벌써 4시네… 30분만 더 버티면 돼. 휴…',
    color: '#7D97B8',
    signature: ['Tiredness', 'Boredom', 'Disappointment'],
  },
  {
    id: '3am',
    quadrant: 'down-cloudy',
    name: '새벽 3시 감성에 빠진 사람',
    tagline: '괜히 옛날 사진 넘겨 보는 목소리',
    lines: ['속마음 얘기를 끌어내는 목소리', '노래방에선 발라드 담당', '아침에 들으면 "어디 아파?" 소리를 들어요'],
    strength: '진심이 묻어나서 귀 기울이게 돼요.',
    script: '그때 우리 진짜 재밌었는데… 다들 잘 지내려나.',
    color: '#7482BD',
    signature: ['Nostalgia', 'Sadness', 'Contemplation', 'Love'],
  },
  {
    id: 'holiday',
    quadrant: 'up-cloudy',
    name: '명절에 친척 만난 사람',
    tagline: '웃고는 있지만 빨리 집에 가고 싶은 목소리',
    lines: ['"아 네네 하하" 리액션 장인', '긴장하면 말이 빨라져요', '그래도 끝까지 예의는 지켜요'],
    strength: '끝까지 예의 바르게 들려요.',
    script: '아 네, 하하… 취업이요? 네, 그냥 열심히 준비하고 있어요.',
    color: '#C68A9C',
    signature: ['Awkwardness', 'Embarrassment', 'Doubt', 'Anxiety'],
  },
  {
    id: 'crush',
    quadrant: 'up-cloudy',
    name: '썸 타는 중인 사람',
    tagline: '티 안 내려는데 다 티 나는 목소리',
    lines: ['웃음이 말 사이사이 새어 나와요', '긴장과 설렘이 반반', '중요한 순간엔 목소리가 살짝 떨려요'],
    strength: '설렘이 묻어나서 생동감 있게 들려요.',
    script: '아 그거? 아니 그냥… 너 생각나서 연락해 본 거야.',
    color: '#D97C92',
    signature: ['Romance', 'Excitement', 'Anxiety', 'Awkwardness'],
  },
]

export function getPersona(id: PersonaId): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]
}

export function isPersonaId(v: unknown): v is PersonaId {
  return typeof v === 'string' && PERSONAS.some((p) => p.id === v)
}

/** 대표색의 옅은 바탕 */
export function sceneTint(color: string, pct = 18): string {
  return `color-mix(in oklab, ${color} ${pct}%, white)`
}

/** 대표색의 진한 글자색 */
export function sceneInk(color: string): string {
  return `color-mix(in oklab, ${color} 55%, black)`
}
