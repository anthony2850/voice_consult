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
