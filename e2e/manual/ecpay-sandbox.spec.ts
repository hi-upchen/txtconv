// e2e/manual/ecpay-sandbox.spec.ts
/**
 * ECPay sandbox end-to-end run. Skipped unless ECPAY_SANDBOX_E2E=1.
 *
 * Prerequisites, all headless:
 *   - `ecpay_orders` exists in the Supabase project from .env.local;
 *   - an ngrok https tunnel points at :3000;
 *   - `next start` serves a build made with NEXT_PUBLIC_APP_URL=<that https URL>;
 *   - both the build and the server run with ECPAY_SANDBOX_GRANT=true;
 *   - the same NEXT_PUBLIC_APP_URL is exported for this Playwright process.
 *
 * The tests run in order:
 *   1. three negative callbacks hit a pending order inserted straight into the database;
 *   2. the real sandbox cashier pays a second order;
 *   3. a replayed callback hits the paid order;
 *   4. the paid order is marked refunded, and one more callback grants nothing.
 * beforeAll creates a throwaway Supabase user. afterAll deletes it with its orders and profile.
 *
 * How the cashier is paid:
 * The card form on the sandbox cashier ends on an SMS code page.
 * ECPay documents the code 1234, but the sandbox rejected it in our runs.
 * Each attempt also asks ECPay to text the phone number typed in.
 * So we use the test-payment link that the sandbox cashier shows instead.
 * It opens ECPay's own mock card page with the test card filled in.
 * ECPay then sends its real signed callback and the browser result, like a card payment.
 *
 * Each run writes ids, statuses and responses to test-results/ecpay/evidence.json.
 */
import * as fs from 'fs';
import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { buildCheckMacValue } from '@/lib/payment/ecpay';
import { ECPAY_SANDBOX_CREDENTIALS, generateMerchantTradeNo } from '@/lib/payment/config';
import { createE2eUser, deleteE2eUser, type E2eUser } from '../../scripts/ecpay-e2e-user';

loadEnv({ path: '.env.local', quiet: true });

const ENABLED = process.env.ECPAY_SANDBOX_E2E === '1';
const APP = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const LOCAL = 'http://localhost:3000';

/** ECPay's public sandbox test card. Never a real card. */
const TEST_CARD = '4311952222222222';
const TEST_CVV = '222';
/** Any future month and year. */
const TEST_EXPIRY_MONTH = '12';
const TEST_EXPIRY_YEAR = '30';
const TEST_HOLDER_NAME = 'TEST USER';
/** The mock page needs a mobile number. This one is made up. The mock page sends no SMS. */
const TEST_PHONE = '0912345678';

const EVIDENCE_DIR = 'test-results/ecpay';
const EVIDENCE_FILE = `${EVIDENCE_DIR}/evidence.json`;

test.skip(!ENABLED, 'Set ECPAY_SANDBOX_E2E=1 to run the ECPay sandbox flow');
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  // ngrok's free plan shows browsers a warning page. This header skips it.
  // It goes only to our own tunnel, never to ECPay's pages.
  await page.context().route(
    (url) => APP !== '' && url.origin === APP,
    (route) => route.continue({ headers: { ...route.request().headers(), 'ngrok-skip-browser-warning': '1' } }),
  );
});

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function readOrder(merchantTradeNo: string) {
  const { data } = await serviceClient()
    .from('ecpay_orders')
    .select('merchant_trade_no,status,paid_at,ecpay_trade_no,simulate_paid,amount_twd,payment_type,rtn_code')
    .eq('merchant_trade_no', merchantTradeNo)
    .maybeSingle();
  return data;
}

async function readLicense(userId: string): Promise<string | null> {
  const { data } = await serviceClient().from('profiles').select('license_type').eq('id', userId).maybeSingle();
  return data?.license_type ?? null;
}

/** Adds one labelled entry to the evidence file. Holds ids and statuses only, never secrets. */
function record(label: string, value: unknown): void {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  let entries: Array<{ label: string; at: string; value: unknown }> = [];
  try {
    entries = JSON.parse(fs.readFileSync(EVIDENCE_FILE, 'utf8'));
  } catch {
    entries = [];
  }
  entries.push({ label, at: new Date().toISOString(), value });
  fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(entries, null, 2));
}

/** A callback body shaped like ECPay's for the given order, before signing. */
function callbackBody(merchantTradeNo: string, overrides: Record<string, string> = {}): Record<string, string> {
  return {
    MerchantID: ECPAY_SANDBOX_CREDENTIALS.merchantId,
    MerchantTradeNo: merchantTradeNo,
    RtnCode: '1',
    RtnMsg: '交易成功',
    TradeNo: `e2e${Date.now()}`,
    TradeAmt: '899',
    PaymentDate: '2026/09/02 00:07:00',
    PaymentType: 'Credit_CreditCard',
    SimulatePaid: '0',
    ...overrides,
  };
}

/** Signs a body with the sandbox keys, the way ECPay would. */
function signed(body: Record<string, string>): Record<string, string> {
  return {
    ...body,
    CheckMacValue: buildCheckMacValue(body, ECPAY_SANDBOX_CREDENTIALS.hashKey, ECPAY_SANDBOX_CREDENTIALS.hashIV),
  };
}

