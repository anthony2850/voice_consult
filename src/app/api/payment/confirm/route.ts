import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm'
const AMOUNT = 990

export async function POST(req: NextRequest) {
  try {
    const { paymentKey, orderId, amount } = await req.json()

    // 1. 금액 위변조 검증
    if (Number(amount) !== AMOUNT) {
      return NextResponse.json(
        { message: '결제 금액이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    // 2. 토스페이먼츠 서버에 결제 승인 요청
    const secretKey = process.env.TOSS_SECRET_KEY!
    const encoded = Buffer.from(`${secretKey}:`).toString('base64')

    const tossRes = await fetch(TOSS_CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })

    const tossData = await tossRes.json()

    if (!tossRes.ok) {
      console.error('[Toss confirm error]', tossData)
      return NextResponse.json(
        { message: tossData.message ?? '결제 승인에 실패했습니다.' },
        { status: tossRes.status }
      )
    }

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

    return NextResponse.json({ success: true, payment: tossData })
  } catch (err) {
    console.error('[Payment confirm unexpected error]', err)
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
