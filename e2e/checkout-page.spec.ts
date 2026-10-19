// e2e/checkout-page.spec.ts
/**
 * /checkout and /checkout/complete in a real browser.
 *   - Guests see the login panel, and a login started here returns to /checkout.
 *   - A free test user sees the NT$899 summary and the form that starts ECPay.
 *   - A lifetime test user is sent home.
 *   - The completion page shows its friendly error states.
 *   - The payment routes answer unauthenticated or unsigned requests correctly.
 *   - The legal pages name ECPay.
 *
 * It never submits the checkout form. That needs a real Supabase user and
 * ECPay's sandbox. e2e/manual/ecpay-sandbox.spec.ts covers it.
 */
import { test, expect, type Page } from '@playwright/test';

/**
 * Logs the browser context in through the dev-only test login.
 * Returns the HTTP status, so a test can skip itself when the endpoint is off.
 */
async function testLogin(page: Page, license: 'free' | 'lifetime'): Promise<number> {
  const query = license === 'free' ? '?license=free' : '';
  const res = await page.request.get(`/api/dev/test-login${query}`, { maxRedirects: 0 });
  return res.status();
}

/** Blocks Google's sign-in script, so no test depends on accounts.google.com. */
async function blockGoogleScript(page: Page) {
  await page.route('https://accounts.google.com/gsi/client', (route) => route.abort());
}

test.afterEach(async ({ context }) => {
  await context.clearCookies();
});

test('guest on /checkout sees the login panel and no pay form', async ({ page }) => {
  await blockGoogleScript(page);
  await page.goto('/checkout');
  const main = page.locator('main');
  await expect(main.getByRole('heading', { name: '購買 Pro 終身版' })).toBeVisible();
  await expect(main.getByText('購買會綁定你的 email，請先登入')).toBeVisible();
  await expect(main.getByRole('heading', { name: '先登入，再付款' })).toBeVisible();
  await expect(main.getByLabel('Email')).toBeVisible();
  await expect(main.getByRole('button', { name: '寄送驗證碼' })).toBeVisible();
  await expect(page.locator('form[action="/api/payment/ecpay/create"]')).toHaveCount(0);
});

test('a login started on /checkout remembers /checkout as the page to return to', async ({ page }) => {
  await blockGoogleScript(page);
  await page.route('**/auth/v1/otp**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  await page.goto('/checkout');
  const main = page.locator('main');
  await main.getByLabel('Email').fill('e2e@example.com');
  await main.getByRole('button', { name: '寄送驗證碼' }).click();
  await expect(main.getByLabel('驗證碼')).toBeVisible();

  // /auth/finish reads this cookie after the code is verified and redirects there.
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'login_return_to')?.value).toBe('%2Fcheckout');
});

test('free test user on /checkout sees the NT$899 summary and the ECPay form', async ({ page }) => {
  const status = await testLogin(page, 'free');
  test.skip(status === 403, 'ENABLE_TEST_LOGIN=true is not set for the dev server');
  expect(status).toBe(307);

  await page.goto('/checkout');
  const main = page.locator('main');
  await expect(main.getByText('NT$899')).toBeVisible();
  await expect(main.getByText('test@txtconv.local')).toBeVisible();
  await expect(main.getByText('購買後 14 天內不滿意可退款')).toBeVisible();
  const form = page.locator('form[action="/api/payment/ecpay/create"]');
  await expect(form).toHaveAttribute('method', 'post');
  await expect(form.getByRole('button', { name: '前往綠界付款' })).toBeVisible();
});

test('lifetime test user is sent home from /checkout', async ({ page }) => {
  const status = await testLogin(page, 'lifetime');
  test.skip(status === 403, 'ENABLE_TEST_LOGIN=true is not set for the dev server');
  expect(status).toBe(307);

  await page.goto('/checkout');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#pricing')).toBeVisible();
});

test('dictionary upsell for a free user links to /checkout in the same tab', async ({ page }) => {
  const status = await testLogin(page, 'free');
  test.skip(status === 403, 'ENABLE_TEST_LOGIN=true is not set for the dev server');
  expect(status).toBe(307);

  await page.goto('/');
  // Six lines pass the free limit of five pairs, which shows the upsell.
  await page.getByPlaceholder(/代码,程式碼/).fill('a1,b1\na2,b2\na3,b3\na4,b4\na5,b5\na6,b6');
  const upsell = page.getByRole('link', { name: '升級 Pro', exact: true });
  await expect(upsell).toBeVisible();
  await expect(upsell).toHaveAttribute('href', '/checkout');
  await expect(upsell).not.toHaveAttribute('target');
});

test('/checkout/complete?error=1 shows the friendly error', async ({ page }) => {
  await page.goto('/checkout/complete?error=1');
  await expect(page.getByRole('heading', { name: '付款結果無法確認' })).toBeVisible();
  await expect(page.getByRole('link', { name: '回到結帳頁' })).toHaveAttribute('href', '/checkout');
});

test('/checkout/complete without a valid order shows the friendly error', async ({ page }) => {
  await page.goto('/checkout/complete');
  await expect(page.getByRole('heading', { name: '付款結果無法確認' })).toBeVisible();
  await page.goto('/checkout/complete?order=not-ours');
  await expect(page.getByRole('heading', { name: '付款結果無法確認' })).toBeVisible();
});

test('unauthenticated POST to the create route answers 303 to /checkout', async ({ request }) => {
  const res = await request.post('/api/payment/ecpay/create', { maxRedirects: 0 });
  expect(res.status()).toBe(303);
  expect(res.headers()['location']).toMatch(/\/checkout$/);
});

test('callback route answers 200 with 0|CheckMacValue verify failed for an unsigned body', async ({ request }) => {
  const res = await request.post('/api/payment/ecpay/callback', {
    form: { MerchantTradeNo: 'TCaaaaaaaaaaaaaaaaaa', RtnCode: '1', TradeAmt: '899', CheckMacValue: 'DEADBEEF' },
  });
  expect(res.status()).toBe(200);
  expect(await res.text()).toBe('0|CheckMacValue verify failed');
});

test('result route answers 303 to the error page for an unsigned body', async ({ request }) => {
  const res = await request.post('/api/payment/ecpay/result', {
    form: { MerchantTradeNo: 'TCaaaaaaaaaaaaaaaaaa', CheckMacValue: 'DEADBEEF' },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(303);
  expect(res.headers()['location']).toMatch(/\/checkout\/complete\?error=1$/);
});

test('terms and privacy describe ECPay, not Gumroad, as the payment channel', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.getByText(/綠界科技（ECPay）/).first()).toBeVisible();
  await expect(page.getByText(/透過 Gumroad 申請/)).toHaveCount(0);
  await page.goto('/privacy');
  await expect(page.getByText(/綠界交易編號/)).toBeVisible();
});
