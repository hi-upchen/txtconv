/**
 * End-to-end checks for license-tier file-size limits.
 *   - A guest dropping a file over the free 5MB limit sees the upgrade dialog.
 *   - The dialog's buy button is a same-tab link to /checkout.
 *   - Clicking it reports the checkout step to analytics at NT$899.
 *   - The rejected file's row reopens the same dialog on a landing page.
 */
import { test, expect, type Page } from '@playwright/test';

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

/**
 * Mirrors every dataLayer push into sessionStorage before any page script runs.
 * Session storage survives a same-origin navigation, so a test can still read
 * the events after a click moves the tab to another page.
 */
async function mirrorDataLayer(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { dataLayer?: unknown[] };
    const mirror = (event: unknown) => {
      try {
        const list = JSON.parse(sessionStorage.getItem('e2e_dataLayer') ?? '[]');
        list.push(event);
        sessionStorage.setItem('e2e_dataLayer', JSON.stringify(list));
      } catch {
        // Storage is unavailable. The test then sees no events and fails.
      }
    };
    // Page scripts reassign window.dataLayer, so wrap each array only once.
    const wrapped = new WeakSet<object>();
    const wrap = (list: unknown[]) => {
      if (wrapped.has(list)) return list;
      wrapped.add(list);
      const originalPush = list.push.bind(list);
      list.push = (...items: unknown[]) => {
        items.forEach(mirror);
        return originalPush(...items);
      };
      return list;
    };
    let layer = wrap(w.dataLayer ?? []);
    Object.defineProperty(window, 'dataLayer', {
      configurable: true,
      get: () => layer,
      set: (value: unknown[]) => {
        layer = wrap(value);
      },
    });
  });
}

/** Reads the events pushed onto the dataLayer, even after a page navigation. */
function readDataLayer(page: Page) {
  return page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('e2e_dataLayer') ?? '[]') as Array<Record<string, unknown>>
  );
}

test('guest uploading a 9MB file sees the upgrade dialog with a working buy button', async ({
  page,
}) => {
  // Tag Manager is not under test. Blocking it keeps gtm.js from replacing push.
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
  await mirrorDataLayer(page);
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

  // Buy button is a same-tab link to our own checkout page
  const buyLink = dialog.getByRole('link', { name: /升級 Pro 終身版 NT\$899/ });
  await expect(buyLink).toHaveAttribute('href', '/checkout');
  await expect(buyLink).not.toHaveAttribute('target');

  // The secondary link works off the homepage too, hence the absolute path
  await expect(dialog.getByRole('link', { name: '查看完整方案比較' })).toHaveAttribute(
    'href',
    '/#pricing'
  );

  // Clicking the buy button reports one checkout step at the shown price.
  // The events are read from session storage because the click changes page.
  await buyLink.click();
  await page.waitForURL('**/checkout');
  const checkoutEvents = (await readDataLayer(page)).filter((e) => e.event === 'begin_checkout');
  expect(checkoutEvents).toHaveLength(1);
  expect(checkoutEvents[0]).toMatchObject({
    currency: 'TWD',
    value: 899,
    item_name: 'lifetime',
    source_path: '/',
  });
  await expect(page.getByRole('heading', { name: '購買 Pro 終身版' })).toBeVisible();
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
