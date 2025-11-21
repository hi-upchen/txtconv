import type { Metadata } from "next";
import { GoogleTagManager } from '@next/third-parties/google';
import 'bulma/css/bulma.min.css';
import 'animate.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import "./globals.css";

export const metadata: Metadata = {
  title: "txtconv - 簡繁轉換工具",
  description: "將簡體中文文字檔案轉換為繁體中文",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <GoogleTagManager gtmId="GTM-TWV35322" />
      <body>{children}</body>
    </html>
  );
}
