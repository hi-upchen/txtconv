// lib/payment/ecpay.ts
/**
 * Pure building blocks for ECPay's All-in-One hosted checkout.
 *
 * Nothing here reads the database, the network, the clock or the environment.
 * The signature is the riskiest part of an ECPay integration. A unit test
 * reproduces ECPay's own worked example byte for byte. Pure functions keep
 * that test simple.
 *
 * CheckMacValue algorithm, checked against https://developers.ecpay.com.tw/?p=2902:
 *   1. Sort every parameter by key, A to Z, ignoring case.
 *   2. Join as `HashKey=<key>&k1=v1&k2=v2&...&HashIV=<iv>`.
 *   3. URL-encode the whole string the way .NET `HttpUtility.UrlEncode` does.
 *      A space becomes `+`. The characters `- _ . ! * ( )` stay as they are.
 *   4. Lower-case the encoded string.
 *   5. Hash it with SHA-256. EncryptType=1 selects SHA-256.
 *   6. Upper-case the hex digest. That is the CheckMacValue.
 *
 * `__tests__/lib/payment/ecpay.test.ts` checks steps 1 to 6 against ECPay's example.
 */

import crypto from 'crypto';

/** A flat map of ECPay parameter names to their string values. */
export type EcpayParams = Record<string, string>;

/**
 * URL-encodes one string the way ECPay expects.
 *
 * `encodeURIComponent` is close but differs from .NET in three places:
 *   - a space becomes `%20`, but ECPay expects `+`;
 *   - `~` stays literal, but .NET encodes it as `%7E`;
 *   - `'` stays literal, but .NET encodes it as `%27`.
 * Hex case does not matter. The caller lower-cases the whole string.
 */
function ecpayUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7E')
    .replace(/'/g, '%27');
}

/**
 * Builds the exact string ECPay hashes.
 *
 * The string is sorted, wrapped in HashKey and HashIV, URL-encoded and
 * lower-cased. Tests call it directly to check the encoding step alone.
 *
 * @param params - Parameters to sign. Must not include CheckMacValue.
 * @param hashKey - Merchant HashKey.
 * @param hashIV - Merchant HashIV.
 * @returns The string ECPay hashes.
 */
export function buildPreHashString(
  params: EcpayParams,
  hashKey: string,
  hashIV: string,
): string {
  const sortedKeys = Object.keys(params).sort((a, b) => {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    if (la < lb) return -1;
    if (la > lb) return 1;
    return 0;
  });

  const middle = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${middle}&HashIV=${hashIV}`;

  return ecpayUrlEncode(raw).toLowerCase();
}

/**
 * Computes the ECPay CheckMacValue for a set of parameters.
 *
 * @param params - Every field except CheckMacValue. Including it would corrupt the result.
 * @param hashKey - Merchant HashKey.
 * @param hashIV - Merchant HashIV.
 * @returns The upper-case SHA-256 CheckMacValue.
 */
export function buildCheckMacValue(
  params: EcpayParams,
  hashKey: string,
  hashIV: string,
): string {
  const preHash = buildPreHashString(params, hashKey, hashIV);
  return crypto.createHash('sha256').update(preHash).digest('hex').toUpperCase();
}

/**
 * Everything needed to build one credit-card AioCheckOut request.
 * The caller supplies config, URLs and the timestamp, so this module reads nothing.
 */
export interface CheckoutInput {
  merchantId: string;
  /** Our hard-to-guess order id. ECPay receives it as MerchantTradeNo. */
  merchantTradeNo: string;
  /** Order time in Taipei, formatted `yyyy/MM/dd HH:mm:ss`. */
  merchantTradeDate: string;
  /** Whole New Taiwan Dollars. For this product it is always 899. */
  totalAmount: number;
  /** Item label on the ECPay cashier page. At most 400 characters. */
  itemName: string;
  /** Short trade description. At most 200 characters, no special characters. */
  tradeDesc: string;
  /** Server-to-server result URL. The only place a payment is trusted. */
  returnURL: string;
  /** Where ECPay sends the browser after paying. Display only. */
  orderResultURL: string;
  /** Target of the cashier's "back to shop" button. Carries no payment data. */
  clientBackURL: string;
  /** Free-form merchant field, at most 50 characters. We store the buyer's user id. */
  customField1: string;
  hashKey: string;
  hashIV: string;
}

/**
 * Builds the full AioCheckOut parameter map for one credit-card payment.
 *
 * The map includes a valid CheckMacValue and is ready to POST as form fields.
 * `ChoosePayment=Credit` limits the cashier to credit cards.
 * `EncryptType=1` selects SHA-256. `PaymentType=aio` is a fixed value.
 *
 * @param input - Everything needed to describe and sign the order.
 * @returns The parameter map to submit to ECPay.
 */
export function buildCheckoutParams(input: CheckoutInput): EcpayParams {
  const params: EcpayParams = {
    MerchantID: input.merchantId,
    MerchantTradeNo: input.merchantTradeNo,
    MerchantTradeDate: input.merchantTradeDate,
    PaymentType: 'aio',
    TotalAmount: String(input.totalAmount),
    TradeDesc: input.tradeDesc,
    ItemName: input.itemName,
    ReturnURL: input.returnURL,
    OrderResultURL: input.orderResultURL,
    ClientBackURL: input.clientBackURL,
    ChoosePayment: 'Credit',
    EncryptType: '1',
    CustomField1: input.customField1,
  };

  const CheckMacValue = buildCheckMacValue(params, input.hashKey, input.hashIV);
  return { ...params, CheckMacValue };
}

/**
 * Checks the CheckMacValue on a payload ECPay posted to us.
 *
 * It recomputes the signature over every other field and compares,
 * ignoring case. A missing or empty CheckMacValue fails.
 *
 * A valid signature only proves ECPay sent the payload. It does not mean
 * the payment succeeded. The caller must also check RtnCode, the amount
 * and SimulatePaid.
 *
 * @param body - The parsed form fields.
 * @param hashKey - Merchant HashKey.
 * @param hashIV - Merchant HashIV.
 * @returns True when the signature matches.
 */
export function verifyCallback(
  body: EcpayParams,
  hashKey: string,
  hashIV: string,
): boolean {
  const received = body.CheckMacValue;
  if (!received) return false;

  const rest: EcpayParams = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'CheckMacValue') continue;
    rest[k] = v;
  }

  const expected = buildCheckMacValue(rest, hashKey, hashIV);
  return expected === received.toUpperCase();
}

/**
 * Reads a form that ECPay posted into a flat map of strings.
 *
 * The signature code expects one string per key.
 * A repeated key keeps its first value. A file field becomes an empty string.
 * Such a body then fails the signature check instead of crashing it.
 * It throws when the body is not form data at all.
 *
 * @param request - The incoming POST request.
 * @returns The posted fields.
 */
export async function readEcpayForm(request: Request): Promise<EcpayParams> {
  const form = await request.formData();
  const body: EcpayParams = {};
  form.forEach((value, key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) return;
    body[key] = typeof value === 'string' ? value : '';
  });
  return body;
}

/**
 * Checks the signature on a posted payload without ever throwing.
 *
 * The encoder throws on some broken text, such as a lone surrogate.
 * A throw here counts as a bad signature.
 *
 * @param body - The parsed form fields.
 * @param hashKey - Merchant HashKey.
 * @param hashIV - Merchant HashIV.
 * @returns True only when the signature matches.
 */
export function verifyCallbackSafely(
  body: EcpayParams,
  hashKey: string,
  hashIV: string,
): boolean {
  try {
    return verifyCallback(body, hashKey, hashIV);
  } catch {
    return false;
  }
}
