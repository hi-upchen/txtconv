/**
 * @jest-environment node
 */

// jest.mock factories are hoisted. Only variables named mock* may be used inside them.
const mockFrom = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

import {
  createPendingOrder,
  findOrderByTradeNo,
  findOrderForUser,
  findOtherPaidOrder,
  grantLifetime,
  markOrderPaid,
  type EcpayOrder,
} from '@/lib/payment/orders';

/**
 * A fake PostgREST query builder.
 * Every chained method returns the builder itself.
 * The builder is thenable, so `await builder` resolves to the result.
 * The real builder behaves the same way.
 */
function queryResolvingTo(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock | ((...args: unknown[]) => unknown)> = {};
  for (const method of ['insert', 'select', 'update', 'delete', 'eq', 'neq', 'limit', 'order', 'single', 'maybeSingle']) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder as Record<string, jest.Mock>;
}

const ORDER: EcpayOrder = {
  id: '11111111-1111-1111-1111-111111111111',
  merchant_trade_no: 'TCabc123def456ghi789',
  user_id: '22222222-2222-2222-2222-222222222222',
  email: 'buyer@example.com',
  amount_twd: 899,
  status: 'pending',
  ecpay_trade_no: null,
  payment_type: null,
  payment_date: null,
  rtn_code: null,
  rtn_msg: null,
  simulate_paid: false,
  raw_callback: null,
  created_at: '2026-09-01T16:00:00.000Z',
  paid_at: null,
};

const PAID_FIELDS = {
  ecpayTradeNo: '2609020005091234',
  paymentType: 'Credit_CreditCard',
  paymentDate: '2026-09-01T16:07:00.000Z',
  rtnCode: 1,
  rtnMsg: '交易成功',
  rawCallback: { MerchantTradeNo: 'TCabc123def456ghi789', RtnCode: '1' },
};

const PURCHASED_AT = '2026-09-01T16:07:00.000Z';

beforeEach(() => {
  mockFrom.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('createPendingOrder', () => {
  it('inserts a pending row and returns it', async () => {
    const q = queryResolvingTo({ data: ORDER, error: null });
    mockFrom.mockReturnValueOnce(q);

    const order = await createPendingOrder({
      userId: ORDER.user_id,
      email: ORDER.email,
      amountTwd: 899,
      merchantTradeNo: ORDER.merchant_trade_no,
    });

    expect(mockFrom).toHaveBeenCalledWith('ecpay_orders');
    expect(q.insert).toHaveBeenCalledWith({
      merchant_trade_no: ORDER.merchant_trade_no,
      user_id: ORDER.user_id,
      email: ORDER.email,
      amount_twd: 899,
      status: 'pending',
    });
    expect(q.select).toHaveBeenCalledWith('*');
    expect(q.single).toHaveBeenCalled();
    expect(order).toEqual(ORDER);
  });

  it('throws when the insert fails', async () => {
    mockFrom.mockReturnValueOnce(queryResolvingTo({ data: null, error: { message: 'boom' } }));
    await expect(
      createPendingOrder({ userId: 'u', email: 'e', amountTwd: 899, merchantTradeNo: 'TCx' }),
    ).rejects.toThrow('boom');
  });
});

describe('findOrderByTradeNo', () => {
  it('returns the matching row', async () => {
    const q = queryResolvingTo({ data: ORDER, error: null });
    mockFrom.mockReturnValueOnce(q);
    expect(await findOrderByTradeNo(ORDER.merchant_trade_no)).toEqual(ORDER);
    expect(q.eq).toHaveBeenCalledWith('merchant_trade_no', ORDER.merchant_trade_no);
    expect(q.maybeSingle).toHaveBeenCalled();
  });

  it('returns null when nothing matches or the query errors', async () => {
    mockFrom.mockReturnValueOnce(queryResolvingTo({ data: null, error: null }));
    expect(await findOrderByTradeNo('TCnothing')).toBeNull();
    mockFrom.mockReturnValueOnce(queryResolvingTo({ data: null, error: { message: 'down' } }));
    expect(await findOrderByTradeNo('TCnothing')).toBeNull();
  });
});

describe('markOrderPaid', () => {
  it('returns paid_now when the pending→paid update touched a row', async () => {
    const q = queryResolvingTo({ data: [{ id: ORDER.id }], error: null });
    mockFrom.mockReturnValueOnce(q);

    const result = await markOrderPaid(ORDER.merchant_trade_no, PAID_FIELDS);

    expect(result).toBe('paid_now');
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'paid',
        ecpay_trade_no: PAID_FIELDS.ecpayTradeNo,
        payment_type: PAID_FIELDS.paymentType,
        payment_date: PAID_FIELDS.paymentDate,
        rtn_code: 1,
        rtn_msg: '交易成功',
        simulate_paid: false,
        raw_callback: PAID_FIELDS.rawCallback,
        paid_at: expect.any(String),
      }),
    );
    // The two eq calls make the change atomic. Only a pending row can flip.
    expect(q.eq).toHaveBeenNthCalledWith(1, 'merchant_trade_no', ORDER.merchant_trade_no);
    expect(q.eq).toHaveBeenNthCalledWith(2, 'status', 'pending');
    expect(q.select).toHaveBeenCalledWith('id');
  });

  it('returns already_paid when no row flipped but the order is paid (duplicate callback)', async () => {
    mockFrom.mockReturnValueOnce(queryResolvingTo({ data: [], error: null }));
    mockFrom.mockReturnValueOnce(queryResolvingTo({ data: { ...ORDER, status: 'paid' }, error: null }));
    expect(await markOrderPaid(ORDER.merchant_trade_no, PAID_FIELDS)).toBe('already_paid');
  });

  it('returns not_found when no row flipped and no order exists', async () => {
    mockFrom.mockReturnValueOnce(queryResolvingTo({ data: [], error: null }));
    mockFrom.mockReturnValueOnce(queryResolvingTo({ data: null, error: null }));
    expect(await markOrderPaid('TCghost', PAID_FIELDS)).toBe('not_found');
  });

  it('throws when the update itself errors', async () => {
    mockFrom.mockReturnValueOnce(queryResolvingTo({ data: null, error: { message: 'db down' } }));
    await expect(markOrderPaid(ORDER.merchant_trade_no, PAID_FIELDS)).rejects.toThrow('db down');
  });
});

