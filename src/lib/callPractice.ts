/**
 * 전화 연습 — 정해진 시간에 캘린더 알림이 울리고, 누르면 코치에게서 "전화"가 온다.
 * 받으면 코치가 질문하고, 사용자가 대답한다. 녹음은 기기 안에서만 분석한다.
 *
 * 전화의 첫마디는 실제로 긴장되는 장면이라, 질문이 끝나고 대답을 시작하기까지의 시간과
 * 말 빠르기(쉼 뺀 조음 속도)만 보여 준다. 점수는 매기지 않는다.
 */

export const CALL_QUESTIONS: string[] = [
  '여보세요, 잠깐 통화 괜찮으세요? 오늘 하루 어떻게 보내셨는지 들려주세요.',
  '여보세요, 저 MyTone 코치예요. 지금 어디서 뭐 하고 계셨어요?',
  '여보세요, 바쁘신데 전화드려서 죄송해요. 이번 주에 있었던 일 하나만 말씀해 주시겠어요?',
  '여보세요, 오늘 점심은 뭐 드셨어요? 어땠는지 말해 주세요.',
  '여보세요, 요즘 가장 기다려지는 일이 뭐예요?',
]

export function pickCallQuestion(rand: () => number = Math.random): string {
  return CALL_QUESTIONS[Math.floor(rand() * CALL_QUESTIONS.length) % CALL_QUESTIONS.length]
}

/** 대답 녹음 길이 */
export const ANSWER_MAX_SEC = 25
export const ANSWER_MIN_SEC = 3

export type Tone = 'good' | 'caution' | 'neutral'

/** 질문이 끝나고 첫마디까지 걸린 시간 */
export function onsetFeedback(sec: number | null): { label: string; tone: Tone; line: string } {
  if (sec == null) return { label: '들리지 않음', tone: 'neutral', line: '목소리가 잘 잡히지 않았어요. 마이크에 조금 더 가까이 대고 다시 해 봐요.' }
  if (sec <= 1.5) return { label: '바로', tone: 'good', line: '질문이 끝나자 바로 대답했어요. 전화에서 가장 좋은 첫인상이에요.' }
  if (sec <= 3) return { label: '자연스러움', tone: 'good', line: '잠깐 생각하고 자연스럽게 대답을 시작했어요.' }
  return { label: '조금 늦음', tone: 'caution', line: '첫마디가 조금 늦었어요. "네, 여보세요"처럼 미리 정해 둔 첫마디가 있으면 편해져요.' }
}

/** 쉼 뺀 조음 속도 (음절/초). 전화는 얼굴이 안 보여 조금 느긋한 편이 잘 들린다. */
export function paceFeedback(rate: number | null): { label: string; tone: Tone } {
  if (rate == null || rate <= 0) return { label: '측정 안 됨', tone: 'neutral' }
  if (rate > 7) return { label: '빠름', tone: 'caution' }
  if (rate < 4.5) return { label: '느긋', tone: 'neutral' }
  return { label: '적당', tone: 'good' }
}

/** 캘린더 알림이 여는 주소 */
export const CALL_PATH = '/call'
