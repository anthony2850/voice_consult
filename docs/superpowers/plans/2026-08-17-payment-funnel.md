# 결제 퍼널 (3단 가격) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 무료(페르소나) / 990원(AI 리포트, 서버 검증 게이트) / 4,900원(훈련 fake door 사전등록) 3단 퍼널을 배선하고 각 단계를 GA4 이벤트로 측정 가능하게 만든다.

**Architecture:** 기존 부품(Toss checkout, confirm API, PreRegister 폼)을 연결한다. 게스트 결제의 orderId를 localStorage에 저장해 언락 토큰으로 쓰고, `/api/generate-report`가 Supabase `payments` 테이블에서 orderId 승인 여부를 검증한 뒤에만 LLM 리포트를 생성한다. `/training`은 사전등록 랜딩으로 교체하되 기존 훈련 코드는 보존한다.

**Tech Stack:** Next.js 16 (App Router), Supabase (`payments`, `pre_registrations`), Toss Payments Widget SDK, Anthropic SDK, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-17-payment-funnel-design.md`

## Global Constraints

- 가격: 리포트 990원, 훈련 출시가 4,900원 (fake door — 결제 없음, 이메일만 수집).
- 게스트 결제: 로그인 요구 금지. 언락 토큰은 `localStorage.paidOrderId`.
- 기존 훈련 코드(TrainingClient, session, voice-check, components/training)는 삭제 금지 — 라우트 진입만 교체.
- 이벤트는 기존 `trackEvent` (`src/lib/analytics.ts`) 사용. 스펙의 이벤트 이름 그대로: `funnel_result_view`, `funnel_report_cta_click`, `funnel_checkout_view`, `funnel_payment_done`, `funnel_report_view`, `funnel_preregister_view`, 기존 `payment_requested`/`submit_pre_register` 유지.
- Toss 승인 완료 status 값은 `'DONE'`.
- 클라이언트 컴포넌트에서 `useSearchParams()`를 쓰면 해당 page.tsx에서 `<Suspense>`로 감쌀 것 (Next.js 16 요구사항, `src/app/result/page.tsx` 참고).
- 코드 스타일: 기존 파일들의 한국어 UI 카피, glass/rounded-2xl Tailwind 패턴, `// ── 섹션 주석 ──` 관례를 따른다.

---

### Task 1: 결제 검증 라이브러리 + generate-report 게이트

**Files:**
- Create: `src/lib/verifyPaidOrder.ts`
- Test: `src/lib/verifyPaidOrder.test.ts`
- Modify: `src/app/api/generate-report/route.ts:16-27`

**Interfaces:**
- Produces: `verifyPaidOrder(client: PaymentsClient, orderId: string | null | undefined): Promise<boolean>` — `payments` 테이블에 `order_id = orderId AND status = 'DONE'` 행이 있으면 true.
- Produces: `POST /api/generate-report` — body `{ emotions?: Record<string, number> | null, orderId?: string }`. 미결제 orderId면 **402** `{ error: 'payment_required' }`. 결제 확인 후에만 리포트 생성 (mock 리포트 포함).

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// src/lib/verifyPaidOrder.test.ts
import { describe, it, expect } from 'vitest'
import { verifyPaidOrder, type PaymentsClient } from './verifyPaidOrder'

function fakeClient(result: { data: unknown; error: unknown }): PaymentsClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => result,
          }),
        }),
      }),
    }),
  }
}

