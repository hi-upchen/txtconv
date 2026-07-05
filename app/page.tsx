import CustomDictEditor from '@/components/CustomDictEditor';
import FaqSection from '@/components/FaqSection';
import FileUpload from '@/components/FileUpload';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PricingSection from '@/components/PricingSection';
import { getAuthUser, getProfile, ensureProfileLinked } from '@/lib/actions/auth';

export default async function Home() {
  const user = await getAuthUser();
  let profile = user ? await getProfile(user.id) : null;

  // If user is authenticated but has no profile by ID, try to link/create one
  if (user && !profile && user.email) {
    await ensureProfileLinked(user.id, user.email);
    profile = await getProfile(user.id);
  }

  return (
    <>
      <Header user={user} profile={profile} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 flex flex-col gap-12">
        {/* Hero Section */}
        <section className="space-y-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 leading-snug">
            小說字幕簡轉繁、純文字檔案簡體轉繁體
          </h1>
          <p className="text-lg text-gray-600 max-w-4xl">
            線上免費將剪映 Capcut 字幕、小說、電子書、CSV 等文字檔從簡體轉換成繁體中文，支援批次轉換。
          </p>

          {/* Trust row: three quick reassurances shown right under the hero copy.
              Kept as a lightweight icon+text row (not a card section) so it
              supports the conversion decision without pushing the uploader
              below the fold. */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-lg" aria-hidden="true">
                check_circle
              </span>
              免費使用
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-lg" aria-hidden="true">
                devices
              </span>
              免安裝、瀏覽器內完成
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-lg" aria-hidden="true">
                manage_search
              </span>
              自動偵測編碼
            </span>
          </div>

          <div className="space-y-1 text-sm text-gray-500">
            <p>支援檔案格式為：</p>
            <p>
              <a href="/novel" className="hover:text-primary underline underline-offset-2">
                .txt 純文字小說檔案
              </a>
            </p>
            <p>
              <a href="/epub" className="hover:text-primary underline underline-offset-2">
                .epub 電子書檔案
              </a>
            </p>
            <p>
              <a href="/srt" className="hover:text-primary underline underline-offset-2">
                .srt 電影字幕檔案
              </a>
            </p>
            <p>
              <a href="/csv" className="hover:text-primary underline underline-offset-2">
                .csv 資料格式
              </a>
            </p>
            <p>.xml 資料格式</p>
          </div>

          {/* Social proof: real third-party coverage only — do not add outlets
              that have not actually reviewed txtconv. */}
          <p className="text-sm text-gray-400">
            媒體報導：
            <a
              href="https://briian.com/27849/txtconv.html"
              target="_blank"
              rel="noopener"
              className="hover:text-primary underline underline-offset-2"
            >
              重灌狂人
            </a>
            <span aria-hidden="true">・</span>
            <a
              href="https://www.techmarks.com/convert-zh-cn/"
              target="_blank"
              rel="noopener"
              className="hover:text-primary underline underline-offset-2"
            >
              TechMarks
            </a>
          </p>
        </section>

        {/* File Upload Section */}
        <FileUpload licenseType={profile?.license_type ?? 'free'} />

        <CustomDictEditor user={user} profile={profile} />

        <PricingSection
          gumroadUrl={process.env.NEXT_PUBLIC_GUMROAD_URL || 'https://gumroad.com'}
          licenseType={profile?.license_type ?? 'free'}
        />

        <FaqSection />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'txtconv',
              url: 'https://txtconv.arpuli.com',
              applicationCategory: 'UtilitiesApplication',
              operatingSystem: 'Web',
              description:
                '線上簡轉繁工具：將 .txt 小說、.srt 字幕、.csv、.xml 檔案從簡體中文轉換成台灣繁體中文，自動偵測編碼並支援自訂字典。',
              inLanguage: 'zh-TW',
              offers: [
                { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
                { '@type': 'Offer', name: 'Lifetime', price: '30', priceCurrency: 'USD' },
              ],
            }),
          }}
        />
      </main>

      <Footer />
    </>
  );
}
