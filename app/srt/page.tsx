import type { Metadata } from 'next';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getAuthUser, getProfile } from '@/lib/actions/auth';

/**
 * SEO landing page for subtitle conversion queries (剪映/CapCut 字幕簡轉繁,
 * srt 簡體轉繁體). Hosts the same in-browser converter as the homepage with
 * subtitle-specific guidance so the page ranks for and directly serves
 * subtitle-related searches.
 */

export const metadata: Metadata = {
  title: 'SRT 字幕簡轉繁 — 剪映/CapCut 字幕一鍵轉繁體',
  description:
    '剪映、CapCut 匯出的 .srt 字幕免費線上轉繁體中文：拖曳上傳即轉換，時間軸不變，自動轉台灣用語（软件→軟體、视频→影片）。瀏覽器內完成，速度快。',
  alternates: { canonical: '/srt' },
  openGraph: {
    title: 'SRT 字幕簡轉繁 — 剪映/CapCut 字幕一鍵轉繁體',
    description:
      '剪映、CapCut 匯出的 .srt 字幕免費線上轉繁體中文，時間軸不變，自動轉台灣用語。',
    url: 'https://txtconv.arpuli.com/srt',
  },
};

const SUBTITLE_FAQ = [
  {
    question: '剪映匯出的字幕轉繁體後，時間軸會跑掉嗎？',
    answer:
      '不會。txtconv 只轉換字幕的文字內容，SRT 的序號與時間碼（例如 00:00:01,000 --> 00:00:03,500）完全保持原樣，轉完直接匯入剪輯軟體或播放器即可使用。',
  },
  {
    question: '為什麼不直接用剪輯軟體內建的簡繁轉換？',
    answer:
      '多數剪輯軟體沒有簡繁轉換，或只做逐字替換，會留下「软件、视频、信息」這類直翻詞。txtconv 使用 OpenCC 台灣正體詞庫，會轉成台灣觀眾習慣的「軟體、影片、資訊」，字幕看起來更自然。',
  },
  {
    question: '批次處理多集影片的字幕可以嗎？',
    answer:
      '可以。一次拖入多個 .srt 檔案，txtconv 會依序自動轉換，每個檔案轉完即可下載，適合整季影集或系列影片的字幕處理。',
  },
];

export default async function SrtLandingPage() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: SUBTITLE_FAQ.map((item) => ({
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
            SRT 字幕簡轉繁：剪映、CapCut 字幕一鍵轉台灣繁體
          </h1>
          <p className="text-lg text-gray-600 max-w-4xl">
            剪映（CapCut）辨識出來的字幕常是簡體中文。把 .srt
            檔拖進下方轉換區，txtconv 立刻在瀏覽器內轉成台灣用語的繁體中文
            —— 時間軸與序號完全不動，轉完就能直接用。
          </p>
        </section>

        <FileUpload licenseType={profile?.license_type ?? 'free'} />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">三步驟完成字幕轉換</h2>
          <ol className="list-decimal pl-6 space-y-2 text-gray-600">
            <li>從剪映/CapCut 或字幕軟體匯出 .srt 字幕檔</li>
            <li>拖曳（或點選）上傳到本頁的轉換區，自動開始轉換</li>
            <li>點下載取得繁體字幕，直接匯回剪輯軟體或播放器</li>
          </ol>
          <p className="text-gray-600">
            也需要轉換小說或其他文字檔？請見{' '}
            <a href="/novel" className="text-primary hover:underline">
              小說 TXT 簡轉繁
            </a>
            ，或回到
            <Link href="/" className="text-primary hover:underline">
              首頁
            </Link>
            查看完整功能與方案。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">字幕轉換常見問題</h2>
          <div className="space-y-4">
            {SUBTITLE_FAQ.map((item) => (
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
