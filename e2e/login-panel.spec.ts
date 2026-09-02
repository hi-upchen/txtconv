// e2e/login-panel.spec.ts
/**
 * End-to-end checks for the login panel: the header dialog offers Google
 * and an email code; sending a code switches the panel to the code step;
 * a rejected code shows the expired-code message and reports the failure.
 * Every Supabase Auth request is intercepted, so nothing reaches the real
 * project and no email is ever sent.
 */
import { test, expect, type Page } from '@playwright/test';

/** Reads the events pushed onto the Google Tag Manager dataLayer so far. */
function readDataLayer(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer.slice()
  );
}

/** Opens the header login dialog (the dictionary section has its own Login button). */
async function openHeaderLogin(page: Page) {
  await page.goto('/');
  await page.locator('header').getByRole('button', { name: 'Login' }).click();
  return page.getByRole('dialog');
}

test('header login dialog shows the Google button and the email field', async ({ page }) => {
  const dialog = await openHeaderLogin(page);

  await expect(dialog.getByRole('button', { name: '使用 Google 登入' })).toBeVisible();
  await expect(dialog.getByLabel('Email')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '寄送驗證碼' })).toBeVisible();
});

test('sending a code switches to the code step and reports login_started', async ({ page }) => {
  await page.route('**/auth/v1/otp**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );

  const dialog = await openHeaderLogin(page);
  await dialog.getByLabel('Email').fill('e2e@example.com');
  await dialog.getByRole('button', { name: '寄送驗證碼' }).click();

  await expect(dialog.getByLabel('驗證碼')).toBeVisible();
  await expect(dialog.getByText('e2e@example.com')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /秒後可重寄/ })).toBeDisabled();

  const started = (await readDataLayer(page)).filter((e) => e.event === 'login_started');
  expect(started).toHaveLength(1);
  expect(started[0]).toMatchObject({ method: 'email_code', source_path: '/' });

  // The return-to cookie remembers the page that opened the dialog
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'login_return_to')?.value).toBe('%2F');
});

test('a rejected code shows the expired message and reports login_failed', async ({ page }) => {
  await page.route('**/auth/v1/otp**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  await page.route('**/auth/v1/verify**', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error_code: 'otp_expired', msg: 'Token has expired or is invalid' }),
    })
  );

  const dialog = await openHeaderLogin(page);
  await dialog.getByLabel('Email').fill('e2e@example.com');
  await dialog.getByRole('button', { name: '寄送驗證碼' }).click();
  await dialog.getByLabel('驗證碼').fill('123456');
  await dialog.getByRole('button', { name: '確認' }).click();

  await expect(dialog.getByRole('alert')).toHaveText(/驗證碼錯誤或已過期/);
  // Still on the code step, with the recovery actions available
  await expect(dialog.getByLabel('驗證碼')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '換一個信箱' })).toBeVisible();

  const failed = (await readDataLayer(page)).filter((e) => e.event === 'login_failed');
  expect(failed).toHaveLength(1);
  expect(failed[0]).toMatchObject({ method: 'email_code', reason: 'otp_expired' });
  expect(page.url()).toContain('http://localhost:3000/');
});

test('a login_just_succeeded cookie from a server redirect reports login_succeeded', async ({ page, context }) => {
  // Stands in for what /auth/callback and /auth/confirm leave behind after
  // a successful Google or magic-link login on the server side.
  await context.addCookies([
    { name: 'login_just_succeeded', value: 'google', url: 'http://localhost:3000' },
  ]);

  await page.goto('/');
  await page.waitForFunction(() =>
    (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer.some(
      (e) => e.event === 'login_succeeded'
    )
  );

  const succeeded = (await readDataLayer(page)).filter((e) => e.event === 'login_succeeded');
  // toMatchObject, not toEqual: the real Google Tag Manager container script
  // loads during this test and stamps its own gtm.uniqueEventId onto every
  // pushed event, the same way it does for every other dataLayer assertion
  // in this suite.
  expect(succeeded).toHaveLength(1);
  expect(succeeded[0]).toMatchObject({ event: 'login_succeeded', method: 'google', source_path: '/' });

  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === 'login_just_succeeded')).toBeUndefined();
});

test('expired-link page offers the code login and reports login_failed', async ({ page }) => {
  await page.goto('/auth/auth-code-error');

  await expect(page.getByRole('heading', { level: 1, name: '登入連結已失效' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '改用驗證碼登入' })).toBeVisible();
  await expect(page.getByRole('button', { name: '使用 Google 登入' })).toBeVisible();

  const failed = (await readDataLayer(page)).filter((e) => e.event === 'login_failed');
  expect(failed).toHaveLength(1);
  expect(failed[0]).toMatchObject({ method: 'magic_link', reason: 'link_invalid_or_expired' });
});
