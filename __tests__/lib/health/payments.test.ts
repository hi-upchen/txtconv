/**
 * @jest-environment node
 */
type Result = { data?: unknown; error?: { message: string } | null };

const mockResults: Result[] = [];
const mockCalls: Array<{ method: string; args: unknown[] }> = [];
let mockRejectNext = false;

function makeBuilder(): any {
  const builder: any = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'insert']) {
    builder[method] = (...args: unknown[]) => {
      mockCalls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (v: Result) => void, reject: (e: unknown) => void) => {
    if (mockRejectNext) {
      mockRejectNext = false;
      return reject(new Error('network down'));
    }
    return resolve(mockResults.shift() ?? { data: [], error: null });
  };
  return builder;
}
const mockFrom = jest.fn((table: string) => {
  mockCalls.push({ method: 'from', args: [table] });
  return makeBuilder();
});
const mockAfter = jest.fn();
const mockGetEcpayConfig = jest.fn();

jest.mock('next/server', () => ({ after: (cb: () => unknown) => mockAfter(cb) }));
jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: (t: string) => mockFrom(t) }),
}));
jest.mock('@/lib/payment/config', () => ({
  getEcpayConfig: () => mockGetEcpayConfig(),
  isEcpayProduction: jest.requireActual('@/lib/payment/config').isEcpayProduction,
}));

import {
  recordPaymentFailure,
  checkPaymentConfig,
  checkPaidOrders,
  checkDoublePaid,
  checkCallbackFailures,
} from '@/lib/health/payments';

const callsOf = (method: string) => mockCalls.filter((c) => c.method === method);

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  mockResults.length = 0;
  mockCalls.length = 0;
  mockRejectNext = false;
  mockAfter.mockImplementation(() => undefined);
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe('recordPaymentFailure', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.ECPAY_ENV = 'production';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it.each([undefined, 'sandbox'])('records nothing when ECPAY_ENV is %s', (value) => {
    if (value === undefined) delete process.env.ECPAY_ENV;
    else process.env.ECPAY_ENV = value;
    recordPaymentFailure('金額不符', 'TC123');
    expect(mockAfter).not.toHaveBeenCalled();
    expect(callsOf('insert')).toHaveLength(0);
  });

  it('inserts the failure inside after(), not before', async () => {
    recordPaymentFailure('金額不符', 'TC123');
    expect(callsOf('insert')).toHaveLength(0);
    expect(mockAfter).toHaveBeenCalledTimes(1);
    await mockAfter.mock.calls[0][0]();
    expect(mockFrom).toHaveBeenCalledWith('ecpay_callback_failures');
    expect(callsOf('insert')[0].args[0]).toEqual({ reason: '金額不符', merchant_trade_no: 'TC123' });
  });

  it.each([undefined, ''])('inserts null when the order number is %p', async (no) => {
    recordPaymentFailure('金額不符', no);
    await mockAfter.mock.calls[0][0]();
    expect(callsOf('insert')[0].args[0]).toEqual({ reason: '金額不符', merchant_trade_no: null });
  });

  it.each([
    [
      'after() throws',
      () =>
        mockAfter.mockImplementation(() => {
          throw new Error('outside request');
        }),
    ],
    ['the insert returns an error', () => mockResults.push({ error: { message: 'relation missing' } })],
    ['the insert rejects', () => (mockRejectNext = true)],
  ])('does not throw and logs once when %s', async (_name, arrange) => {
    arrange();
    expect(() => recordPaymentFailure('x')).not.toThrow();
    const write = mockAfter.mock.calls[0]?.[0];
    if (write) await expect(write()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe('checkPaymentConfig', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('passes outside Vercel production', async () => {
    delete process.env.VERCEL_ENV;
    expect(await checkPaymentConfig()).toEqual({ status: 'pass' });
    process.env.VERCEL_ENV = 'preview';
    expect(await checkPaymentConfig()).toEqual({ status: 'pass' });
    expect(mockGetEcpayConfig).not.toHaveBeenCalled();
  });

  it('throws in production when getEcpayConfig throws', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://txtconv.arpuli.com';
    mockGetEcpayConfig.mockImplementation(() => {
      throw new Error('缺少 ECPAY_HASH_KEY');
    });
    await expect(checkPaymentConfig()).rejects.toThrow('缺少');
  });

  it('fails in production when the app URL is wrong', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://preview.example.com';
    mockGetEcpayConfig.mockReturnValue({});
    expect(await checkPaymentConfig()).toEqual({
      status: 'fail',
      output: 'NEXT_PUBLIC_APP_URL 不是 https://txtconv.arpuli.com',
    });
  });

  it('passes in production when config loads and the URL is right', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://txtconv.arpuli.com';
    mockGetEcpayConfig.mockReturnValue({});
    expect(await checkPaymentConfig()).toEqual({ status: 'pass' });
  });
});

