/**
 * Creates a pending order and hands the browser to ECPay's hosted cashier.
 *
 * The /checkout page posts here with a plain HTML form. Steps:
 *   - check the session;
 *   - send buyers who already own lifetime home;
 *   - store a pending order bound to the user id;
 *   - build signed AioCheckOut parameters;
 *   - return a small HTML form that posts itself to ECPay.
 * Nothing is granted here. Only the server-to-server callback grants lifetime.
 * Amount and item name come from constants. No client input decides them.
 */

import { NextResponse } from 'next/server';
import { getAuthUser, getProfile } from '@/lib/actions/auth';
import { isPaidUser } from '@/lib/auth';
import { getBaseUrl } from '@/lib/url';
import { buildCheckoutParams } from '@/lib/payment/ecpay';
import {
  EcpayConfigError,
  PRO_ITEM_NAME,
  PRO_LIFETIME_PRICE_TWD,
  PRO_TRADE_DESC,
  formatMerchantTradeDate,
  generateMerchantTradeNo,
  getEcpayConfig,
} from '@/lib/payment/config';
import { createPendingOrder } from '@/lib/payment/orders';

/** This route reads the session and writes an order. Never prerender it. */
export const dynamic = 'force-dynamic';

/** Escapes a value for use inside a double-quoted HTML attribute. */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wraps a short Traditional Chinese message in a minimal HTML page. */
function messagePage(title: string, body: string, status: number): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtmlAttr(title)}</title>
  </head>
  <body style="font-family: system-ui, sans-serif; text-align: center; padding: 3rem 1rem; color: #334155;">
    <h1 style="font-size: 1.25rem;">${escapeHtmlAttr(title)}</h1>
    <p>${escapeHtmlAttr(body)}</p>
    <p><a href="/checkout">回到結帳頁</a></p>
  </body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/** Starts one ECPay checkout for the logged-in user. */
export async function POST(request: Request): Promise<NextResponse> {
  const baseUrl = getBaseUrl(request).replace(/\/+$/, '');

  const user = await getAuthUser();
  if (!user || !user.email) {
    return NextResponse.redirect(`${baseUrl}/checkout`, 303);
  }

  const profile = await getProfile(user.id);
  if (isPaidUser(profile)) {
    return NextResponse.redirect(`${baseUrl}/`, 303);
  }

  let config;
  try {
    config = getEcpayConfig();
  } catch (err) {
    if (err instanceof EcpayConfigError) {
      console.error('ecpay/create: refusing to start checkout, config unsafe', err.message);
      return messagePage('付款暫時無法使用', '付款暫時無法使用，請稍後再試。', 503);
    }
    throw err;
  }

  const merchantTradeNo = generateMerchantTradeNo();
  try {
    await createPendingOrder({
      userId: user.id,
      email: user.email,
      amountTwd: PRO_LIFETIME_PRICE_TWD,
      merchantTradeNo,
    });
  } catch (err) {
    console.error('ecpay/create: failed to create pending order', { merchantTradeNo, err });
    return messagePage('無法建立訂單', '無法建立訂單，請稍後再試。', 500);
  }

  const params = buildCheckoutParams({
    merchantId: config.merchantId,
    merchantTradeNo,
    merchantTradeDate: formatMerchantTradeDate(new Date()),
    totalAmount: PRO_LIFETIME_PRICE_TWD,
    itemName: PRO_ITEM_NAME,
    tradeDesc: PRO_TRADE_DESC,
    returnURL: `${baseUrl}/api/payment/ecpay/callback`,
    orderResultURL: `${baseUrl}/api/payment/ecpay/result`,
    clientBackURL: `${baseUrl}/checkout/complete?order=${merchantTradeNo}`,
    customField1: user.id,
    hashKey: config.hashKey,
    hashIV: config.hashIV,
  });

  const fields = Object.entries(params)
    .map(
      ([k, v]) =>
        `<input type="hidden" name="${escapeHtmlAttr(k)}" value="${escapeHtmlAttr(v)}" />`,
    )
    .join('\n      ');

  // The form submits itself on load. The noscript button covers browsers without JavaScript.
  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>前往付款…</title>
  </head>
  <body style="font-family: system-ui, sans-serif; text-align: center; padding: 3rem 1rem; color: #334155;">
    <p>正在前往綠界安全付款頁面，請稍候…</p>
    <form id="ecpay-form" method="POST" action="${escapeHtmlAttr(config.checkoutUrl)}" accept-charset="UTF-8">
      ${fields}
      <noscript><button type="submit">若未自動跳轉，請點此前往付款</button></noscript>
    </form>
    <script>document.getElementById('ecpay-form').submit();</script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
