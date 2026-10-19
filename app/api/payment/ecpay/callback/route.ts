/**
 * ECPay's server-to-server ReturnURL. The only place a payment is trusted.
 *
 * ECPay posts here after a card is charged, as a URL-encoded form.
 * An order becomes paid here and nowhere else. All of these must hold:
 *   - the CheckMacValue verifies with our HashKey and HashIV;
 *   - RtnCode is 1, ECPay's success code;
 *   - TradeAmt equals the stored order amount and the fixed price;
 *   - SimulatePaid is not 1, because a backend simulation pays nobody;
 *   - this environment may grant a licence at all.
 * The browser-facing result route never reaches this logic.
 * So a user cannot report their own payment.
 *
 * ECPay expects HTTP 200 with plain text `1|OK` or `0|<reason>`.
 * A 500 makes ECPay retry all day, so every error becomes `0|...`.
 * ECPay retries until it sees `1|OK`. A replay of a paid order answers
 * `1|OK` and grants lifetime again, which changes nothing.
 */

import { verifyCallback, type EcpayParams } from '@/lib/payment/ecpay';
import {
  PRO_LIFETIME_PRICE_TWD,
  getEcpayConfig,
  isSandboxGrantAllowed,
  parseEcpayPaymentDate,
} from '@/lib/payment/config';
import {
  findOrderByTradeNo,
  findOtherPaidOrder,
  grantLifetime,
  markOrderPaid,
} from '@/lib/payment/orders';

/** ECPay callbacks are always dynamic server-to-server POSTs. */
export const dynamic = 'force-dynamic';

/** Plain-text 200 response in ECPay's `code|message` shape. */
function ecpayResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * Reads the posted form into a flat map of strings.
 *
 * The signature code expects one string per key.
 * A repeated key keeps its first value. A file field becomes an empty string.
 * Such a body then fails the signature check instead of crashing it.
 * It throws when the body is not form data at all.
 */
async function readFormBody(request: Request): Promise<EcpayParams> {
  const form = await request.formData();
  const body: EcpayParams = {};
  form.forEach((value, key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) return;
    body[key] = typeof value === 'string' ? value : '';
  });
  return body;
}

/**
 * Checks the signature without ever throwing.
 *
 * The encoder throws on some broken text, such as a lone surrogate.
 * A throw here counts as a bad signature.
 */
function signatureIsValid(body: EcpayParams, hashKey: string, hashIV: string): boolean {
  try {
    return verifyCallback(body, hashKey, hashIV);
  } catch {
    return false;
  }
}

/** Verifies one ECPay callback and grants lifetime when every check passes. */
export async function POST(request: Request): Promise<Response> {
  let merchantTradeNo = '';
  try {
    const body = await readFormBody(request);
    merchantTradeNo = body.MerchantTradeNo ?? '';

    const config = getEcpayConfig();

    // 1. The signature proves the payload came from ECPay unchanged.
    if (!signatureIsValid(body, config.hashKey, config.hashIV)) {
      console.warn('ecpay/callback: CheckMacValue verification failed', { merchantTradeNo });
      return ecpayResponse('0|CheckMacValue verify failed');
    }

    // 2. Only RtnCode 1 is a completed payment.
    if (body.RtnCode !== '1') {
      console.warn('ecpay/callback: non-success RtnCode', { merchantTradeNo, rtnCode: body.RtnCode });
      return ecpayResponse(`0|payment not successful (RtnCode=${body.RtnCode})`);
    }

    if (!merchantTradeNo) {
      console.warn('ecpay/callback: missing MerchantTradeNo');
      return ecpayResponse('0|missing MerchantTradeNo');
    }

    // 3. The order must exist before we can compare amounts.
    const order = await findOrderByTradeNo(merchantTradeNo);
    if (!order) {
      console.warn('ecpay/callback: order not found', { merchantTradeNo });
      return ecpayResponse('0|order not found');
    }

    // 4. The amount must match the stored order and the fixed price.
    const tradeAmt = Number(body.TradeAmt);
    if (tradeAmt !== order.amount_twd || tradeAmt !== PRO_LIFETIME_PRICE_TWD) {
      console.warn('ecpay/callback: amount mismatch', {
        merchantTradeNo,
        tradeAmt: body.TradeAmt,
        orderAmount: order.amount_twd,
      });
      return ecpayResponse(`0|amount mismatch (TradeAmt=${body.TradeAmt})`);
    }

    // 5. A simulated payment comes from ECPay's backend and moves no money.
    //    Acknowledge it so ECPay stops retrying, but grant nothing.
    if (body.SimulatePaid === '1') {
      console.warn('ecpay/callback: SimulatePaid=1, acknowledged without granting', { merchantTradeNo });
      return ecpayResponse('1|OK');
    }

    // 6. The test store keys are public, and test runs share the real database.
    //    So a test-store callback grants nothing unless the local opt-in is set.
    //    The answer is 1|OK so ECPay does not retry.
    if (!isSandboxGrantAllowed()) {
      console.warn(
        'ecpay/callback: test store without ECPAY_SANDBOX_GRANT, acknowledged without granting',
        { merchantTradeNo },
      );
      return ecpayResponse('1|OK');
    }

    // 7. Mark the order paid in one atomic step, then grant.
    //    A retry after a failed grant lands on already_paid and grants again.
    const paymentDate = parseEcpayPaymentDate(body.PaymentDate ?? '');
    const result = await markOrderPaid(merchantTradeNo, {
      ecpayTradeNo: body.TradeNo ?? '',
      paymentType: body.PaymentType ?? '',
      paymentDate,
      rtnCode: Number(body.RtnCode),
      rtnMsg: body.RtnMsg ?? '',
      rawCallback: body,
    });

    // A missed re-read can also land here. ECPay retries, and the retry sees the order.
    if (result === 'not_found') {
      console.warn('ecpay/callback: order vanished between lookup and update', { merchantTradeNo });
      return ecpayResponse('0|order not found');
    }

    // 8. A buyer can pay twice from two open cashier tabs. The money is taken,
    //    so ECPay still gets 1|OK. The log tells the owner which order to refund.
    if (result === 'paid_now') {
      const earlierOrder = await findOtherPaidOrder(order.user_id, merchantTradeNo);
      if (earlierOrder) {
        console.error('ecpay/callback: buyer paid twice, refund one order by hand', {
          merchantTradeNo,
          earlierOrder,
          userId: order.user_id,
        });
      }
    }

    const granted = await grantLifetime(
      order.user_id,
      order.email,
      paymentDate ?? new Date().toISOString(),
    );
    if (!granted) {
      console.error('ecpay/callback: grant failed, asking ECPay to retry', {
        merchantTradeNo,
        userId: order.user_id,
      });
      return ecpayResponse('0|grant failed');
    }

    console.log('ecpay/callback: lifetime granted', { merchantTradeNo, userId: order.user_id, result });
    return ecpayResponse('1|OK');
  } catch (err) {
    // Never show ECPay a 500. Log the error and answer in the protocol's shape.
    console.error('ecpay/callback: unexpected error', { merchantTradeNo, err });
    return ecpayResponse('0|internal error');
  }
}
