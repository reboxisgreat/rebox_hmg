'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ScoreEntry } from '@/lib/types'

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

const MEDAL_COLORS: Record<number, { bg: string; border: string; text: string; sub: string }> = {
  1: { bg: 'bg-[#FFFBEB]', border: 'border-[#F59E0B]', text: 'text-[#B45309]', sub: 'text-[#D97706]' },
  2: { bg: 'bg-[#F8FAFC]', border: 'border-[#94A3B8]', text: 'text-[#475569]', sub: 'text-[#64748B]' },
  3: { bg: 'bg-[#FFF7F0]', border: 'border-[#F97316]', text: 'text-[#C2410C]', sub: 'text-[#EA580C]' },
}

export default function RankingPage() {
  const router = useRouter()
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [myId, setMyId] = useState<string | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('participant_id')
    if (!id) { router.replace('/'); return }
    setMyId(id)

    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data: { scores: ScoreEntry[]; error?: string }) => {
        if (data.error) { setError(data.error); setLoading(false); return }
        setScores(data.scores)
        setLoading(false)
      })
      .catch(() => { setError('데이터를 불러오지 못했어요.'); setLoading(false) })
  }, [router])

  const top3 = scores.filter((s) => s.rank <= 3 && s.total_score > 0).slice(0, 3)
  const rest = scores.filter((s) => !top3.some((t) => t.participant_id === s.participant_id))
  const myEntry = scores.find((s) => s.participant_id === myId)
  const myRankInRest = rest.findIndex((s) => s.participant_id === myId)

  // 포디움 순서: 2위(왼) - 1위(중) - 3위(오)
  const podiumOrder = [
    top3.find((s) => s.rank === 2) ?? null,
    top3.find((s) => s.rank === 1) ?? null,
    top3.find((s) => s.rank === 3) ?? null,
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-[#F5F5F5]" style={{ height: '100dvh' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#8A8A8A]">랭킹을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center px-6 text-center bg-[#F5F5F5]" style={{ height: '100dvh' }}>
        <div>
          <p className="text-[#111111] font-medium mb-4">{error}</p>
          <button onClick={() => router.back()} className="text-sm text-[#111111] underline">돌아가기</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-[#111111]" style={{ minHeight: '100dvh' }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-white/60 active:text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-sm font-medium">이전</span>
          </button>
          <button
            onClick={() => router.push('/')}
            className="text-white/60 active:text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
        </div>

        <p className="text-xs font-bold text-white/40 tracking-[0.18em] uppercase mb-1">리더스러닝랩 xClass</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">실행력 랭킹 🏆</h1>
        <p className="text-sm text-white/50 mt-1">30일 체크리스트 완료 점수 기준</p>

        {/* 내 점수 배너 */}
        {myEntry && (
          <div className="mt-5 bg-white/10 rounded-2xl px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50 mb-0.5">나의 현재 순위</p>
              <p className="text-lg font-bold text-white">
                {MEDAL[myEntry.rank] ?? ''} {myEntry.rank}위
                <span className="text-sm font-normal text-white/50 ml-1.5">/ {scores.length}명</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/50 mb-0.5">총 점수</p>
              <p className="text-2xl font-bold text-white">{myEntry.total_score}<span className="text-sm font-normal text-white/50">점</span></p>
            </div>
          </div>
        )}

        {/* 점수 기준 칩 */}
        <div className="flex gap-2 mt-4">
          {[
            { label: '항목 완료', point: '+10' },
            { label: '주차 완주', point: '+20' },
            { label: '전체 완주', point: '+50' },
          ].map(({ label, point }) => (
            <div key={label} className="flex-1 bg-white/8 border border-white/10 rounded-xl px-2 py-1.5 text-center">
              <p className="text-xs font-bold text-white">{point}<span className="text-white/50">점</span></p>
              <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 bg-[#F5F5F5] rounded-t-3xl px-4 pt-6 pb-8">
        {scores.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-[#111111] font-medium">아직 데이터가 없어요</p>
            <p className="text-sm text-[#8A8A8A] mt-1">액션플랜을 확정하면 랭킹이 시작됩니다</p>
          </div>
        ) : (
          <>
            {/* 포디움 TOP 3 */}
            {top3.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold text-[#8A8A8A] tracking-[0.12em] uppercase mb-4">TOP 3</p>
                <div className="flex items-end justify-center gap-3">
                  {podiumOrder.map((entry, idx) => {
                    if (!entry) return <div key={idx} className="flex-1" />
                    const isMe = entry.participant_id === myId
                    const colors = MEDAL_COLORS[entry.rank] ?? MEDAL_COLORS[3]
                    const heights = ['h-28', 'h-36', 'h-24'] // 2위, 1위, 3위 높이
                    const pct = entry.total_items > 0
                      ? Math.round((entry.completed_items / entry.total_items) * 100)
                      : 0

                    return (
                      <div key={entry.participant_id} className="flex-1 flex flex-col items-center">
                        {/* 메달 + 이름 */}
                        <div className="text-center mb-2">
                          <p className="text-2xl mb-1">{MEDAL[entry.rank]}</p>
                          <p className={`text-xs font-bold ${isMe ? 'text-[#02855B]' : 'text-[#111111]'} truncate max-w-[80px]`}>
                            {entry.name}
                            {isMe && <span className="ml-1 text-[9px] bg-[#02855B] text-white px-1 py-0.5 rounded-full">나</span>}
                          </p>
                          <p className="text-[10px] text-[#8A8A8A] truncate max-w-[80px]">{entry.department}</p>
                        </div>

                        {/* 포디움 블록 */}
                        <div
                          className={`w-full ${heights[idx]} ${colors.bg} border-2 ${isMe ? 'border-[#02855B]' : colors.border} rounded-t-2xl flex flex-col items-center justify-center gap-1 transition-all`}
                        >
                          <p className={`text-lg font-bold ${isMe ? 'text-[#02855B]' : colors.text}`}>
                            {entry.total_score}
                            <span className="text-xs font-normal">점</span>
                          </p>
                          <p className={`text-[10px] font-medium ${isMe ? 'text-[#02855B]/70' : colors.sub}`}>
                            {pct}% 완료
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 나머지 순위 */}
            {rest.length > 0 && (
              <div>
                <p className="text-xs font-bold text-[#8A8A8A] tracking-[0.12em] uppercase mb-3">전체 순위</p>
                <div className="space-y-2">
                  {rest.map((entry, idx) => {
                    const isMe = entry.participant_id === myId
                    const pct = entry.total_items > 0
                      ? Math.round((entry.completed_items / entry.total_items) * 100)
                      : 0

                    return (
                      <div
                        key={entry.participant_id}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 ${
                          isMe
                            ? 'bg-white border-2 border-[#02855B]'
                            : 'bg-white border border-[#EBEBEB]'
                        }`}
                      >
                        {/* 순위 번호 */}
                        <div className="w-8 shrink-0 text-center">
                          <span className={`text-sm font-bold ${isMe ? 'text-[#02855B]' : 'text-[#8A8A8A]'}`}>
                            {entry.rank}
                          </span>
                        </div>

                        {/* 이름 / 진행률 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className={`text-sm font-semibold truncate ${isMe ? 'text-[#02855B]' : 'text-[#111111]'}`}>
                              {entry.name}
                            </p>
                            {isMe && (
                              <span className="text-[9px] bg-[#02855B] text-white px-1.5 py-0.5 rounded-full shrink-0">나</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-[#EBEBEB] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-[#16A34A]' : isMe ? 'bg-[#02855B]' : 'bg-[#D4D4D4]'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[#8A8A8A] shrink-0">{pct}%</span>
                          </div>
                        </div>

                        {/* 점수 */}
                        <div className="text-right shrink-0">
                          <p className={`text-base font-bold ${isMe ? 'text-[#02855B]' : 'text-[#111111]'}`}>
                            {entry.total_score}
                            <span className="text-xs font-normal text-[#8A8A8A]">점</span>
                          </p>
                          <p className="text-[10px] text-[#8A8A8A]">{entry.completed_items}/{entry.total_items}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 내가 top3이고 rest가 없을 때 하단 여백 */}
            {rest.length === 0 && myRankInRest === -1 && <div className="h-4" />}
          </>
        )}
      </div>
    </div>
  )
}