describe('verifyPaidOrder', () => {
  it('orderId가 없으면 false', async () => {
    const client = fakeClient({ data: { order_id: 'x' }, error: null })
    expect(await verifyPaidOrder(client, null)).toBe(false)
    expect(await verifyPaidOrder(client, undefined)).toBe(false)
    expect(await verifyPaidOrder(client, '')).toBe(false)
  })

  it('DONE 결제 행이 없으면 false', async () => {
    expect(await verifyPaidOrder(fakeClient({ data: null, error: null }), 'order-1')).toBe(false)
  })

  it('조회 에러 시 false', async () => {
    expect(await verifyPaidOrder(fakeClient({ data: null, error: { message: 'boom' } }), 'order-1')).toBe(false)
  })

  it('maybeSingle이 throw하면 false', async () => {
    const client: PaymentsClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => { throw new Error('network') },
            }),
          }),
        }),
      }),
    }
    expect(await verifyPaidOrder(client, 'order-1')).toBe(false)
  })

  it('DONE 결제 행이 있으면 true', async () => {
    expect(await verifyPaidOrder(fakeClient({ data: { order_id: 'order-1' }, error: null }), 'order-1')).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/verifyPaidOrder.test.ts`
Expected: FAIL — `Cannot find module './verifyPaidOrder'`

- [ ] **Step 3: 최소 구현**

```typescript
// src/lib/verifyPaidOrder.ts
/**
 * 게스트 결제 언락 검증.
 * payments 테이블에 order_id가 승인(DONE) 상태로 존재하는지 확인한다.
 * Supabase 클라이언트를 구조적 타입으로 받아 테스트에서 모킹 가능.
 */
export interface PaymentsClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{ data: unknown; error: unknown }>
        }
      }
    }
  }
}

export async function verifyPaidOrder(
  client: PaymentsClient,
  orderId: string | null | undefined,
): Promise<boolean> {
  if (!orderId) return false
  try {
    const { data, error } = await client
      .from('payments')
      .select('order_id')
      .eq('order_id', orderId)
      .eq('status', 'DONE')
      .maybeSingle()
    return !error && !!data
  } catch {
    return false
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/verifyPaidOrder.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: generate-report에 게이트 추가**

`src/app/api/generate-report/route.ts` 수정. import 추가:

```typescript
import { createServiceClient } from '@/lib/supabase'
import { verifyPaidOrder, type PaymentsClient } from '@/lib/verifyPaidOrder'
```

`POST` 함수의 body 파싱 직후(현재 `const { emotions } = body` 라인)를 다음으로 교체 — **게이트는 mock 리포트 분기(`ANTHROPIC_API_KEY` 체크)보다 먼저** 와야 한다:

```typescript
  let body: { emotions?: Record<string, number> | null; orderId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }
  const { emotions, orderId } = body

  // 결제 게이트 — 승인된 orderId 없이는 리포트(mock 포함)를 생성하지 않는다
  const paid = await verifyPaidOrder(
    createServiceClient() as unknown as PaymentsClient,
    orderId,
  )
  if (!paid) {
    return NextResponse.json({ error: 'payment_required' }, { status: 402 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ report: getMockReport() })
  }
```

- [ ] **Step 6: 전체 vitest + lint 통과 확인**

Run: `npm test && npm run lint`
Expected: PASS (기존 trainingCycle 테스트 포함), lint 에러 없음

- [ ] **Step 7: Commit**

```bash
git add src/lib/verifyPaidOrder.ts src/lib/verifyPaidOrder.test.ts src/app/api/generate-report/route.ts
git commit -m "feat(funnel): gate report generation behind verified payment"
```

---

### Task 2: confirm API 저장 재시도

**Files:**
- Modify: `src/app/api/payment/confirm/route.ts:42-56`

**Interfaces:**
- Consumes: 없음 (독립).
- Produces: 동작 변경 없음 — Supabase insert 실패 시 1회 재시도만 추가. 저장 실패가 곧 게이트(Task 1)가 정당한 결제자를 막는 사고이므로.

- [ ] **Step 1: insert 재시도 구현**

`route.ts`의 `// 3. Supabase에 결제 내역 저장` 블록을 다음으로 교체:

```typescript
    // 3. Supabase에 결제 내역 저장 — 이 행이 리포트 언락 게이트의 근거이므로 실패 시 1회 재시도
    try {
      const supabase = createServiceClient()
      const row = {
        order_id: orderId,
        payment_key: paymentKey,
        amount: tossData.totalAmount,
        method: tossData.method,
        status: tossData.status,
        approved_at: tossData.approvedAt,
      }
      let { error: dbErr } = await supabase.from('payments').insert(row)
      if (dbErr) {
        console.error('[Supabase insert error, retrying]', dbErr)
        ;({ error: dbErr } = await supabase.from('payments').insert(row))
        if (dbErr) console.error('[Supabase insert retry failed]', dbErr)
      }
    } catch (dbErr) {
      console.error('[Supabase insert error]', dbErr)
    }
```

- [ ] **Step 2: 타입/lint 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/app/api/payment/confirm/route.ts
git commit -m "fix(payment): retry payments insert once — row backs the report unlock gate"
```

---

### Task 3: 결제 성공 → 리포트 언락 핸드셰이크

**Files:**
- Modify: `src/app/result/success/page.tsx`
- Modify: `src/app/report/ReportClient.tsx:1-60`
- Modify: `src/app/report/page.tsx`

**Interfaces:**
- Consumes: `POST /api/generate-report`의 `orderId` body 파라미터와 402 응답 (Task 1).
- Produces: 성공 페이지가 `/report?orderId=<orderId>`로 리다이렉트. ReportClient가 orderId를 `localStorage.paidOrderId`에 저장(키 이름 고정 — Task 5, 6에서 동일 키 사용).

- [ ] **Step 1: success 페이지 리다이렉트 수정**

`src/app/result/success/page.tsx`의 try/catch + redirect 부분 전체를 교체. **기존 버그 수정 포함**: `redirect()`는 내부적으로 throw하므로 try 블록 안에서 호출하면 catch가 삼켜서 `server_error`로 잘못 빠진다. 에러 파라미터를 계산한 뒤 try 밖에서 redirect한다:

```typescript
  const { paymentKey, orderId, amount } = await searchParams

  if (!paymentKey || !orderId || !amount) {
    redirect('/checkout?error=missing_params')
  }

  let errorParam: string | null = null
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/payment/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const data = await res.json()
      console.error('[Payment confirm failed]', data)
      errorParam = data.message ?? 'confirm_failed'
    }
  } catch (err) {
    console.error('[Payment success handler error]', err)
    errorParam = 'server_error'
  }

  if (errorParam) {
    redirect(`/checkout?error=${encodeURIComponent(errorParam)}`)
  }
  redirect(`/report?orderId=${encodeURIComponent(orderId)}`)