describe('grantLifetime', () => {
  it('updates the existing profile to lifetime and returns true', async () => {
    const q = queryResolvingTo({ data: [{ id: ORDER.user_id }], error: null });
    mockFrom.mockReturnValueOnce(q);

    expect(await grantLifetime(ORDER.user_id, ORDER.email, PURCHASED_AT)).toBe(true);

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(q.update).toHaveBeenCalledWith({
      license_type: 'lifetime',
      license_expires_at: null,
      purchased_at: PURCHASED_AT,
      updated_at: expect.any(String),
    });
    expect(q.eq).toHaveBeenCalledWith('id', ORDER.user_id);
    expect(q.select).toHaveBeenCalledWith('id');
  });

  it('creates a lifetime profile when the update matched no row, so the payment is never lost', async () => {
    const update = queryResolvingTo({ data: [], error: null });
    const insert = queryResolvingTo({ data: null, error: null });
    mockFrom.mockReturnValueOnce(update).mockReturnValueOnce(insert);

    expect(await grantLifetime(ORDER.user_id, ORDER.email, PURCHASED_AT)).toBe(true);

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'profiles');
    expect(insert.insert).toHaveBeenCalledWith({
      id: ORDER.user_id,
      email: ORDER.email,
      license_type: 'lifetime',
      purchased_at: PURCHASED_AT,
    });
  });

  it('returns false when the fallback insert fails, so ECPay retries', async () => {
    mockFrom
      .mockReturnValueOnce(queryResolvingTo({ data: [], error: null }))
      .mockReturnValueOnce(queryResolvingTo({ data: null, error: { message: 'duplicate key' } }));
    expect(await grantLifetime(ORDER.user_id, ORDER.email, PURCHASED_AT)).toBe(false);
  });

  it('returns false when the update errors', async () => {
    mockFrom.mockReturnValueOnce(queryResolvingTo({ data: null, error: { message: 'nope' } }));
    expect(await grantLifetime(ORDER.user_id, ORDER.email, PURCHASED_AT)).toBe(false);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe('findOrderForUser', () => {
  it('matches on both merchant_trade_no and user_id', async () => {
    const q = queryResolvingTo({ data: ORDER, error: null });
    mockFrom.mockReturnValueOnce(q);

    expect(await findOrderForUser(ORDER.merchant_trade_no, ORDER.user_id)).toEqual(ORDER);
    expect(q.eq).toHaveBeenNthCalledWith(1, 'merchant_trade_no', ORDER.merchant_trade_no);
    expect(q.eq).toHaveBeenNthCalledWith(2, 'user_id', ORDER.user_id);
    expect(q.maybeSingle).toHaveBeenCalled();
  });

  it('returns null for somebody else\'s order', async () => {
    mockFrom.mockReturnValueOnce(queryResolvingTo({ data: null, error: null }));
    expect(await findOrderForUser(ORDER.merchant_trade_no, 'someone-else')).toBeNull();
  });
});

describe('findOtherPaidOrder', () => {
  it('returns the number of another paid order by the same buyer', async () => {
    const q = queryResolvingTo({ data: [{ merchant_trade_no: 'TCzzzzzzzzzzzzzzzzzz' }], error: null });
    mockFrom.mockReturnValueOnce(q);

    expect(await findOtherPaidOrder(ORDER.user_id, ORDER.merchant_trade_no)).toBe('TCzzzzzzzzzzzzzzzzzz');
    expect(mockFrom).toHaveBeenCalledWith('ecpay_orders');
    expect(q.eq).toHaveBeenNthCalledWith(1, 'user_id', ORDER.user_id);
    expect(q.eq).toHaveBeenNthCalledWith(2, 'status', 'paid');
    expect(q.neq).toHaveBeenCalledWith('merchant_trade_no', ORDER.merchant_trade_no);
    expect(q.limit).toHaveBeenCalledWith(1);
  });

  it('returns null when there is none or the query errors', async () => {
    mockFrom.mockReturnValueOnce(queryResolvingTo({ data: [], error: null }));
    expect(await findOtherPaidOrder(ORDER.user_id, ORDER.merchant_trade_no)).toBeNull();
    mockFrom.mockReturnValueOnce(queryResolvingTo({ data: null, error: { message: 'down' } }));
    expect(await findOtherPaidOrder(ORDER.user_id, ORDER.merchant_trade_no)).toBeNull();
  });
});
