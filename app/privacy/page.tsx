import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getAuthUser, getProfile } from '@/lib/actions/auth';

/**
 * Privacy policy page. Discloses what data the service collects
 * (account email, custom dictionary, analytics) and how it is used;
 * files are converted entirely in the browser and never uploaded.
 * Linked from the site footer and required for user trust and
 * payment-provider compliance.
 */

export const metadata: Metadata = {
  title: '隱私權政策',
  description:
    'txtconv 隱私權政策：說明帳號資料、檔案處理、網站分析資料的收集與使用方式。',
  alternates: { canonical: '/privacy' },
};

export default async function PrivacyPage() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  return (
    <>
      <Header user={user} profile={profile} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 space-y-8 text-gray-700">
        <h1 className="text-3xl font-bold text-gray-800">隱私權政策</h1>
        <p className="text-sm text-gray-500">最後更新：2026 年 7 月 3 日</p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-800">我們收集哪些資料</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed">
            <li>
              <strong>帳號資料：</strong>當你註冊或登入時，我們透過
              Supabase 儲存你的電子郵件地址與登入紀錄，用於識別你的方案權益（免費版／Pro）。
            </li>
            <li>
              <strong>你的檔案：</strong>簡繁轉換完全在你的瀏覽器內執行，
              檔案不會上傳到我們的伺服器，也不會被儲存或留存任何副本。
            </li>
            <li>
              <strong>自訂字典：</strong>你建立的自訂字典內容會儲存在雲端，供你跨裝置使用。
            </li>
            <li>
              <strong>網站分析：</strong>我們使用 Google Tag Manager 與 Google
              Analytics 收集匿名的使用統計（如頁面瀏覽、轉換次數、檔案格式類型），用於改善產品。
            </li>
            <li>
              <strong>付款資料：</strong>Pro 方案付款由 Gumroad
              處理，我們不會接觸或儲存你的信用卡資料；我們僅會收到訂單編號、購買者
              email 與付款狀態，用於開通你的方案。
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-800">我們如何使用資料</h2>
          <p className="text-sm leading-relaxed">
            資料僅用於：提供與改善轉換服務、開通付費方案權益、統計產品使用情況、以及回覆你的支援請求。
            我們不會出售或出租你的個人資料給第三方。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-800">資料刪除</h2>
          <p className="text-sm leading-relaxed">
            你可以隨時來信{' '}
            <a href="mailto:hi.upchen@gmail.com" className="text-primary hover:underline">
              hi.upchen@gmail.com
            </a>{' '}
            要求刪除你的帳號或自訂字典資料，我們會在 30 天內處理完成。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-800">聯絡方式</h2>
          <p className="text-sm leading-relaxed">
            對本政策有任何疑問，歡迎來信{' '}
            <a href="mailto:hi.upchen@gmail.com" className="text-primary hover:underline">
              hi.upchen@gmail.com
            </a>
            。
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
}
