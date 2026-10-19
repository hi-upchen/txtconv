// e2e/purchase-flow.spec.ts
/**
 * Purchase-flow and site smoke checks.
 *   - The homepage Lifetime card shows NT$899 and links to /checkout in the same tab.
 *   - The structured data quotes both offers in TWD.
 *   - No page carries a Gumroad purchase link or the old US$30 price.
 *   - Every SEO landing page answers 200 with its converter or upgrade link.
 * It never opens ECPay. The sandbox flow lives in e2e/manual/.
 */
import { test, expect } from '@playwright/test';

test('homepage Lifetime card shows NT$899 and links to /checkout in the same tab', async ({ page }) => {
  await page.goto('/');

  const pricing = page.locator('#pricing');
  await expect(pricing).toBeVisible();

  await expect(pricing.getByText('Lifetime')).toBeVisible();
  await expect(pricing.getByText('終身授權')).toBeVisible();
  await expect(pricing.getByText('NT$899')).toBeVisible();
  // There is no monthly card.
  await expect(pricing.getByText('Monthly')).toHaveCount(0);

  const buyLink = pricing.getByRole('link', { name: /立即購買/ });
  await expect(buyLink).toBeVisible();
  await expect(buyLink).toHaveAttribute('href', '/checkout');
  await expect(buyLink).not.toHaveAttribute('target');
});

test('homepage structured data prices the offers in TWD', async ({ page }) => {
  await page.goto('/');
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const app = blocks.map((text) => JSON.parse(text)).find((data) => data['@type'] === 'WebApplication');
  expect(app).toBeDefined();
  expect(app.offers).toEqual([
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'TWD' },
    { '@type': 'Offer', name: 'Lifetime', price: '899', priceCurrency: 'TWD' },
  ]);
});

// The footer donation link (…/l/txtconv?utm_…) may stay.
// The Pro product link and the old price must be gone from every page.
for (const path of ['/', '/srt', '/jianying', '/novel', '/csv', '/epub', '/dictionary-guide', '/terms', '/privacy']) {
  test(`${path} carries no Gumroad purchase link and no US$30 price`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('a[href*="txtconv-pro"]')).toHaveCount(0);
    expect(await page.content()).not.toContain('US$30');
    // Only the footer donation link may point at Gumroad.
    const gumroadLinks = await page.locator('a[href*="gumroad.com"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? '')
    );
    for (const href of gumroadLinks) {
      expect(href).toContain('/l/txtconv?');
      expect(href).toContain('utm_content=footer');
    }
  });
}

// Landing pages that embed the converter must load and show the file input.
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
