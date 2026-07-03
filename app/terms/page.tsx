import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getAuthUser, getProfile } from '@/lib/actions/auth';

/**
 * Terms of service page. States usage terms, plan entitlements, refund
 * channel (Gumroad), and liability limits; linked from the site footer.
 */

export const metadata: Metadata = {
  title: '服務條款',
  description: 'txtconv 服務條款：使用規範、方案權益、退款方式與免責聲明。',
  alternates: { canonical: '/terms' },
};

export default async function TermsPage() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  return (
    <>
      <Header user={user} profile={profile} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 space-y-8 text-gray-700">
        <h1 className="text-3xl font-bold text-gray-800">服務條款</h1>
        <p className="text-sm text-gray-500">最後更新：2026 年 7 月 3 日</p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-800">服務內容</h2>
          <p className="text-sm leading-relaxed">
            txtconv 提供文字檔案的簡體中文轉繁體中文服務，支援 .txt、.srt、.csv、.xml
            格式。免費版可使用基本轉換功能（單檔 5MB、自訂字典 5 組）；Pro
            終身授權提供單檔 100MB 與最多 10,000 組自訂字典對照。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-800">使用規範</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed">
            <li>請勿上傳含有惡意程式、違法內容或侵害他人權利的檔案。</li>
            <li>請確認你擁有所上傳檔案的使用權利；轉換結果的著作權歸屬依原始檔案而定。</li>
            <li>請勿以自動化程式大量存取本服務或干擾服務運作。</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-800">付款與退款</h2>
          <p className="text-sm leading-relaxed">
            Pro 方案透過 Gumroad 付款。如需退款，請於購買後 14 天內來信{' '}
            <a href="mailto:hi.upchen@gmail.com" className="text-primary hover:underline">
              hi.upchen@gmail.com
            </a>{' '}
            或透過 Gumroad 申請。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-800">免責聲明</h2>
          <p className="text-sm leading-relaxed">
            本服務以「現狀」提供。簡繁轉換基於 OpenCC
            詞庫，無法保證所有詞彙在你的情境下都轉換正確，重要文件請於轉換後自行校對。
            對於因使用本服務造成的任何損失，我們的責任以你實際支付的費用為上限。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-800">條款修改</h2>
          <p className="text-sm leading-relaxed">
            我們可能不定期修改本條款，重大變更會在網站上公告。繼續使用本服務即表示你同意修改後的條款。
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
}
