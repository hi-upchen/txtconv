import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads the search articles stored as Markdown files in `content/articles`.
 *
 * Each file is one article. The file name without `.md` is the URL slug.
 * The file starts with a front-matter block between two `---` lines.
 * Only a fixed list of fields is read from it. Any other field is ignored.
 * The canonical URL always comes from the slug, so no field can change it.
 */

/** The folder that holds the article Markdown files. */
export const ARTICLES_DIR = path.join(process.cwd(), 'content', 'articles');

/** The public origin used for canonical URLs and structured data. */
export const SITE_ORIGIN = 'https://txtconv.arpuli.com';

/** The page the author byline links to. */
export const AUTHOR_URL = 'https://www.runawayup.com/about';

/** The byline name when an article has no `author` field. It matches the footer. */
export const DEFAULT_AUTHOR = '出走工程師 Up';

/** The only front-matter fields an article may use. */
export const ALLOWED_FIELDS = [
  'title',
  'description',
  'date',
  'updated',
  'keyword',
  'author',
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

/** The front matter after the whitelist is applied. */
export interface ArticleFrontMatter {
  title: string;
  description: string;
  /** Publish date as YYYY-MM-DD. */
  date: string;
  /** Last update date as YYYY-MM-DD, if the article was updated. */
  updated?: string;
  keyword?: string;
  author: string;
}

/** One article, ready to render. */
export interface Article extends ArticleFrontMatter {
  slug: string;
  /** Path of the article page, such as `/articles/my-slug`. */
  path: string;
  /** Full canonical URL of the article page. */
  canonicalUrl: string;
  /** The Markdown body without the front matter. */
  body: string;
}

/** A slug is lowercase letters, digits and single dashes. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A date is YYYY-MM-DD. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks whether a string is a valid article slug.
 *
 * A bad slug could point outside the articles folder, such as `../secret`.
 */
export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * Removes one pair of matching outer quotes from a front-matter value.
 */
function unquote(value: string): string {
  const first = value[0];
  if (value.length >= 2 && (first === '"' || first === "'") && value.endsWith(first)) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Splits a Markdown file into whitelisted front-matter fields and the body.
 *
 * Each front-matter line has the form `key: value`. Fields outside
 * ALLOWED_FIELDS are dropped. A file without front matter gives no fields.
 *
 * @param raw - The whole file content.
 * @returns The allowed fields as strings, and the Markdown body.
 */
export function parseFrontMatter(raw: string): {
  fields: Partial<Record<AllowedField, string>>;
  body: string;
} {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) {
    return { fields: {}, body: text };
  }

  const fields: Partial<Record<AllowedField, string>> = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    const value = unquote(line.slice(colon + 1).trim());
    if ((ALLOWED_FIELDS as readonly string[]).includes(key) && value !== '') {
      fields[key as AllowedField] = value;
    }
  }

  return { fields, body: text.slice(match[0].length) };
}

/**
 * Builds a full article from its slug and file content.
 *
 * The title, description and a YYYY-MM-DD date are required.
 * Without them this throws, so a broken file fails the build loudly.
 */
export function buildArticle(slug: string, raw: string): Article {
  const { fields, body } = parseFrontMatter(raw);

  const missing = (['title', 'description', 'date'] as const).filter((key) => !fields[key]);
  if (missing.length > 0) {
    throw new Error(`Article "${slug}" is missing front matter: ${missing.join(', ')}`);
  }
  for (const key of ['date', 'updated'] as const) {
    const value = fields[key];
    if (value !== undefined && !DATE_PATTERN.test(value)) {
      throw new Error(`Article "${slug}" has a bad ${key}: use YYYY-MM-DD`);
    }
  }

  const articlePath = `/articles/${slug}`;
  return {
    slug,
    path: articlePath,
    canonicalUrl: `${SITE_ORIGIN}${articlePath}`,
    title: fields.title as string,
    description: fields.description as string,
    date: fields.date as string,
    updated: fields.updated,
    keyword: fields.keyword,
    author: fields.author ?? DEFAULT_AUTHOR,
    body,
  };
}

/**
 * Lists every article in the folder, newest first.
 *
 * Only `*.md` files directly in the folder count. A missing folder gives an empty list.
 *
 * The `turbopackIgnore` comments stop the bundler from tracing the whole
 * project because the folder is a parameter. next.config.js ships the
 * content/articles files with the server code instead.
 *
 * @param dir - The folder to read. Tests pass a fixture folder.
 */
export function listArticles(dir: string = ARTICLES_DIR): Article[] {
  if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) return [];

  return fs
    .readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.slice(0, -'.md'.length))
    .filter(isValidSlug)
    .map((slug) =>
      buildArticle(
        slug,
        fs.readFileSync(/*turbopackIgnore: true*/ path.join(dir, `${slug}.md`), 'utf8'),
      ),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

/**
 * Loads one article by slug.
 *
 * @param slug - The slug from the URL.
 * @param dir - The folder to read. Tests pass a fixture folder.
 * @returns The article, or null when the slug is invalid or has no file.
 */
export function getArticle(slug: string, dir: string = ARTICLES_DIR): Article | null {
  if (!isValidSlug(slug)) return null;
  const file = path.join(dir, `${slug}.md`);
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return null;
  return buildArticle(slug, fs.readFileSync(/*turbopackIgnore: true*/ file, 'utf8'));
}

/**
 * Builds the schema.org Article structured data for an article page.
 *
 * Every value comes from the whitelisted front matter or the slug.
 */
export function articleJsonLd(article: Article): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    dateModified: article.updated ?? article.date,
    inLanguage: 'zh-TW',
    ...(article.keyword ? { keywords: article.keyword } : {}),
    author: { '@type': 'Person', name: article.author, url: AUTHOR_URL },
    mainEntityOfPage: { '@type': 'WebPage', '@id': article.canonicalUrl },
    url: article.canonicalUrl,
  };
}

/**
 * Serialises structured data for a `<script type="application/ld+json">` tag.
 *
 * A `<` inside a title could close the script tag early. This escapes it.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
