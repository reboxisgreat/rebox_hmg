'use client'

import { useState, useEffect } from 'react'
import type { ScoreEntry } from '@/lib/types'

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function Leaderboard({
  myParticipantId,
  onClose,
}: {
  myParticipantId: string
  onClose: () => void
}) {
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data: { scores: ScoreEntry[]; error?: string }) => {
        if (data.error) { setError(data.error); setLoading(false); return }
        setScores(data.scores)
        setLoading(false)
      })
      .catch(() => { setError('불러오기 실패'); setLoading(false) })
  }, [])

  return (
    <>
      {/* 딤 배경 */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* 바텀 시트 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[80dvh] flex flex-col">
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-[#D4D4D4] rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="px-5 pt-2 pb-4 border-b border-[#EBEBEB] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#111111]">실행력 랭킹 🏆</h2>
              <p className="text-xs text-[#8A8A8A] mt-0.5">30일 체크리스트 완료 점수 기준</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#F5F5F5] flex items-center justify-center text-[#8A8A8A] active:bg-[#EBEBEB]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* 점수 기준 안내 */}
          <div className="flex gap-3 mt-3">
            {[
              { label: '항목 완료', point: '+10점' },
              { label: '주차 완주', point: '+20점' },
              { label: '전체 완주', point: '+50점' },
            ].map(({ label, point }) => (
              <div key={label} className="flex-1 bg-[#F5F5F5] rounded-xl px-2 py-1.5 text-center">
                <p className="text-xs font-bold text-[#111111]">{point}</p>
                <p className="text-xs text-[#8A8A8A] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 순위 목록 */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-center text-sm text-red-500 py-8">{error}</p>
          ) : scores.length === 0 ? (
            <p className="text-center text-sm text-[#8A8A8A] py-8">아직 참가자 데이터가 없어요</p>
          ) : (
            scores.map((entry) => {
              const isMe = entry.participant_id === myParticipantId
              return (
                <div
                  key={entry.participant_id}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${
                    isMe
                      ? 'bg-[#F5F5F5] border-2 border-[#111111]'
                      : 'bg-[#F5F5F5] border border-[#EBEBEB]'
                  }`}
                >
                  {/* 순위 */}
                  <div className="w-8 shrink-0 text-center">
                    {MEDAL[entry.rank] ? (
                      <span className="text-xl">{MEDAL[entry.rank]}</span>
                    ) : (
                      <span className="text-sm font-bold text-[#8A8A8A]">{entry.rank}</span>
                    )}
                  </div>

                  {/* 이름/소속 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-semibold truncate ${isMe ? 'text-[#111111]' : 'text-[#3A3A3A]'}`}>
                        {entry.name}
                      </p>
                      {isMe && (
                        <span className="text-xs bg-[#111111] text-white px-1.5 py-0.5 rounded-full shrink-0">나</span>
                      )}
                    </div>
                    <p className="text-xs text-[#8A8A8A] truncate">{entry.department}</p>
                  </div>

                  {/* 점수 + 진행률 */}
                  <div className="text-right shrink-0">
                    <p className={`text-base font-bold ${isMe ? 'text-[#111111]' : 'text-[#3A3A3A]'}`}>
                      {entry.total_score}<span className="text-xs font-normal text-[#8A8A8A]">점</span>
                    </p>
                    <p className="text-xs text-[#8A8A8A]">
                      {entry.completed_items}/{entry.total_items}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div className="h-3" />
        </div>
      </div>
    </>
  )
}
