# 훈련 탭 대대적 개편 — 설계 문서

**작성일**: 2026-05-27
**대상**: `src/app/training/` 전반
**상태**: 합의된 설계. 구현 계획은 별도 plan 문서로.

---

## 1. 배경과 목표

현재 훈련 탭은 4개 문제 기반 카테고리(작은 목소리/떨림/빠른 말/발음)를 2x2 그리드로 노출하고 있으나, 각 카테고리의 세부 운동(`/training/category/[slug]/`)이 placeholder("곧 채워질 트랙이에요") 상태로 비어 있다. 한편 레거시 `/training/[day]/`에는 5-stage 커리큘럼(호흡·립트릴·볼륨·속도·발음)이 인터랙티브 구현되어 있다.

본 개편의 목표:

- **통합 5단계 커리큘럼**으로 단일화 (카테고리별 별도 트랙 제거)
- **개인화는 깊이로** — 사용자 선언 고민과 일치하는 Day는 더 깊게(deep mode)
- **콘텐츠 기획과 시스템 구현을 분리** — 프레임워크는 데이터 중심, 콘텐츠는 별도 트랙으로 추가
- **권태 방지 메커니즘 내장** — 스크립트 풀 + 주간 voice-check 추이

비목표:
- 발성 코치 콘텐츠 자체의 완성 (별도 조사·기획 진행)
- 푸시 알림, 친구 비교, 소셜 기능
- 보이스 코치 영상 통합

---

## 2. 결정 요약

브레인스토밍을 통해 합의된 핵심 결정사항:

| # | 결정 | 선택지 중 |
|---|---|---|
| D1 | 사용자의 "오늘 뭐 하지?" 답을 누가 주도하나 | 하이브리드 (앱 추천 + 오버라이드) |
| D2 | 한 세션의 모양 | 미니 루틴, 마이크로 운동 3-5개, ~10분 |
| D3 | 추천의 근거 | 사용자가 선언한 고민 (진단 점수는 보조) |
| D4 | 카테고리 내 운동 순서 | 고정 순차 (Day 1→5) |
| D5 | 카테고리 구조 | **통합 커리큘럼** (카테고리별 트랙 폐기) |
| D6 | 권태 방지 | A. 스크립트 풀 + B. 주간 voice-check |
| D7 | 통일성과 개인화 충돌 해결 | **깊이로 개인화** (다른 축 운동 섞지 않음. 같은 테마 안에서 깊이↑) |
| D8 | 고민 캡처 시점 | 진단 직후 모달, 다중 선택 |
| D9 | 마이그레이션 방식 | 빅뱅 (기존 페이지 즉시 폐기) |

---

## 3. 정보 아키텍처 (Section 1)

### 5단계 통합 커리큘럼

> **주의**: 아래 5가지 테마는 **잠정 안**이며 별도 발성 코치 콘텐츠 조사 후 확정. 시스템(데이터 모델, 세션 플레이어, deep 발동 로직)은 테마 목록·개수와 무관하게 작동하도록 설계되어 있어, 추후 테마 변경 시 `CURRICULUM` 데이터만 수정.

| Day | 테마 (잠정) | 매칭 고민 (deep mode 발동) |
|---|---|---|
| 1 | 호흡·안정 | trembling |
| 2 | 립트릴·이완 | trembling |
| 3 | 공명·볼륨 | small_voice |
| 4 | 속도 조절 | fast |
| 5 | 발음·딕션 | diction |

5-day 사이클로 매일 1단계씩 진행. Day 5 완료 후 Day 1로 순환.

### 랜딩 화면 구성

```
┌─ 훈련 랜딩 ──────────────────────────────────┐
│ 🔥 N일 연속                                  │
│ 📊 [이번 사이클 voice-check 추이]            │
│                                              │
│ ┌────────────────────────────────────────┐  │
│ │ 오늘의 단계 · Day 3 / 5                │  │
│ │ 🎯 공명·볼륨                            │  │
│ │ (axis match 시) "당신의 핵심 단계예요"  │  │
│ │ [ Start ▶ ]                            │  │
│ └────────────────────────────────────────┘  │
│                                              │
│ 다른 단계 둘러보기                          │
│ [Day1 호흡] [Day2 이완] [Day4 속도] [Day5 발음] │
│                                              │
│ 현재 고민: [작은 목소리, 떨림] [변경]        │
│                                              │
│ 훈련 후 목소리 변화 측정 →                  │
└──────────────────────────────────────────────┘
```

### 제거되는 요소

