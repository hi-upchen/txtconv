import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
