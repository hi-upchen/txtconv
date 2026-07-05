/**
 * End-to-end checks for the 剪映/CapCut subtitle workflow: a small Simplified
 * .srt dropped on the /jianying landing page converts in-browser and produces
 * a .srt download whose text was converted Simplified->Traditional while the
 * SRT timing lines are preserved; and the /jianying page renders with its H1
 * and FAQPage JSON-LD marker.
 */
import { test, expect } from '@playwright/test';

/** Minimal two-cue Simplified SRT with 剪映-style vocabulary to convert. */
const SIMPLIFIED_SRT = `1
00:00:01,000 --> 00:00:03,500
这个软件的视频信息

2
00:00:03,500 --> 00:00:06,000
网络世界的软件测试
`;

test('simplified .srt dropped on /jianying converts and downloads as .srt', async ({ page }) => {
  await page.goto('/jianying');

  const downloadPromise = page.waitForEvent('download');

  await page.setInputFiles('input[type="file"]', {
    name: 'jianying-subtitles.srt',
    mimeType: 'application/x-subrip',
    buffer: Buffer.from(SIMPLIFIED_SRT, 'utf-8'),
  });

  await expect(page.getByText('Finished')).toBeVisible({ timeout: 30000 });

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.srt$/);

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf-8');

  // Text converted to Traditional Chinese with Taiwan vocabulary.
  expect(text).toContain('軟體');
  expect(text).toContain('影片');
  expect(text).not.toContain('软件');
  // SRT timing lines are preserved untouched.
  expect(text).toContain('00:00:01,000 --> 00:00:03,500');
});

test('/jianying landing page renders with H1 and FAQ JSON-LD', async ({ page }) => {
  const response = await page.goto('/jianying');
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole('heading', { level: 1, name: /剪映字幕簡轉繁/ })
  ).toBeVisible();

  // FAQPage structured data must be present for rich-result eligibility.
  const jsonLd = await page
    .locator('script[type="application/ld+json"]')
    .innerText();
  expect(jsonLd).toContain('FAQPage');

  // Converter is embedded on the landing page too.
  await expect(page.locator('input[type="file"]')).toBeAttached();
});
