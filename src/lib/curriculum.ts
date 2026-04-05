export type Theme = 'accuracy' | 'speed' | 'emotion'

export interface Script {
  id: string
  text: string
  description: string
}

export interface DayCurriculum {
  theme: Theme
  label: string
  emoji: string
  description: string
  script: Script
}

// 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
export const THEME_BY_DOW: Record<number, Theme> = {
  0: 'emotion',
  1: 'accuracy',
  2: 'speed',
  3: 'emotion',
  4: 'accuracy',
  5: 'speed',
  6: 'emotion',
}

export const THEME_INFO: Record<Theme, { label: string; emoji: string; description: string }> = {
  accuracy: {
    label: '정확도 훈련',
    emoji: '🎯',
    description: '한 글자도 빠짐없이, 또렷하게 발음하며 읽어보세요',
  },
  speed: {
    label: '속도 훈련',
    emoji: '⚡',
    description: '뉴스 앵커처럼 초당 5~6글자의 자연스러운 속도로 읽어보세요',
  },
  emotion: {
    label: '감정 훈련',
    emoji: '🎭',
    description: '상황에 맞는 감정을 담아 자연스럽게 읽으면 스탬프가 부여돼요',
  },
}

export const THEME_TIPS: Record<Theme, { tip: string; exercise: string }[]> = {
  accuracy: [
    { tip: '입을 크게 벌리고 각 음절을 또렷하게 끊어 읽어보세요.', exercise: '거울을 보며 입 모양을 확인하면서 읽으면 더 효과적이에요.' },
    { tip: '천천히 읽어도 괜찮아요. 정확함이 속도보다 중요합니다.', exercise: '어려운 부분을 3회 반복 후 전체를 이어 읽어보세요.' },
  ],
  speed: [
    { tip: '말하기 전 숨을 충분히 들이쉬고 시작하세요.', exercise: '메트로놈 앱을 켜고 박자에 맞춰 읽으면 속도 감각이 생겨요.' },
    { tip: '단어 사이의 끊음을 자연스럽게 유지하며 읽어보세요.', exercise: '뉴스를 보며 아나운서의 속도를 따라 읽는 섀도잉을 해보세요.' },
  ],
  emotion: [
    { tip: '그 상황에 실제로 있다고 상상하며 읽어보세요.', exercise: '읽기 전 5초간 눈을 감고 장면을 머릿속에 그려보세요.' },
    { tip: '감정이 목소리 톤, 속도, 볼륨에 자연스럽게 배어나오도록 해보세요.', exercise: '같은 문장을 전혀 다른 감정으로 읽어보며 차이를 느껴보세요.' },
  ],
}

export const ACCURACY_SCRIPTS: Script[] = [
  {
    id: 'acc-1',
    text: '간장 공장 공장장은 강 공장장이고 된장 공장 공장장은 장 공장장이다.',
    description: "자음 'ㅈ'과 'ㄱ'의 정확한 발음을 연습하는 문장이에요.",
  },
  {
    id: 'acc-2',
    text: '경찰청 쇠창살은 외쇠창살이고 검찰청 쇠창살도 외쇠창살이다.',
    description: '겹받침과 연음 규칙을 정확하게 읽어보세요.',
  },
  {
    id: 'acc-3',
    text: '저 분은 백 법학 박사이고 이 분은 박 법학 박사이다. 두 분 다 훌륭한 법학 박사님이시다.',
    description: "'ㅂ' 받침 연음과 'ㄱ' 경음화를 연습해보세요.",
  },
]

export const SPEED_SCRIPTS: Script[] = [
  {
    id: 'spd-1',
    text: '오늘 오전 서울 도심에서 기습 폭우가 내려 출근길 시민들이 큰 불편을 겪었습니다. 기상청은 오후까지 강한 비가 이어질 것으로 예보하며 우산 지참을 당부했습니다.',
    description: '뉴스 앵커 속도, 초당 5~6글자를 목표로 해보세요.',
  },
  {
    id: 'spd-2',
    text: '정부는 오늘 새로운 경제 활성화 정책을 발표했습니다. 이번 정책은 중소기업 지원과 일자리 창출을 핵심 목표로 삼고 있으며 다음 달부터 본격 시행될 예정입니다.',
    description: '또렷하면서도 빠르게, 뉴스 속도를 목표로 해보세요.',
  },
  {
    id: 'spd-3',
    text: '해외 주요 증시가 일제히 상승세를 보이며 국내 투자자들의 관심이 높아지고 있습니다. 전문가들은 당분간 상승 흐름이 이어질 것으로 전망하면서도 신중한 투자를 조언했습니다.',
    description: '전문 용어도 정확하게 발음하며 속도를 맞춰보세요.',
  },
]

export const EMOTION_SCRIPTS: Script[] = [
  {
    id: 'emo-1',
    text: '요즘 많이 힘들었지? 그 말 듣고 나도 마음이 아팠어. 괜찮아, 여기 있을게. 네가 힘들 때 내가 곁에 있으면 좋겠어.',
    description: '힘들어하는 친구를 위로하는 상황이에요. 따뜻하고 진심 어린 톤으로 읽어보세요.',
  },
  {
    id: 'emo-2',
    text: '여러분, 저는 오늘 정말 설레는 마음으로 이 자리에 섰습니다. 지난 6개월간 우리 팀이 함께 만들어낸 이 결과를 드디어 여러분께 선보일 수 있게 되었습니다.',
    description: '발표 시작 장면이에요. 열정과 흥분이 담긴 목소리로 읽어보세요.',
  },
  {
    id: 'emo-3',
    text: '정말 고마워요. 당신이 옆에 있어줘서 제가 여기까지 올 수 있었어요. 이 감사함을 어떻게 다 표현해야 할지 모르겠지만 진심으로 고맙습니다.',
    description: '깊은 감사를 전하는 장면이에요. 진지하고 진심 어린 감정을 담아보세요.',
  },
]

export const SCRIPTS_BY_THEME: Record<Theme, Script[]> = {
  accuracy: ACCURACY_SCRIPTS,
  speed: SPEED_SCRIPTS,
  emotion: EMOTION_SCRIPTS,
}

function pickScript(scripts: Script[]): Script {
  // rotate daily so users don't always see the same script
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  )
  return scripts[dayOfYear % scripts.length]
}

export function getTodayCurriculum(): DayCurriculum {
  const dow = new Date().getDay()
  const theme = THEME_BY_DOW[dow]
  const info = THEME_INFO[theme]
  const script = pickScript(SCRIPTS_BY_THEME[theme])
  return { theme, ...info, script }
}
