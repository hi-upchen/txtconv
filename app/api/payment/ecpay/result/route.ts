/**
 * ECPay's OrderResultURL. The buyer's browser lands here after the cashier.
 *
 * This route only redirects. It never writes to the database or grants anything.
 * It verifies the signature, so nobody can craft a "success" link for a guessed order.
 * An unsuccessful RtnCode adds `failed=1`, so the page can offer a retry.
 * The completion page reads the order state that the callback route wrote.
 *
 * The answer is 303 on purpose. ECPay's POST is cross-site and carries no session cookie.
 * The browser follows a 303 with a top-level GET, and that GET carries the cookie.
 * So the completion page can check that the order belongs to the logged-in user.
 */

import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/url';
import { readEcpayForm, verifyCallbackSafely } from '@/lib/payment/ecpay';
import { MERCHANT_TRADE_NO_REGEX, getEcpayConfig } from '@/lib/payment/config';

/** The result route is a dynamic POST handler and must never be cached. */
export const dynamic = 'force-dynamic';

/** Sends the browser to the completion page for the order ECPay reported. */
export async function POST(request: Request): Promise<NextResponse> {
  const baseUrl = getBaseUrl(request).replace(/\/+$/, '');
  const errorUrl = `${baseUrl}/checkout/complete?error=1`;

  try {
    const body = await readEcpayForm(request);
    const config = getEcpayConfig();
    const merchantTradeNo = body.MerchantTradeNo ?? '';

    const verified =
      verifyCallbackSafely(body, config.hashKey, config.hashIV) &&
      MERCHANT_TRADE_NO_REGEX.test(merchantTradeNo);

    if (!verified) {
      console.warn('ecpay/result: rejected browser result');
      return NextResponse.redirect(errorUrl, 303);
    }

    const failedSuffix = body.RtnCode === '1' ? '' : '&failed=1';
    return NextResponse.redirect(
      `${baseUrl}/checkout/complete?order=${encodeURIComponent(merchantTradeNo)}${failedSuffix}`,
      303,
    );
  } catch (err) {
    console.error('ecpay/result: unexpected error', err);
    return NextResponse.redirect(errorUrl, 303);
  }
}
