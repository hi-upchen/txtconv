/**
 * @jest-environment node
 */
const mockFindOrderByTradeNo = jest.fn();
const mockMarkOrderPaid = jest.fn();
const mockGrantLifetime = jest.fn();
const mockFindOtherPaidOrder = jest.fn();
const mockVerifyCallback = jest.fn();

jest.mock('@/lib/payment/orders', () => ({
  findOrderByTradeNo: (...args: unknown[]) => mockFindOrderByTradeNo(...args),
  markOrderPaid: (...args: unknown[]) => mockMarkOrderPaid(...args),
  grantLifetime: (...args: unknown[]) => mockGrantLifetime(...args),
  findOtherPaidOrder: (...args: unknown[]) => mockFindOtherPaidOrder(...args),
}));

// The real verifier runs by default. Single tests swap in a throwing one.
jest.mock('@/lib/payment/ecpay', () => {
  const actual = jest.requireActual('@/lib/payment/ecpay');
  return {
    ...actual,
    verifyCallback: (...args: unknown[]) => mockVerifyCallback(...args),
  };
});

import { POST } from '@/app/api/payment/ecpay/callback/route';
import { buildCheckMacValue } from '@/lib/payment/ecpay';
import { ECPAY_SANDBOX_CREDENTIALS } from '@/lib/payment/config';

const actualVerifyCallback = jest.requireActual('@/lib/payment/ecpay').verifyCallback;

const ORDER = {
  id: '11111111-1111-1111-1111-111111111111',
  merchant_trade_no: 'TCabc123def456ghi789',
  user_id: '22222222-2222-2222-2222-222222222222',
  email: 'buyer@example.com',
  amount_twd: 899,
  status: 'pending',
};

/** Builds a callback body signed with the sandbox keys. Overrides apply before signing. */
function signedBody(overrides: Record<string, string> = {}): Record<string, string> {
  const body: Record<string, string> = {
    MerchantID: ECPAY_SANDBOX_CREDENTIALS.merchantId,
    MerchantTradeNo: ORDER.merchant_trade_no,
    RtnCode: '1',
    RtnMsg: '交易成功',
    TradeNo: '2609020005091234',
    TradeAmt: '899',
    PaymentDate: '2026/09/02 00:07:00',
    PaymentType: 'Credit_CreditCard',
    SimulatePaid: '0',
    CustomField1: ORDER.user_id,
    ...overrides,
  };
  body.CheckMacValue = buildCheckMacValue(
    body,
    ECPAY_SANDBOX_CREDENTIALS.hashKey,
    ECPAY_SANDBOX_CREDENTIALS.hashIV,
  );
  return body;
}

