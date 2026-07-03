import type { MetadataRoute } from 'next';

/**
 * Sitemap metadata route. Lists all indexable public pages so search
 * engines discover them without crawling; update when adding new
 * public routes (e.g. landing pages or guides).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://txtconv.arpuli.com';

  return [
    {
      url: `${base}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/srt`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/novel`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/csv`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
