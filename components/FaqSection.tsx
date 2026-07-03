/**
 * FAQ and feature-explanation section rendered on the homepage. Server
 * component (static HTML) that doubles as the site's main indexable
 * content for search: answers target the long-tail queries users type
 * (字幕簡轉繁、小說 txt 轉繁體、亂碼、編碼偵測、自訂字典), and the same
 * Q&A pairs are emitted as FAQPage JSON-LD structured data.
 */

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: '如何把剪映（CapCut）匯出的字幕從簡體轉成繁體？',
    answer:
      '剪映匯出的 .srt 字幕檔常是簡體中文。把 .srt 檔直接拖曳到 txtconv 上傳區，工具會自動轉換成台灣慣用的繁體中文（例如「软件→軟體」「视频→影片」），轉換完成後點擊下載即可，字幕的時間軸完全不會被更動。',
  },
  {
    question: '簡體 txt 小說打開是亂碼，可以修復嗎？',
    answer:
      '可以。亂碼通常是編碼判斷錯誤造成的：簡體檔案多用 GBK/GB18030 編碼，用 Big5 或 UTF-8 開啟就會變亂碼。txtconv 會自動偵測 UTF-8、GBK、GB2312、GB18030、Big5 等常見中文編碼，正確解碼後再轉成繁體，輸出一律是 UTF-8，任何裝置都能正常開啟。',
  },
  {
    question: '轉換是用什麼標準？會把「软件」轉成「軟體」還是「軟件」？',
    answer:
      'txtconv 使用 OpenCC 的「簡體到台灣正體（含常用詞彙轉換）」模式，不只逐字轉換，也會把中國大陸用語轉成台灣慣用詞，例如「软件→軟體」「网络→網路」「信息→資訊」。如果有特殊術語想固定譯法，登入後可以在自訂字典加入自己的對照。',
  },
  {
    question: '檔案會被上傳到伺服器嗎？轉換速度快嗎？',
    answer:
      '轉換本身完全在你的瀏覽器裡執行，不需等待伺服器排隊，即使幾 MB 的小說檔也能在數秒內完成；批次拖入多個檔案會依序自動轉換。',
  },
  {
    question: '支援哪些檔案格式與大小？',
    answer:
      '支援 .txt 純文字（小說、文件）、.srt 影片字幕、.csv 資料表、.xml 資料檔。免費版單檔上限 5MB；升級 Pro（終身授權 US$30）後單檔上限 100MB，並可使用最多 10,000 組自訂字典對照。',
  },
  {
    question: '自訂字典是什麼？什麼情況會用到？',
    answer:
      '自訂字典讓你指定「某個簡體詞一律轉成某個繁體詞」，優先於預設轉換規則。常見用途：小說人名、地名、專有名詞（避免被逐字轉錯）、公司內部術語、字幕翻譯風格統一。格式很簡單：每行一組「簡體詞,繁體詞」，也支援匯入與匯出。',
  },
  {
    question: '和 ConvertZ / ConvertZZ 這類軟體有什麼不同？',
    answer:
      'ConvertZ 系列是 Windows 桌面軟體，需要下載安裝，在 Mac 上無法使用。txtconv 是網頁工具，打開瀏覽器就能用，Windows、Mac、平板都支援，且內建台灣用語詞彙轉換與自訂字典，不用另外設定。',
  },
];

/**
 * Renders the FAQ accordion-style list plus FAQPage JSON-LD.
 */
export default function FaqSection() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <section className="py-8">
      <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
        常見問題
      </h2>

      <div className="space-y-4 max-w-3xl mx-auto">
        {FAQ_ITEMS.map((item) => (
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
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              {item.answer}
            </p>
          </details>
        ))}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