/** Posts a raw form string and checks the protocol shape ECPay needs. */
async function postRaw(formBody: string): Promise<string> {
  const res = await POST(
    new Request('https://example.test/api/payment/ecpay/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    }),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('text/plain');
  return res.text();
}

/** Posts a body the way ECPay does, as application/x-www-form-urlencoded. */
async function post(body: Record<string, string>): Promise<string> {
  return postRaw(new URLSearchParams(body).toString());
}

describe('POST /api/payment/ecpay/callback', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ECPAY_ENV;
    delete process.env.VERCEL_ENV;
    delete process.env.ECPAY_MERCHANT_ID;
    delete process.env.ECPAY_HASH_KEY;
    delete process.env.ECPAY_HASH_IV;
    // Most tests exercise the grant path, so the local sandbox opt-in is on.
    process.env.ECPAY_SANDBOX_GRANT = 'true';
    mockVerifyCallback.mockReset().mockImplementation(actualVerifyCallback);
    mockFindOrderByTradeNo.mockReset().mockResolvedValue(ORDER);
    mockMarkOrderPaid.mockReset().mockResolvedValue('paid_now');
    mockGrantLifetime.mockReset().mockResolvedValue(true);
    mockFindOtherPaidOrder.mockReset().mockResolvedValue(null);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects a bad signature before touching the database', async () => {
    const body = signedBody();
    body.CheckMacValue = 'DEADBEEF';
    expect(await post(body)).toBe('0|CheckMacValue verify failed');
    expect(mockFindOrderByTradeNo).not.toHaveBeenCalled();
    expect(mockGrantLifetime).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('CheckMacValue'),
      expect.objectContaining({ merchantTradeNo: ORDER.merchant_trade_no }),
    );
  });

  it('rejects a payload where a field was altered after signing', async () => {
    const body = signedBody();
    body.TradeAmt = '1';
    expect(await post(body)).toBe('0|CheckMacValue verify failed');
    expect(mockFindOrderByTradeNo).not.toHaveBeenCalled();
  });

  it('turns a verifier that throws into a signature failure, not a 500', async () => {
    mockVerifyCallback.mockImplementation(() => {
      throw new URIError('URI malformed');
    });
    expect(await post(signedBody())).toBe('0|CheckMacValue verify failed');
    expect(mockFindOrderByTradeNo).not.toHaveBeenCalled();
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
    expect(mockGrantLifetime).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('CheckMacValue'),
      expect.objectContaining({ merchantTradeNo: ORDER.merchant_trade_no }),
    );
  });

  it('hands the verifier a flat string map and keeps the first value of a repeated key', async () => {
    const formBody = `${new URLSearchParams(signedBody()).toString()}&TradeAmt=1&RtnCode=0`;
    expect(await postRaw(formBody)).toBe('1|OK');
    const passed = mockVerifyCallback.mock.calls[0][0] as Record<string, unknown>;
    expect(passed.TradeAmt).toBe('899');
    expect(passed.RtnCode).toBe('1');
    for (const value of Object.values(passed)) expect(typeof value).toBe('string');
  });

  it('turns a file upload field into an empty string, which fails the signature', async () => {
    const form = new FormData();
    for (const [k, v] of Object.entries(signedBody())) form.append(k, v);
    form.set('RtnMsg', new Blob(['x']), 'x.txt');
    const res = await POST(
      new Request('https://example.test/api/payment/ecpay/callback', { method: 'POST', body: form }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('0|CheckMacValue verify failed');
    const passed = mockVerifyCallback.mock.calls[0][0] as Record<string, unknown>;
    expect(passed.RtnMsg).toBe('');
  });

  it('rejects a non-success RtnCode', async () => {
    expect(await post(signedBody({ RtnCode: '10100058' }))).toBe(
      '0|payment not successful (RtnCode=10100058)',
    );
    expect(mockFindOrderByTradeNo).not.toHaveBeenCalled();
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
  });

  it('rejects a payload without MerchantTradeNo', async () => {
    const body = signedBody();
    delete body.MerchantTradeNo;
    body.CheckMacValue = buildCheckMacValue(
      Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'CheckMacValue')),
      ECPAY_SANDBOX_CREDENTIALS.hashKey,
      ECPAY_SANDBOX_CREDENTIALS.hashIV,
    );
    expect(await post(body)).toBe('0|missing MerchantTradeNo');
    expect(mockFindOrderByTradeNo).not.toHaveBeenCalled();
  });

  it('reports an unknown order', async () => {
    mockFindOrderByTradeNo.mockResolvedValue(null);
    expect(await post(signedBody())).toBe('0|order not found');
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
  });

  it('rejects an amount that differs from the order (validly signed)', async () => {
    expect(await post(signedBody({ TradeAmt: '1' }))).toBe('0|amount mismatch (TradeAmt=1)');
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
  });

  it('rejects an amount that matches a tampered order but not the fixed price', async () => {
    mockFindOrderByTradeNo.mockResolvedValue({ ...ORDER, amount_twd: 1 });
    expect(await post(signedBody({ TradeAmt: '1' }))).toBe('0|amount mismatch (TradeAmt=1)');
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
  });

  it('acknowledges a simulated payment without granting anything', async () => {
    expect(await post(signedBody({ SimulatePaid: '1' }))).toBe('1|OK');
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
    expect(mockGrantLifetime).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('SimulatePaid'),
      expect.objectContaining({ merchantTradeNo: ORDER.merchant_trade_no }),
    );
  });

  it('checks SimulatePaid only after the amount', async () => {
    expect(await post(signedBody({ SimulatePaid: '1', TradeAmt: '1' }))).toBe(
      '0|amount mismatch (TradeAmt=1)',
    );
  });

  it('acknowledges but grants nothing on the test store without the sandbox opt-in', async () => {
    delete process.env.ECPAY_SANDBOX_GRANT;
    expect(await post(signedBody())).toBe('1|OK');
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
    expect(mockGrantLifetime).not.toHaveBeenCalled();
    expect(mockFindOtherPaidOrder).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('ECPAY_SANDBOX_GRANT'),
      expect.objectContaining({ merchantTradeNo: ORDER.merchant_trade_no }),
    );
  });

  it('checks the sandbox guard only after the amount', async () => {
    delete process.env.ECPAY_SANDBOX_GRANT;
    expect(await post(signedBody({ TradeAmt: '1' }))).toBe('0|amount mismatch (TradeAmt=1)');
  });

  it('grants on the test store when the sandbox opt-in is on', async () => {
    process.env.ECPAY_SANDBOX_GRANT = 'true';
    expect(await post(signedBody())).toBe('1|OK');
    expect(mockMarkOrderPaid).toHaveBeenCalledTimes(1);
    expect(mockGrantLifetime).toHaveBeenCalledTimes(1);
  });

  it('marks the order paid, grants lifetime, and answers 1|OK', async () => {
    expect(await post(signedBody())).toBe('1|OK');

    expect(mockMarkOrderPaid).toHaveBeenCalledWith(ORDER.merchant_trade_no, {
      ecpayTradeNo: '2609020005091234',
      paymentType: 'Credit_CreditCard',
      paymentDate: '2026-09-01T16:07:00.000Z',
      rtnCode: 1,
      rtnMsg: '交易成功',
      rawCallback: expect.objectContaining({
        MerchantTradeNo: ORDER.merchant_trade_no,
        CheckMacValue: expect.any(String),
      }),
    });
    expect(mockGrantLifetime).toHaveBeenCalledWith(
      ORDER.user_id,
      ORDER.email,
      '2026-09-01T16:07:00.000Z',
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it('stores the complete raw callback on the order', async () => {
    const body = signedBody();
    await post(body);
    expect(mockMarkOrderPaid.mock.calls[0][1].rawCallback).toEqual(body);
  });

  it('re-grants on a duplicate callback and still answers 1|OK (idempotent)', async () => {
    mockMarkOrderPaid.mockResolvedValue('already_paid');
    expect(await post(signedBody())).toBe('1|OK');
    expect(mockGrantLifetime).toHaveBeenCalledTimes(1);
    expect(mockGrantLifetime).toHaveBeenCalledWith(
      ORDER.user_id,
      ORDER.email,
      '2026-09-01T16:07:00.000Z',
    );
    // A replay of the same order is not a second purchase.
    expect(mockFindOtherPaidOrder).not.toHaveBeenCalled();
  });

  it('asks ECPay to retry when the grant on a duplicate callback fails', async () => {
    mockMarkOrderPaid.mockResolvedValue('already_paid');
    mockGrantLifetime.mockResolvedValue(false);
    expect(await post(signedBody())).toBe('0|grant failed');
  });

  it('still grants on a second paid order by the same buyer and logs a refund request', async () => {
    mockFindOtherPaidOrder.mockResolvedValue('TCzzzzzzzzzzzzzzzzzz');
    expect(await post(signedBody())).toBe('1|OK');
    expect(mockFindOtherPaidOrder).toHaveBeenCalledWith(ORDER.user_id, ORDER.merchant_trade_no);
    expect(mockGrantLifetime).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('refund'),
      expect.objectContaining({
        merchantTradeNo: ORDER.merchant_trade_no,
        earlierOrder: 'TCzzzzzzzzzzzzzzzzzz',
      }),
    );
  });

  it('reports not_found from the atomic update as order not found', async () => {
    mockMarkOrderPaid.mockResolvedValue('not_found');
    expect(await post(signedBody())).toBe('0|order not found');
    expect(mockGrantLifetime).not.toHaveBeenCalled();
  });

  it('asks ECPay to retry when the grant fails and logs the order and user', async () => {
    mockGrantLifetime.mockResolvedValue(false);
    expect(await post(signedBody())).toBe('0|grant failed');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('grant failed'),
      { merchantTradeNo: ORDER.merchant_trade_no, userId: ORDER.user_id },
    );
  });

  it('never throws: database exceptions become 0|internal error', async () => {
    mockMarkOrderPaid.mockRejectedValue(new Error('db down'));
    expect(await post(signedBody())).toBe('0|internal error');
    expect(mockGrantLifetime).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('unexpected error'),
      expect.objectContaining({ merchantTradeNo: ORDER.merchant_trade_no }),
    );
  });

  it('never throws: a failing order lookup becomes 0|internal error', async () => {
    mockFindOrderByTradeNo.mockRejectedValue(new Error('db down'));
    expect(await post(signedBody())).toBe('0|internal error');
  });

  it('never throws: an unsafe production config becomes 0|internal error', async () => {
    process.env.VERCEL_ENV = 'production';
    expect(await post(signedBody())).toBe('0|internal error');
    expect(mockFindOrderByTradeNo).not.toHaveBeenCalled();
  });

  it('never throws: an unparseable body becomes 0|internal error', async () => {
    const res = await POST(
      new Request('https://example.test/api/payment/ecpay/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not form data',
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toBe('0|internal error');
  });
});
