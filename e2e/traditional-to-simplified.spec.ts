/**
 * End-to-end checks for the Traditional to Simplified page: pasted text and
 * a dropped .txt file both convert in the browser, and the home page still
 * links to the page.
 */
import { test, expect } from '@playwright/test';

test('pasted Traditional text becomes Simplified text', async ({ page }) => {
  await page.goto('/traditional-to-simplified');
  await page.getByTestId('tw2cn-input').fill('軟體、網路、資訊、影片');
  await expect(page.getByTestId('tw2cn-output')).toHaveValue('软件、网络、信息、视频');
});

test('a Traditional .txt file converts and downloads', async ({ page }) => {
  await page.goto('/traditional-to-simplified');
  const downloadPromise = page.waitForEvent('download');
  await page.setInputFiles('[data-testid="tw2cn-file"]', {
    name: '軟體.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('軟體、網路、資訊、影片', 'utf-8'),
  });
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('软件.txt');
  await expect(page.getByTestId('tw2cn-output')).toHaveValue('软件、网络、信息、视频');
});

test('the home page links to the page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href="/traditional-to-simplified"]').first()).toBeVisible();
});
