/**
 * @jest-environment node
 */
/**
 * Tests for the Markdown article loader and the safe Markdown renderer.
 *
 * The fixture articles live in __tests__/fixtures/articles. They stay out
 * of content/articles so they never ship as real pages.
 */
import path from 'node:path';
import {
  AUTHOR_URL,
  DEFAULT_AUTHOR,
  articleJsonLd,
  buildArticle,
  getArticle,
  isValidSlug,
  listArticles,
  parseFrontMatter,
  serializeJsonLd,
} from '@/lib/articles';
import { renderMarkdown } from '@/lib/markdown';

const FIXTURES = path.join(__dirname, '..', 'fixtures', 'articles');

describe('renderMarkdown', () => {
  it('renders ordinary Markdown', () => {
    const html = renderMarkdown('## 標題\n\n**粗體** 與 [連結](https://example.com)');
    expect(html).toContain('<h2>標題</h2>');
    expect(html).toContain('<strong>粗體</strong>');
    expect(html).toContain('<a href="https://example.com">連結</a>');
  });

  it('escapes a raw script tag instead of outputting it', () => {
    const html = renderMarkdown('前文\n\n<script>alert(1)</script>\n\n後文');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes inline raw HTML and event handlers', () => {
    const html = renderMarkdown('文字 <img src=x onerror="alert(1)"> <b>粗</b>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;img');
  });

  it('does not turn javascript: or data: URLs into links', () => {
    const html = renderMarkdown(
      '[壞連結](javascript:alert(1)) [資料](data:text/html,<script>alert(1)</script>)',
    );
    expect(html).not.toMatch(/href="\s*javascript:/i);
    expect(html).not.toMatch(/href="\s*data:/i);
    expect(html).not.toContain('<script');
  });

  it('does not render an image with a javascript: source', () => {
    const html = renderMarkdown('![x](javascript:alert(1))');
    expect(html).not.toMatch(/src="\s*javascript:/i);
  });
});

describe('parseFrontMatter', () => {
  it('keeps only the whitelisted fields', () => {
    const raw = [
      '---',
      'title: 標題',
      'description: 說明',
      'date: 2026-10-27',
      'updated: 2026-10-28',
      'keyword: 簡轉繁',
      'author: 某作者',
      'canonical: https://evil.example.com/',
      'slug: other-slug',
      'url: https://evil.example.com/',
      'robots: noindex',
      '---',
      '內文',
    ].join('\n');

    const { fields, body } = parseFrontMatter(raw);
    expect(fields).toEqual({
      title: '標題',
      description: '說明',
      date: '2026-10-27',
      updated: '2026-10-28',
      keyword: '簡轉繁',
      author: '某作者',
    });
    expect(body).toBe('內文');
  });

  it('strips matching outer quotes and keeps colons inside values', () => {
    const { fields } = parseFrontMatter('---\ntitle: "A: B"\ndescription: \'C\'\n---\n');
    expect(fields.title).toBe('A: B');
    expect(fields.description).toBe('C');
  });

  it('handles Windows line endings and a byte-order mark', () => {
    const { fields, body } = parseFrontMatter('﻿---\r\ntitle: T\r\n---\r\nBody');
    expect(fields.title).toBe('T');
    expect(body).toBe('Body');
  });

  it('returns no fields when there is no front matter', () => {
    expect(parseFrontMatter('# Just text')).toEqual({ fields: {}, body: '# Just text' });
  });
});

describe('buildArticle', () => {
  const valid = '---\ntitle: T\ndescription: D\ndate: 2026-10-27\n---\nBody';

  it('derives the canonical URL from the slug only', () => {
    const article = buildArticle(
      'my-article',
      valid.replace('---\nBody', 'canonical: https://evil.example.com/\n---\nBody'),
    );
    expect(article.path).toBe('/articles/my-article');
    expect(article.canonicalUrl).toBe('https://txtconv.arpuli.com/articles/my-article');
  });

  it('uses the default author when none is given', () => {
    expect(buildArticle('a', valid).author).toBe(DEFAULT_AUTHOR);
  });

  it('throws when a required field is missing', () => {
    expect(() => buildArticle('a', '---\ntitle: T\n---\n')).toThrow(/description, date/);
  });

  it('throws on a date that is not YYYY-MM-DD', () => {
    expect(() => buildArticle('a', valid.replace('2026-10-27', 'Oct 27'))).toThrow(/bad date/);
  });
});

describe('isValidSlug', () => {
  it.each(['a', 'my-article', 'srt-2026'])('accepts %s', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(['', '../secret', 'a/b', 'Upper', 'a--b', '-a', 'a.md'])('rejects %s', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});

describe('listArticles and getArticle', () => {
  it('lists only valid .md files, newest first', () => {
    expect(listArticles(FIXTURES).map((a) => a.slug)).toEqual(['sample-newer', 'sample-older']);
  });

  it('returns an empty list for a missing folder', () => {
    expect(listArticles(path.join(FIXTURES, 'does-not-exist'))).toEqual([]);
  });

  it('loads one article and ignores a canonical field in the file', () => {
    const article = getArticle('sample-newer', FIXTURES);
    expect(article).not.toBeNull();
    expect(article?.title).toBe('Test fixture newer article');
    expect(article?.author).toBe('Fixture Author');
    expect(article?.canonicalUrl).toBe('https://txtconv.arpuli.com/articles/sample-newer');
    expect(article?.body).toContain('## Heading');
  });

  it('returns null for an unknown or unsafe slug', () => {
    expect(getArticle('missing', FIXTURES)).toBeNull();
    expect(getArticle('../articles/sample-newer', FIXTURES)).toBeNull();
  });
});

describe('articleJsonLd', () => {
  it('builds Article structured data from the front matter', () => {
    const article = getArticle('sample-newer', FIXTURES)!;
    expect(articleJsonLd(article)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test fixture newer article',
      description: 'Test fixture, not a real article.',
      datePublished: '2026-02-01',
      dateModified: '2026-03-01',
      inLanguage: 'zh-TW',
      keywords: 'fixture keyword',
      author: { '@type': 'Person', name: 'Fixture Author', url: AUTHOR_URL },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': 'https://txtconv.arpuli.com/articles/sample-newer',
      },
      url: 'https://txtconv.arpuli.com/articles/sample-newer',
    });
  });

  it('falls back to the publish date and leaves out an empty keyword', () => {
    const data = articleJsonLd(getArticle('sample-older', FIXTURES)!);
    expect(data.dateModified).toBe('2026-01-01');
    expect(data).not.toHaveProperty('keywords');
  });

  it('serialises without a raw < that could close the script tag', () => {
    const json = serializeJsonLd({ headline: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('<');
    expect(JSON.parse(json).headline).toBe('</script><script>alert(1)</script>');
  });
});
