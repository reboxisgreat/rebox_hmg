import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "리더스러닝랩 xClass 조직관리 과정",
  description: "현대자동차그룹 실장급 리더 조직관리 역량 개발 과정",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