const many = (n: number, make: (i: number) => object) => Array.from({ length: n }, (_, i) => make(i));
const CAP_OUTPUT = '資料超過 1000 筆，請改用 SQL 對帳查詢';
const paidOrders = (n: number) => many(n, (i) => ({ merchant_trade_no: `TC${i}`, user_id: `u${i}` }));

describe('checkPaidOrders', () => {
  it('fails listing count and order numbers for unlicensed or missing profiles', async () => {
    mockResults.push(
      {
        data: [
          { merchant_trade_no: 'TC1', user_id: 'u1' },
          { merchant_trade_no: 'TC2', user_id: 'u2' },
          { merchant_trade_no: 'TC3', user_id: 'u3' },
        ],
        error: null,
      },
      {
        data: [{ id: 'u1' }, { id: 'u9' }],
        error: null,
      },
    );
    const result = await checkPaidOrders();
    expect(result).toEqual({ status: 'fail', output: '2 筆已付款但未開通：TC2、TC3' });
    expect(callsOf('from').map((c) => c.args[0])).toEqual(['ecpay_orders', 'profiles']);
    expect(callsOf('eq').map((c) => c.args)).toEqual([
      ['status', 'paid'],
      ['license_type', 'lifetime'],
    ]);
    expect(callsOf('in')).toHaveLength(0);
  });

  it('throws when the paid orders reach the 1000-row cap', async () => {
    mockResults.push({ data: paidOrders(1000), error: null });
    await expect(checkPaidOrders()).rejects.toThrow(CAP_OUTPUT);
    expect(callsOf('from')).toHaveLength(1);
  });

  it('throws when the lifetime profiles reach the 1000-row cap', async () => {
    mockResults.push(
      { data: [{ merchant_trade_no: 'TC1', user_id: 'u1' }], error: null },
      { data: many(1000, (i) => ({ id: `u${i}` })), error: null },
    );
    await expect(checkPaidOrders()).rejects.toThrow(CAP_OUTPUT);
  });

  it('checks 999 rows normally', async () => {
    mockResults.push(
      { data: [{ merchant_trade_no: 'TC1', user_id: 'u1' }], error: null },
      { data: many(999, (i) => ({ id: `u${i}` })), error: null },
    );
    expect(await checkPaidOrders()).toEqual({ status: 'pass' });
  });

  it('passes when every paid order is lifetime', async () => {
    mockResults.push(
      { data: [{ merchant_trade_no: 'TC1', user_id: 'u1' }], error: null },
      { data: [{ id: 'u1' }], error: null },
    );
    expect(await checkPaidOrders()).toEqual({ status: 'pass' });
  });

  it('passes when there are no paid orders', async () => {
    mockResults.push({ data: [], error: null });
    expect(await checkPaidOrders()).toEqual({ status: 'pass' });
    expect(callsOf('from')).toHaveLength(1);
  });

  it('throws the error text on a database error', async () => {
    mockResults.push({ data: null, error: { message: 'db down' } });
    await expect(checkPaidOrders()).rejects.toThrow('db down');
  });

  it('throws when the profiles query errors', async () => {
    mockResults.push(
      { data: [{ merchant_trade_no: 'TC1', user_id: 'u1' }], error: null },
      { data: null, error: { message: 'profiles down' } },
    );
    await expect(checkPaidOrders()).rejects.toThrow('profiles down');
  });

  it('throws when the query rejects', async () => {
    mockRejectNext = true;
    await expect(checkPaidOrders()).rejects.toThrow('network down');
  });
});

