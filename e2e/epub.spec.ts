/**
 * End-to-end checks for EPUB conversion: a real (in-test generated) .epub
 * dropped on the homepage uploader converts in-browser and produces an
 * .epub download whose text was converted Simplified->Traditional; and the
 * /epub landing page renders with its H1 and FAQ JSON-LD marker.
 */
import { test, expect } from '@playwright/test';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

/**
 * Builds a minimal valid EPUB (mimetype first + container + opf + one
 * chapter with Simplified text) as a Buffer for upload.
 */
function buildEpubBuffer(): Buffer {
  const zipped = zipSync({
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8(
      '<?xml version="1.0"?>\n<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'
    ),
    'OEBPS/content.opf': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>\n<package><metadata><title>软件</title></metadata></package>'
    ),
    'OEBPS/chapter1.xhtml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>\n<html><body><p>软件测试网络世界</p></body></html>'
    ),
  });
  return Buffer.from(zipped);
}

test('epub dropped on homepage converts and downloads as .epub', async ({ page }) => {
  await page.goto('/');

  const downloadPromise = page.waitForEvent('download');

  await page.setInputFiles('input[type="file"]', {
    name: 'test-book.epub',
    mimeType: 'application/epub+zip',
    buffer: buildEpubBuffer(),
  });

  await expect(page.getByText('Finished')).toBeVisible({ timeout: 30000 });

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.epub$/);

  // The downloaded EPUB must still be a valid zip whose chapter text was
  // converted to Traditional Chinese.
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const entries = unzipSync(new Uint8Array(Buffer.concat(chunks)));

  expect(Object.keys(entries)).toContain('OEBPS/chapter1.xhtml');
  const chapter = strFromU8(entries['OEBPS/chapter1.xhtml']);
  expect(chapter).toContain('軟體');
  expect(chapter).toContain('網路');
  expect(chapter).not.toContain('软件');
});

test('/epub landing page renders with H1 and FAQ JSON-LD', async ({ page }) => {
  const response = await page.goto('/epub');
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole('heading', { level: 1, name: /EPUB 電子書簡轉繁/ })
  ).toBeVisible();

  // FAQPage structured data must be present for rich-result eligibility.
  const jsonLd = await page
    .locator('script[type="application/ld+json"]')
    .innerText();
  expect(jsonLd).toContain('FAQPage');

  // Converter is embedded on the landing page too.
  await expect(page.locator('input[type="file"]')).toBeAttached();
});
