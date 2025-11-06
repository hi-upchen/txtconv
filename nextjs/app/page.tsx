import FileUpload from '@/components/FileUpload';

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 text-gray-900">txtconv</h1>
          <p className="text-xl text-gray-600">簡體中文 → 繁體中文 轉換工具</p>
          <p className="text-sm text-gray-500 mt-2">支援 .txt 文字檔案，使用 OpenCC s2twp 轉換</p>
        </div>

        <FileUpload />

        <footer className="mt-16 text-center text-sm text-gray-500">
          <p>Powered by Next.js 14 + OpenCC + Vercel</p>
        </footer>
      </div>
    </main>
  );
}
