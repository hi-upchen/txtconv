// app/checkout/page.tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import LoginPanel from '@/components/LoginPanel';
import ProBenefits from '@/components/ProBenefits';
import { getAuthUser, getProfile, ensureProfileLinked } from '@/lib/actions/auth';
import { isPaidUser } from '@/lib/auth';
import { PRO_LIFETIME_PRICE_TWD, PRO_PRICE_LABEL, REFUND_NOTE } from '@/lib/payment/price';

/**
 * Checkout page for the Pro lifetime licence.
 *
 * The server picks one of three states:
 *   - guest: explain that the purchase binds to an email, and show the login panel;
 *   - logged in, not paid: show the order summary and the form that starts ECPay;
 *   - already lifetime: send the user home, because there is nothing to buy.
 * The page never talks to ECPay. The form posts to the create route.
 */

export const metadata: Metadata = {
  title: '購買 Pro 終身版',
  description: `以新台幣 ${PRO_LIFETIME_PRICE_TWD} 元購買 txtconv Pro 終身版，透過綠界 ECPay 信用卡付款。`,
  robots: { index: false, follow: false },
};

/** The page reads the session cookie. Never prerender it. */
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const user = await getAuthUser();
  let profile = user ? await getProfile(user.id) : null;

  // Same repair as the homepage. A logged-in user without a profile row
  // gets one before we decide what to show.
  if (user && !profile && user.email) {
    await ensureProfileLinked(user.id, user.email);
    profile = await getProfile(user.id);
  }

  if (user && isPaidUser(profile)) {
    redirect('/');
  }

  return (
    <>
      <Header user={user} profile={profile} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 flex flex-col gap-8">
        <h1 className="text-3xl font-bold text-gray-800 text-center">購買 Pro 終身版</h1>

        {!user ? (
          <section className="flex flex-col items-center gap-6 text-center">
            <p className="text-gray-600">購買會綁定你的 email，請先登入</p>
            <div className="w-full max-w-sm text-left bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
              <LoginPanel
                returnTo="/checkout"
                heading="先登入，再付款"
                description="Pro 會綁定你登入的 email，之後在任何裝置登入都能使用。"
              />
            </div>
          </section>
        ) : (
          <section className="bg-[#fffdf5] border border-amber-100 rounded-2xl shadow-lg p-8 space-y-6">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-xl font-bold text-gray-900">Pro 終身版</p>
                <p className="text-sm text-gray-500">一次付費，永久使用</p>
              </div>
              <p className="text-4xl font-bold text-primary">{PRO_PRICE_LABEL}</p>
            </div>

            <ProBenefits
              className="text-sm text-gray-600 space-y-2"
              dictionaryWording="explained"
              extraItems={['包含所有未來新功能']}
            />

            <dl className="text-sm text-gray-600 border-t border-amber-100 pt-4 space-y-1">
              <div className="flex gap-2">
                <dt className="shrink-0">將綁定的帳號：</dt>
                <dd className="font-medium text-gray-900 break-all">{user.email}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0">退款：</dt>
                <dd>{REFUND_NOTE}</dd>
              </div>
            </dl>

            <form method="post" action="/api/payment/ecpay/create">
              <button
                type="submit"
                className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-colors"
              >
                前往綠界付款
              </button>
            </form>

            <p className="text-xs text-gray-400">
              付款由綠界科技（ECPay）處理，本站不接觸你的信用卡號。金額以新台幣計價，付款完成後立即開通。
            </p>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
