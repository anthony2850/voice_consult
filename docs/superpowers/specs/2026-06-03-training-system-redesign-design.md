# 훈련 시스템 재설계 — outcome 중심 5-Day 사이클

**작성일**: 2026-06-03
**대상**: `src/lib/curriculum.ts`, `src/components/training/`, `src/app/training/`
**관련 자료**: [16-exercise pool draft](../research/2026-06-03-exercise-pool-draft.md)
**상태**: 합의된 설계. 구현 plan은 별도 문서로.

---

## 1. 배경

지난 5-Day 커리큘럼(호흡·립트릴·공명·속도·발음)은 *임의로 채워둔* 플레이스홀더였음. 운동 콘텐츠는 잠정이라 명시했으나, Day 테마 자체도 과학적 근거 없이 결정. 본 spec은 실제 발성치료/코칭 기법을 바탕으로 Day 구조와 세션 모델을 재정의.

**목표:**
- 발성지도사 1:1 코칭을 어플 가이드만으로 대체 가능한 구조
- 임상 검증된 기법 기반 (VFE, SOVT, LSVT LOUD, Lessac, RVT 등)
- "갈고닦다" 메시지 — 결함 교정이 아닌 시그니처 다듬기
- 사용자가 *매일* 들어오지 못해도 자연스러운 진행

---

## 2. 결정 요약

| # | 결정 | 선택 |
|---|---|---|
| D1 | Day 테마 성격 | outcome 기반 (메커니즘/결함 아님) |
| D2 | 사이클 길이 | 5 Days |
| D3 | Day 1~4 | 고정 outcome (안정 / 전달력 / 명료성 / 표현력) |
| D4 | Day 5 | 사용자 elective — outcome 픽 |
| D5 | 한 세션 운동 수 | 4 micro-exercises (해당 영역의 L1→L4 모두) |
| D6 | 운동 개당 시간 | 1-2분 (짧고 가볍게) |
| D7 | 세션 총 시간 | ~5-8분 |
| D8 | Day 진행 방식 | 세션 기반 (캘린더 무관) — 진입할 때마다 다음 Day |
| D9 | 워밍업·쉬는 날 | 없음 — 매 진입이 즉시 본 운동 |
| D10 | concern 역할 | focus 마커 (콘텐츠 게이트 아님). 매칭 Day 시각 강조 + voice-check 점수 우선 + 졸업 뱃지 |
| D11 | 코스 졸업 | 1 cycle(5 sessions) = 모든 영역 L1-L4 1회 경험 |
| D12 | 사이클 반복 | scriptPool / parameter 변주로 무한 반복 가능 |

---

## 3. Day 구조

### 5 Day 정의 (고정 순서)

| Day | Outcome | 매칭 concern | 그 Day의 4개 micro-exercise (L1→L4) |
|---|---|---|---|
| 1 | **안정** Stability | 떨림 | 4-7-8 호흡 / 모음 유지 / 립트릴 음계 / 안정된 문장 |
| 2 | **전달력** Projection | 작은 목소리 | 복식호흡 / 빨대 호흡 / 험→모음 / 거리감 시뮬 |
| 3 | **명료성** Clarity | 발음 웅얼거림 | 입술·혀 풀기 / 자음 정밀화 / 잰말놀이 / 자연 문장 |
| 4 | **표현력** Expression | 빠른 말 | 메트로놈 / 의도적 휴지 / 슬로우 섀도잉 / 목표 BPM |
| 5 | **선택** Elective | (사용자 픽) | 위 4 outcome 중 사용자가 픽한 outcome의 4 운동 |

### Concern → outcome 1:1 매핑

```
떨림            ↔  안정 (Day 1)
작은 목소리      ↔  전달력 (Day 2)
발음 웅얼거림    ↔  명료성 (Day 3)
빠른 말         ↔  표현력 (Day 4)
```

### Day 진행은 세션 기반 — 캘린더 무관

진행은 *세션 단위*. 두 진입 사이에 며칠이 지나든 시스템엔 영향 없음. 시스템 관점에서 "어제 안 들어옴"이라는 개념이 존재하지 않음 — 다음 진입은 항상 마지막 진입의 직후로 이어짐.

```
진입 1 → Day 1 안정 (4 운동) → 완료 → currentSlot = 2
진입 2 → Day 2 전달력         → 완료 → currentSlot = 3
진입 3 → Day 3 명료성         → 완료 → currentSlot = 4
진입 4 → Day 4 표현력         → 완료 → currentSlot = 5
진입 5 → Day 5 (사용자 픽)    → 완료 → currentSlot = 1, currentCycle++
```