describe('checkDoublePaid', () => {
  it('fails listing every order number of a user with two paid orders', async () => {
    mockResults.push({
      data: [
        { merchant_trade_no: 'TC1', user_id: 'u1' },
        { merchant_trade_no: 'TC2', user_id: 'u2' },
        { merchant_trade_no: 'TC3', user_id: 'u1' },
      ],
      error: null,
    });
    const result = await checkDoublePaid();
    expect(result).toEqual({ status: 'fail', output: '1 位使用者重複付款：TC1、TC3' });
    expect(callsOf('eq')[0].args).toEqual(['status', 'paid']);
  });

  it('passes when each user has one paid order', async () => {
    mockResults.push({
      data: [
        { merchant_trade_no: 'TC1', user_id: 'u1' },
        { merchant_trade_no: 'TC2', user_id: 'u2' },
      ],
      error: null,
    });
    expect(await checkDoublePaid()).toEqual({ status: 'pass' });
  });

  it('throws when the paid orders reach the 1000-row cap', async () => {
    mockResults.push({ data: paidOrders(1000), error: null });
    await expect(checkDoublePaid()).rejects.toThrow(CAP_OUTPUT);
  });

  it('checks 999 paid orders normally', async () => {
    mockResults.push({ data: paidOrders(999), error: null });
    expect(await checkDoublePaid()).toEqual({ status: 'pass' });
  });

  it('throws the error text on a database error', async () => {
    mockResults.push({ data: null, error: { message: 'db down' } });
    await expect(checkDoublePaid()).rejects.toThrow('db down');
  });
});

describe('checkCallbackFailures', () => {
  const NOW = Date.parse('2026-10-20T12:00:00Z');
  let nowSpy: jest.SpyInstance;
  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => nowSpy.mockRestore());
  const DAY = 24 * 60 * 60 * 1000;
  const row = (ageMs: number, no: string | null = 'TC9') => ({
    reason: '金額不符',
    merchant_trade_no: no,
    created_at: new Date(NOW - ageMs).toISOString(),
  });

  it('fails with the latest reason and order number when younger than 24 hours', async () => {
    mockResults.push({ data: [row(DAY - 1)], error: null });
    const result = await checkCallbackFailures();
    expect(result).toEqual({ status: 'fail', output: '金額不符，訂單 TC9' });
    expect(callsOf('order')[0].args).toEqual(['created_at', { ascending: false }]);
    expect(callsOf('limit')[0].args).toEqual([1]);
  });

  it('says the order is unknown when there is no order number', async () => {
    mockResults.push({ data: [row(1000, null)], error: null });
    expect((await checkCallbackFailures()).output).toBe('金額不符，訂單 不明');
  });

  it('passes with no rows', async () => {
    mockResults.push({ data: [], error: null });
    expect(await checkCallbackFailures()).toEqual({ status: 'pass' });
  });

  it('passes when the newest row is exactly 24 hours old', async () => {
    mockResults.push({ data: [row(DAY)], error: null });
    expect(await checkCallbackFailures()).toEqual({ status: 'pass' });
  });

  it('throws the error text on a database error', async () => {
    mockResults.push({ data: null, error: { message: 'db down' } });
    await expect(checkCallbackFailures()).rejects.toThrow('db down');
  });
});
