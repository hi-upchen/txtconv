import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getAuthUser, getProfile } from '@/lib/actions/auth';
import { listArticles } from '@/lib/articles';

/**
 * Articles index page. It lists every Markdown article, newest first.
 *
 * With no articles yet, it shows a short empty message and is not indexed.
 */

/**
 * Builds the index metadata. An empty index is kept out of search results.
 */
export function generateMetadata(): Metadata {
  return {
    title: '文章',
    description: 'txtconv 簡轉繁相關文章：簡體轉繁體、字幕、小說與編碼問題的說明。',
    alternates: { canonical: '/articles' },
    ...(listArticles().length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ArticlesIndexPage() {
  const articles = listArticles();
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  return (
    <>
      <Header user={user} profile={profile} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 space-y-8">
        <h1 className="text-3xl font-bold text-gray-800">文章</h1>

        {articles.length === 0 ? (
          <p className="text-gray-600">目前還沒有文章。</p>
        ) : (
          <ul className="space-y-6">
            {articles.map((article) => (
              <li key={article.slug} className="space-y-1">
                <Link
                  href={article.path}
                  className="text-xl font-bold text-gray-800 hover:text-primary"
                >
                  {article.title}
                </Link>
                <p className="text-sm text-gray-500">
                  <time dateTime={article.updated ?? article.date}>
                    {article.updated ?? article.date}
                  </time>
                </p>
                <p className="text-gray-600">{article.description}</p>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Footer />
    </>
  );
}
