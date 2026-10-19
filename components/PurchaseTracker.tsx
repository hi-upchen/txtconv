'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trackPurchase } from '@/lib/analytics';

/** How often the pending view asks the server for the order again. */
const REFRESH_INTERVAL_MS = 3000;

/** After this long we stop asking and tell the buyer how to reach us. */
const GIVE_UP_AFTER_MS = 60_000;

const SUPPORT_EMAIL = 'hi.upchen@gmail.com';

/** Returns the sessionStorage key that marks an order as already reported. */
export function purchaseTrackedKey(merchantTradeNo: string): string {
  return `purchase_tracked_${merchantTradeNo}`;
}

interface PurchaseTrackerProps {
  /** Order state as the server page read it. */
  status: 'paid' | 'pending';
  merchantTradeNo: string;
  amountTwd: number;
}

/**
 * Reports a paid order once, or keeps a pending order fresh.
 *
 * For a paid order it sends the purchase event and renders nothing.
 * sessionStorage remembers the order, so a reload does not count it twice.
 *
 * For a pending order it re-renders the server page every 3 seconds.
 * ECPay's callback often lands a few seconds after the browser returns.
 * After 60 seconds it stops and shows how to contact us.
 * The component stays mounted across refreshes, so the timer keeps its state.
 */
export default function PurchaseTracker({
  status,
  merchantTradeNo,
  amountTwd,
}: PurchaseTrackerProps) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  // The timer reads the router through a ref. A new router object must not
  // restart the timer, or the 60-second limit would never arrive.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    if (status !== 'paid') return;
    const key = purchaseTrackedKey(merchantTradeNo);
    try {
      if (window.sessionStorage.getItem(key)) return;
    } catch {
      // Private browsing may block storage. Sending the event once more is acceptable.
    }
    trackPurchase({ transactionId: merchantTradeNo, value: amountTwd, currency: 'TWD' });
    try {
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Storage is blocked. There is nothing else to do.
    }
  }, [status, merchantTradeNo, amountTwd]);

  useEffect(() => {
    if (status !== 'pending') return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt >= GIVE_UP_AFTER_MS) {
        window.clearInterval(timer);
        setGaveUp(true);
        return;
      }
      routerRef.current.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [status]);

  if (status === 'paid') return null;

  if (gaveUp) {
    return (
      <p className="text-sm text-gray-600 leading-relaxed" role="status">
        付款確認花的時間比預期久。若你已完成扣款，請稍後重新整理此頁；如果 10 分鐘後仍未開通，請來信{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
          {SUPPORT_EMAIL}
        </a>{' '}
        並附上訂單編號 {merchantTradeNo}，我們會盡快處理。
      </p>
    );
  }

  return (
    <p className="text-sm text-gray-600" role="status">
      正在向綠界確認付款結果，這個頁面每 3 秒會自動更新一次，請稍候…
    </p>
  );
}
