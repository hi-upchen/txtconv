'use client';

import type { LicenseType } from '@/types/user';

interface PricingSectionProps {
  gumroadUrl?: string;
  licenseType?: LicenseType;
}

export default function PricingSection({
  gumroadUrl = 'https://gumroad.com/l/YOUR_PRODUCT_ID',
  licenseType = 'free'
}: PricingSectionProps) {
  const isCurrent = (tier: LicenseType) => licenseType === tier;

  return (
    <section className="py-8">
      <h3 className="text-3xl font-bold text-center text-gray-800 mb-12">方案價格</h3>

      <div className="grid md:grid-cols-3 gap-6">
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
          </ul>
          {isCurrent('free') ? (
            <button className="w-full py-3 px-4 bg-gray-100 text-gray-400 font-medium rounded-lg cursor-not-allowed" disabled>
              目前方案
            </button>
          ) : (
            <div className="w-full py-3 px-4" />
          )}
        </div>

        {/* Monthly Tier */}
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center text-center shadow-sm border border-transparent">
          <div className="mb-4">
            <p className="text-2xl font-bold text-gray-900">Monthly</p>
            <p className="text-gray-500">月訂閱</p>
          </div>
          <div className="text-4xl font-bold text-gray-900 mb-8">
            $3<span className="text-base font-normal text-gray-500"> USD/月</span>
          </div>
          <ul className="text-left w-full space-y-4 mb-10 text-gray-600 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              Free 方案所有功能
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              100MB 檔案大小限制
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              優先處理佇列
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              自訂字典對照 <span className="text-xs text-gray-400">(coming soon)</span>
            </li>
          </ul>
          {isCurrent('monthly') ? (
            <button className="w-full py-3 px-4 bg-gray-100 text-gray-400 font-medium rounded-lg cursor-not-allowed" disabled>
              目前方案
            </button>
          ) : (
            <button className="w-full py-3 px-4 bg-gray-100 text-gray-400 font-medium rounded-lg cursor-not-allowed" disabled>
              即將推出
            </button>
          )}
        </div>

        {/* Lifetime Tier */}
        <div className="bg-[#fffdf5] rounded-2xl p-8 flex flex-col items-center text-center shadow-lg border border-amber-100 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-rose-400 text-white text-[10px] font-bold rounded uppercase tracking-wider">
            早鳥限定
          </div>
          <div className="mb-4">
            <p className="text-2xl font-bold text-gray-900">Lifetime</p>
            <p className="text-gray-500">終身授權</p>
          </div>
          <div className="flex items-center gap-3 mb-8">
            <span className="text-2xl text-gray-400 line-through font-bold">$30</span>
            <span className="text-5xl font-bold text-primary">$15</span>
            <span className="text-base font-normal text-gray-500">USD</span>
          </div>
          <ul className="text-left w-full space-y-4 mb-10 text-gray-600 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-gray-900 mt-0.5">•</span>
              Monthly 方案所有功能
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
            <a
              href={gumroadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              立即購買 →
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
