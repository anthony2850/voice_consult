# 결제 퍼널 (린 스타트업 3단 가격) 설계

**날짜**: 2026-08-17
**상태**: 승인됨

## 목표

기능 추가 없이, 이미 만들어진 부품(체크아웃, confirm API, 사전등록 폼)을 이어서 3단 가격 퍼널을 완성하고 각 단계 전환율을 측정한다.

| 티어 | 가격 | 제공물 | 상태 |
|------|------|--------|------|
| 무료 | 0원 | Voice persona 매칭 + 목소리 품질 요약 (현재 /result 그대로) | 변경 없음 |
| 리포트 | 990원 | /report AI 상세 리포트 (게스트 결제, 서버 검증 게이트) | 배선 + 게이트 추가 |
| 훈련 | 4,900원 (출시가 표기) | fake door — 이메일 사전등록만 받음, 결제 없음 | /training을 랜딩으로 교체 |

## 결정 사항

- **게스트 결제 허용**: 로그인 불요. orderId를 localStorage에 저장해 언락. 기기 변경 시 재열람 불가는 990원 가격대에서 수용.
- **서버 검증 게이트 (B안)**: 클라이언트 플래그만으로 열지 않는다. `/api/generate-report`가 Supabase `payments` 테이블에서 orderId 승인 상태를 확인한 뒤에만 LLM 리포트를 생성한다. 측정 신뢰도 + LLM 비용 통제 목적.
- **훈련 fake door**: 기존 /training 커리큘럼·세션 화면은 코드 유지하되 라우트 진입을 사전등록 랜딩으로 교체. 무료 베타로 열어두지 않는다 (유료 가치 훼손 방지, 수요 측정 순수성).
- **티저형 페이월**: result 하단에 리포트 5개 섹션 목차를 자물쇠와 함께 노출 후 990원 CTA.

## 퍼널 구조

```
녹음(/record)
  → 결과(/result)          [무료] 페르소나 매칭 + 품질 요약
      ├─ CTA① "상세 리포트 990원" → /checkout → Toss 결제
      │      → /result/success (confirm) → /report?orderId=...
      └─ CTA② "훈련 프로그램 사전등록 (출시가 4,900원)" → 이메일 폼
  /report                   [유료] orderId 서버 검증 후 AI 리포트 생성
  /training                 [숨김] 사전등록 랜딩으로 교체
```

## 컴포넌트별 변경

### 1. /result (ResultClient)
- 하단에 **잠긴 리포트 티저 섹션** 추가: 기존 checkout FEATURES 5개 항목(감정 분석, 대인관계, 스트레스, 커리어, 성장 가이드)을 자물쇠 아이콘과 함께 나열 + "990원으로 전체 리포트 보기" CTA → `/checkout` 이동.
- 기존 사전예약 카드에 "출시가 4,900원" 가격 명시 추가.
- 이미 결제한 유저(localStorage.paidOrderId 존재)에게는 티저 대신 "리포트 보기" 버튼.

### 2. /checkout (CheckoutClient)
- 기존 UI/위젯 유지. successUrl은 기존 `/result/success` 유지.
- 새 동선에서는 결제 성공 시 Toss가 `/result/success`로 리다이렉트하므로 checkout 내부의 'processing'(가짜 진행률) 화면은 도달 불가 — 해당 step과 `/result?paid=1` 이동 코드는 제거. 리포트 생성 로딩 UI는 /report가 이미 보유.
- `?error=` 쿼리 파라미터 수신 시 에러 배너 노출 (현재 파라미터만 받고 미표시).

### 3. /result/success
- confirm 성공 시 `localStorage.paidOrderId = orderId` 저장 후 `/report?orderId=...`로 리다이렉트.
- (서버 컴포넌트에서 localStorage 불가하므로, 실제 저장은 리다이렉트 대상 클라이언트에서 orderId 쿼리 파라미터를 받아 수행)

### 4. /api/payment/confirm
- 현재 결제 내역 Supabase 저장 실패 시 로그만 남김 → **1회 재시도** 추가. 저장 실패는 게이트가 정당한 결제자를 막는 사고로 이어지므로.

### 5. /api/generate-report
- 요청 body에 `orderId` 추가.
- Supabase `payments`에서 `order_id = ? AND status = 'DONE'` 조회. 미존재 시 **402** 응답, 리포트 생성 안 함.

### 6. /report (ReportClient)
- 진입 시 `orderId` (쿼리 파라미터 우선, 없으면 localStorage.paidOrderId) 확인. 없으면 `/checkout` 리다이렉트.
- 쿼리로 받은 orderId는 localStorage에 저장 (재방문 대비).
- generate-report 호출 시 orderId 전달. 402 응답 시 `/checkout` 리다이렉트.

### 7. /training → 사전등록 랜딩
- TrainingClient 렌더 대신 사전등록 랜딩 컴포넌트 렌더.
- 내용: 프로그램 미리보기(기존 CURRICULUM Day 라벨 재활용) + "출시가 4,900원" + 이메일 폼.
- 이메일 폼은 result의 PreRegister 컴포넌트 재사용, `pre_registrations`에 `source` 컬럼 추가 (`'training_landing' | 'result_card'`).
- 기존 훈련 코드(세션, voice-check, 컴포넌트)는 삭제하지 않음.

### 8. DB (Supabase)
- `pre_registrations`에 `source text` 컬럼 추가 (마이그레이션).
- `payments` 테이블은 변경 없음.

## 퍼널 이벤트 (GA4 + Meta Pixel, 기존 trackEvent)

| 순서 | 이벤트 | 시점 |
|------|--------|------|
| 1 | `funnel_result_view` | result 페이지 로드 |
| 2 | `funnel_report_cta_click` | 990원 티저 CTA 클릭 |
| 3 | `funnel_checkout_view` | checkout 페이지 로드 |
| 4 | `payment_requested` (기존) | Toss 위젯 결제 요청 |
| 5 | `funnel_payment_done` | confirm 성공 |
| 6 | `funnel_report_view` | 리포트 렌더 완료 |
| 7 | `funnel_preregister_view` | 훈련 사전등록 랜딩 로드 |
| 8 | `submit_pre_register` (기존) | 이메일 제출 — `source`, `price: 4900` 파라미터 추가 |

## 에러 처리

- confirm 실패 → 기존대로 `/checkout?error=...` (checkout에서 에러 배너 노출 — 현재 파라미터만 받고 표시 안 하면 배너 추가).
- generate-report 402 → checkout 리다이렉트.
- generate-report LLM 실패 → 기존 에러 UI 유지 (결제는 이미 완료된 상태이므로 "다시 시도" 버튼 필수, orderId 재사용 가능해야 함 — 리포트 생성 성공 여부와 무관하게 orderId는 계속 유효).
- pre_registrations 중복 이메일(23505) → 기존대로 성공 처리.

## 범위 제외 (YAGNI)

- 환불 플로우, 결제 내역 페이지
- 사전등록 안내 메일 자동화 (수동 발송)
- 계정 연동 영구 언락 (전환율 검증 후)
- 리포트 결과 영구 저장/캐싱

## 테스트

- generate-report 게이트: orderId 없음/미승인/승인 3케이스 (vitest, Supabase 조회 모킹).
- 리다이렉트 로직: report 페이지 orderId 부재 시 checkout 이동.
- 기존 스모크 테스트(training)가 랜딩 교체로 깨지는지 확인 및 수정.
- 결제 E2E는 Toss 테스트 키로 수동 확인 (자동화 제외).
