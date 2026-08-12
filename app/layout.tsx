import type { Metadata } from "next";
import { GoogleTagManager } from '@next/third-parties/google';
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://txtconv.arpuli.com"),
  // Homepage title/description target the broad-head queries 簡轉繁 and
  // 簡體轉繁體: both keywords lead, the free/no-upload promise differentiates,
  // and the brand name sits at the tail (CTR experiment, read out 2026-09-14).
  title: {
    default: "簡轉繁線上工具｜免費簡體轉繁體，檔案不上傳、瀏覽器內完成｜txtconv",
    template: "%s | txtconv 簡轉繁工具",
  },
  description:
    "簡轉繁免費線上工具：簡體轉繁體一鍵完成，檔案不上傳、全程在瀏覽器轉換。支援 txt 小說、srt 字幕（剪映/CapCut）、epub 電子書、csv，自動偵測 GBK/Big5 編碼。",
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
    title: "簡轉繁線上工具｜免費簡體轉繁體，檔案不上傳、瀏覽器內完成｜txtconv",
    description:
      "簡轉繁免費線上工具：簡體轉繁體一鍵完成，檔案不上傳、全程在瀏覽器轉換。支援 txt 小說、srt 字幕（剪映/CapCut）、epub 電子書、csv，自動偵測 GBK/Big5 編碼。",
    locale: "zh_TW",
  },
  twitter: {
    card: "summary_large_image",
    title: "簡轉繁線上工具｜免費簡體轉繁體，檔案不上傳｜txtconv",
    description:
      "簡轉繁免費線上工具：簡體轉繁體一鍵完成，檔案不上傳、全程在瀏覽器轉換。支援 txt 小說、srt 字幕（剪映/CapCut）、epub 電子書、csv，自動偵測 GBK/Big5 編碼。",
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
