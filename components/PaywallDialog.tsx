'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { trackBeginCheckout, trackUpgradeCtaClicked } from '@/lib/analytics';
import { PRO_LIFETIME_PRICE_TWD } from '@/lib/payment/price';

export interface PaywallDialogProps {
  /** Whether the dialog is currently shown. */
  open: boolean;
  /** Called when the user dismisses the dialog (Escape, backdrop, ✕, 稍後再說). */
  onClose: () => void;
  /** Name of the file that was rejected, shown verbatim in the body copy. */
  fileName: string;
  /** File size in megabytes, already formatted to two decimals (e.g. "8.42"). */
  fileSizeMB: string;
  /** Destination of the buy button. Defaults to our own checkout page. */
  checkoutHref?: string;
}

/**
 * Upgrade prompt shown when a file is rejected for the free 5MB limit.
 *
 * The dialog appears at the exact moment the limit is hit.
 * Its buy button goes straight to our checkout page in the same tab.
 * Checkout needs the user's session, so the buyer stays in this tab.
 * The secondary link opens the full plan comparison on the homepage.
 *
 * A dialog interrupts the user. So the caller opens it by itself at most
 * once per browser session. After that it opens only on an explicit click.
 */
export default function PaywallDialog({
  open,
  onClose,
  fileName,
  fileSizeMB,
  checkoutHref = '/checkout',
}: PaywallDialogProps) {
  const primaryButtonRef = useRef<HTMLAnchorElement>(null);
  const priceLabel = `NT$${PRO_LIFETIME_PRICE_TWD}`;

  // Move keyboard focus onto the buy button as soon as the dialog appears so
  // keyboard and screen-reader users land inside the dialog rather than
  // staying on the page behind it.
  useEffect(() => {
    if (open) {
      primaryButtonRef.current?.focus();
    }
  }, [open]);

  // Escape closes the dialog, which is the behaviour every user expects from
  // a modal. The listener lives on the document rather than on the dialog
  // element so it works even if focus has moved outside the dialog.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      // Clicking the dimmed area outside the panel dismisses the dialog. The
      // target check keeps clicks that started inside the panel from bubbling
      // up and closing it by accident.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-dialog-headline"
        // On narrow screens the panel is a full-width sheet anchored to the
        // bottom of the viewport; from the small breakpoint upwards it becomes
        // a centred card. Both keep the panel within the viewport width so the
        // page never scrolls sideways.
        className="relative w-full sm:max-w-md bg-[#fffdf5] border border-amber-100 rounded-t-2xl sm:rounded-2xl shadow-lg p-6 sm:p-8 max-h-full overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h2
          id="paywall-dialog-headline"
          className="text-xl sm:text-2xl font-bold text-gray-900 pr-10 mb-3"
        >
          檔案超過免費版 5MB 上限
        </h2>

        <p className="text-sm text-gray-600 mb-6 break-words">
          「{fileName}」大小為 {fileSizeMB}MB。升級 Pro 終身版即可轉換最大 100MB 的檔案。
        </p>

        <ul className="text-left w-full space-y-3 mb-8 text-gray-600 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-gray-900 mt-0.5">•</span>
            單檔最大 100MB，批次轉換不受限
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-900 mt-0.5">•</span>
            自訂字典 10,000 組，固定人名與專有名詞譯法
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-900 mt-0.5">•</span>
            一次付費 {priceLabel}，永久使用，包含所有未來新功能
          </li>
        </ul>

        {/* Same-tab link to our checkout page. Checkout needs this tab's login session. */}
        <Link
          ref={primaryButtonRef}
          href={checkoutHref}
          onClick={() => trackBeginCheckout(PRO_LIFETIME_PRICE_TWD, 'lifetime')}
          className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          升級 Pro 終身版 {priceLabel} →
        </Link>

        <p className="mt-3 text-xs text-gray-500 text-center">購買後 14 天內不滿意可退款</p>

        <div className="mt-4 flex flex-col items-center gap-3">
          {/*
            Absolute path, not a bare "#pricing" fragment: the converter is
            embedded on several landing pages that have no pricing section of
            their own, where a fragment-only link would do nothing.
          */}
          <Link
            href="/#pricing"
            onClick={() => trackUpgradeCtaClicked('file_size_limit')}
            className="text-sm text-primary hover:text-primary-hover font-medium underline underline-offset-2"
          >
            查看完整方案比較
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            稍後再說
          </button>
        </div>
      </div>
    </div>
  );
}
