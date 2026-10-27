import type { MetadataRoute } from 'next';
import { listArticles } from '@/lib/articles';

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
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }

  return [
    {
      url: `${base}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/epub`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/srt`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/jianying`,
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
      url: `${base}/dictionary-guide`,
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
    ...articleEntries,
  ];
}
