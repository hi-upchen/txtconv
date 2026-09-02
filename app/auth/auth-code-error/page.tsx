import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AuthCodeErrorLogin from '@/components/AuthCodeErrorLogin';

export const metadata = {
  title: '登入連結已失效 - txtconv',
};

export default function AuthCodeErrorPage() {
  return (
    <>
      <Header user={null} profile={null} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-16 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-red-400 text-4xl">link_off</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          登入連結已失效
        </h1>
        <p className="text-gray-500 max-w-md">
          此連結可能已過期、已被使用，或是在另一個瀏覽器（例如郵件 App 內建的瀏覽器）開啟。<br />
          改用驗證碼登入最可靠：驗證碼在哪個頁面輸入都可以。
        </p>

        <AuthCodeErrorLogin />

        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-primary transition-colors"
        >
          返回首頁
        </Link>
      </main>

      <Footer />
    </>
  );
}
