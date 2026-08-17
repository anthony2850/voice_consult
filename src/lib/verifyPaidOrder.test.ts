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
