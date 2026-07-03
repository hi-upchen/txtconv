import type { Metadata } from 'next';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getAuthUser, getProfile } from '@/lib/actions/auth';

/**
 * SEO landing page for novel/text-file conversion queries (小說 txt 簡轉繁,
 * 簡體亂碼修復). Hosts the in-browser converter with novel-specific guidance
 * — encoding auto-detection is the differentiator this page explains.
 */

export const metadata: Metadata = {
  title: '小說 TXT 簡轉繁 — 簡體亂碼自動修復、轉台灣用語',
  description:
    '簡體小說 txt 免費線上轉繁體：自動偵測 GBK/GB18030/Big5 編碼修復亂碼，轉成台灣慣用詞，支援批次與大檔案。自訂字典可固定人名譯法。',
  alternates: { canonical: '/novel' },
  openGraph: {
    title: '小說 TXT 簡轉繁 — 簡體亂碼自動修復、轉台灣用語',
    description:
      '簡體小說 txt 免費線上轉繁體：自動偵測編碼修復亂碼，轉成台灣慣用詞，支援批次轉換。',
    url: 'https://txtconv.arpuli.com/novel',
  },
};

const NOVEL_FAQ = [
  {
    question: '下載的簡體小說打開全是亂碼，為什麼？',
    answer:
      '簡體小說 txt 大多以 GBK 或 GB18030 編碼儲存，而台灣的系統預設用 Big5 或 UTF-8 開啟，編碼對不上就變亂碼。txtconv 會自動偵測正確編碼再轉換，輸出一律是 UTF-8 繁體中文，手機、電腦、電子書閱讀器都能正常開啟。',
  },
  {
    question: '小說人名、專有名詞轉錯了怎麼辦？',
    answer:
      '登入後可使用自訂字典：每行一組「簡體詞,繁體詞」，例如「昆仑,崑崙」。自訂字典的優先度高於預設規則，適合固定人名、地名、招式名的譯法。免費版可設定 5 組，Pro 版最多 10,000 組。',
  },
  {
    question: '整套小說幾十個檔案，要一個一個轉嗎？',
    answer:
      '不用。把所有 txt 檔一次拖進轉換區即可批次轉換。免費版單檔上限 5MB（一般長篇小說約 1-3MB），更大的合集檔可升級 Pro 支援單檔 100MB。',
  },
];

export default async function NovelLandingPage() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: NOVEL_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <>
      <Header user={user} profile={profile} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 flex flex-col gap-12">
        <section className="space-y-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 leading-snug">
            小說 TXT 簡轉繁：亂碼自動修復，轉成台灣用語
          </h1>
          <p className="text-lg text-gray-600 max-w-4xl">
            簡體小說打開是亂碼？txtconv 自動偵測 GBK / GB18030 / Big5
            編碼，正確解碼後轉成台灣慣用的繁體中文（软件→軟體、网络→網路），
            並輸出成任何裝置都能開的 UTF-8。支援整套小說批次轉換。
          </p>
        </section>

        <FileUpload licenseType={profile?.license_type ?? 'free'} />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">為什麼選 txtconv 轉小說</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li>亂碼救援：自動判斷來源編碼，不用自己猜是 GBK 還是 Big5</li>
            <li>台灣用語：OpenCC 詞庫轉換，不是逐字替換，讀起來自然</li>
            <li>
              自訂字典：人名、地名、招式名可固定譯法，整套書一致（
              <a href="/dictionary-guide" className="text-primary hover:underline">
                自訂字典使用教學
              </a>
              ）
            </li>
            <li>免安裝：瀏覽器就能用，Mac 也不用找 ConvertZ 替代品</li>
          </ul>
          <p className="text-gray-600">
            要轉影片字幕？請見{' '}
            <a href="/srt" className="text-primary hover:underline">
              SRT 字幕簡轉繁
            </a>
            ，或回到
            <Link href="/" className="text-primary hover:underline">
              首頁
            </Link>
            查看完整功能與方案。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">小說轉換常見問題</h2>
          <div className="space-y-4">
            {NOVEL_FAQ.map((item) => (
              <details
                key={item.question}
                className="group bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-4"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-medium text-gray-800">
                  <h3 className="text-base font-medium">{item.question}</h3>
                  <span className="material-symbols-outlined text-gray-400 transition-transform group-open:rotate-180">
                    expand_more
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </main>

      <Footer />
    </>
  );
}