/** Saves the page's HTML, ARIA snapshot and a screenshot for debugging. */
async function dumpPage(page: Page, label: string): Promise<void> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(`${EVIDENCE_DIR}/${label}.html`, await page.content());
  fs.writeFileSync(`${EVIDENCE_DIR}/${label}.aria.txt`, await page.locator('body').ariaSnapshot());
  await page.screenshot({ path: `${EVIDENCE_DIR}/${label}.png`, fullPage: true });
}

/** Reads every purchase event from the page's dataLayer. */
async function purchaseEvents(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(() =>
    (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer.filter(
      (e) => e.event === 'purchase',
    ),
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let user: E2eUser;
let pendingOrderNo: string;
let paidOrderNo: string;

test.beforeAll(async () => {
  expect(APP, 'NEXT_PUBLIC_APP_URL must be the public https ngrok URL').toMatch(/^https:\/\//);
  fs.rmSync(EVIDENCE_FILE, { force: true });
  user = await createE2eUser(APP);
  record('test user created', { userId: user.userId, email: user.email });

  // A pending order inserted directly, for the negative callback tests.
  pendingOrderNo = generateMerchantTradeNo();
  const { error } = await serviceClient().from('ecpay_orders').insert({
    merchant_trade_no: pendingOrderNo,
    user_id: user.userId,
    email: user.email,
    amount_twd: 899,
    status: 'pending',
  });
  expect(error).toBeNull();
  record('pending order inserted', await readOrder(pendingOrderNo));
});

test.afterAll(async () => {
  if (user) {
    await deleteE2eUser(user.userId);
    record('test user deleted', { userId: user.userId });
  }
});

test('negative: a tampered signature is rejected and nothing changes', async ({ request }) => {
  const body = signed(callbackBody(pendingOrderNo));
  body.CheckMacValue = 'DEADBEEF';
  const res = await request.post(`${LOCAL}/api/payment/ecpay/callback`, { form: body });
  const text = await res.text();
  record('tampered signature', { status: res.status(), body: text, order: await readOrder(pendingOrderNo) });
  expect(res.status()).toBe(200);
  expect(text).toBe('0|CheckMacValue verify failed');
  expect((await readOrder(pendingOrderNo))?.status).toBe('pending');
  expect(await readLicense(user.userId)).not.toBe('lifetime');
});

test('negative: a validly signed callback with the wrong amount is rejected', async ({ request }) => {
  const res = await request.post(`${LOCAL}/api/payment/ecpay/callback`, {
    form: signed(callbackBody(pendingOrderNo, { TradeAmt: '1' })),
  });
  const text = await res.text();
  record('wrong amount', { status: res.status(), body: text, order: await readOrder(pendingOrderNo) });
  expect(res.status()).toBe(200);
  expect(text).toBe('0|amount mismatch (TradeAmt=1)');
  expect((await readOrder(pendingOrderNo))?.status).toBe('pending');
  expect(await readLicense(user.userId)).not.toBe('lifetime');
});

test('negative: SimulatePaid=1 is acknowledged but grants nothing', async ({ request }) => {
  const res = await request.post(`${LOCAL}/api/payment/ecpay/callback`, {
    form: signed(callbackBody(pendingOrderNo, { SimulatePaid: '1' })),
  });
  const text = await res.text();
  record('SimulatePaid=1', {
    status: res.status(),
    body: text,
    order: await readOrder(pendingOrderNo),
    license: await readLicense(user.userId),
  });
  expect(res.status()).toBe(200);
  expect(text).toBe('1|OK');
  expect((await readOrder(pendingOrderNo))?.status).toBe('pending');
  expect(await readLicense(user.userId)).not.toBe('lifetime');
});

test('happy path: log in, pay in the sandbox cashier, land on the success page, licence granted', async ({ page }) => {
  test.setTimeout(240_000);

  // 1. Log in through our own confirm route and land on /checkout.
  await page.goto(user.loginUrl);
  await page.waitForURL(`${APP}/checkout`);
  const main = page.locator('main');
  await expect(main.getByText('NT$899')).toBeVisible();
  await expect(main.getByText(user.email)).toBeVisible();
  record('licence before payment', { license: await readLicense(user.userId) });

  // 2. Start checkout. The create route stores a pending order.
  //    Its self-submitting form posts to the sandbox cashier.
  await page.getByRole('button', { name: '前往綠界付款' }).click();
  await page.waitForURL(/payment-stage\.ecpay\.com\.tw/, { timeout: 60_000 });

  const { data: newest } = await serviceClient()
    .from('ecpay_orders')
    .select('merchant_trade_no,status')
    .eq('user_id', user.userId)
    .neq('merchant_trade_no', pendingOrderNo)
    .order('created_at', { ascending: false })
    .limit(1);
  paidOrderNo = newest?.[0]?.merchant_trade_no ?? '';
  expect(paidOrderNo).toMatch(/^TC[a-z0-9]{18}$/);
  expect(newest?.[0]?.status).toBe('pending');
  record('order before payment', await readOrder(paidOrderNo));

  // 3. The cashier shows a test-payment link beside its card form.
  //    In a real browser it opens a second window. We open it in a second tab.
  //    The cashier tab stays open and moves on when ECPay reports the payment.
  await expect(page.getByText(paidOrderNo)).toBeVisible();
  const mockHref = await page.getByRole('link', { name: '測試付款請點此' }).getAttribute('href');
  expect(mockHref).toMatch(/^https:\/\/payment-stage\.ecpay\.com\.tw\/MockScanCodePay\//);

  const mock = await page.context().newPage();
  await mock.goto(mockHref!);
  await expect(mock.locator('#CardNo')).toHaveValue(TEST_CARD);
  await mock.locator('#AuthExpireDateYY').fill(TEST_EXPIRY_YEAR);
  await mock.locator('#AuthExpireDateMM').fill(TEST_EXPIRY_MONTH);
  await mock.locator('#AuthCode').fill(TEST_CVV);
  await mock.locator('#CardHolderInfo_Cardholder').fill(TEST_HOLDER_NAME);
  await mock.locator('#CardHolderInfo_CellPhone').fill(TEST_PHONE);
  await mock.locator('input[type="submit"][value="交易成功"]').click();

  // 4. Back on our site through the browser result route (303, then GET).
  try {
    await page.waitForURL(new RegExp(`^${escapeRegex(APP)}/checkout/complete\\?order=`), { timeout: 120_000 });
  } catch (err) {
    await dumpPage(page, 'cashier-stuck');
    await dumpPage(mock, 'mock-stuck');
    throw err;
  }
  expect(page.url()).toContain(`order=${paidOrderNo}`);
  expect(page.url()).not.toContain('failed=1');

  // 5. The callback may land a few seconds after the browser.
  //    The page polls every 3 seconds. Allow up to 90 seconds.
  await expect(page.getByRole('heading', { name: '付款成功，Pro 終身版已開通' })).toBeVisible({ timeout: 90_000 });

  // 6. Exactly one purchase event, and none after a reload.
  const purchases = await purchaseEvents(page);
  record('purchase events on first view', purchases);
  expect(purchases).toHaveLength(1);
  expect(purchases[0]).toMatchObject({ transaction_id: paidOrderNo, value: 899, currency: 'TWD' });

  await page.reload();
  await expect(page.getByRole('heading', { name: '付款成功，Pro 終身版已開通' })).toBeVisible();
  const afterReload = await purchaseEvents(page);
  record('purchase events after reload', afterReload);
  expect(afterReload).toHaveLength(0);

  // 7. Database state written by the callback route.
  const order = await readOrder(paidOrderNo);
  const license = await readLicense(user.userId);
  record('order after payment', order);
  record('licence after payment', { license });
  expect(order?.status).toBe('paid');
  expect(order?.amount_twd).toBe(899);
  expect(order?.simulate_paid).toBe(false);
  expect(order?.ecpay_trade_no).toBeTruthy();
  expect(order?.paid_at).toBeTruthy();
  expect(license).toBe('lifetime');
});

test('negative: replaying a callback for the paid order answers 1|OK and changes nothing', async ({ request }) => {
  const before = await readOrder(paidOrderNo);
  const res = await request.post(`${LOCAL}/api/payment/ecpay/callback`, { form: signed(callbackBody(paidOrderNo)) });
  const text = await res.text();
  const after = await readOrder(paidOrderNo);
  record('replay', { status: res.status(), body: text, before, after });
  expect(res.status()).toBe(200);
  expect(text).toBe('1|OK');
  expect(after?.paid_at).toBe(before?.paid_at);
  expect(after?.ecpay_trade_no).toBe(before?.ecpay_trade_no);
  expect(await readLicense(user.userId)).toBe('lifetime');
});

test('negative: a callback for a refunded order answers 1|OK and grants nothing', async ({ request }) => {
  // The owner marks an order refunded after a refund. We do the same here.
  // Then the test user drops back to free. A new grant would show as lifetime.
  // Both writes touch only rows this run created.
  const supabase = serviceClient();
  const { error: refundError } = await supabase
    .from('ecpay_orders')
    .update({ status: 'refunded' })
    .eq('merchant_trade_no', paidOrderNo)
    .eq('user_id', user.userId);
  expect(refundError).toBeNull();
  const { error: resetError } = await supabase
    .from('profiles')
    .update({ license_type: 'free', license_expires_at: null })
    .eq('id', user.userId);
  expect(resetError).toBeNull();
  const before = await readOrder(paidOrderNo);

  const res = await request.post(`${LOCAL}/api/payment/ecpay/callback`, {
    form: signed(callbackBody(paidOrderNo)),
  });
  const text = await res.text();
  const after = await readOrder(paidOrderNo);
  const license = await readLicense(user.userId);
  record('refunded order callback', { status: res.status(), body: text, before, after, license });
  expect(res.status()).toBe(200);
  expect(text).toBe('1|OK');
  expect(after?.status).toBe('refunded');
  expect(license).toBe('free');
});
