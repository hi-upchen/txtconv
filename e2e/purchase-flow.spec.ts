/**
 * Purchase-flow and site smoke checks: the homepage pricing section must
 * render the Lifetime card at the current price with a buy link pointing
 * at the configured Gumroad product (opened in a new tab), and every SEO
 * landing page must respond 200 with its converter or upgrade CTA present.
 * Deliberately never navigates to gumroad.com itself — external checkout
 * is out of scope for e2e.
 */
import { test, expect } from '@playwright/test';

/**
 * Expected Gumroad product URL. The dev server reads it from .env as
 * NEXT_PUBLIC_GUMROAD_URL; the fallback keeps the assertion meaningful
 * when the Playwright process itself was started without that variable.
 */
const GUMROAD_URL =
  process.env.NEXT_PUBLIC_GUMROAD_URL ?? 'https://upchen.gumroad.com/l/txtconv-pro';

test('homepage Lifetime card shows $30 and links to the Gumroad product', async ({ page }) => {
  await page.goto('/');

  const pricing = page.locator('#pricing');
  await expect(pricing).toBeVisible();

  // Lifetime card renders with the current one-time price
  await expect(pricing.getByText('Lifetime')).toBeVisible();
  await expect(pricing.getByText('終身授權')).toBeVisible();
  await expect(pricing.getByText('$30')).toBeVisible();

  // Buy link goes to the configured Gumroad product in a new tab
  const buyLink = pricing.getByRole('link', { name: /立即購買/ });
  await expect(buyLink).toBeVisible();
  await expect(buyLink).toHaveAttribute('href', GUMROAD_URL);
  await expect(buyLink).toHaveAttribute('target', '_blank');
  await expect(buyLink).toHaveAttribute('rel', /noopener/);
});

// Landing pages that embed the converter: must load and show the file input.
for (const path of ['/srt', '/novel', '/csv']) {
  test(`landing page ${path} responds 200 with the converter present`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('input[type="file"]')).toBeAttached();
  });
}

test('landing page /dictionary-guide responds 200 with the upgrade CTA present', async ({ page }) => {
  const response = await page.goto('/dictionary-guide');
  expect(response?.status()).toBe(200);
  await expect(
    page.locator('a[href="/#pricing"]').first()
  ).toBeVisible();
});