진입 간격은 자유 — 매일 진입해도 OK, 일주일에 한 번이어도 다음 Day로 자연스럽게 이어짐. `currentSlot`이 5를 초과하면 `currentCycle++`, `currentSlot = 1`로 리셋.

단, streak(연속 일수)는 별개 — 캘린더 기반으로 계산하므로 이탈일 발생 시 끊김. streak는 진행 상태와 독립적.

---

## 4. 세션 모델

### 4-step micro-exercise 시퀀스

한 세션 = 그 Day의 4 micro-exercises를 L1→L4 순차 진행:

```
Step 1 / 4   L1 (토대)         ~1-2분
   ↓ (5-10초 다음 안내)
Step 2 / 4   L2 (드릴)         ~1-2분
   ↓
Step 3 / 4   L3 (통합)         ~1-2분
   ↓
Step 4 / 4   L4 (적용)         ~1-2분
   ↓
완료 화면
```

### 운동 사이 전환

각 운동 사이엔 짧은 안내 카드 (5-10초):
```
"잘 했어요. 다음 운동으로 →"
"[L2 모음 유지] 한 호흡에 5초 유지를 목표로"
```

### 한 운동의 내부 구조

각 micro-exercise는 기존 `ExerciseUnit` 타입 그대로:
- `title`, `description`, `instructions[]`, `durationSec`, `interaction`
- 짧음(1-2분)을 위해 `durationSec: 60-120`
- `interaction: 'guided' | 'record'` (+ 신규: `'metronome'`, `'breath-pacer'`, `'stopwatch'`)

---

## 5. 사이클 반복 & 변주

### 사이클 = 5 sessions

5 Day 모두 진행하면 1 cycle 완료. 코스 졸업 개념은 없음 — 사이클이 무한 반복.

### 변주 메커니즘 (권태 방지)

같은 운동 ID를 여러 cycle에 걸쳐 반복하되, **runtime parameter 변주**:

1. **`scriptPool` 회전**: 녹음 운동의 스크립트가 cycle마다 다른 것 추천
   - 예: A-L4 거리감 시뮬 — cycle 1엔 "안녕하세요" 류, cycle 2엔 "오늘 날씨가" 류
2. **메트로놈 BPM 점증**: C-L1 메트로놈 — cycle 1엔 60 BPM, cycle 2엔 70 BPM, ...
3. **시간 점증**: B-L2 모음 유지 — cycle 1엔 5초 목표, cycle 2엔 7초, ...

변주 로직은 컴포넌트 내부 또는 `ExerciseUnit`에 `cycleVariants` 필드로 정의 (선택).

### Cycle별 voice-check 추천

매 cycle 마무리(Day 5 완료 시) voice-check CTA 강조. 사이클별 점수 추이로 진척 시각화.

---

## 6. Day 5 elective UX

### 픽 화면

Day 5 진입 시 4개 outcome 카드 표시:

```
┌─ Day 5 · 선택 ───────────────┐
│ 어떤 영역을 한 번 더?         │
│                              │
│ [🫁 안정]   [📢 전달력]      │
│ [🗣️ 명료성] [⚡ 표현력]      │
└──────────────────────────────┘
```

선택 시 그 outcome의 4 운동 세션 진입 (Day 1~4와 동일 모양).

### 변주 동작

- 픽한 outcome의 4 운동을 현재 cycle level에 맞춰 진행
- 같은 outcome을 사이클마다 픽해도 scriptPool 변주로 새로움

### 사용자 추천

매칭 concern이 1개뿐인 user에겐 비매칭 outcome 픽을 권장 (cross-train):
```
"오늘 안정은 충분히 하셨어요. 명료성도 한 번 다듬어볼까요?"
```
optional. 무시해도 됨.

---

## 7. concern 역할 정리

### 무엇을 하느냐 (변경된 부분)

- **focus 마커**: 매칭 Day에 "⚡ 당신이 가장 빛날 단계" 강조 배너 (Phase 1)
- **voice-check 우선 축**: 사이클 마무리 voice-check에서 그 축 점수를 가장 크게 표시 (Phase 1)
- **졸업 뱃지**: 매 사이클 매칭 Day 완료 시 axis-specific 뱃지 ("떨림 마스터 1단", ...) — **Phase 2**

### 무엇을 안 하느냐

- **콘텐츠 게이트**: 비매칭 Day를 막거나 다른 콘텐츠를 보여주지 않음. 모든 사용자가 Day 1~5 모두 진행.
- **deep mode**: 제거. 매칭/비매칭 모두 같은 4 micro-exercise.

---

## 8. 데이터 모델 변경

### `curriculum.ts` 수정

