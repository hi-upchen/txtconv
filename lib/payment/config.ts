// lib/payment/config.ts
/**
 * ECPay settings, order numbers and the Taipei time helpers ECPay needs.
 *
 * Sandbox is the default. Only `ECPAY_ENV=production` selects the live cashier.
 * In that mode all three merchant secrets must be set.
 * Outside production we use ECPay's public sandbox merchant
 * (https://developers.ecpay.com.tw/?p=22696). Those values are public test data.
 * So local runs and CI need no secrets.
 *
 * The real site fails closed. If Vercel says this is the production
 * deployment but ECPAY_ENV is not production, we throw.
 * A real buyer must never reach the test cashier.
 */

import crypto from 'crypto';

export { PRO_LIFETIME_PRICE_TWD } from './price';

/** Item label on the ECPay cashier page. At most 400 characters. */
export const PRO_ITEM_NAME = '簡轉繁 Pro 終身版';

/** Trade description sent to ECPay. Plain ASCII, no special characters. */
export const PRO_TRADE_DESC = 'txtconv Pro lifetime';

/** ECPay's public sandbox merchant without 3D verification. Public test data. */
export const ECPAY_SANDBOX_CREDENTIALS = {
  merchantId: '2000132',
  hashKey: '5294y06JbISpM5x9',
  hashIV: 'v77hoKGq4kWxNNIS',
} as const;

const SANDBOX_CHECKOUT_URL = 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';
const PRODUCTION_CHECKOUT_URL = 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';

/** Thrown when this environment cannot safely take a real payment. */
export class EcpayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EcpayConfigError';
  }
}

/** ECPay settings resolved for the current environment. */
export interface EcpayConfig {
  merchantId: string;
  hashKey: string;
  hashIV: string;
  /** The AioCheckOut V5 endpoint for this environment. */
  checkoutUrl: string;
}

/**
 * Reads the ECPay settings from the environment.
 *
 * It throws `EcpayConfigError` in two cases:
 *   - production mode is missing the merchant id or a key;
 *   - this is the Vercel production deployment, but ECPAY_ENV is not production.
 * Either case would send real buyers to the wrong cashier.
 */
export function getEcpayConfig(): EcpayConfig {
  const isProduction = process.env.ECPAY_ENV === 'production';
  const onVercelProduction = process.env.VERCEL_ENV === 'production';

  if (onVercelProduction && !isProduction) {
    throw new EcpayConfigError(
      'ECPAY_ENV must be "production" on the production deployment',
    );
  }

  if (isProduction) {
    const merchantId = process.env.ECPAY_MERCHANT_ID;
    const hashKey = process.env.ECPAY_HASH_KEY;
    const hashIV = process.env.ECPAY_HASH_IV;
    if (!merchantId || !hashKey || !hashIV) {
      throw new EcpayConfigError(
        'ECPAY_MERCHANT_ID, ECPAY_HASH_KEY and ECPAY_HASH_IV are all required in production',
      );
    }
    return { merchantId, hashKey, hashIV, checkoutUrl: PRODUCTION_CHECKOUT_URL };
  }

  return {
    merchantId: process.env.ECPAY_MERCHANT_ID || ECPAY_SANDBOX_CREDENTIALS.merchantId,
    hashKey: process.env.ECPAY_HASH_KEY || ECPAY_SANDBOX_CREDENTIALS.hashKey,
    hashIV: process.env.ECPAY_HASH_IV || ECPAY_SANDBOX_CREDENTIALS.hashIV,
    checkoutUrl: SANDBOX_CHECKOUT_URL,
  };
}

/**
 * Says whether a payment callback may grant a licence in this environment.
 *
 * The test merchant keys are public, so anyone can sign a fake paid callback.
 * Preview and local runs share the production database.
 * So a licence is granted only in production.
 * A local sandbox run can opt in with `ECPAY_SANDBOX_GRANT=true`.
 */
export function isSandboxGrantAllowed(): boolean {
  return (
    process.env.ECPAY_ENV === 'production' || process.env.ECPAY_SANDBOX_GRANT === 'true'
  );
}

/** Prefix on every order number. It makes our orders easy to spot in ECPay's backend. */
const MERCHANT_TRADE_NO_PREFIX = 'TC';

/** Random characters after the prefix. 2 + 18 = 20, ECPay's maximum length. */
const MERCHANT_TRADE_NO_RANDOM_LEN = 18;

/** Lower-case base-36 alphabet for the random part. */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Matches exactly one well-formed order number. */
export const MERCHANT_TRADE_NO_REGEX = /^TC[a-z0-9]{18}$/;

/**
 * Generates a hard-to-guess order number. ECPay receives it as MerchantTradeNo.
 *
 * It is `TC` plus 18 random base-36 characters, about 93 bits of entropy.
 * Rejection sampling keeps every character equally likely.
 * A plain `byte % 36` would favour the first characters of the alphabet.
 */
export function generateMerchantTradeNo(): string {
  const targetLength = MERCHANT_TRADE_NO_PREFIX.length + MERCHANT_TRADE_NO_RANDOM_LEN;
  // 252 is the largest multiple of 36 below 256. Bytes at or above it are skipped.
  const CUTOFF = 252;
  let out = MERCHANT_TRADE_NO_PREFIX;
  while (out.length < targetLength) {
    const bytes = crypto.randomBytes(MERCHANT_TRADE_NO_RANDOM_LEN);
    for (let i = 0; i < bytes.length && out.length < targetLength; i++) {
      if (bytes[i] >= CUTOFF) continue;
      out += ALPHABET[bytes[i] % 36];
    }
  }
  return out;
}

/**
 * Date formatter pinned to Taipei time.
 *
 * ECPay reads MerchantTradeDate as Taipei wall-clock time.
 * Vercel machines run in UTC, so the machine clock zone is wrong.
 * `hourCycle: 'h23'` prints midnight as 00, never 24.
 */
const TAIPEI_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Taipei',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/**
 * Formats an instant as ECPay's `yyyy/MM/dd HH:mm:ss` in Taipei time.
 *
 * @param date - Any instant.
 * @returns For example `2026/09/02 00:05:09`.
 */
export function formatMerchantTradeDate(date: Date): string {
  const parts = TAIPEI_PARTS.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return (
    `${pick('year')}/${pick('month')}/${pick('day')} ` +
    `${pick('hour')}:${pick('minute')}:${pick('second')}`
  );
}

/**
 * Turns ECPay's `yyyy/MM/dd HH:mm:ss` Taipei time into an ISO instant.
 *
 * @param value - The raw PaymentDate field from a callback.
 * @returns An ISO 8601 string, or null when the input is not in ECPay's format.
 */
export function parseEcpayPaymentDate(value: string): string | null {
  const match = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const instant = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+08:00`);
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toISOString();
}
