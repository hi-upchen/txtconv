/**
 * End-to-end checks for license-tier file-size limits: a guest dropping a
 * file over the free 5MB limit is shown the upgrade dialog, the dialog's buy
 * button points at the configured payment page and reports the checkout step
 * to analytics, and the same dialog is reachable from the rejected file's row
 * on a landing page (where the previous "#pricing" anchor link did nothing
 * because that section only exists on the homepage).
 */
import { test, expect, type Page } from '@playwright/test';

/**
 * Expected payment-page URL. The dev server reads it from .env as
 * NEXT_PUBLIC_GUMROAD_URL; the fallback keeps the assertion meaningful when
 * the Playwright process itself was started without that variable.
 */
const GUMROAD_URL =
  process.env.NEXT_PUBLIC_GUMROAD_URL ?? 'https://upchen.gumroad.com/l/txtconv-pro';

/**
 * A file comfortably over the free tier's 5MB limit and under the paid
 * 100MB one, built in memory at run time. It used to be read from a fixed
 * path on disk, which broke the moment that file was cleaned up; generating
 * it here means the spec has no external prerequisite.
 */
const OVERSIZED_FILE = {
  name: 'big-novel.txt',
  mimeType: 'text/plain',
  // 19 bytes per repetition in UTF-8, so ~497k repetitions is just over 9MB.
  buffer: Buffer.from('简体软件测试\n'.repeat(497_000)),
};

/** Reads the events pushed onto the Google Tag Manager dataLayer so far. */
function readDataLayer(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer.slice()
  );
}

test.beforeEach(async ({ context }) => {
  // The buy button is a real outbound link. Abort any request to the payment
  // provider so the test never touches their servers.
  await context.route(/gumroad\.com/, (route) => route.abort());
});

test('guest uploading a 9MB file sees the upgrade dialog with a working buy button', async ({
  page,
}) => {
  await page.goto('/');

  await page.setInputFiles('input[type="file"]', OVERSIZED_FILE);

  // The rejected row still explains why the file was refused
  await expect(page.getByText(/超過免費版 5MB 上限/).first()).toBeVisible();

  // The rejection itself must be measurable: a file_rejected event with
  // the free-limit reason reaches the GTM dataLayer.
  const rejectedEvents = (await readDataLayer(page)).filter((e) => e.event === 'file_rejected');
  expect(rejectedEvents).toHaveLength(1);
  expect(rejectedEvents[0]).toMatchObject({
    reject_reason: 'size_limit_free',
    upgrade_available: true,
    source_path: '/',
  });

  // The upgrade dialog opens by itself at the moment of rejection
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: '檔案超過免費版 5MB 上限' })
  ).toBeVisible();

  // Buy button is a real link to the configured payment page, in a new tab
  const buyLink = dialog.getByRole('link', { name: /升級 Pro 終身版 US\$30/ });
  await expect(buyLink).toHaveAttribute('href', GUMROAD_URL);
  await expect(buyLink).toHaveAttribute('target', '_blank');
  await expect(buyLink).toHaveAttribute('rel', /noopener/);

  // The secondary link works off the homepage too, hence the absolute path
  await expect(dialog.getByRole('link', { name: '查看完整方案比較' })).toHaveAttribute(
    'href',
    '/#pricing'
  );

  // Clicking the buy button reports exactly one checkout step at the shown price
  await buyLink.click();
  const checkoutEvents = (await readDataLayer(page)).filter((e) => e.event === 'begin_checkout');
  expect(checkoutEvents).toHaveLength(1);
  expect(checkoutEvents[0]).toMatchObject({
    currency: 'USD',
    value: 30,
    item_name: 'lifetime',
    source_path: '/',
  });

  // Dismissing closes the dialog
  await dialog.getByRole('button', { name: '稍後再說' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('rejected row on the /novel landing page opens the upgrade dialog', async ({ page }) => {
  await page.goto('/novel');

  await page.setInputFiles('input[type="file"]', OVERSIZED_FILE);

  // Close the automatic dialog first, so the next appearance can only come
  // from the row button
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '稍後再說' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  // This is the regression guard: the row control used to be a link to a
  // "#pricing" anchor that does not exist on the landing pages, so clicking
  // it did nothing at all. It must now reopen the dialog.
  await page.getByRole('button', { name: /升級 Pro 可轉換 100MB/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '檔案超過免費版 5MB 上限' })
  ).toBeVisible();
});

test('converter works on the /srt landing page', async ({ page }) => {
  await page.goto('/srt');

  const srtFile = {
    name: 'subs.srt',
    mimeType: 'text/plain',
    buffer: Buffer.from('1\n00:00:01,000 --> 00:00:03,500\n简体软件测试\n'),
  };
  await page.setInputFiles('input[type="file"]', srtFile);

  await expect(page.getByText('Finished')).toBeVisible({ timeout: 30000 });
});

test('small file converts normally for guests', async ({ page }) => {
  await page.goto('/');

  const smallFile = {
    name: 'small.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('简体软件网络测试'),
  };
  await page.setInputFiles('input[type="file"]', smallFile);

  await expect(page.getByText('Finished')).toBeVisible({ timeout: 30000 });
});