```typescript
export type Outcome = 'stability' | 'projection' | 'clarity' | 'expression'

export const OUTCOME_LABELS: Record<Outcome, string> = {
  stability: '안정',
  projection: '전달력',
  clarity: '명료성',
  expression: '표현력',
}

// concern → outcome 1:1 매핑
export const CONCERN_TO_OUTCOME: Record<ConcernSlug, Outcome> = {
  trembling: 'stability',
  small_voice: 'projection',
  diction: 'clarity',
  fast: 'expression',
}

export type Interaction = 'guided' | 'record' | 'metronome' | 'breath-pacer' | 'stopwatch'

export interface ExerciseUnit {
  id: string
  title: string
  description: string
  instructions: string[]
  durationSec: number
  interaction: Interaction
  scriptPool?: string[]
  // runtime parameters (선택)
  metronomeBPM?: number
  targetDurationSec?: number
}

export interface TrainingDay {
  dayNum: 1 | 2 | 3 | 4 | 5
  outcome: Outcome | 'elective'   // Day 5는 'elective'
  theme: string                    // "안정", "전달력", ..., "선택"
  subtitle: string                 // aspirational framing 유지
  emoji: string
  matchingConcern?: ConcernSlug   // Day 5는 없음. 1:1 매핑이므로 단수
  exercises: ExerciseUnit[]        // 정확히 4개 (Day 1~4). Day 5는 빈 배열 (런타임 픽)
}

export const CURRICULUM: TrainingDay[] = [ /* Day 1~5 */ ]
```

기존 `matchingConcerns: ConcernSlug[]`, `standard`/`deep` 필드는 제거.

### 사용자 진행 상태 — 별도 저장 불요

Progress(currentCycle, currentSlot)는 기존 `user_training_logs` row 수로부터 derive:
```typescript
// 클라이언트에서 계산
const sessionCount = trainingLogs.length  // 이 사용자의 모든 세션 row
const currentCycle = Math.floor(sessionCount / 5) + 1
const currentSlot = (sessionCount % 5) + 1  // 1~5
```

- `user_training_logs.stage_num`은 "완료한 Day 번호 (1~5)" 의미로 재활용. row 1개 = 1 세션 완료 = Day 1개 완료.
- 별도 progress 테이블 신설 불요. 새 컬럼 추가도 불요.
- 단, 기존 row의 `stage_num`은 옛 5-stage 의미라 새 시스템 진입 시점에 의미 변경(추후 결정 참고).

### concern_focus는 그대로

`user_profiles.concerns TEXT[]` 유지. 의미만 "focus 마커"로 격하.

---

## 9. 마이그레이션

### 새 정의 vs 기존 (Day theme 비교)

| Day | 기존 (잠정) | 새 (확정) |
|---|---|---|
| 1 | 호흡·안정 | **안정** |
| 2 | 립트릴·이완 | **전달력** |
| 3 | 공명·볼륨 | **명료성** |
| 4 | 속도 조절 | **표현력** |
| 5 | 발음·딕션 | **선택 (elective)** |

기존 Day 매핑은 완전 폐기. 4 sample 운동도 새 16-운동 풀로 교체.

### 단계적 변경

- **Phase 1 (이 spec)**: 새 데이터 모델, Day 정의, 16 운동 데이터, 세션 플레이어 다중 step 지원
- **Phase 2 (별도)**: cycle 변주 메커니즘, 졸업 뱃지, cross-train 추천 등

Phase 2는 사용 데이터 쌓인 후 별도 spec.

---

## 10. Out of Scope

- 새 interaction 타입(`metronome`, `breath-pacer`, `stopwatch`)의 컴포넌트 구현 — 별도 plan에서 정의
- 사이클 변주 알고리즘의 세부 (scriptPool 회전 룰 등)
- 졸업 뱃지·achievement 시스템
- 추천 알고리즘 (Day 5에 cross-train 권장 등)
- 푸시 알림 / 리마인더
- 음성 분석 점수 → concern 자동 추천 정확도 개선

---

## 11. 추후 결정

- **새 interaction 타입의 우선순위**: 첫 구현 시 `metronome` 필요(C-L1), 나머지는 점진. `breath-pacer`(A-L1, B-L1)는 시각만 있으면 됨, simple
- **운동 사이 전환 카드의 정확한 UX** — auto-advance vs "다음" 버튼
- **Day 5 cross-train 추천 트리거 룰** — concern 수에 따라? 시간 경과? 사용자 행동?
- **빠른 말(C-L4) BPM 측정 정확도** — 기존 인프라로 자동 측정 가능한지 검증 필요
- **마이그레이션 시 기존 사용자 진행 상태 처리**: 기존 `user_training_logs.stage_num`은 옛 5-stage 의미. 새 시스템에선 1~5 Day 의미로 reinterpret 가능하지만, 연속성은 보장 못함. user_count가 적으면 그냥 reset 권장.
