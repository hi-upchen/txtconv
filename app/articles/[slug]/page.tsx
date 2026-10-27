import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getAuthUser, getProfile } from '@/lib/actions/auth';
import {
  AUTHOR_URL,
  articleJsonLd,
  getArticle,
  listArticles,
  serializeJsonLd,
} from '@/lib/articles';
import { renderMarkdown } from '@/lib/markdown';

/**
 * Article page. It renders one Markdown file from `content/articles`.
 *
 * The title, description, canonical URL and structured data all come from
 * the file's whitelisted front matter and its slug. A slug with no file is a 404.
 */

type PageProps = { params: Promise<{ slug: string }> };

/** Lists every article slug so each page is known at build time. */
export function generateStaticParams() {
  return listArticles().map((article) => ({ slug: article.slug }));
}

/** Builds the page metadata from the article front matter. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.description,
    ...(article.keyword ? { keywords: [article.keyword] } : {}),
    authors: [{ name: article.author, url: AUTHOR_URL }],
    alternates: { canonical: article.path },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.description,
      url: article.canonicalUrl,
      publishedTime: article.date,
      ...(article.updated ? { modifiedTime: article.updated } : {}),
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  return (
    <>
      <Header user={user} profile={profile} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 space-y-8">
        <article className="space-y-6">
          <header className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 leading-snug">
              {article.title}
            </h1>
            <p className="text-sm text-gray-500">
              作者：
              <a href={AUTHOR_URL} rel="author" className="text-primary hover:underline">
                {article.author}
              </a>
              <span className="mx-2">·</span>
              <time dateTime={article.date}>發布於 {article.date}</time>
              {article.updated && (
                <>
                  <span className="mx-2">·</span>
                  <time dateTime={article.updated}>更新於 {article.updated}</time>
                </>
              )}
            </p>
          </header>

          {/* renderMarkdown escapes raw HTML and drops unsafe links. */}
          <div
            className="article-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
          />
        </article>

        <p className="text-gray-600">
          <Link href="/articles" className="text-primary hover:underline">
            更多文章
          </Link>
          <span className="mx-2">·</span>
          <Link href="/" className="text-primary hover:underline">
            回到 txtconv 簡轉繁工具
          </Link>
        </p>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd(article)) }}
        />
      </main>

      <Footer />
    </>
  );
}
