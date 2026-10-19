// __tests__/lib/payment/config.test.ts
/**
 * @jest-environment node
 */
import {
  ECPAY_SANDBOX_CREDENTIALS,
  EcpayConfigError,
  MERCHANT_TRADE_NO_REGEX,
  PRO_LIFETIME_PRICE_TWD,
  formatMerchantTradeDate,
  generateMerchantTradeNo,
  getEcpayConfig,
  isSandboxGrantAllowed,
  parseEcpayPaymentDate,
} from '@/lib/payment/config';

describe('lib/payment/config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ECPAY_ENV;
    delete process.env.ECPAY_MERCHANT_ID;
    delete process.env.ECPAY_HASH_KEY;
    delete process.env.ECPAY_HASH_IV;
    delete process.env.VERCEL_ENV;
    delete process.env.ECPAY_SANDBOX_GRANT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('fixes the lifetime price at NT$899', () => {
    expect(PRO_LIFETIME_PRICE_TWD).toBe(899);
  });

  describe('getEcpayConfig', () => {
    it('defaults to the public sandbox merchant when ECPAY_ENV is unset', () => {
      const config = getEcpayConfig();
      expect(config.isProduction).toBe(false);
      expect(config.merchantId).toBe(ECPAY_SANDBOX_CREDENTIALS.merchantId);
      expect(config.hashKey).toBe(ECPAY_SANDBOX_CREDENTIALS.hashKey);
      expect(config.hashIV).toBe(ECPAY_SANDBOX_CREDENTIALS.hashIV);
      expect(config.checkoutUrl).toBe('https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5');
    });

    it('treats any ECPAY_ENV other than "production" as sandbox', () => {
      process.env.ECPAY_ENV = 'staging';
      expect(getEcpayConfig().isProduction).toBe(false);
    });

    it('uses the live endpoint and the configured keys in production', () => {
      process.env.ECPAY_ENV = 'production';
      process.env.ECPAY_MERCHANT_ID = '1234567';
      process.env.ECPAY_HASH_KEY = 'prodkeyprodkey00';
      process.env.ECPAY_HASH_IV = 'prodivprodiv0000';
      const config = getEcpayConfig();
      expect(config.isProduction).toBe(true);
      expect(config.merchantId).toBe('1234567');
      expect(config.checkoutUrl).toBe('https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5');
    });

    it('throws EcpayConfigError when production is missing any key', () => {
      process.env.ECPAY_ENV = 'production';
      process.env.ECPAY_MERCHANT_ID = '1234567';
      process.env.ECPAY_HASH_KEY = 'prodkeyprodkey00';
      // ECPAY_HASH_IV is left out on purpose.
      expect(() => getEcpayConfig()).toThrow(EcpayConfigError);
    });

    it('throws EcpayConfigError on the Vercel production deployment when not pointed at the live merchant', () => {
      process.env.VERCEL_ENV = 'production';
      // ECPAY_ENV is unset, so this would be sandbox. Real buyers must never see the test cashier.
      expect(() => getEcpayConfig()).toThrow(EcpayConfigError);
    });

    it('does not throw on Vercel preview deployments without ECPay variables', () => {
      process.env.VERCEL_ENV = 'preview';
      expect(getEcpayConfig().isProduction).toBe(false);
    });
  });

  describe('generateMerchantTradeNo', () => {
    it('produces TC plus 18 lower-case base36 chars (20 total, ECPay maximum)', () => {
      const no = generateMerchantTradeNo();
      expect(no).toHaveLength(20);
      expect(no).toMatch(MERCHANT_TRADE_NO_REGEX);
    });

    it('does not repeat across 200 draws', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 200; i++) seen.add(generateMerchantTradeNo());
      expect(seen.size).toBe(200);
    });
  });

  describe('formatMerchantTradeDate', () => {
    it('renders a UTC instant as Taipei wall-clock time (UTC+8)', () => {
      // 16:05:09 UTC is 00:05:09 the next day in Taipei.
      expect(formatMerchantTradeDate(new Date('2026-09-01T16:05:09Z'))).toBe('2026/09/02 00:05:09');
    });

    it('crosses year boundaries and prints midnight as 00, never 24', () => {
      expect(formatMerchantTradeDate(new Date('2026-12-31T16:00:00Z'))).toBe('2027/01/01 00:00:00');
    });
  });

  describe('parseEcpayPaymentDate', () => {
    it('reads ECPay Taipei time back into an ISO instant', () => {
      expect(parseEcpayPaymentDate('2026/09/02 00:05:09')).toBe('2026-09-01T16:05:09.000Z');
    });

    it('returns null for malformed input', () => {
      expect(parseEcpayPaymentDate('')).toBeNull();
      expect(parseEcpayPaymentDate('2026-09-02 00:05:09')).toBeNull();
      expect(parseEcpayPaymentDate('not a date')).toBeNull();
    });
  });

  describe('isSandboxGrantAllowed', () => {
    it('allows granting in production', () => {
      process.env.ECPAY_ENV = 'production';
      expect(isSandboxGrantAllowed()).toBe(true);
    });

    it('refuses outside production without the flag', () => {
      expect(isSandboxGrantAllowed()).toBe(false);
    });

    it('allows outside production when ECPAY_SANDBOX_GRANT is "true"', () => {
      process.env.ECPAY_SANDBOX_GRANT = 'true';
      expect(isSandboxGrantAllowed()).toBe(true);
    });

    it('refuses outside production for any other flag value', () => {
      process.env.ECPAY_SANDBOX_GRANT = '1';
      expect(isSandboxGrantAllowed()).toBe(false);
    });
  });
});
