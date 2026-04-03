'use client'

import Image from 'next/image'
import { Lock } from 'lucide-react'

export default function ClosedPage() {
  const endDate = process.env.NEXT_PUBLIC_EDUCATION_END_DATE
  const formatted = endDate
    ? new Date(endDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col">
      {/* 헤더 */}
      <header className="bg-[#1A1A1A] px-5 py-4 flex items-center justify-center">
        <span className="text-white text-sm font-bold tracking-[0.15em]">HMG XCLASS</span>
      </header>

      {/* 본문 */}
      <main className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="bg-white rounded-3xl shadow-sm w-full max-w-sm px-8 py-10 flex flex-col items-center text-center gap-6">
          {/* 아이콘 */}
          <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center">
            <Lock size={28} color="#6B7280" strokeWidth={1.5} />
          </div>

          {/* 제목 */}
          <div className="flex flex-col gap-2">
            <h1 className="text-[1.25rem] font-bold text-[#111] leading-snug">
              교육 과정이 종료되었습니다
            </h1>
            {formatted && (
              <p className="text-sm text-[#6B7280]">
                {formatted}부로 과정이 마감되었습니다.
              </p>
            )}
          </div>

          {/* 안내 */}
          <p className="text-sm text-[#9CA3AF] leading-relaxed">
            본 플랫폼은 교육 기간 중에만 이용 가능합니다.<br />
            문의사항은 담당자에게 연락해 주세요.
          </p>

          {/* 브랜딩 */}
          <div className="pt-2 border-t border-[#F3F4F6] w-full flex justify-center">
            <span className="text-xs text-[#C4C4C4] tracking-wider font-medium">re:BOX Consulting</span>
          </div>
        </div>
      </main>
    </div>
  )
}
