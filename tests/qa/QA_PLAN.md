# Voice MBTI — QA 계획서

## 핵심 이슈 요약

### [CRITICAL] 공유 링크 페르소나 불일치
**재현 방법:**
1. 음성 분석 완료 → 페르소나 A 배정
2. 공유 버튼 → URL 복사 (`/result`)
3. 친구가 해당 URL 클릭 → 다른 브라우저/세션
4. 친구 화면에 페르소나 B 출력 (원본과 다름)

**근본 원인:**
- 감정 분석 결과가 `sessionStorage`에만 저장됨 (세션 로컬, 공유 불가)
- 공유 URL에 감정 데이터 파라미터 없음
- 새 세션에서 `/result` 접근 → `getMockEmotions()` (랜덤) fallback
- 랜덤 감정 → 다른 페르소나 매칭

**영향 범위:** 제품의 핵심 소셜 기능 전체

---

## 발견된 전체 이슈 목록

| # | 심각도 | 이슈 | 파일 |
|---|--------|------|------|
| 1 | 🔴 Critical | 공유 링크에서 페르소나 불일치 | `ResultClient.tsx:585` |
| 2 | 🔴 Critical | 결과 페이지 새로고침 시 페르소나 변경 | `ResultClient.tsx:558` |
| 3 | 🟠 High | Hume API 실패 시 유저에게 알림 없이 mock 데이터 사용 | `analyze-voice/route.ts:85` |
| 4 | 🟠 High | 유료 리포트 데이터가 sessionStorage에만 존재 (탭 닫으면 소멸) | `ReportClient.tsx` |
| 5 | 🟠 High | 결제 후 결과 페이지로 돌아왔을 때 emotions가 달라질 수 있음 | `CheckoutClient.tsx:61` |
| 6 | 🟡 Medium | audioFeatures sessionStorage 의존 (새로고침 시 소실) | `ResultClient.tsx:574` |
| 7 | 🟡 Medium | 트레이닝 target 감정 sessionStorage 의존 | `ResultClient.tsx:387` |
| 8 | 🟡 Medium | 로그인 계정 정보가 분석 결과와 연동 안 됨 | `mypage/page.tsx` |
| 9 | 🟢 Low | 히스토리 날짜 중복 제거 로직 fragile (자정 경계) | `mypage/page.tsx:33` |
| 10 | 🟢 Low | analyze-voice 병렬 요청 시 race condition 가능성 | `RecordClient.tsx:86` |

---

## Playwright 테스트 구성

```
tests/qa/
├── QA_PLAN.md              ← 이 문서
├── 01-pages.spec.ts        ← 전체 페이지 로드 확인
├── 02-share-bug.spec.ts    ← [CRITICAL] 공유 링크 버그 재현
├── 03-result-reliability.spec.ts  ← 결과 페이지 신뢰성
├── 04-navigation.spec.ts   ← 페이지 간 이동
├── 05-api.spec.ts          ← API 엔드포인트 안정성
└── 06-edge-cases.spec.ts   ← 비정상 입력/상태 처리
```

### 실행 방법

```bash
# 개발 서버 실행 (별도 터미널)
npm run dev

# 전체 테스트 실행
npx playwright test

# 특정 파일만 실행
npx playwright test tests/qa/02-share-bug.spec.ts

# UI 모드로 실행 (시각적으로 확인)
npx playwright test --ui

# 헤드풀 모드 (브라우저 보면서 실행)
npx playwright test --headed

# 리포트 보기
npx playwright show-report tests/qa-report
```

---

## 수정 우선순위 및 방안

### 1순위: 공유 링크 버그 (이슈 #1, #2)

**옵션 A — URL 파라미터 인코딩 (단기 해결)**
```
/result?data=<base64_encoded_emotions>
```
- 장점: 백엔드 없이 즉시 구현 가능
- 단점: URL이 길어짐, 데이터 노출

**옵션 B — DB 저장 + 공유 토큰 (권장)**
```
/result/share/<unique_id>  →  DB에서 emotions 조회
```
- Supabase가 이미 설치되어 있으므로 연동 가능
- 장점: URL 짧음, 히스토리 영구 저장, 계정 연동 가능
- 단점: 구현 공수 필요

### 2순위: API 실패 시 사용자 알림 (이슈 #3)
- Hume API 실패 시 "분석 실패, 다시 시도해주세요" 토스트 표시
- 현재는 유저 몰래 mock 데이터로 대체됨

### 3순위: 유료 리포트 영속성 (이슈 #4, #5)
- 결제 완료 시 Supabase에 emotions + 결제 ID 저장
- report 페이지에서 DB 조회로 로드

---

## 테스트 범위 현황

| 영역 | 커버리지 |
|------|---------|
| 페이지 로드 | ✅ 전체 |
| 공유 버그 재현 | ✅ 자동화 |
| 결과 신뢰성 | ✅ 데이터 주입 방식 |
| 네비게이션 | ✅ 주요 경로 |
| API 안정성 | ✅ 에러 케이스 |
| 엣지 케이스 | ✅ 비정상 데이터 |
| 음성 녹음 | ⚠️ 브라우저 마이크 필요, 수동 QA |
| 결제 플로우 | ⚠️ 실제 결제 필요, 수동 QA |
| 모바일 반응형 | ⚠️ 수동 QA 권장 |
