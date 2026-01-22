import FileUpload from '@/components/FileUpload';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PricingSection from '@/components/PricingSection';
import { getAuthUser, getProfile } from '@/lib/actions/auth';

export default async function Home() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

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
          <div className="space-y-1 text-sm text-gray-500">
            <p>支援檔案格式為：</p>
            <p>.txt 純文字小說檔案</p>
            <p>.srt 電影字幕檔案</p>
            <p>.csv 資料格式</p>
            <p>.xml 資料格式</p>
          </div>
        </section>

        {/* File Upload Section */}
        <FileUpload />

        {/* Pricing Section */}
        <PricingSection
          gumroadUrl={process.env.NEXT_PUBLIC_GUMROAD_URL || 'https://gumroad.com'}
        />
      </main>

      <Footer />
    </>
  );
}
