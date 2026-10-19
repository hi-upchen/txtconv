'use client';

import Link from 'next/link';
import { trackBeginCheckout } from '@/lib/analytics';
import { PRO_LIFETIME_PRICE_TWD } from '@/lib/payment/price';
import type { LicenseType } from '@/types/user';

interface PricingSectionProps {
  /** Our own checkout page. Defaults to /checkout. */
  checkoutHref?: string;
  licenseType?: LicenseType;
}

/**
 * Homepage pricing section with two plans: free and one-time lifetime.
 *
 * Lifetime is the only paid plan. So its card lists concrete benefits
 * instead of pointing at another plan.
 */
export default function PricingSection({
  checkoutHref = '/checkout',
  licenseType = 'free',
}: PricingSectionProps) {
  const isCurrent = (tier: LicenseType) => licenseType === tier;

  return (
    <section id="pricing" className="py-8 scroll-mt-8">
      <h3 className="text-3xl font-bold text-center text-gray-800 mb-12">方案價格</h3>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Free Tier */}
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center text-center shadow-sm border border-transparent">
          <div className="mb-4">
            <p className="text-2xl font-bold text-gray-900">Free</p>
            <p className="text-gray-500">免費版</p>
          </div>
          <div className="text-5xl font-bold text-gray-900 mb-8">$0</div>
          <ul className="text-left w-full space-y-4 mb-10 text-gray-600 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              基本轉換功能
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              5MB 檔案大小限制
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              自訂字典對照（5 組）
            </li>
          </ul>
          {isCurrent('free') ? (
            <button className="w-full py-3 px-4 bg-gray-100 text-gray-400 font-medium rounded-lg cursor-not-allowed" disabled>
              目前方案
            </button>
          ) : (
            <div className="w-full py-3 px-4" />
          )}
        </div>

        {/* Lifetime Tier */}
        <div className="bg-[#fffdf5] rounded-2xl p-8 flex flex-col items-center text-center shadow-lg border border-amber-100 relative">
          <div className="mb-4">
            <p className="text-2xl font-bold text-gray-900">Lifetime</p>
            <p className="text-gray-500">終身授權</p>
          </div>
          <div className="flex items-baseline gap-2 mb-8">
            <span className="text-5xl font-bold text-primary">{`NT$${PRO_LIFETIME_PRICE_TWD}`}</span>
            <span className="text-base font-normal text-gray-500">一次付費</span>
          </div>
          <ul className="text-left w-full space-y-4 mb-10 text-gray-600 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              單檔最大 100MB，批次轉換不受限
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              自訂字典對照 10,000 組
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              一次付費，永久使用
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              所有未來新功能
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              優先客戶支援
            </li>
          </ul>
          {isCurrent('lifetime') ? (
            <button className="w-full py-3 px-4 bg-gray-100 text-gray-400 font-medium rounded-lg cursor-not-allowed" disabled>
              目前方案
            </button>
          ) : (
            <Link
              href={checkoutHref}
              onClick={() => trackBeginCheckout(PRO_LIFETIME_PRICE_TWD, 'lifetime')}
              className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              立即購買 →
            </Link>
          )}
          <p className="mt-3 text-xs text-gray-500">購買後 14 天內不滿意可退款</p>
        </div>
      </div>
    </section>
  );
}
