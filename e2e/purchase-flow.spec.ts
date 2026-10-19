/**
 * Purchase-flow and site smoke checks: the homepage pricing section must
 * render the Lifetime card at the current price with a buy link pointing
 * at our own checkout page (same tab), and every SEO landing page must
 * respond 200 with its converter or upgrade CTA present.
 * Never navigates away from the site itself.
 */
import { test, expect } from '@playwright/test';

test('homepage Lifetime card shows NT$899 and links to /checkout', async ({ page }) => {
  await page.goto('/');

  const pricing = page.locator('#pricing');
  await expect(pricing).toBeVisible();

  // Lifetime card renders with the current one-time price
  await expect(pricing.getByText('Lifetime')).toBeVisible();
  await expect(pricing.getByText('終身授權')).toBeVisible();
  await expect(pricing.getByText('NT$899')).toBeVisible();

  // Buy link goes to our own checkout page in the same tab
  const buyLink = pricing.getByRole('link', { name: /立即購買/ });
  await expect(buyLink).toBeVisible();
  await expect(buyLink).toHaveAttribute('href', '/checkout');
  await expect(buyLink).not.toHaveAttribute('target');
});

// Landing pages that embed the converter: must load and show the file input.
for (const path of ['/srt', '/jianying', '/novel', '/csv']) {
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
