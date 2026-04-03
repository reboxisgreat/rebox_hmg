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
      <body className="min-h-full flex flex-col sm:bg-[#D6D8DB]">
        <div className="w-full max-w-[430px] mx-auto flex-1 flex flex-col sm:shadow-2xl sm:shadow-black/20">
          {children}
        </div>
      </body>
    </html>
  );
}
