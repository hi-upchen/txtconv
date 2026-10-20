import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import LoginPanel from '@/components/LoginPanel';
import PurchaseTracker from '@/components/PurchaseTracker';
import { getAuthUser, getProfile } from '@/lib/actions/auth';
import { isPaidUser } from '@/lib/auth';
import { MERCHANT_TRADE_NO_REGEX } from '@/lib/payment/config';
import { findOrderForUser } from '@/lib/payment/orders';
import { SUPPORT_EMAIL } from '@/lib/site';
import type { Profile } from '@/types/user';

/**
 * Shows the result of one ECPay payment.
 *
 * ECPay's browser result route sends buyers here.
 * The cashier's back-to-shop button links here too.
 * The page only reads. It looks up the logged-in user's own order.
 * It shows one of these views:
 *   - error: the result route could not verify ECPay's message.
 *   - login: nobody is logged in.
 *   - not_found: the order is not this user's.
 *   - paid: the order is paid and the licence is active.
 *   - activating: the order is paid, but the licence is not active yet.
 *   - pending: the callback has not landed yet.
 *   - failed: ECPay reported an unsuccessful payment.
 *   - refunded: the owner refunded this order.
 * The lifetime grant happens in the callback route, never here.
 */

export const metadata: Metadata = {
  title: '付款結果',
  robots: { index: false, follow: false },
};

/** The page reads the session cookie and the live order. Never prerender it. */
export const dynamic = 'force-dynamic';

type View =
  | 'error'
  | 'login'
  | 'not_found'
  | 'paid'
  | 'activating'
  | 'pending'
  | 'failed'
  | 'refunded';

type Order = Awaited<ReturnType<typeof findOrderForUser>>;

const PRIMARY_LINK_CLASS =
  'mt-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors';

/** Picks the view for an order the user's own lookup returned. */
function viewForOrder(order: Order, profile: Profile | null, reportedFailed: boolean): View {
  if (!order) return 'not_found';
  // A refunded order never counts as a purchase, whatever the URL says.
  if (order.status === 'refunded') return 'refunded';
  // The database wins. A paid order shows success even with failed=1 in the URL.
  // Success also needs an active licence. Until then the page keeps polling.
  if (order.status === 'paid') return isPaidUser(profile) ? 'paid' : 'activating';
  return reportedFailed ? 'failed' : 'pending';
}

