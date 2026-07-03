import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getAuthUser, getProfile } from '@/lib/actions/auth';

/**
 * SEO/education page for the custom dictionary (自訂字典) — txtconv's
 * differentiator versus other simplified-to-traditional converters.
 * Explains the "one pair per line, comma-separated" format, how custom
 * pairs take priority over the default OpenCC rules, common use cases
 * (novel character names, subtitle terminology, company glossaries),
 * and the free/Pro pair limits. All behavior described here must match
 * lib/custom-dict.ts and components/CustomDictEditor.tsx.
 */

export const metadata: Metadata = {
  title: '自訂字典教學 — 簡轉繁固定譯法，人名、術語不再轉錯',
  description:
    'txtconv 自訂字典教學：指定「簡體詞→繁體詞」固定譯法，優先於預設 OpenCC 轉換規則。適合小說人名地名、字幕術語統一、公司內部用語。格式為每行一組「簡體詞,繁體詞」，支援 CSV 匯入匯出。',
  alternates: { canonical: '/dictionary-guide' },
  openGraph: {
    title: '自訂字典教學 — 簡轉繁固定譯法，人名、術語不再轉錯',
    description:
      '指定「簡體詞→繁體詞」固定譯法，優先於預設 OpenCC 規則。小說人名、字幕術語、公司用語都能統一。',
    url: 'https://txtconv.arpuli.com/dictionary-guide',
  },
};

const DICT_FAQ = [
  {
    question: '自訂字典的優先順序如何運作？',
    answer:
      '自訂字典優先於預設的 OpenCC 轉換規則。轉換時會先把文字中你設定的簡體詞標記保護起來，OpenCC 只處理其餘內容，最後再帶入你指定的繁體詞，所以自訂譯法一定會生效、不會被預設規則覆蓋。若多組對照同時符合，較長的詞優先，例如同時設定「云」與「云岚宗」，「云岚宗」會先被套用。',
  },
  {
    question: '匯入、匯出用什麼格式？',
    answer:
      '純文字 CSV（UTF-8 編碼），每行一組「簡體詞,繁體詞」，一行只能有一個逗號。點「匯入 CSV」可上傳 .csv 或 .txt 檔，點「匯出 CSV」會下載 custom-dictionary.csv，方便備份或分享給同事。格式有誤時（缺逗號、兩側空白、簡體詞重複）編輯器會逐行提示錯誤。',
  },
  {
    question: '免費版有什麼限制？',
    answer:
      '編輯自訂字典需要先登入（輸入 Email 即可免費註冊，無須密碼）。免費版可設定 5 組對照，Pro 版（終身授權 US$30）可設定最多 10,000 組。字典儲存在你的帳號中，輸入後約 1 秒自動儲存，換裝置登入也能繼續使用。',
  },
];

/** Example dictionary rows shown in the worked-example block. */
const EXAMPLE_ROWS = [
  { pair: '赫敏,妙麗', note: '中國譯名 → 台灣譯名（哈利波特的 Hermione）' },
  { pair: '伏地魔,佛地魔', note: '同一角色，兩岸譯名不同，統一成台灣版' },
  { pair: '信息,訊息', note: '預設會轉成「資訊」，這裡固定改用「訊息」' },
];

export default async function DictionaryGuidePage() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: DICT_FAQ.map((item) => ({
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
            自訂字典教學：固定簡轉繁譯法，人名、術語不再轉錯
          </h1>
          <p className="text-lg text-gray-600 max-w-4xl">
            自訂字典讓你指定「某個簡體詞一律轉成某個繁體詞」，優先於 txtconv
            預設的 OpenCC 台灣用語轉換規則。預設規則能把「软件→軟體、网络→網路」
            轉得很好，但小說人名、招式名、公司術語這類專有名詞，只有你知道正確譯法
            —— 設定一次，整批檔案的譯法就完全一致。這是 txtconv
            與一般簡繁轉換工具最大的差異。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/#dictionary"
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
            >
              開始使用自訂字典
            </Link>
            <Link
              href="/#pricing"
              className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition-colors"
            >
              查看方案與價格
            </Link>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">格式：每行一組「簡體詞,繁體詞」</h2>
          <p className="text-gray-600">
            在首頁的「自訂字典對照」編輯區輸入，一行一組、以一個逗號分隔，
            左邊是簡體詞、右邊是你要的繁體詞。空白行會自動略過；同一個簡體詞
            重複設定、或一行有多個逗號時，編輯器會標出是哪一行出錯。
          </p>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 text-xs font-medium text-gray-500 border-b border-gray-100">
              範例：小說譯名統一
            </div>
            <div className="px-6 py-4 space-y-3">
              {EXAMPLE_ROWS.map((row) => (
                <div
                  key={row.pair}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4"
                >
                  <code className="font-mono text-sm text-gray-800 bg-gray-50 rounded px-2 py-1 w-fit">
                    {row.pair}
                  </code>
                  <span className="text-sm text-gray-500">{row.note}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">什麼情況會用到自訂字典</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li>
              <strong>小說人名、地名固定譯法</strong>
              ：整套小說幾十個檔案批次轉換，主角名字、門派、招式名每一集都一致，
              不會被逐字轉出奇怪的寫法
            </li>
            <li>
              <strong>字幕術語統一</strong>
              ：影集、教學影片的專有名詞（角色名、產品名、技術詞）在整季字幕中
              維持同一種譯法
            </li>
            <li>
              <strong>公司內部用語</strong>
              ：品牌名、部門名、慣用術語照公司的標準寫法轉換，轉完的文件不用再人工校對替換
            </li>
          </ul>
          <p className="text-gray-600">
            實際轉換請見{' '}
            <a href="/novel" className="text-primary hover:underline">
              小說 TXT 簡轉繁
            </a>
            、
            <a href="/srt" className="text-primary hover:underline">
              SRT 字幕簡轉繁
            </a>
            、
            <a href="/csv" className="text-primary hover:underline">
              CSV 簡轉繁
            </a>
            ，或回到
            <Link href="/" className="text-primary hover:underline">
              首頁
            </Link>
            。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">免費版與 Pro 版的差異</h2>
          <p className="text-gray-600">
            編輯自訂字典需要先登入（Email 免費註冊即可）。免費版可設定 5
            組對照，足夠固定幾個主要人名；需要整理大量術語表的話，Pro
            版（終身授權）支援最多 10,000 組，並可用 CSV 一次匯入整份對照表。
          </p>
          <Link href="/#pricing" className="inline-block text-primary hover:underline font-medium">
            查看 Pro 方案 →
          </Link>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">自訂字典常見問題</h2>
          <div className="space-y-4">
            {DICT_FAQ.map((item) => (
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
