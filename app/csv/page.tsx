import type { Metadata } from 'next';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getAuthUser, getProfile } from '@/lib/actions/auth';

/**
 * SEO landing page for data-file conversion queries (CSV 簡轉繁,
 * Excel 開啟 CSV 亂碼). Hosts the in-browser converter with CSV-specific
 * guidance — encoding auto-detection and structure preservation are the
 * points this page explains. Only plain-text .csv is supported (not .xlsx),
 * and only the text content is converted.
 */

export const metadata: Metadata = {
  title: 'CSV 簡轉繁 — Excel 開啟簡體 CSV 亂碼修復、轉台灣用語',
  description:
    '簡體 CSV 資料檔免費線上轉繁體：自動偵測 GBK/GB18030 編碼修復 Excel 開啟的亂碼，只轉文字內容，欄位與分隔符號不變，輸出 UTF-8，支援批次轉換。',
  alternates: { canonical: '/csv' },
  openGraph: {
    title: 'CSV 簡轉繁 — Excel 開啟簡體 CSV 亂碼修復、轉台灣用語',
    description:
      '簡體 CSV 資料檔免費線上轉繁體：自動偵測編碼修復亂碼，欄位結構不變，輸出 UTF-8。',
    url: 'https://txtconv.arpuli.com/csv',
  },
};

const CSV_FAQ = [
  {
    question: '用 Excel 開啟簡體 CSV 全是亂碼，怎麼修復？',
    answer:
      '中國大陸來源的 CSV 大多以 GBK 或 GB18030 編碼儲存，Excel 用錯編碼解讀就變亂碼。把檔案拖進 txtconv，會自動偵測正確編碼、轉成台灣繁體中文，並輸出成 UTF-8。若下載後直接雙擊開啟仍顯示亂碼，改用 Excel 的「資料 → 從文字/CSV 取得資料」匯入並選擇 UTF-8 編碼，即可正常顯示。',
  },
  {
    question: '轉換會不會弄亂欄位或分隔符號？',
    answer:
      '不會。txtconv 只轉換檔案裡的文字內容（例如「软件→軟體」），逗號、分號、Tab 等分隔符號、引號與換行都保持原樣，欄位數量與順序完全不變，轉完可直接匯入 Excel、Google 試算表或資料庫。注意僅支援純文字 .csv 檔，Excel 的 .xlsx 格式請先另存成 CSV 再轉換。',
  },
  {
    question: '有很多個資料檔要轉，可以批次處理嗎？',
    answer:
      '可以。一次拖入多個 .csv（也可混搭 .txt、.srt、.xml）即可批次轉換，每個檔案轉完即可下載。免費版單檔上限 5MB，更大的資料檔可升級 Pro 支援單檔 100MB。',
  },
];

export default async function CsvLandingPage() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: CSV_FAQ.map((item) => ({
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
            CSV 簡轉繁：修復 Excel 開啟亂碼，轉成台灣用語
          </h1>
          <p className="text-lg text-gray-600 max-w-4xl">
            從中國大陸網站或系統匯出的 CSV，用 Excel 打開常是亂碼？txtconv
            自動偵測 GBK / GB18030 / Big5 編碼，把文字內容轉成台灣慣用的繁體中文
            （软件→軟體、数据→資料），欄位與分隔符號完全不動，輸出成通用的
            UTF-8。全程在瀏覽器內完成，資料檔不需安裝任何軟體。
          </p>
        </section>

        <FileUpload licenseType={profile?.license_type ?? 'free'} />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">為什麼選 txtconv 轉資料檔</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li>亂碼救援：自動判斷來源編碼，不用自己猜是 GBK 還是 Big5</li>
            <li>結構不變：只轉文字內容，逗號、引號、欄位順序原封不動</li>
            <li>台灣用語：OpenCC 詞庫轉換，「信息→資訊、网络→網路」讀起來自然</li>
            <li>批次轉換：多個資料檔一次拖入，逐檔轉完即可下載</li>
          </ul>
          <p className="text-gray-600">
            也需要轉換小說或字幕？請見{' '}
            <a href="/novel" className="text-primary hover:underline">
              小說 TXT 簡轉繁
            </a>
            、
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
          <h2 className="text-2xl font-bold text-gray-800">CSV 轉換常見問題</h2>
          <div className="space-y-4">
            {CSV_FAQ.map((item) => (
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