- 4개 카테고리 카드 (작은/떨리는/빠른/발음)
- `/training/category/[slug]/` 라우트
- `src/lib/trainingCategories.ts`

---

## 4. Daily Session Flow (Section 2)

### 세션 구성 규칙

- **표준 day**: 마이크로 운동 3~5개, 단일 테마, 시퀀스 (~8-10분)
- **약점 일치 day**: 5~7개 (표준 + deep 운동 1~2개), 단일 테마 (~12-15분)

각 운동은 1~2분짜리 단일 목적 유닛. 워밍업 → 드릴 → 응용의 자연스러운 흐름.

### Deep mode 발동 규칙

사용자의 `concerns` 배열에 *하나라도* 해당 Day의 `matchingConcerns`와 교집합이 있으면 deep:

- 작은 목소리 → Day 3
- 떨림 → Day 1, Day 2 (둘 다 deep)
- 빠른 말 → Day 4
- 발음 → Day 5
- `concerns = []` (미선언) → 모든 Day 표준

### 데이터 모델 (`src/lib/curriculum.ts` 재작성)

```typescript
export type ConcernSlug = 'small_voice' | 'trembling' | 'fast' | 'diction'
export type Interaction = 'guided' | 'record' | 'metronome' | 'visualizer'

export interface ExerciseUnit {
  id: string
  title: string
  description: string
  instructions: string[]
  durationSec: number
  interaction: Interaction
  scriptPool?: string[]   // 권태 방지: 매 진입마다 랜덤 선택
  audioGuide?: string     // 선택: 코치 음성 안내
}

export interface TrainingDay {
  dayNum: 1 | 2 | 3 | 4 | 5
  theme: string                    // "공명·볼륨"
  emoji: string
  matchingConcerns: ConcernSlug[]  // ['small_voice']
  standard: ExerciseUnit[]         // 3-5개
  deep: ExerciseUnit[]             // 1-2개 추가
}

export const CURRICULUM: TrainingDay[] = [/* Day 1~5 */]
```

### 세션 플레이어

`/training/session/[day]/` 경로에 새 플레이어 컴포넌트.

- 진입 시 `concerns` 로딩 → standard만 vs standard+deep 결정
- 시퀀스 진행: Step N / M, "다음", 마지막 운동은 "훈련 완료"
- 각 `ExerciseUnit`은 `<ExerciseUnitRenderer>`가 `interaction` 타입에 따라 sub-renderer 분기:
  - `'guided'`: 안내문만, 시간 카운트
  - `'record'`: 안내 + recorder + 즉시 피드백 (기존 패턴 재활용)
  - `'metronome'`: 비트 따라 시각화 (신규 컴포넌트)
  - `'visualizer'`: 라이브 피치/볼륨 시각화 (기존 useWaveform 등 재활용)

### Streak / 저장

- 세션 *완료* 시 `user_training_logs` 1개 row 저장 (day_num, log_date)
- 약점 일치 day(운동 더 많음)도 1 row = 1 streak 카운트
- 깊이는 동기부여용, 카운트용 아님
- 기존 streak 계산 로직 (연속 일수) 그대로 재활용

### Cycle 위치 계산

- 가장 최근 완료된 log의 `day_num` 다음을 "오늘의 단계"로
- 첫 진입 시 → Day 1
- 오늘 이미 완료했으면 → "오늘 완료" 상태, 다음 단계는 내일 (강제로 다음 단계 진행 가능 — 오버라이드)

### Voice-check 트리거 (권태 방지 B)

Day 5 완료 직후 추천 카드 표시 → 기존 `/training/voice-check/` 진입.
추이 그래프는 voice-check 결과 화면 또는 훈련 랜딩에 시각화 추가.

---

## 5. 온보딩 & 고민 캡처 (Section 3)

### 캡처 방식: 진단 직후 모달 (다중 선택)

`/result` 페이지에서 voice 분석 결과 표시 직후, "고민 확인" 모달.

- 점수 기반 자동 사전 선택: 안정감/전달력/표현력 중 임계값(예: 75점) 미만인 축을 → 매핑된 concern을 사전 체크
- 사용자가 체크박스로 편집 가능 (다중 선택)
- "선택할수록 매일 훈련이 깊어져요. 보통 1-2개를 추천" 힌트
- 저장 → "훈련 시작" CTA

매핑 (점수 축 → concern):
- 안정감 ↓ → trembling
- 전달력 ↓ → small_voice 또는 fast (어느 쪽일지 점수만으로 모호. 일단 사용자가 직접 선택하는 영역에 두 옵션 다 노출)
- 표현력 ↓ → 발음/딕션과 직결되지는 않음. UI에서 사용자가 직접 판단

