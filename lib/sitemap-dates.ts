/**
 * The date each static page's content last changed, as YYYY-MM-DD.
 *
 * The sitemap reads these dates. Update a date when you change the
 * content of that page. A test checks that every sitemap path has a date.
 *
 * The dates are fixed values on purpose. Vercel builds clone the repo
 * shallowly, so git history may be missing, and the build time would
 * tell search engines that every page changed on every deploy.
 */
export const PAGE_LAST_MODIFIED: Record<string, string> = {
  '/': '2026-11-07',
  '/epub': '2026-07-05',
  '/srt': '2026-07-03',
  '/jianying': '2026-07-05',
  '/novel': '2026-07-03',
  '/csv': '2026-07-03',
  '/traditional-to-simplified': '2026-11-07',
  '/dictionary-guide': '2026-10-20',
  '/privacy': '2026-10-20',
  '/terms': '2026-10-20',
};
