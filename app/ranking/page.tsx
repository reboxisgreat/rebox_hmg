'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ScoreEntry } from '@/lib/types'

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

const PODIUM_STYLE: Record<number, { bg: string; border: string; score: string; sub: string; height: string }> = {
  1: { bg: 'bg-[#FFFBEB]', border: 'border-[#F59E0B]', score: 'text-[#B45309]', sub: 'text-[#D97706]', height: 'h-36' },
  2: { bg: 'bg-[#F8FAFC]', border: 'border-[#94A3B8]', score: 'text-[#475569]', sub: 'text-[#64748B]', height: 'h-28' },
  3: { bg: 'bg-[#FFF7F0]', border: 'border-[#FDBA74]', score: 'text-[#C2410C]', sub: 'text-[#EA580C]', height: 'h-24' },
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

  // 포디움 순서: 2위(왼) - 1위(중) - 3위(오)
  const podiumOrder = [
    top3.find((s) => s.rank === 2) ?? null,
    top3.find((s) => s.rank === 1) ?? null,
    top3.find((s) => s.rank === 3) ?? null,
  ]

  const scoreGuide = [
    { label: '항목 완료', point: '+10', amber: false },
    { label: '주차 완주', point: '+20', amber: false },
    { label: '전체 완주', point: '+50', amber: false },
    { label: '주차 인증샷', point: '+50', amber: true },
    { label: '과제 인증샷', point: '+50', amber: true },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-[#F0F4F8]" style={{ height: '100dvh' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#8A8A8A]">랭킹을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center px-6 text-center bg-[#F0F4F8]" style={{ height: '100dvh' }}>
        <div>
          <p className="text-[#111111] font-medium mb-4">{error}</p>
          <button onClick={() => router.back()} className="text-sm text-[#111111] underline">돌아가기</button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col overflow-hidden" style={{ minHeight: '100dvh', background: '#F0F4F8' }}>

      {/* 홈과 동일한 애니메이션 배경 */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="animate-float1 absolute rounded-full" style={{ width: '80vw', height: '80vw', top: '-20vw', left: '-20vw', background: 'rgba(2, 133, 91, 0.25)', filter: 'blur(40px)' }} />
        <div className="animate-float2 absolute rounded-full" style={{ width: '70vw', height: '70vw', bottom: '-15vw', right: '-15vw', background: 'rgba(37, 99, 235, 0.20)', filter: 'blur(45px)' }} />
        <div className="animate-float3 absolute rounded-full" style={{ width: '60vw', height: '60vw', top: '28%', left: '15%', background: 'rgba(234, 179, 8, 0.22)', filter: 'blur(38px)' }} />
      </div>

      {/* 헤더 */}
      <div className="relative z-10 px-4 pt-12 pb-2">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-[#8A8A8A] active:text-[#111111] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-sm font-medium">이전</span>
          </button>
          <button
            onClick={() => router.push('/')}
            className="text-[#8A8A8A] active:text-[#111111] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
        </div>

        <p className="text-[11px] font-bold tracking-[0.15em] uppercase mb-1">리더스러닝랩 xClass 조직관리 과정</p>
        <h1 className="text-[1.75rem] font-bold text-[#111111] tracking-tight leading-tight">실행력 랭킹 🏆</h1>
        <p className="text-sm mt-1">30일 체크리스트 완료 점수 기준<br/>전체 교육생 대상(1,2,3차수)</p>

        {/* 내 점수 배너 — 홈의 랭킹 칩 스타일 */}
        {myEntry && (
          <div
            className="mt-4 rounded-2xl shadow-md flex items-center justify-between px-4 py-3.5"
            style={{ background: 'linear-gradient(135deg, #FEF9C3 0%, #FEF3C7 100%)' }}
          >
            <div>
              <p className="text-[10px] font-bold text-[#CA8A04] tracking-wider mb-0.5">나의 현재 순위</p>
              <p className="text-xl font-bold text-[#92400E] leading-none">
                {MEDAL[myEntry.rank] ?? ''} {myEntry.rank}위
                <span className="text-sm font-normal text-[#A16207] ml-1.5">/ {scores.length}명</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#A16207] mb-0.5">총 점수</p>
              <p className="text-2xl font-bold text-[#92400E]">{myEntry.total_score}<span className="text-sm font-normal text-[#B45309]">점</span></p>
            </div>
          </div>
        )}

        {/* 점수 기준 칩 */}
        <div className="grid grid-cols-5 gap-1.5 mt-3">
          {scoreGuide.map(({ label, point, amber }) => (
            <div key={label} className={`flex flex-col items-center py-1.5 rounded-lg ${amber ? 'bg-[#FFFBEB]' : 'bg-white/70 backdrop-blur-sm border border-white/80'}`}>
              <span className={`text-[9px] ${amber ? 'text-[#D97706]' : 'text-[#8A8A8A]'}`}>{label}</span>
              <span className={`text-[11px] font-bold ${amber ? 'text-[#D97706]' : 'text-[#111111]'}`}>{point}점</span>
            </div>
          ))}
        </div>
        <div className="mt-2 px-3 py-2.5 bg-[#FFF1F2] border border-[#FECDD3] rounded-xl text-center">
          <p className="text-xs text-[#DC2626] font-medium leading-relaxed">
            🎁 열심히 참여해주시는 분들에게는 보너스 점수 드립니다! <br />인증샷으로 솜씨를 뽐내주세요.
          </p>
        </div>
      </div>

      {/* 본문 */}
      <div className="relative z-10 flex-1 px-4 pt-5 pb-10">
        {scores.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🌱</p>
            <p className="text-[#111111] font-bold text-lg">아직 데이터가 없어요</p>
            <p className="text-sm text-[#8A8A8A] mt-1">액션플랜을 확정하면 랭킹이 시작됩니다</p>
          </div>
        ) : (
          <>
            {/* TOP 3 포디움 */}
            {top3.length > 0 && (
              <div className="mb-6">
                <p className="text-[11px] font-bold text-[#8A8A8A] tracking-[0.15em] uppercase mb-4">TOP 3</p>
                <div className="flex items-end justify-center gap-3">
                  {podiumOrder.map((entry, idx) => {
                    if (!entry) return <div key={idx} className="flex-1" />
                    const isMe = entry.participant_id === myId
                    const style = PODIUM_STYLE[entry.rank] ?? PODIUM_STYLE[3]
                    const pct = entry.total_items > 0
                      ? Math.round((entry.completed_items / entry.total_items) * 100)
                      : 0

                    return (
                      <div key={entry.participant_id} className="flex-1 flex flex-col items-center">
                        <div className="text-center mb-2">
                          <p className="text-3xl mb-1">{MEDAL[entry.rank]}</p>
                          <p className={`text-xs font-bold truncate max-w-[80px] ${isMe ? 'text-[#02855B]' : 'text-[#111111]'}`}>
                            {entry.name}
                            {isMe && <span className="ml-1 text-[9px] bg-[#02855B] text-white px-1 py-0.5 rounded-full">나</span>}
                          </p>
                          <p className="text-[10px] text-[#8A8A8A] truncate max-w-[80px]">{entry.department}</p>
                        </div>

                        <div
                          className={`w-full ${style.height} ${isMe ? 'bg-[#F0FDF4]' : style.bg} border-2 ${isMe ? 'border-[#02855B]' : style.border} rounded-t-2xl flex flex-col items-center justify-center gap-1 shadow-sm`}
                        >
                          <p className={`text-lg font-bold ${isMe ? 'text-[#02855B]' : style.score}`}>
                            {entry.total_score}<span className="text-xs font-normal">점</span>
                          </p>
                          <p className={`text-[10px] font-medium ${isMe ? 'text-[#02855B]/70' : style.sub}`}>
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
                <p className="text-[11px] font-bold text-[#8A8A8A] tracking-[0.15em] uppercase mb-3">전체 순위</p>
                <div className="space-y-2">
                  {rest.map((entry) => {
                    const isMe = entry.participant_id === myId
                    const pct = entry.total_items > 0
                      ? Math.round((entry.completed_items / entry.total_items) * 100)
                      : 0

                    return (
                      <div
                        key={entry.participant_id}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-sm ${
                          isMe ? 'bg-white border-2 border-[#02855B]' : 'bg-white/80 border border-white'
                        }`}
                      >
                        <div className="w-8 shrink-0 text-center">
                          <span className={`text-sm font-bold ${isMe ? 'text-[#02855B]' : 'text-[#8A8A8A]'}`}>
                            {entry.rank}
                          </span>
                        </div>

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
                            <div className="flex-1 h-1.5 bg-[#EBEBEB] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-[#16A34A]' : isMe ? 'bg-[#02855B]' : 'bg-[#D4D4D4]'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[#8A8A8A] shrink-0">{pct}%</span>
                            <span className="text-[10px] text-[#D4D4D4] shrink-0">{entry.completed_items}/{entry.total_items}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className={`text-base font-bold ${isMe ? 'text-[#02855B]' : 'text-[#111111]'}`}>
                            {entry.total_score}<span className="text-xs font-normal text-[#8A8A8A]">점</span>
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
