'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { trackBeginCheckout, trackUpgradeCtaClicked } from '@/lib/analytics';

export interface PaywallDialogProps {
  /** Whether the dialog is currently shown. */
  open: boolean;
  /** Called when the user dismisses the dialog (Escape, backdrop, ✕, 稍後再說). */
  onClose: () => void;
  /** Name of the file that was rejected, shown verbatim in the body copy. */
  fileName: string;
  /** File size in megabytes, already formatted to two decimals (e.g. "8.42"). */
  fileSizeMB: string;
  /** Destination of the buy button; the configured Gumroad product page. */
  gumroadUrl: string;
}

/**
 * Upgrade prompt shown the moment a file is rejected for exceeding the free
 * tier's 5MB limit.
 *
 * Why it exists: previously a rejected file only produced a small inline
 * "upgrade" link inside the error row. Measured behaviour showed almost
 * nobody followed it, and on the landing pages that embed the converter the
 * link pointed at a "#pricing" anchor that does not exist outside the
 * homepage, so it did nothing at all. Presenting the offer as a dialog at
 * the exact moment the limit is hit removes both problems: the offer is
 * impossible to miss, and the buy button leaves for the payment page
 * directly instead of relying on same-page navigation.
 *
 * Trade-off: a dialog interrupts the user, which is intrusive if it appears
 * repeatedly. The caller therefore auto-opens it at most once per browser
 * session and otherwise only on an explicit click, so a user who declines
 * the offer is never interrupted again during that visit.
 */
export default function PaywallDialog({
  open,
  onClose,
  fileName,
  fileSizeMB,
  gumroadUrl,
}: PaywallDialogProps) {
  const primaryButtonRef = useRef<HTMLAnchorElement>(null);

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
            一次付費 US$30，永久使用，包含所有未來新功能
          </li>
        </ul>

        <a
          ref={primaryButtonRef}
          href={gumroadUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackBeginCheckout(30, 'lifetime')}
          className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          升級 Pro 終身版 US$30 →
        </a>

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