```

파일 상단 주석의 `2. 성공 → /result?paid=1 로 리다이렉트`도 `2. 성공 → /report?orderId=... 로 리다이렉트`로 수정.

- [ ] **Step 2: ReportClient에 orderId 게이트 로직 추가**

`src/app/report/ReportClient.tsx` 수정.

import 라인 변경:

```typescript
import { useRouter, useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'
```

`ReportClient` 컴포넌트 본문 시작부와 `useEffect`를 다음으로 교체:

```typescript
export default function ReportClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // ── 언락 토큰 확인: 쿼리 파라미터 우선, 없으면 localStorage ──
    const queryOrderId = searchParams.get('orderId')
    let orderId: string | null = queryOrderId
    try {
      if (queryOrderId) {
        localStorage.setItem('paidOrderId', queryOrderId)
      } else {
        orderId = localStorage.getItem('paidOrderId')
      }
    } catch { /* noop */ }

    if (!orderId) {
      router.replace('/checkout')
      return
    }
    // 결제 직후 최초 진입 (success 리다이렉트)에서만 발화
    if (queryOrderId) trackEvent('funnel_payment_done', { order_id: queryOrderId })

    async function loadReport(paidOrderId: string) {
      let emotions: Record<string, number> | null = null
      try {
        const e = sessionStorage.getItem('voiceEmotions')
        emotions = e ? JSON.parse(e) : null
      } catch { /* noop */ }

      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + Math.random() * 5 + 2, 90))
      }, 300)

      try {
        const res = await fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emotions, orderId: paidOrderId }),
        })
        if (res.status === 402) {
          // 서버가 결제를 확인 못 함 — 토큰 폐기 후 결제 페이지로
          try { localStorage.removeItem('paidOrderId') } catch { /* noop */ }
          router.replace('/checkout')
          return
        }
        const data = await res.json()
        setReport(data.report)
        setProgress(100)
        trackEvent('funnel_report_view')
      } catch {
        setReport(null)
      } finally {
        clearInterval(progressInterval)
        setLoading(false)
      }
    }
    loadReport(orderId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

나머지(로딩 UI, 에러 UI, 섹션 렌더)는 그대로 둔다. 에러 UI(`리포트를 불러오지 못했어요`)의 "결과 페이지로 돌아가기" 버튼 옆에 재시도 버튼 추가 — 결제는 이미 완료됐으므로 orderId 재사용해 다시 시도할 수 있어야 한다:

```tsx
  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-84px)] px-5 text-center gap-4">
        <p className="text-foreground font-semibold">리포트를 불러오지 못했어요</p>
        <p className="text-xs text-muted-foreground">결제는 정상 처리됐어요. 잠시 후 다시 시도해 주세요.</p>
        <Button onClick={() => window.location.reload()} className="rounded-2xl gradient-primary text-white border-0">
          다시 시도
        </Button>
        <Button onClick={() => router.push('/result')} variant="outline" className="rounded-2xl">
          결과 페이지로 돌아가기
        </Button>
      </div>
    )
  }
```

- [ ] **Step 3: report page.tsx에 Suspense 래핑**

`useSearchParams` 사용으로 필수. `src/app/report/page.tsx` 전체 교체:

```tsx
import { Suspense } from 'react'
import ReportClient from './ReportClient'

export default function ReportPage() {
  return (
    <Suspense>
      <ReportClient />
    </Suspense>
  )
}
```

- [ ] **Step 4: 타입/lint/빌드 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 없음

- [ ] **Step 5: 수동 검증 (게이트 동작)**

Run: `npm run dev` 후 브라우저 또는 curl로:
1. `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/generate-report -H 'Content-Type: application/json' -d '{"emotions":null}'` → **402**
2. 시크릿 창에서 `/report` 직접 접근 → `/checkout`으로 리다이렉트 확인

- [ ] **Step 6: Commit**

```bash
git add src/app/result/success/page.tsx src/app/report/ReportClient.tsx src/app/report/page.tsx
git commit -m "feat(funnel): unlock report via orderId handshake (success -> report)"
```

---

### Task 4: CheckoutClient 정리 — 도달 불가 화면 제거 + 에러 배너

**Files:**
- Modify: `src/app/checkout/CheckoutClient.tsx`
- Modify: `src/app/checkout/page.tsx`

**Interfaces:**
- Consumes: `/checkout?error=<code>` 쿼리 파라미터 (Task 3의 success 페이지, Toss failUrl이 전달).
- Produces: `funnel_checkout_view` 이벤트.

- [ ] **Step 1: processing 화면 제거**

`src/app/checkout/CheckoutClient.tsx`에서 제거할 것 (새 동선에서는 결제 성공 시 Toss가 `/result/success`로 보내므로 checkout의 가짜 진행률 화면은 도달 불가):
- `type Step = 'summary' | 'widget' | 'processing'` → `type Step = 'summary' | 'widget'`
- `const [fakeProgress, setFakeProgress] = useState(0)` 라인
- `// AI 분석 fake progress (결제 후)` useEffect 블록 전체 (`/result?paid=1` 이동 코드 포함)
- `// ── AI 분석 로딩 화면 ──` 렌더 블록 전체 (`if (step === 'processing') { ... }`)
- 미사용이 되는 것들 제거: `Sparkles` import (processing 화면에서만 사용), `useRouter` import와 `const router = useRouter()` (processing effect의 `router.push`에서만 사용 — 단, Step 2에서 `useSearchParams`를 import하므로 import 라인은 교체가 됨)

- [ ] **Step 2: 에러 배너 + 진입 이벤트 추가**

같은 파일에 추가. 기존 `import { useRouter } from 'next/navigation'` 라인을 다음으로 교체 (router는 processing 제거 후 미사용):

```typescript
import { useSearchParams } from 'next/navigation'
```

컴포넌트 상단에:

```typescript
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  useEffect(() => {
    trackEvent('funnel_checkout_view', errorParam ? { error: errorParam } : undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

summary 렌더 블록의 헤더(`<div className="mb-6">`) 바로 위에:

```tsx
      {errorParam && (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5">
          <p className="text-sm font-semibold text-destructive">결제가 완료되지 않았어요</p>
          <p className="text-xs text-muted-foreground mt-0.5">다시 시도해 주세요. 문제가 계속되면 다른 결제 수단을 이용해 주세요.</p>
        </div>
      )}
```

- [ ] **Step 3: checkout page.tsx에 Suspense 래핑**

`src/app/checkout/page.tsx` 전체 교체:

```tsx
import { Suspense } from 'react'
import CheckoutClient from './CheckoutClient'

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutClient />
    </Suspense>
  )
}
```

- [ ] **Step 4: 타입/lint 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 없음 (미사용 import/state 남기면 lint가 잡는다)

- [ ] **Step 5: Commit**

```bash
git add src/app/checkout/CheckoutClient.tsx src/app/checkout/page.tsx
git commit -m "refactor(checkout): drop unreachable processing screen, add error banner + view event"
```

---

### Task 5: PreRegisterForm 공용 컴포넌트 추출 + source 컬럼

**Files:**
- Create: `src/components/PreRegisterForm.tsx`
- Create: `docs/superpowers/migrations/2026-08-17-pre-registrations-source.sql`
- Modify: `src/app/result/ResultClient.tsx:252-329` (인라인 `PreRegisterForm` 함수 제거, import로 교체)

**Interfaces:**
- Consumes: Supabase `pre_registrations` 테이블 (기존), `trackEvent`.
- Produces: `<PreRegisterForm source="result_card" | "training_landing" />` — Task 7의 훈련 랜딩이 사용. `submit_pre_register` 이벤트에 `source`, `price: 4900` 파라미터 추가.

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- docs/superpowers/migrations/2026-08-17-pre-registrations-source.sql
-- 결제 퍼널: 사전등록 유입처 구분 (result_card | training_landing)
alter table public.pre_registrations
  add column if not exists source text;
```

