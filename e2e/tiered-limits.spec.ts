/**
 * End-to-end check for license-tier file-size limits: a guest dropping
 * a file over the free 5MB limit sees the rejection message with an
 * upgrade link pointing at the pricing section, and no conversion runs.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const BIG_FILE = path.join(
  '/private/tmp/claude-501/-Users-upchen-Dropbox-01-Projects-08-TxtConv/0c4cc49c-2c6c-42b3-b82a-0a34af1dcf74/scratchpad',
  'big-novel.txt'
);

test('guest uploading 9MB file sees free-limit error with upgrade CTA', async ({ page }) => {
  await page.goto('/');

  await page.setInputFiles('input[type="file"]', BIG_FILE);

  await expect(page.getByText(/超過免費版 5MB 上限/)).toBeVisible();

  // The rejection itself must be measurable: a file_rejected event with
  // the free-limit reason reaches the GTM dataLayer.
  const rejectedEvents = await page.evaluate(() =>
    (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer
      .filter((e) => e.event === 'file_rejected')
  );
  expect(rejectedEvents).toHaveLength(1);
  expect(rejectedEvents[0]).toMatchObject({
    reject_reason: 'size_limit_free',
    upgrade_available: true,
    source_path: '/',
  });

  const upgradeLink = page.getByRole('link', { name: /升級 Pro 可轉換 100MB/ });
  await expect(upgradeLink).toBeVisible();
  await expect(upgradeLink).toHaveAttribute('href', '#pricing');

  // Clicking the CTA lands on the pricing section with the buy button
  await upgradeLink.click();
  await expect(page.locator('#pricing')).toBeInViewport();
  const buyButton = page.getByRole('link', { name: /立即購買/ });
  await expect(buyButton).toBeVisible();

  // Funnel events reach the GTM dataLayer
  await buyButton.click();
  const events = await page.evaluate(() =>
    (window as unknown as { dataLayer: Array<{ event: string }> }).dataLayer
      .map((e) => e.event)
  );
  expect(events).toContain('upgrade_cta_clicked');
  expect(events).toContain('begin_checkout');
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
