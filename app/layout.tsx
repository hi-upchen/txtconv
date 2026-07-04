import type { Metadata } from "next";
import { GoogleTagManager } from '@next/third-parties/google';
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://txtconv.arpuli.com"),
  title: {
    default: "txtconv - 簡轉繁線上工具｜字幕、小說 TXT 簡體轉繁體",
    template: "%s | txtconv 簡轉繁工具",
  },
  description:
    "免費線上簡轉繁工具：上傳 .txt 小說、.srt 字幕（剪映/CapCut）、.csv、.xml 檔案，一鍵將簡體中文轉換成台灣繁體中文。自動偵測 GBK/Big5 編碼、支援批次轉換與自訂字典，轉換在瀏覽器完成、速度快。",
  keywords: [
    "簡轉繁",
    "簡體轉繁體",
    "簡繁轉換",
    "txt 簡轉繁",
    "srt 字幕簡轉繁",
    "剪映字幕轉繁體",
    "CapCut 字幕簡轉繁",
    "小說簡轉繁",
    "簡體亂碼轉換",
    "ConvertZ 線上版",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://txtconv.arpuli.com",
    siteName: "txtconv",
    title: "txtconv - 簡轉繁線上工具｜字幕、小說 TXT 簡體轉繁體",
    description:
      "免費線上將 .txt 小說、.srt 字幕、.csv、.xml 從簡體轉成繁體中文。自動偵測編碼、批次轉換、自訂字典。",
    locale: "zh_TW",
  },
  twitter: {
    card: "summary_large_image",
    title: "txtconv - 簡轉繁線上工具",
    description:
      "免費線上將 .txt 小說、.srt 字幕、.csv、.xml 從簡體轉成繁體中文。自動偵測編碼、批次轉換、自訂字典。",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "kzkU9s6p6MuO60DdvtHqc57bVLIhw-LnjFvKMURJRJs",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <GoogleTagManager gtmId="GTM-5C6MXCL4" />
      <body className="font-sans text-slate-700 antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