**주의:** 배포 전에 Supabase 대시보드 SQL Editor에서 이 마이그레이션을 실행해야 한다. 컬럼이 없으면 insert가 실패한다.

- [ ] **Step 2: 공용 컴포넌트 생성**

`src/app/result/ResultClient.tsx`의 인라인 `PreRegisterForm` 함수(주석 `// ── Pre-register (Fake Door) component ──` 포함, 252~329행 부근)를 그대로 옮기되 source prop과 4,900원 카피를 추가:

```tsx
// src/components/PreRegisterForm.tsx
'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

const LAUNCH_PRICE = 4900

// ── Pre-register (Fake Door) — 훈련 프로그램 수요 검증 ────
export default function PreRegisterForm({ source }: { source: 'result_card' | 'training_landing' }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!isValid) {
      setEmailError('올바른 이메일 주소를 입력해 주세요.')
      return
    }
    setEmailError('')
    setLoading(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getSupabase().from('pre_registrations') as any).insert({ email, source })
    setLoading(false)

    if (error && error.code !== '23505') {
      // 23505 = unique_violation (이미 등록된 이메일)
      setEmailError('저장 중 오류가 발생했어요. 다시 시도해 주세요.')
      return
    }

    trackEvent('submit_pre_register', { email_domain: email.split('@')[1], source, price: LAUNCH_PRICE })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="glass rounded-3xl p-5 border border-primary/20 text-center">
        <Sparkles size={28} className="text-primary mx-auto mb-2" />
        <p className="text-sm font-bold text-foreground">사전 예약 완료!</p>
        <p className="text-xs text-muted-foreground mt-1">출시 시 가장 먼저 알려드릴게요.</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-3xl p-5 border border-primary/20">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl">🎙️</span>
        <div>
          <p className="text-sm font-bold text-foreground">
            더 정밀한 맞춤형 AI 발성 훈련 플랜 받아보기
          </p>
          <Badge className="mt-1 bg-accent/20 text-accent border-0 text-[10px]">사전 예약</Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-1">
        목소리 분석 결과를 바탕으로 개인 맞춤 AI 발성 훈련 플랜을 제공합니다. 출시 시 우선 안내 드립니다.
      </p>
      <p className="text-xs font-semibold text-foreground mb-4">
        정식 출시가 <span className="text-primary font-bold">4,900원</span> · 사전 등록하면 오픈 소식을 가장 먼저 받아요
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="email"
          placeholder="이메일 주소를 입력해 주세요"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
          className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {emailError && (
          <p className="text-xs text-destructive">{emailError}</p>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="w-full h-12 text-sm font-bold rounded-2xl gradient-primary border-0 shadow-lg shadow-primary/20 active:scale-95 transition-transform disabled:opacity-60"
        >
          {loading ? '저장 중...' : '사전 예약하기'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: ResultClient에서 인라인 버전 제거**

`src/app/result/ResultClient.tsx`:
- 인라인 `PreRegisterForm` 함수 전체 삭제 (`// ── Pre-register (Fake Door) component ──` 주석부터 함수 끝까지)
- import 추가: `import PreRegisterForm from '@/components/PreRegisterForm'`
- 사용처(720행 부근) 교체: `<PreRegisterForm source="result_card" />`
- 삭제로 미사용이 된 import 정리 (`Sparkles`가 다른 곳에서 안 쓰이면 제거 — 확인 후)

