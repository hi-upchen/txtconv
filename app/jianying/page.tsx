import type { Metadata } from 'next';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getAuthUser, getProfile } from '@/lib/actions/auth';

/**
 * SEO landing page for the 剪映/CapCut subtitle query family (剪映字幕簡轉繁,
 * CapCut 字幕簡體轉繁體, 剪映 SRT 繁體). 剪映 auto-generates Simplified
 * subtitles via speech recognition and Taiwanese users want Traditional; this
 * page targets those searches by name, documents the honest export-then-convert
 * workflow, and embeds the same in-browser converter as the homepage so users
 * can convert their exported .srt immediately.
 */

export const metadata: Metadata = {
  title: '剪映字幕簡轉繁｜CapCut 字幕簡體轉繁體（SRT 一鍵轉換）',
  description:
    '剪映（CapCut）自動辨識的字幕是簡體中文？把匯出的 .srt 字幕檔拖進本頁，免費在瀏覽器內一鍵轉成台灣繁體：時間軸不變、自動轉台灣用語（软件→軟體、视频→影片），檔案不上傳伺服器，轉完可重新匯回剪映。',
  keywords: [
    '剪映字幕繁體',
    '剪映字幕簡轉繁',
    'CapCut 簡轉繁',
    'CapCut 字幕簡體轉繁體',
    '剪映 SRT 繁體',
    '剪映字幕轉台灣繁體',
    '剪映字幕轉繁體',
  ],
  alternates: { canonical: '/jianying' },
  openGraph: {
    title: '剪映字幕簡轉繁｜CapCut 字幕簡體轉繁體（SRT 一鍵轉換）',
    description:
      '剪映（CapCut）匯出的簡體 .srt 字幕免費線上轉台灣繁體：時間軸不變、自動轉台灣用語，檔案不上傳伺服器，轉完可重新匯回剪映。',
    url: 'https://txtconv.arpuli.com/jianying',
  },
};

const JIANYING_FAQ = [
  {
    question: '剪映匯出的字幕是簡體，怎麼轉成繁體？',
    answer:
      '剪映（CapCut）的 AI 語音辨識預設產生簡體中文字幕。先在剪映把字幕匯出成 .srt 檔，再把檔案拖進本頁的轉換區，txtconv 會在你的瀏覽器內用 OpenCC 台灣正體詞庫把「软件、视频、信息」轉成「軟體、影片、資訊」，時間軸與序號完全不動，轉完就是一份台灣繁體字幕。',
  },
  {
    question: '檔案會上傳到伺服器嗎？',
    answer:
      '不會。txtconv 的轉換完全在你的瀏覽器內完成，字幕檔不會離開你的裝置，也不會被儲存任何副本。這也代表就算是尚未公開的影片字幕，也能安心轉換。',
  },
  {
    question: '支援哪些字幕格式？',
    answer:
      '本頁的轉換區接受 .srt 字幕檔（也支援 .txt 純文字）。剪映匯出字幕時，如果需要保留時間碼就選 SRT；只要純文字則可選 TXT，兩種都能直接拖進來轉換。',
  },
  {
    question: '轉出來的字幕可以再匯回剪映嗎？',
    answer:
      '可以。轉換後下載的還是標準 .srt 檔，格式與時間軸都保持不變，直接在剪映用「導入字幕 / 本地字幕」把轉好的 SRT 重新匯入即可，字幕就會顯示為繁體中文。',
  },
  {
    question: '剪映匯出 SRT 需要付費嗎？',
    answer:
      '看版本而定。較新版的剪映專業版在「導出」頁面內建了「字幕導出」選項，可直接輸出 SRT；部分版本或行動版的字幕匯出可能需要會員（VIP）或改用其他方式。無論你用哪種方式取得 .srt，拿到檔案後在本頁的轉換都是完全免費的。',
  },
];

export default async function JianyingLandingPage() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: JIANYING_FAQ.map((item) => ({
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
            剪映字幕簡轉繁：CapCut 字幕簡體轉台灣繁體（SRT 一鍵轉換）
          </h1>
          <p className="text-lg text-gray-600 max-w-4xl">
            剪映（CapCut）用 AI 自動辨識出來的字幕，預設都是簡體中文。把在剪映匯出的
            .srt 字幕檔拖進下方轉換區，txtconv 立刻在你的瀏覽器內轉成台灣用語的繁體中文
            —— 時間軸與序號完全不動、檔案不上傳伺服器，轉完的 SRT 還能直接重新匯回剪映。
          </p>
        </section>

        <FileUpload licenseType={profile?.license_type ?? 'free'} />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">
            剪映字幕轉繁體：三步驟完成
          </h2>
          <ol className="list-decimal pl-6 space-y-2 text-gray-600">
            <li>
              在剪映（CapCut）用 AI 辨識字幕後，開啟「導出」頁面，勾選「字幕導出」，
              選擇 <span className="font-medium text-gray-800">SRT</span>（保留時間碼）匯出字幕檔。
            </li>
            <li>把匯出的 .srt 檔拖曳（或點選）上傳到本頁的轉換區，會自動開始轉換。</li>
            <li>點下載取得繁體字幕，再在剪映用「導入字幕」把轉好的 SRT 重新匯入即可。</li>
          </ol>
          <p className="text-sm text-gray-500">
            提醒：剪映的字幕匯出功能與是否免費會因版本而異，部分版本可能需要會員（VIP）；
            但只要你取得 .srt 檔，在本頁的轉換一律免費、且在瀏覽器內完成，不會上傳你的檔案。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">為什麼用 txtconv 轉剪映字幕</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li>
              <span className="font-medium text-gray-800">時間軸不跑掉：</span>
              只轉文字，SRT 的序號與時間碼（例如 00:00:01,000 --&gt; 00:00:03,500）原樣保留。
            </li>
            <li>
              <span className="font-medium text-gray-800">台灣用語詞庫：</span>
              使用 OpenCC 台灣正體詞庫，把「软件、视频、信息」轉成「軟體、影片、資訊」，字幕更自然。
            </li>
            <li>
              <span className="font-medium text-gray-800">免上傳、更隱私：</span>
              轉換在瀏覽器內完成，字幕檔不會離開你的電腦，也不會被存到任何伺服器。
            </li>
            <li>
              <span className="font-medium text-gray-800">批次處理整季影片：</span>
              一次拖入多個 .srt 檔，會依序自動轉換，適合系列影片或整季影集的字幕。
            </li>
          </ul>
          <p className="text-sm text-gray-500">
            我們也在研究直接讀取剪映專案檔（草稿）的字幕、免匯出 SRT 的做法；目前尚未支援，
            現階段請先在剪映匯出 .srt 再上傳轉換。
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-gray-600">
            要轉換的不是字幕？也可以看{' '}
            <a href="/srt" className="text-primary hover:underline">
              SRT 字幕簡轉繁
            </a>
            、
            <a href="/novel" className="text-primary hover:underline">
              小說 TXT 簡轉繁
            </a>
            、
            <a href="/epub" className="text-primary hover:underline">
              EPUB 電子書簡轉繁
            </a>
            ，或回到
            <Link href="/" className="text-primary hover:underline">
              首頁
            </Link>
            查看完整功能與方案。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">剪映字幕轉繁體常見問題</h2>
          <div className="space-y-4">
            {JIANYING_FAQ.map((item) => (
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
