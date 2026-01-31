import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: '登入連結已失效 - txtconv',
};

export default function AuthCodeErrorPage() {
  return (
    <>
      <Header user={null} profile={null} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-24 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-red-400 text-4xl">link_off</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          登入連結已失效
        </h1>
        <p className="text-gray-500 max-w-md">
          此連結可能已過期或已被使用。<br />
          請返回首頁重新發送登入連結。
        </p>
        <Link
          href="/"
          className="mt-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
        >
          返回首頁
        </Link>
      </main>

      <Footer />
    </>
  );
}
