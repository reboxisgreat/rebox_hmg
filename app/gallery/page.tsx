'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronDown, ChevronUp, Heart } from 'lucide-react'
import type { MasterPlanCard } from '@/lib/types'

interface GalleryCard extends MasterPlanCard {
  like_count: number
  is_liked: boolean
}

const AREAS = [
  { whatKey: 'customer_what' as const, whyKey: 'customer_why' as const, label: '고객가치', color: '#DC2626', bg: '#FFF1F2', border: '#FECDD3' },
  { whatKey: 'process_what' as const, whyKey: 'process_why' as const, label: '프로세스', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { whatKey: 'people_what' as const, whyKey: 'people_why' as const, label: '사람', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
]

export default function GalleryPage() {
  const router = useRouter()
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [cards, setCards] = useState<GalleryCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [likingId, setLikingId] = useState<string | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('participant_id')
    if (!id) { router.replace('/'); return }
    setParticipantId(id)

    fetch(`/api/gallery?participantId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setCards(d.data ?? [])
      })
      .catch(() => setError('데이터를 불러오는 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  }, [router])

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id))

  const handleLike = async (e: React.MouseEvent, card: GalleryCard) => {
    e.stopPropagation()
    if (!participantId || likingId) return
    setLikingId(card.id)

    // 낙관적 업데이트
    setCards((prev) =>
      prev
        .map((c) =>
          c.id === card.id
            ? { ...c, is_liked: !c.is_liked, like_count: c.is_liked ? c.like_count - 1 : c.like_count + 1 }
            : c
        )
        .sort((a, b) => b.like_count - a.like_count)
    )

    try {
      await fetch('/api/gallery/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, masterPlanId: card.id }),
      })
    } catch {
      // 실패 시 롤백
      setCards((prev) =>
        prev
          .map((c) =>
            c.id === card.id
              ? { ...c, is_liked: card.is_liked, like_count: card.like_count }
              : c
          )
          .sort((a, b) => b.like_count - a.like_count)
      )
    } finally {
      setLikingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* 상단 바 */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#EBEBEB] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#F5F5F5]"
        >
          <ChevronLeft size={20} color="#111" />
        </button>
        <div className="flex-1">
          <p className="text-[16px] font-bold text-[#111]">마스터플랜 갤러리</p>
          <p className="text-[11px] text-[#8A8A8A]">우리 차수 확정 마스터플랜</p>
        </div>
        {!loading && cards.length > 0 && (
          <span className="text-[12px] font-semibold text-[#8A8A8A]">{cards.length}명</span>
        )}
      </div>

      {/* 콘텐츠 */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="bg-white rounded-2xl overflow-hidden border border-[#EBEBEB]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F5F5F5] last:border-b-0">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-[#F0F0F0] rounded animate-pulse w-1/4" />
                  <div className="h-3 bg-[#F0F0F0] rounded animate-pulse w-3/4" />
                </div>
                <div className="w-10 h-5 bg-[#F0F0F0] rounded animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
        ) : cards.length === 0 ? (
          <div className="text-center py-16 text-[#8A8A8A] text-sm">아직 확정된 마스터플랜이 없습니다.</div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden border border-[#EBEBEB] shadow-sm">
            {cards.map((card, idx) => {
              const isOpen = openId === card.id
              return (
                <div key={card.id} className={idx < cards.length - 1 ? 'border-b border-[#F0F0F0]' : ''}>
                  {/* 아코디언 헤더 */}
                  <div className="flex items-center gap-3 px-4 py-3.5 active:bg-[#F9F9F9]">
                    {/* 이름+슬로건 영역 (탭하면 펼침) */}
                    <button
                      onClick={() => toggle(card.id)}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left"
                    >
                      <div className="shrink-0">
                        <p className="text-[13px] font-bold text-[#111] leading-tight">{card.participants?.name ?? '-'}</p>
                        <p className="text-[10px] text-[#AAAAAA] leading-tight">{card.participants?.department ?? ''}</p>
                      </div>
                      <p className="flex-1 min-w-0 text-[12px] text-[#555] truncate">
                        {card.slogan ?? <span className="text-[#CCCCCC] italic">슬로건 미작성</span>}
                      </p>
                    </button>

                    {/* 좋아요 버튼 */}
                    <button
                      onClick={(e) => handleLike(e, card)}
                      disabled={likingId === card.id}
                      className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-full active:scale-90 transition-transform"
                      style={{ backgroundColor: card.is_liked ? '#FFF1F2' : '#F5F5F5' }}
                    >
                      <Heart
                        size={14}
                        color={card.is_liked ? '#EF4444' : '#CCCCCC'}
                        fill={card.is_liked ? '#EF4444' : 'none'}
                      />
                      {card.like_count > 0 && (
                        <span className="text-[11px] font-bold" style={{ color: card.is_liked ? '#EF4444' : '#AAAAAA' }}>
                          {card.like_count}
                        </span>
                      )}
                    </button>

                    {/* 펼침 화살표 */}
                    <button onClick={() => toggle(card.id)} className="shrink-0">
                      {isOpen ? <ChevronUp size={16} color="#AAAAAA" /> : <ChevronDown size={16} color="#AAAAAA" />}
                    </button>
                  </div>

                  {/* 펼쳐진 내용 */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 space-y-2" style={{ backgroundColor: '#F9F9F9' }}>
                      <div className="bg-[#111] rounded-xl px-4 py-3 mb-3">
                        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">슬로건</p>
                        <p className="text-[14px] font-bold text-white leading-snug">
                          {card.slogan ?? <span className="text-white/30 italic font-normal">미작성</span>}
                        </p>
                      </div>
                      {AREAS.map(({ whatKey, whyKey, label, color, bg, border }) => (
                        <div key={whatKey} className="rounded-xl border p-3" style={{ backgroundColor: bg, borderColor: border }}>
                          <p className="text-[11px] font-bold mb-2" style={{ color }}>{label}</p>
                          <div className="space-y-1.5">
                            <div>
                              <p className="text-[10px] font-semibold text-[#8A8A8A] mb-0.5">What</p>
                              <p className="text-[12px] text-[#1A1A1A] leading-relaxed">
                                {card[whatKey] ?? <span className="text-[#CCCCCC] italic">미작성</span>}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-[#8A8A8A] mb-0.5">Why</p>
                              <p className="text-[12px] text-[#3A3A3A] leading-relaxed">
                                {card[whyKey] ?? <span className="text-[#CCCCCC] italic">미작성</span>}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
