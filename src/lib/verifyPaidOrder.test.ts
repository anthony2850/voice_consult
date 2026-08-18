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
  it('orderId가 없으면 unpaid', async () => {
    const client = fakeClient({ data: { order_id: 'x' }, error: null })
    expect(await verifyPaidOrder(client, null)).toBe('unpaid')
    expect(await verifyPaidOrder(client, undefined)).toBe('unpaid')
    expect(await verifyPaidOrder(client, '')).toBe('unpaid')
  })

  it('DONE 결제 행이 없으면 unpaid', async () => {
    expect(await verifyPaidOrder(fakeClient({ data: null, error: null }), 'order-1')).toBe('unpaid')
  })

  it('조회 에러 시 error', async () => {
    expect(await verifyPaidOrder(fakeClient({ data: null, error: { message: 'boom' } }), 'order-1')).toBe('error')
  })

  it('maybeSingle이 throw하면 error', async () => {
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
    expect(await verifyPaidOrder(client, 'order-1')).toBe('error')
  })

  it('DONE 결제 행이 있으면 paid', async () => {
    expect(await verifyPaidOrder(fakeClient({ data: { order_id: 'order-1' }, error: null }), 'order-1')).toBe('paid')
  })
})
