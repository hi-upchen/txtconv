import type { MetadataRoute } from 'next';
import { listArticles } from '@/lib/articles';
import { PAGE_LAST_MODIFIED } from '@/lib/sitemap-dates';

/**
 * Sitemap metadata route. Lists all indexable public pages so search
 * engines discover them without crawling; update when adding new
 * public routes (e.g. landing pages or guides).
 *
 * Articles are added by scanning `content/articles`, so a new article
 * file needs no edit here. The articles index is listed only when at
 * least one article exists.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://txtconv.arpuli.com';
  const articles = listArticles();

  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: article.canonicalUrl,
    lastModified: article.updated ?? article.date,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));
  if (articles.length > 0) {
    articleEntries.unshift({
      url: `${base}/articles`,
      lastModified: articles
        .map((article) => article.updated ?? article.date)
        .reduce((latest, d) => (d > latest ? d : latest)),
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }

  return [
    {
      url: `${base}/`,
      lastModified: PAGE_LAST_MODIFIED['/'],
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/epub`,
      lastModified: PAGE_LAST_MODIFIED['/epub'],
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/srt`,
      lastModified: PAGE_LAST_MODIFIED['/srt'],
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/jianying`,
      lastModified: PAGE_LAST_MODIFIED['/jianying'],
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/novel`,
      lastModified: PAGE_LAST_MODIFIED['/novel'],
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/csv`,
      lastModified: PAGE_LAST_MODIFIED['/csv'],
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/traditional-to-simplified`,
      lastModified: PAGE_LAST_MODIFIED['/traditional-to-simplified'],
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/dictionary-guide`,
      lastModified: PAGE_LAST_MODIFIED['/dictionary-guide'],
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/privacy`,
      lastModified: PAGE_LAST_MODIFIED['/privacy'],
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      lastModified: PAGE_LAST_MODIFIED['/terms'],
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...articleEntries,
  ];
}