(상세 매핑 표는 구현 시 결정.)

### 변경 가능성

훈련 랜딩 헤더에 "현재 고민: [...] [변경]" 링크.
변경 시 같은 모달 재오픈, `concerns` 덮어쓰기, `concerns_set_at` 갱신.

### 진단 미수행 사용자

훈련 탭 진입 시 "먼저 분석부터 받아볼래요?" CTA → `/record`로 유도.
스킵하고 진입하면 `concerns = []` 상태 → 모든 Day 표준 모드.

### DB 변경

```sql
-- user_profiles 또는 별도 테이블에 추가
ALTER TABLE user_profiles ADD COLUMN concerns TEXT[] DEFAULT '{}';
ALTER TABLE user_profiles ADD COLUMN concerns_set_at TIMESTAMPTZ;
-- CHECK 제약으로 concerns 값을 'small_voice' | 'trembling' | 'fast' | 'diction'로 제한 (선택)
```

기존 `user_profiles` 테이블이 없으면 신설.

---

## 6. 마이그레이션 (Section 4) — 빅뱅

### 유지

- `/training/voice-check/` 전부
- `useAudioRecorder`, `useWaveform` 훅
- `extractAudioFeaturesWithPraat` (Praat 측정)
- `user_training_logs`, `voice_quality_logs` 테이블
- Streak 계산 로직 (새 랜딩에 이식)

### 즉시 제거

- `/training/category/` 전체 폴더
- `src/lib/trainingCategories.ts`
- `/training/[day]/` 전체 폴더 (`DayTrainingClient.tsx` + `stages/Stage{1,2,4,5,7}Training.tsx`)
- `TrainingClient.tsx`의 4개 카테고리 카드 영역

### 신설

- `/training/session/[day]/page.tsx` + `SessionPlayerClient.tsx` (세션 플레이어)
- `src/components/training/ExerciseUnitRenderer.tsx` (interaction별 sub-renderer 분기)
- `src/components/training/exercise/` 하위에 interaction별 컴포넌트 (Guided, Record, Metronome, Visualizer)
- `src/lib/curriculum.ts` 재작성 (`CURRICULUM`, `TrainingDay`, `ExerciseUnit`)
- `/result` 페이지의 concerns 확인 모달
- DB 마이그레이션 (`concerns` 컬럼)

### 재작성

- `TrainingClient.tsx` 전체 재작성:
  - streak 영역 (유지)
  - 오늘의 단계 카드 (cycle 위치 + axis match 강조)
  - 다른 단계 4개 (오버라이드)
  - 현재 고민 표시 + 변경 링크
  - voice-check CTA (유지)

### v1 콘텐츠 범위

각 Day에 sample 운동 1~2개만 채워 시스템 검증. 코치 콘텐츠 조사 완료 후 데이터만 추가하면 됨 (코드 변경 없음).

---

## 7. Out of Scope (YAGNI)

- 푸시 알림 / 리마인더
- 운동 일시정지 / 부분 저장
- 세션 건너뛰기
- 사이클 위치 사용자 임의 조정
- 진단 점수 추이 비교 (Voice-check 자체 추이만)
- 사용자별 운동 즐겨찾기 / 커스텀 순서
- 코치 음성 안내 (`audioGuide` 필드는 정의만, 사용은 추후)
- 콘텐츠 자체의 완성 (별도 조사 트랙)

---

## 8. 미해결 / 추후 결정

- **Day별 테마 확정**: 호흡/이완/공명/속도/발음 5분류는 잠정 안. 발성 코치 콘텐츠 조사 후 테마 수·이름·순서 재검토 가능. 변경 시 `CURRICULUM` 데이터 수정으로 흡수.
- **점수 → concern 매핑 정확도**: 안정감/전달력/표현력 3축이 4개 concern과 1:1 매핑되지 않음. 모달에서 자동 사전 선택 정확도가 낮을 수 있음. 사용자 편집이 안전망.
- **scriptPool 회전 알고리즘**: 단순 랜덤 vs "최근 N회 제외 랜덤" vs 결정론적 순환. 구현 시 결정.
- **사이클 reset 정책**: 며칠 빠진 후 돌아오면 어디서 시작? 마지막 완료 다음 단계 또는 Day 1 리셋. 구현 시 결정 (제안: 마지막 완료 다음 단계, streak는 끊김).
- **Deep mode UI 차별화**: deep 운동을 "보너스 회차"로 강조 표시할지 (예: 라벨, 색상). 디자인 시 결정.
