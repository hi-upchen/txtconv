import type { MetadataRoute } from 'next';

/**
 * Robots.txt metadata route. Allows all crawlers on public pages while
 * keeping API and auth endpoints out of search indexes, and points
 * crawlers to the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/'],
    },
    sitemap: 'https://txtconv.arpuli.com/sitemap.xml',
  };
}
