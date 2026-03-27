/**
 * 토스페이먼츠 결제 성공 콜백 페이지
 * URL: /result/success?paymentKey=...&orderId=...&amount=...
 *
 * 1. 서버에서 결제 최종 승인 요청
 * 2. 성공 → /result?paid=1 로 리다이렉트
 * 3. 실패 → /checkout?error=confirm_failed
 */
import { redirect } from 'next/navigation'

interface SearchParams {
  paymentKey?: string
  orderId?: string
  amount?: string
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { paymentKey, orderId, amount } = await searchParams

  if (!paymentKey || !orderId || !amount) {
    redirect('/checkout?error=missing_params')
  }

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
      redirect(`/checkout?error=${encodeURIComponent(data.message ?? 'confirm_failed')}`)
    }
  } catch (err) {
    console.error('[Payment success handler error]', err)
    redirect('/checkout?error=server_error')
  }

  redirect('/report')
}