- [ ] **Step 4: 타입/lint/테스트 확인**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: 모두 통과

- [ ] **Step 5: Commit**

```bash
git add src/components/PreRegisterForm.tsx src/app/result/ResultClient.tsx docs/superpowers/migrations/2026-08-17-pre-registrations-source.sql
git commit -m "refactor(preregister): extract shared form with source tracking + 4,900 price copy"
```

---

### Task 6: 결과 페이지 리포트 티저 (990원 페이월 노출)

**Files:**
- Create: `src/components/ReportTeaser.tsx`
- Modify: `src/app/result/ResultClient.tsx` (섹션 삽입 + `funnel_result_view` 이벤트)

**Interfaces:**
- Consumes: `localStorage.paidOrderId` (Task 3이 저장), `/checkout`, `/report` 라우트.
- Produces: `funnel_result_view`, `funnel_report_cta_click` 이벤트.

- [ ] **Step 1: ReportTeaser 컴포넌트 생성**

리포트 5개 섹션 목차를 자물쇠와 함께 보여주는 티저. 이미 결제한 유저(localStorage에 토큰 존재)에게는 CTA가 "내 리포트 보기"로 바뀐다:

```tsx
// src/components/ReportTeaser.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { trackEvent } from '@/lib/analytics'

const REPORT_SECTIONS = [
  { icon: '🎙', title: '목소리가 말하는 나의 본모습', desc: '감정 패턴이 드러내는 성격과 내면' },
  { icon: '💬', title: '대인관계에서 내 목소리의 영향', desc: '상대방이 받는 인상과 소통 강점' },
  { icon: '⚡', title: '스트레스 상황에서 목소리 변화', desc: '감정이 격해질 때의 변화와 관리법' },
  { icon: '💼', title: '직업/커리어에서 목소리 활용법', desc: '내 감정 패턴에 잘 맞는 역할' },
  { icon: '🌱', title: '목소리로 성장하는 방법', desc: '매력을 높이는 구체적 연습 팁' },
]

// ── 990원 리포트 페이월 티저 ──────────────────────────────
export default function ReportTeaser() {
  const router = useRouter()
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    try { setPaid(!!localStorage.getItem('paidOrderId')) } catch { /* noop */ }
  }, [])

  const handleClick = () => {
    if (paid) {
      router.push('/report')
      return
    }
    trackEvent('funnel_report_cta_click')
    router.push('/checkout')
  }

  return (
    <div className="glass rounded-3xl p-5 border border-primary/20">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-foreground">AI 상세 리포트</h2>
        {!paid && (
          <Badge className="bg-primary/20 text-primary border-0 text-[10px]">990원</Badge>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {REPORT_SECTIONS.map(({ icon, title, desc }) => (
          <div key={title} className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
            <span className="text-xl w-8 text-center shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">{title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
            </div>
            {!paid && <Lock size={14} className="text-muted-foreground/60 shrink-0" />}
          </div>
        ))}
      </div>

      <button
        onClick={handleClick}
        className="w-full h-13 px-4 py-3.5 rounded-2xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
      >
        {paid ? '내 리포트 보기 →' : '990원으로 전체 리포트 보기 →'}
      </button>
      {!paid && (
        <p className="text-center text-[11px] text-muted-foreground mt-2">
          <span className="line-through mr-1">3,900원</span>75% 할인 · 결제 후 즉시 열람
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: ResultClient에 티저 삽입 + 진입 이벤트**

`src/app/result/ResultClient.tsx`:
- import 추가: `import ReportTeaser from '@/components/ReportTeaser'`
- `trackEvent('analysis_completed')` 라인(586행 부근) 바로 다음에 추가: `trackEvent('funnel_result_view')`
- 렌더 트리에서 `{audioFeatures && <AudioFeaturesSection ... />}` 다음, Share/retry 버튼 `<div className="flex gap-3">` 앞에 삽입:

```tsx
        {/* 990원 리포트 페이월 티저 */}
        <ReportTeaser />
