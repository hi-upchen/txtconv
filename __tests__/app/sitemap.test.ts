import sitemap from '@/app/sitemap';
import { PAGE_LAST_MODIFIED } from '@/lib/sitemap-dates';

const W3C_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('sitemap lastModified', () => {
  const entries = sitemap();

  it('gives every entry a W3C date', () => {
    for (const entry of entries) {
      expect(String(entry.lastModified)).toMatch(W3C_DATE);
    }
  });

  it('has a date for every static page and no unused dates', () => {
    const paths = entries
      .map((e) => new URL(e.url).pathname)
      .filter((p) => p in PAGE_LAST_MODIFIED);
    expect(paths.sort()).toEqual(Object.keys(PAGE_LAST_MODIFIED).sort());
  });

  it('returns the same dates on every call', () => {
    expect(sitemap()).toEqual(entries);
  });

  it('never uses a date after today', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const entry of entries) {
      expect(String(entry.lastModified) <= today).toBe(true);
    }
  });
});
