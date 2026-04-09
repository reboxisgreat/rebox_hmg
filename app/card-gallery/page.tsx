'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronDown, ChevronUp, Heart } from 'lucide-react'

interface CardGalleryItem {
  id: string
  participant_id: string
  card_number: 1 | 2 | 3
  card_topic: string
  step1_keywords: string | null
  step2_asis: string | null
  step3_tobe: string | null
  step4_action: string | null
  step5_indicator: string | null
  is_confirmed: boolean
  like_count: number
  is_liked: boolean
  participants: { name: string; department: string | null } | null
}

const CARD_CONFIG: Record<1 | 2 | 3, { label: string; color: string; bg: string; border: string; leftBar: string }> = {
  1: { label: '고객가치 관리', color: '#DC2626', bg: '#FFF1F2', border: '#FECDD3', leftBar: '#EF4444' },
  2: { label: '사람관리',      color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', leftBar: '#F59E0B' },
  3: { label: '프로세스 관리', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', leftBar: '#22C55E' },
}

const FILTER_TABS: { key: 0 | 1 | 2 | 3; label: string }[] = [
  { key: 0, label: '전체' },
  { key: 1, label: '고객가치' },
  { key: 2, label: '사람관리' },
  { key: 3, label: '프로세스' },
]

function parseKeywords(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(/[\n,]+/)
    .map((k) => k.replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 3)
}

export default function CardGalleryPage() {
  const router = useRouter()
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [cards, setCards] = useState<CardGalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [likingId, setLikingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<0 | 1 | 2 | 3>(0)

  useEffect(() => {
    const id = localStorage.getItem('participant_id')
    if (!id) { router.replace('/'); return }
    setParticipantId(id)

    fetch(`/api/card-gallery?participantId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setCards(d.data ?? [])
      })
      .catch(() => setError('데이터를 불러오는 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  }, [router])

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id))

  const handleLike = async (e: React.MouseEvent, card: CardGalleryItem) => {
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
      await fetch('/api/card-gallery/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, cardResponseId: card.id }),
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

  const filtered = filter === 0 ? cards : cards.filter((c) => c.card_number === filter)

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
          <p className="text-[16px] font-bold text-[#111]">카드 갤러리</p>
          <p className="text-[11px] text-[#8A8A8A]">우리 차수 확정 카드</p>
        </div>
        {!loading && cards.length > 0 && (
          <span className="text-[12px] font-semibold text-[#8A8A8A]">{filtered.length}개</span>
        )}
      </div>

      {/* 필터 탭 */}
      <div className="bg-white border-b border-[#EBEBEB] px-4 py-2 flex gap-2">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
            style={
              filter === key
                ? {
                    backgroundColor:
                      key === 0 ? '#111' : key === 1 ? '#DC2626' : key === 2 ? '#D97706' : '#16A34A',
                    color: '#fff',
                  }
                : { backgroundColor: '#F5F5F5', color: '#8A8A8A' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="bg-white rounded-2xl overflow-hidden border border-[#EBEBEB]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F5F5F5] last:border-b-0">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-[#F0F0F0] rounded animate-pulse w-1/4" />
                  <div className="h-3 bg-[#F0F0F0] rounded animate-pulse w-2/4" />
                </div>
                <div className="w-10 h-5 bg-[#F0F0F0] rounded animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#8A8A8A] text-sm">아직 확정된 카드가 없습니다.</div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden border border-[#EBEBEB] shadow-sm">
            {filtered.map((card, idx) => {
              const cfg = CARD_CONFIG[card.card_number]
              const isOpen = openId === card.id
              const keywords = parseKeywords(card.step1_keywords)

              return (
                <div
                  key={card.id}
                  className={idx < filtered.length - 1 ? 'border-b border-[#F0F0F0]' : ''}
                  style={{ borderLeft: `4px solid ${cfg.leftBar}` }}
                >
                  {/* 아코디언 헤더 */}
                  <div className="flex items-center gap-3 px-4 py-3.5 active:bg-[#F9F9F9]">
                    {/* 이름+부서 (탭하면 펼침) */}
                    <button
                      onClick={() => toggle(card.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-[13px] font-bold text-[#111] leading-tight">
                        {card.participants?.name ?? '-'}
                      </p>
                      <p className="text-[11px] text-[#AAAAAA] leading-tight">
                        {card.participants?.department ?? ''}{card.participants?.department ? ' · ' : ''}{cfg.label}
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
                    <div className="px-4 pb-4 pt-1" style={{ backgroundColor: '#F9F9F9' }}>
                      <div
                        className="rounded-xl border p-3 space-y-3"
                        style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
                      >
                        {/* 카드 타이틀 */}
                        <p className="text-[12px] font-bold" style={{ color: cfg.color }}>{cfg.label}</p>

                        {/* 키워드 */}
                        {keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {keywords.map((kw, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-1 rounded-full text-[11px] font-semibold border"
                                style={{ borderColor: cfg.border, color: cfg.color, backgroundColor: '#fff' }}
                              >
                                #{kw}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 2×2 그리드 */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white rounded-lg p-2.5">
                            <p className="text-[10px] font-bold mb-1" style={{ color: cfg.color }}>As-is 현재수준</p>
                            <p className="text-[11px] text-[#333] leading-relaxed whitespace-pre-wrap">
                              {card.step2_asis ?? <span className="text-[#CCC] italic">미작성</span>}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5">
                            <p className="text-[10px] font-bold mb-1" style={{ color: cfg.color }}>To-be 지향점</p>
                            <p className="text-[11px] text-[#333] leading-relaxed whitespace-pre-wrap">
                              {card.step3_tobe ?? <span className="text-[#CCC] italic">미작성</span>}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5">
                            <p className="text-[10px] font-bold mb-1" style={{ color: cfg.color }}>구체적 액션</p>
                            <p className="text-[11px] text-[#333] leading-relaxed whitespace-pre-wrap">
                              {card.step4_action ?? <span className="text-[#CCC] italic">미작성</span>}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5">
                            <p className="text-[10px] font-bold mb-1" style={{ color: cfg.color }}>성공 지표</p>
                            <p className="text-[11px] text-[#333] leading-relaxed whitespace-pre-wrap">
                              {card.step5_indicator ?? <span className="text-[#CCC] italic">미작성</span>}
                            </p>
                          </div>
                        </div>
                      </div>
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