/** Shows the large icon at the top of a result view. */
function StatusIcon({ icon, color, pulse = false }: { icon: string; color: string; pulse?: boolean }) {
  return (
    <span
      className={`material-symbols-outlined ${color} text-5xl${pulse ? ' animate-pulse' : ''}`}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

/** Shows the order number line under a result heading. */
function OrderNumber({ orderNo }: { orderNo: string }) {
  return (
    <p className="text-sm text-gray-500">
      訂單編號：<span className="font-mono">{orderNo}</span>
    </p>
  );
}

/** Links to the support mailbox. */
function SupportMailLink() {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
      {SUPPORT_EMAIL}
    </a>
  );
}

export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[]; error?: string | string[]; failed?: string | string[] }>;
}) {
  const params = await searchParams;
  const orderParam = typeof params.order === 'string' ? params.order : '';
  const hasError = params.error === '1';
  const reportedFailed = params.failed === '1';
  const orderParamIsValid = !hasError && MERCHANT_TRADE_NO_REGEX.test(orderParam);

  const user = await getAuthUser();
  // Both lookups need only the user id, so they run together.
  // A broken order number skips the order lookup.
  const [profile, order] = user
    ? await Promise.all([
        getProfile(user.id),
        orderParamIsValid ? findOrderForUser(orderParam, user.id) : null,
      ])
    : [null, null];

  let view: View;
  if (!orderParamIsValid) {
    view = 'error';
  } else if (!user) {
    view = 'login';
  } else {
    view = viewForOrder(order, profile, reportedFailed);
  }
  const amountTwd = order?.amount_twd ?? 0;

  // After login the buyer comes back to this same order and view.
  const loginReturnTo = `/checkout/complete?order=${orderParam}${reportedFailed ? '&failed=1' : ''}`;

  return (
    <>
      <Header user={user} profile={profile} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-16 flex flex-col items-center text-center gap-6">
        {view === 'error' && (
          <>
            <StatusIcon icon="error" color="text-red-400" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">付款結果無法確認</h1>
            <p className="text-gray-600 max-w-md">
              我們無法確認這次付款的結果。若你已完成扣款，請來信{' '}
              <SupportMailLink />{' '}
              並附上付款時間，我們會盡快處理。
            </p>
            <Link href="/checkout" className={PRIMARY_LINK_CLASS}>
              回到結帳頁
            </Link>
          </>
        )}

        {view === 'login' && (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">請先登入以查看付款結果</h1>
            <p className="text-gray-600 max-w-md">請用下單時的 email 登入。</p>
            <div className="w-full max-w-sm text-left">
              <LoginPanel
                returnTo={loginReturnTo}
                heading="登入以查看付款結果"
                description="請使用下單時的 email 登入。"
              />
            </div>
          </>
        )}

        {view === 'not_found' && (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">找不到這筆訂單</h1>
            <p className="text-gray-600 max-w-md">
              請確認你登入的是下單時的帳號。若確定沒錯，請來信{' '}
              <SupportMailLink />{' '}
              並附上訂單編號 <span className="font-mono">{orderParam}</span>。
            </p>
          </>
        )}

        {view === 'paid' && (
          <>
            <StatusIcon icon="check_circle" color="text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">付款成功，Pro 終身版已開通</h1>
            <p className="text-gray-600 max-w-md">
              感謝你的支持。現在起單檔最大 100MB、自訂字典 10,000 組都已開放。
            </p>
            <OrderNumber orderNo={orderParam} />
            <Link href="/" className={PRIMARY_LINK_CLASS}>
              回到首頁開始轉換
            </Link>
            <PurchaseTracker status="paid" merchantTradeNo={orderParam} amountTwd={amountTwd} />
          </>
        )}

        {view === 'activating' && (
          <>
            <StatusIcon icon="hourglass_top" color="text-primary" pulse />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">付款完成，開通處理中</h1>
            <p className="text-gray-600 max-w-md">我們已收到你的付款，正在為你的帳號開通 Pro 終身版。</p>
            <OrderNumber orderNo={orderParam} />
            <PurchaseTracker status="activating" merchantTradeNo={orderParam} amountTwd={amountTwd} />
          </>
        )}

        {view === 'pending' && (
          <>
            <StatusIcon icon="hourglass_top" color="text-amber-500" pulse />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">付款確認中</h1>
            <OrderNumber orderNo={orderParam} />
            <PurchaseTracker status="pending" merchantTradeNo={orderParam} amountTwd={amountTwd} />
            <Link href="/checkout" className="text-sm text-primary hover:underline">
              還沒付款？回到結帳頁
            </Link>
          </>
        )}

        {view === 'failed' && (
          <>
            <StatusIcon icon="credit_card_off" color="text-red-400" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">付款未完成</h1>
            <p className="text-gray-600 max-w-md">
              綠界回報這筆付款沒有成功。你可以回到結帳頁再試一次，或改用另一張信用卡。
            </p>
            <OrderNumber orderNo={orderParam} />
            <Link href="/checkout" className={PRIMARY_LINK_CLASS}>
              回到結帳頁重新付款
            </Link>
          </>
        )}
        {view === 'refunded' && (
          <>
            <StatusIcon icon="undo" color="text-gray-400" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">此訂單已退款</h1>
            <OrderNumber orderNo={orderParam} />
            <Link href="/checkout" className={PRIMARY_LINK_CLASS}>
              回到結帳頁
            </Link>
          </>
        )}
      </main>

      <Footer />
    </>
  );
}
