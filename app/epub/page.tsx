import type { Metadata } from 'next';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getAuthUser, getProfile } from '@/lib/actions/auth';

/**
 * SEO landing page for EPUB e-book conversion queries (epub 簡轉繁,
 * 電子書簡體轉繁體, 簡體小說 epub 轉台灣繁體). Hosts the same in-browser
 * converter as the homepage with e-book-specific guidance, and emphasizes
 * the no-upload architecture and the Pro custom dictionary (fixing novel
 * character names across a whole book) as the paid differentiator.
 */

export const metadata: Metadata = {
  title: 'EPUB 電子書簡轉繁 — 免上傳、瀏覽器內轉繁體中文',
  description:
    '簡體 EPUB 電子書免費線上轉繁體中文：拖曳上傳即在瀏覽器內完成，檔案不上傳伺服器，排版與圖片不變，只轉文字。搭配自訂字典可固定小說人名的譯法，整本書統一。',
  alternates: { canonical: '/epub' },
  openGraph: {
    title: 'EPUB 電子書簡轉繁 — 免上傳、瀏覽器內轉繁體中文',
    description:
      '簡體 EPUB 電子書免費線上轉繁體中文，檔案不上傳伺服器，只轉文字不動排版；自訂字典可固定小說人名譯法。',
    url: 'https://txtconv.arpuli.com/epub',
  },
};

const EPUB_FAQ = [
  {
    question: '我的電子書會被上傳到伺服器嗎？',
    answer:
      '不會。txtconv 的轉換完全在你的瀏覽器內完成：EPUB 會在本機解壓縮、逐一轉換內文、再重新打包成新的 EPUB，整個過程檔案都不會離開你的裝置，也不會被儲存副本。多數線上電子書轉換工具都要求把整本書上傳到伺服器，我們刻意不這麼做。',
  },
  {
    question: '支援 mobi、azw、azw3（Kindle）格式嗎？',
    answer:
      '目前只支援 EPUB。mobi/azw/azw3 是 Kindle 的專屬格式，無法在瀏覽器內直接開啟。你可以先用免費軟體 Calibre 把書轉成 EPUB，再上傳到本頁轉換即可。',
  },
  {
    question: '轉完排版會亂掉嗎？',
    answer:
      '不會。txtconv 只轉換 EPUB 內的文字內容（章節 XHTML、目錄、書名等），圖片、字型、CSS 樣式與檔案結構全部原封不動保留，因此排版、封面與插圖都跟原書一樣，只有簡體字被轉成台灣正體。',
  },
  {
    question: '小說裡的人名、專有名詞可以固定譯法嗎？',
    answer:
      '可以，這是 Pro 版的重點。OpenCC 的通用詞庫有時會把同一個名字轉成不同寫法，或轉成你不想要的譯名。登入 Pro 後可自訂字典，指定「簡體詞 → 你要的繁體寫法」，整本書的人名、地名、專有名詞都會統一，不必逐章手動改。',
  },
  {
    question: '免費版有什麼限制？',
    answer:
      '免費版可轉換 5MB 以內的檔案，適合多數純文字小說 EPUB。較大的電子書（含大量插圖）常會超過 5MB，升級 Pro 後上限提高到 100MB，同時解鎖可存 10,000 組對照的自訂字典。',
  },
];

export default async function EpubLandingPage() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: EPUB_FAQ.map((item) => ({
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
            EPUB 電子書簡轉繁：免上傳，瀏覽器內轉台灣繁體
          </h1>
          <p className="text-lg text-gray-600 max-w-4xl">
            買到或下載到的簡體 EPUB 小說，看起來總是不習慣？把 .epub
            檔拖進下方轉換區，txtconv 直接在你的瀏覽器內把整本書轉成台灣正體中文
            —— 檔案不上傳伺服器、只轉文字不動排版與圖片，轉完就是一本可以正常閱讀的繁體
            EPUB。搭配 Pro 自訂字典，還能固定小說人名與專有名詞的譯法，整本書統一。
          </p>
        </section>

        <FileUpload licenseType={profile?.license_type ?? 'free'} />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">三步驟轉換電子書</h2>
          <ol className="list-decimal pl-6 space-y-2 text-gray-600">
            <li>準備簡體 EPUB 檔（Kindle 的 mobi/azw 請先用 Calibre 轉成 EPUB）</li>
            <li>拖曳（或點選）上傳到本頁的轉換區，會在瀏覽器內自動開始轉換</li>
            <li>點下載取得繁體 EPUB，直接匯入閱讀器或 App 就能閱讀</li>
          </ol>
          <p className="text-gray-600">
            也需要轉換純文字小說或字幕？請見{' '}
            <a href="/novel" className="text-primary hover:underline">
              小說 TXT 簡轉繁
            </a>
            、
            <a href="/dictionary-guide" className="text-primary hover:underline">
              自訂字典使用說明
            </a>
            ，或回到
            <Link href="/" className="text-primary hover:underline">
              首頁
            </Link>
            查看完整功能與方案。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">為什麼選 txtconv 轉電子書</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li>
              <span className="font-medium text-gray-800">免上傳、更隱私：</span>
              轉換在瀏覽器內完成，整本書不會離開你的電腦，也不會被存到任何伺服器。
            </li>
            <li>
              <span className="font-medium text-gray-800">只動文字、不毀排版：</span>
              圖片、封面、字型與樣式原樣保留，轉完的 EPUB 版面跟原書一致。
            </li>
            <li>
              <span className="font-medium text-gray-800">台灣用語詞庫：</span>
              使用 OpenCC 台灣正體詞庫，把「软件、视频、信息」轉成「軟體、影片、資訊」。
            </li>
            <li>
              <span className="font-medium text-gray-800">Pro 自訂字典固定譯名：</span>
              整本書的人名、地名、專有名詞統一寫法，不必逐章手動修改。
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">電子書轉換常見問題</h2>
          <div className="space-y-4">
            {EPUB_FAQ.map((item) => (
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
