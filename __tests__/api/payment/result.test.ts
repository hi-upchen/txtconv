/**
 * @jest-environment node
 */
jest.mock('@/lib/payment/orders', () => {
  throw new Error('result route must not import the orders module');
});

import { POST } from '@/app/api/payment/ecpay/result/route';
import { buildCheckMacValue } from '@/lib/payment/ecpay';
import { ECPAY_SANDBOX_CREDENTIALS } from '@/lib/payment/config';

function signedBody(overrides: Record<string, string> = {}): Record<string, string> {
  const body: Record<string, string> = {
    MerchantID: ECPAY_SANDBOX_CREDENTIALS.merchantId,
    MerchantTradeNo: 'TCabc123def456ghi789',
    RtnCode: '1',
    RtnMsg: '交易成功',
    TradeNo: '2609020005091234',
    TradeAmt: '899',
    PaymentDate: '2026/09/02 00:07:00',
    PaymentType: 'Credit_CreditCard',
    SimulatePaid: '0',
    ...overrides,
  };
  body.CheckMacValue = buildCheckMacValue(
    body,
    ECPAY_SANDBOX_CREDENTIALS.hashKey,
    ECPAY_SANDBOX_CREDENTIALS.hashIV,
  );
  return body;
}

async function post(body: Record<string, string> | string) {
  return POST(
    new Request('https://example.test/api/payment/ecpay/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: typeof body === 'string' ? body : new URLSearchParams(body).toString(),
    }),
  );
}

describe('POST /api/payment/ecpay/result', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_APP_URL: 'https://example.test' };
    delete process.env.ECPAY_ENV;
    delete process.env.VERCEL_ENV;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('303s to the completion page with the order number when the signature verifies', async () => {
    const res = await post(signedBody());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(
      'https://example.test/checkout/complete?order=TCabc123def456ghi789',
    );
  });

  it('marks the redirect as failed when ECPay reports an unsuccessful payment', async () => {
    const res = await post(signedBody({ RtnCode: '10100058', RtnMsg: '交易失敗' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(
      'https://example.test/checkout/complete?order=TCabc123def456ghi789&failed=1',
    );
  });

  it('303s to the error variant when the signature does not verify', async () => {
    const body = signedBody();
    body.CheckMacValue = 'DEADBEEF';
    const res = await post(body);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://example.test/checkout/complete?error=1');
  });

  it('303s to the error variant when the order number is not ours', async () => {
    const res = await post(signedBody({ MerchantTradeNo: '../../etc' }));
    expect(res.headers.get('location')).toBe('https://example.test/checkout/complete?error=1');
  });

  it('303s to the error variant on an unparseable body', async () => {
    const res = await POST(
      new Request('https://example.test/api/payment/ecpay/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{nope',
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://example.test/checkout/complete?error=1');
  });

  it('303s to the error variant instead of throwing on hostile text', async () => {
    const res = await post(
      'MerchantTradeNo=TCabc123def456ghi789&RtnCode=1&Bad=%ED%A0%80&CheckMacValue=AA',
    );
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://example.test/checkout/complete?error=1');
  });

  it('uses the configured app URL, not the request host', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://txtconv.example/';
    const res = await post(signedBody());
    expect(res.headers.get('location')).toBe(
      'https://txtconv.example/checkout/complete?order=TCabc123def456ghi789',
    );
  });
});
