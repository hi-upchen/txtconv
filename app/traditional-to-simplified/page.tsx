import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import TraditionalToSimplified from '@/components/TraditionalToSimplified';
import { getAuthUser, getProfile } from '@/lib/actions/auth';

/**
 * SEO landing page for the reverse direction (繁體轉簡體, 繁轉簡, 繁簡轉換).
 * The home page converts Simplified to Traditional only, so searchers for
 * Traditional to Simplified need their own page and tool.
 */

const TITLE = '繁體轉簡體線上工具 — 繁轉簡、繁簡轉換，免費貼上即轉';
const DESCRIPTION =
  '免費線上繁體轉簡體（繁轉簡）：貼上文字或上傳 .txt 檔，立即轉成簡體中文，並轉換常見用語（軟體→软件、影片→视频）。在瀏覽器內完成，檔案不上傳。';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/traditional-to-simplified' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://txtconv.arpuli.com/traditional-to-simplified',
  },
};

const TW2CN_FAQ = [
  {
    question: '繁體轉簡體會連用語一起轉嗎？',
    answer:
      '會。txtconv 使用 OpenCC 的台灣繁體到中國簡體詞庫，不只逐字轉換，也會轉換常見詞彙，例如「軟體→软件」「網路→网络」「資訊→信息」「影片→视频」。',
  },
  {
    question: '繁轉簡可以轉整個 .txt 檔案嗎？',
    answer:
      '可以。點選頁面上的選擇檔案按鈕，上傳 .txt 純文字檔，工具會自動偵測編碼、轉成簡體中文並下載。免費版單檔上限 5MB。',
  },
  {
    question: '繁簡轉換的檔案或文字會上傳到伺服器嗎？',
    answer:
      '不會。轉換在你的瀏覽器內完成，貼上的文字和上傳的檔案都不會送到 txtconv 的伺服器。',
  },
  {
    question: '想把簡體轉成繁體要用哪個頁面？',
    answer: '請回到首頁。首頁的工具把簡體中文轉成台灣繁體中文，並支援 txt、epub、srt、csv 等檔案。',
  },
];

export default async function TraditionalToSimplifiedPage() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: TW2CN_FAQ.map((item) => ({
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
            繁體轉簡體：線上繁轉簡、繁簡轉換工具
          </h1>
          <p className="text-lg text-gray-600 max-w-4xl">
            把繁體中文貼到下方左側，右側立刻出現簡體中文。也可以選擇 .txt
            檔案轉換並下載。轉換在瀏覽器內完成，文字不會上傳。
          </p>
        </section>

        <TraditionalToSimplified licenseType={profile?.license_type ?? 'free'} />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">三步驟完成繁轉簡</h2>
          <ol className="list-decimal pl-6 space-y-2 text-gray-600">
            <li>把繁體中文貼到左側方框，或選擇 .txt 檔案</li>
            <li>右側立即顯示簡體中文</li>
            <li>按「複製結果」或「下載 .txt」取得簡體文字</li>
          </ol>
          <p className="text-gray-600">
            需要簡體轉繁體？請回到
            <Link href="/" className="text-primary hover:underline">
              首頁
            </Link>
            。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">繁體轉簡體常見問題</h2>
          <div className="space-y-4">
            {TW2CN_FAQ.map((item) => (
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
