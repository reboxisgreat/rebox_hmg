import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HMG xClass 조직관리 교육",
  description: "현대자동차그룹 리더 조직관리 역량 개발 플랫폼",
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
