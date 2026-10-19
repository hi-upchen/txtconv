/**
 * @jest-environment node
 */
const mockGetAuthUser = jest.fn();
const mockGetProfile = jest.fn();
const mockCreatePendingOrder = jest.fn();

jest.mock('@/lib/actions/auth', () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
}));
jest.mock('@/lib/payment/orders', () => ({
  createPendingOrder: (...args: unknown[]) => mockCreatePendingOrder(...args),
}));

import { POST } from '@/app/api/payment/ecpay/create/route';
import { verifyCallback } from '@/lib/payment/ecpay';
import { ECPAY_SANDBOX_CREDENTIALS, MERCHANT_TRADE_NO_REGEX } from '@/lib/payment/config';

const USER = { id: '22222222-2222-2222-2222-222222222222', email: 'buyer@example.com' };
const FREE_PROFILE = { id: USER.id, email: USER.email, license_type: 'free', license_expires_at: null };
const LIFETIME_PROFILE = { ...FREE_PROFILE, license_type: 'lifetime' };

function request() {
  return new Request('https://example.test/api/payment/ecpay/create', { method: 'POST' });
}

/** Pulls every hidden input out of the returned HTML form. */
function hiddenFields(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<input type="hidden" name="([^"]+)" value="([^"]*)" \/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out[m[1]] = m[2];
  return out;
}

describe('POST /api/payment/ecpay/create', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_APP_URL: 'https://example.test' };
    delete process.env.ECPAY_ENV;
    delete process.env.VERCEL_ENV;
    mockGetAuthUser.mockReset();
    mockGetProfile.mockReset();
    mockCreatePendingOrder.mockReset();
    mockCreatePendingOrder.mockResolvedValue({});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('redirects guests to /checkout with 303', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(request());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://example.test/checkout');
    expect(mockCreatePendingOrder).not.toHaveBeenCalled();
  });

  it('redirects lifetime users home with 303', async () => {
    mockGetAuthUser.mockResolvedValue(USER);
    mockGetProfile.mockResolvedValue(LIFETIME_PROFILE);
    const res = await POST(request());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://example.test/');
    expect(mockCreatePendingOrder).not.toHaveBeenCalled();
  });

  it('fails closed with 503 on the production deployment when ECPay is not configured for production', async () => {
    process.env.VERCEL_ENV = 'production';
    mockGetAuthUser.mockResolvedValue(USER);
    mockGetProfile.mockResolvedValue(FREE_PROFILE);
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('付款暫時無法使用，請稍後再試');
    expect(mockCreatePendingOrder).not.toHaveBeenCalled();
  });

  it('returns 500 when the pending order cannot be stored', async () => {
    mockGetAuthUser.mockResolvedValue(USER);
    mockGetProfile.mockResolvedValue(FREE_PROFILE);
    mockCreatePendingOrder.mockRejectedValue(new Error('insert failed'));
    const res = await POST(request());
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('無法建立訂單，請稍後再試');
  });

  it('stores a pending order and returns a self-submitting sandbox form for a free user', async () => {
    mockGetAuthUser.mockResolvedValue(USER);
    mockGetProfile.mockResolvedValue(FREE_PROFILE);

    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();

    // The order is stored first, bound to the logged-in user, at the fixed price.
    expect(mockCreatePendingOrder).toHaveBeenCalledTimes(1);
    const orderArgs = mockCreatePendingOrder.mock.calls[0][0];
    expect(orderArgs).toMatchObject({ userId: USER.id, email: USER.email, amountTwd: 899 });
    expect(orderArgs.merchantTradeNo).toMatch(MERCHANT_TRADE_NO_REGEX);

    // ECPAY_ENV is unset, so the form posts to the sandbox cashier and submits itself.
    expect(html).toContain('action="https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"');
    expect(html).toContain("document.getElementById('ecpay-form').submit()");

    const fields = hiddenFields(html);
    expect(fields).toMatchObject({
      MerchantID: ECPAY_SANDBOX_CREDENTIALS.merchantId,
      MerchantTradeNo: orderArgs.merchantTradeNo,
      PaymentType: 'aio',
      TotalAmount: '899',
      TradeDesc: 'txtconv Pro lifetime',
      ItemName: '簡轉繁 Pro 終身版',
      ChoosePayment: 'Credit',
      EncryptType: '1',
      CustomField1: USER.id,
      ReturnURL: 'https://example.test/api/payment/ecpay/callback',
      OrderResultURL: 'https://example.test/api/payment/ecpay/result',
      ClientBackURL: `https://example.test/checkout/complete?order=${orderArgs.merchantTradeNo}`,
    });
    expect(fields.MerchantTradeDate).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);
    // The signature in the form verifies with the sandbox keys.
    expect(
      verifyCallback(fields, ECPAY_SANDBOX_CREDENTIALS.hashKey, ECPAY_SANDBOX_CREDENTIALS.hashIV),
    ).toBe(true);
  });

  it('stays usable when the browser restores the page from the back-forward cache', async () => {
    mockGetAuthUser.mockResolvedValue(USER);
    mockGetProfile.mockResolvedValue(FREE_PROFILE);
    const html = await (await POST(request())).text();

    // A restored page does not run the auto-submit script again.
    // So the pay button must be visible, not hidden inside noscript.
    expect(html).not.toContain('<noscript>');
    const form = html.slice(html.indexOf('<form'), html.indexOf('</form>'));
    expect(form).toContain('<button type="submit">前往綠界付款</button>');
    expect(html).toContain('<a href="/checkout">回到結帳頁</a>');
    // A restored page sends the buyer back to /checkout for a fresh order.
    expect(html).toContain(
      "window.addEventListener('pageshow', (e) => { if (e.persisted) location.replace('/checkout') })",
    );
  });

  it('treats a user with no profile row as free and still builds the form', async () => {
    mockGetAuthUser.mockResolvedValue(USER);
    mockGetProfile.mockResolvedValue(null);
    const res = await POST(request());
    expect(res.status).toBe(200);
  });
});