```

- [ ] **Step 3: 타입/lint 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 없음

- [ ] **Step 4: 수동 검증**

Run: `npm run dev`
1. `/result` 접근 (mock 데이터로 렌더됨) → 티저 카드에 자물쇠 5개 + "990원으로 전체 리포트 보기" 노출
2. CTA 클릭 → `/checkout` 이동
3. 개발자도구에서 `localStorage.setItem('paidOrderId','test')` 후 새로고침 → CTA가 "내 리포트 보기"로 변경

- [ ] **Step 5: Commit**

```bash
git add src/components/ReportTeaser.tsx src/app/result/ResultClient.tsx
git commit -m "feat(funnel): locked report teaser on result page (990 paywall)"
```

---

### Task 7: 훈련 fake door — 사전등록 랜딩으로 교체

**Files:**
- Create: `src/app/training/PreRegisterLanding.tsx`
- Modify: `src/app/training/page.tsx`
- Modify: `tests/qa/07-training-redesign.spec.ts:4-12` (랜딩 테스트 교체)

**Interfaces:**
- Consumes: `<PreRegisterForm source="training_landing" />` (Task 5), `CURRICULUM` (`src/lib/curriculum.ts` — `TrainingDay { dayNum, theme, subtitle, emoji }`).
- Produces: `funnel_preregister_view` 이벤트. `/training` 진입 시 랜딩 렌더. 기존 `TrainingClient`, `/training/session/*`, `/training/voice-check` 코드는 그대로 둔다 (라우트로는 여전히 접근 가능하나 UI 진입점 없음).

- [ ] **Step 1: 랜딩 컴포넌트 생성**

```tsx
// src/app/training/PreRegisterLanding.tsx
'use client'

import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { CURRICULUM } from '@/lib/curriculum'
import PreRegisterForm from '@/components/PreRegisterForm'
import { trackEvent } from '@/lib/analytics'

// ── 훈련 프로그램 fake door 랜딩 — 결제 없이 수요만 검증 ──
export default function PreRegisterLanding() {
  useEffect(() => {
    trackEvent('funnel_preregister_view')
  }, [])

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] pb-8">
      {/* ── Hero ── */}
      <div className="relative bg-gradient-to-br from-[#0093BA] to-[#00BECD] px-5 pt-10 pb-14 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Badge className="mb-3 bg-white/20 text-white border-0 text-xs backdrop-blur">
            🔥 사전 등록 오픈
          </Badge>
          <h1 className="text-2xl font-black text-white mb-2">AI 발성 훈련 프로그램</h1>
          <p className="text-white/80 text-sm">
            내 목소리 분석 결과에 맞춘 5일 사이클 훈련.
            <br />지금 준비 중이에요 — 등록하면 오픈 소식을 가장 먼저 받아요.
          </p>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl font-black text-white">4,900</span>
            <span className="text-white/80 text-sm">원 (정식 출시가)</span>
          </div>
        </div>
      </div>

      <div className="-mt-6 px-4 space-y-4">
        {/* ── 커리큘럼 미리보기 ── */}
        <div className="glass rounded-3xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-3">이런 훈련을 받게 돼요</h2>
          <div className="space-y-2">
            {CURRICULUM.map((day) => (
              <div key={day.dayNum} className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
                <span className="text-xl w-8 text-center shrink-0">{day.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    Day {day.dayNum} · {day.theme}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{day.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 이메일 사전등록 ── */}
        <PreRegisterForm source="training_landing" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: page.tsx 교체**

`src/app/training/page.tsx` 전체 교체 (`LoginRequired` 제거 — 랜딩은 비로그인 공개):

```tsx
import PreRegisterLanding from './PreRegisterLanding'

export default function TrainingPage() {
  return <PreRegisterLanding />
}
```

`TrainingClient.tsx`는 **삭제하지 않는다** — 프로그램 확정 후 재사용.

- [ ] **Step 3: QA 스펙 업데이트**

`tests/qa/07-training-redesign.spec.ts`의 첫 테스트(`landing renders Cycle N subtitle...`)를 다음으로 교체 (세션 라우트 테스트 3개는 그대로 둔다 — 코드가 보존되므로 여전히 통과해야 함):

```typescript
  test('training entry shows pre-register landing (fake door)', async ({ page }) => {
    await page.goto('/training')
    await expect(page.getByText('AI 발성 훈련 프로그램')).toBeVisible()
    await expect(page.getByText(/4,900/)).toBeVisible()
    await expect(page.getByText('이런 훈련을 받게 돼요')).toBeVisible()
    await expect(page.getByPlaceholder('이메일 주소를 입력해 주세요')).toBeVisible()
  })
```

- [ ] **Step 4: 타입/lint 확인 + TrainingClient 미사용 경고 처리**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 없음. `TrainingClient` import가 사라져 미사용 파일이 되는 건 정상 (lint는 미사용 파일을 잡지 않음).

- [ ] **Step 5: 수동 검증**

Run: `npm run dev` → `/training` 접근 → 랜딩(4,900원 + Day 1~5 미리보기 + 이메일 폼) 렌더 확인. 이메일 제출은 마이그레이션(Task 5) 적용 전이면 로컬에서 에러가 날 수 있음 — Supabase에 마이그레이션 적용 후 재확인.

- [ ] **Step 6: Commit**

```bash
git add src/app/training/PreRegisterLanding.tsx src/app/training/page.tsx tests/qa/07-training-redesign.spec.ts
git commit -m "feat(funnel): replace training entry with 4,900 fake-door pre-register landing"
```

---

### Task 8: 최종 검증

**Files:**
- Modify: 없음 (검증만; 실패 시 해당 태스크로 돌아가 수정)

- [ ] **Step 1: 전체 테스트 + 빌드**

Run: `npm test && npm run lint && npm run build`
Expected: vitest 전체 통과, lint 클린, 프로덕션 빌드 성공

- [ ] **Step 2: Playwright QA (환경 가능 시)**

Run: `npm run test:qa -- tests/qa/07-training-redesign.spec.ts tests/qa/05-api.spec.ts`
Expected: 07 랜딩 테스트 + 세션 테스트 통과, 05의 generate-report 테스트는 402 응답으로 통과 (`not.toBe(500)`)

- [ ] **Step 3: 퍼널 수동 점검 (Toss 테스트 키)**

`npm run dev` 상태에서 전체 동선 1회:
`/record` → `/result` (티저 노출) → CTA → `/checkout` → 테스트 결제 → `/result/success` → `/report?orderId=...` (리포트 렌더) → 새 탭에서 `/report` 재접근 (localStorage로 열람) → `/training` (사전등록 랜딩).

**배포 전 체크리스트:**
- [ ] Supabase에 `2026-08-17-pre-registrations-source.sql` 적용
- [ ] 프로덕션 환경변수 확인: `TOSS_SECRET_KEY`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `NEXTAUTH_URL`

- [ ] **Step 4: Commit (잔여 수정이 있었을 경우)**

```bash
git add -A && git commit -m "test(funnel): final verification fixes"
```
