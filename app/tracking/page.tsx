'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { TrackingLog, MyScore } from '@/lib/types'
import confetti from 'canvas-confetti'

type Status = '미착수' | '진행중' | '완료'

interface WeekGroup {
  week: 1 | 2 | 3 | 4
  theme: string
  items: TrackingLog[]
}

const STATUS_CONFIG: Record<Status, { label: string; bg: string; text: string; activeBg: string; activeText: string }> = {
  '미착수': { label: '미착수', bg: 'bg-[#F3F4F6]', text: 'text-[#8A8A8A]', activeBg: 'bg-[#F3F4F6]', activeText: 'text-[#3A3A3A]' },
  '진행중': { label: '진행중', bg: 'bg-[#F3F4F6]', text: 'text-[#8A8A8A]', activeBg: 'bg-[#DBEAFE]', activeText: 'text-[#2563EB]' },
  '완료':   { label: '완료',   bg: 'bg-[#F3F4F6]', text: 'text-[#8A8A8A]', activeBg: 'bg-[#DCFCE7]', activeText: 'text-[#16A34A]' },
}

const STATUSES: Status[] = ['미착수', '진행중', '완료']

const IN_PROGRESS_MESSAGES = [
  '잘 하고 있어요! 이 기세 유지해요 💪',
  '좋아요! 한 걸음씩 나아가는 중이에요',
  '파이팅! 실행하는 리더가 최고예요',
  '움직이고 있어요. 계속 달려가세요!',
]

const DONE_MESSAGES = [
  '해냈습니다! 정말 멋져요 🎉',
  '브라보! 실행력이 대단해요 🏆',
  '최고예요! 리더십이 빛납니다 ✨',
  '와우! 또 하나의 승리입니다 🌟',
  '완벽해요! 이런 리더가 조직을 바꿉니다',
]

function pick(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function groupByWeek(logs: TrackingLog[], weekThemes: Record<number, string>): WeekGroup[] {
  const map = new Map<number, TrackingLog[]>()
  for (const log of logs) {
    if (!map.has(log.week_number)) map.set(log.week_number, [])
    map.get(log.week_number)!.push(log)
  }
  return ([1, 2, 3, 4] as const)
    .filter((w) => map.has(w))
    .map((w) => ({
      week: w,
      theme: weekThemes[w] ?? '',
      items: (map.get(w) ?? []).sort((a, b) => a.item_index - b.item_index),
    }))
}

// ─── 토스트 컴포넌트 ──────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-8 left-1/2 z-50 animate-[toastPop_0.45s_cubic-bezier(0.34,1.56,0.64,1)_both]"
      style={{ transform: 'translateX(-50%)' }}
    >
      <div className="px-7 py-4 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.28)] text-base font-bold whitespace-nowrap bg-[#111111] text-white">
        {message}
      </div>
    </div>
  )
}

// ─── 과제 항목 컴포넌트 ──────────────────────────────────────────────────────

function HomeworkItem({
  item,
  onStatusChange,
}: {
  item: TrackingLog
  onStatusChange: (logId: string, status: Status) => void
}) {
  const isDone = item.status === '완료'
  return (
    <div className={`rounded-2xl border px-4 py-3 transition-colors ${isDone ? 'bg-[#FFFBEB] border-[#FDE68A]' : 'bg-white border-[#EBEBEB]'}`}>
      <p className="text-sm text-[#111111] leading-snug mb-3">{item.item_content}</p>
      <div className="flex gap-2">
        <button
          onClick={() => onStatusChange(item.id, '미착수')}
          className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${
            !isDone ? 'bg-[#FDE68A] text-[#92400E]' : 'bg-[#F3F4F6] text-[#8A8A8A]'
          }`}
        >
          아직이예요🥹
        </button>
        <button
          onClick={() => onStatusChange(item.id, '완료')}
          className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${
            isDone ? 'bg-[#D97706] text-white' : 'bg-[#F3F4F6] text-[#8A8A8A]'
          }`}
        >
          과제 완료했어요!
        </button>
      </div>
    </div>
  )
}

// ─── 개별 항목 컴포넌트 ──────────────────────────────────────────────────────

function TrackingItem({
  item,
  onStatusChange,
  onMemoChange,
}: {
  item: TrackingLog
  onStatusChange: (logId: string, status: Status) => void
  onMemoChange: (logId: string, memo: string) => void
}) {
  const isDone = item.status === '완료'
  const isInProgress = item.status === '진행중'

  return (
    <div className={`rounded-2xl border px-4 py-3 transition-colors ${
      isDone ? 'bg-[#F0FDF4] border-[#BBF7D0]' : isInProgress ? 'bg-[#EFF6FF] border-[#BFDBFE]' : 'bg-white border-[#EBEBEB]'
    }`}>
      {/* 항목 내용 */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isDone ? 'bg-[#16A34A]' : isInProgress ? 'bg-[#2563EB]' : 'bg-[#EBEBEB]'
        }`}>
          {isDone && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2 6 5 9 10 3" />
            </svg>
          )}
          {isInProgress && (
            <div className="w-2 h-2 bg-white rounded-full" />
          )}
        </div>
        <p className={`text-sm leading-snug flex-1 ${isDone ? 'text-[#15803D] line-through decoration-[#BBF7D0]' : 'text-[#111111]'}`}>
          {item.item_content}
        </p>
      </div>

      {/* 상태 버튼 */}
      <div className="flex gap-1.5 mb-2.5 ml-7">
        {STATUSES.map((s) => {
          const cfg = STATUS_CONFIG[s]
          const isActive = item.status === s
          return (
            <button
              key={s}
              onClick={() => onStatusChange(item.id, s)}
              className={`flex-1 h-8 rounded-xl text-xs font-semibold transition-colors ${
                isActive ? `${cfg.activeBg} ${cfg.activeText}` : `${cfg.bg} ${cfg.text}`
              }`}
            >
              {isActive && s === '완료' ? '✓ 완료' : cfg.label}
            </button>
          )
        })}
      </div>

      {/* 메모 입력 */}
      <input
        type="text"
        value={item.memo ?? ''}
        onChange={(e) => onMemoChange(item.id, e.target.value)}
        placeholder="메모 추가..."
        className={`w-full ml-7 text-xs bg-transparent border-b focus:outline-none py-1 placeholder-[#D4D4D4] transition-colors ${
          isDone
            ? 'text-[#15803D] border-[#BBF7D0] focus:border-[#16A34A]'
            : 'text-[#8A8A8A] border-[#EBEBEB] focus:border-[#D4D4D4]'
        }`}
        style={{ width: 'calc(100% - 1.75rem)' }}
      />
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function TrackingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [logs, setLogs] = useState<TrackingLog[]>([])
  const [weekThemes, setWeekThemes] = useState<Record<number, string>>({})
  const [myScore, setMyScore] = useState<MyScore | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const memoTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── 초기 데이터 로드
  useEffect(() => {
    const id = localStorage.getItem('participant_id')
    if (!id) { router.replace('/'); return }
    setParticipantId(id)

    fetch(`/api/tracking?participantId=${id}`)
      .then((r) => r.json())
      .then((data: { logs: TrackingLog[]; weekThemes: Record<number, string>; myScore?: MyScore; error?: string }) => {
        if (data.error) { setErrorMsg(data.error); setLoading(false); return }
        setLogs(data.logs)
        setWeekThemes(data.weekThemes)
        if (data.myScore) setMyScore(data.myScore)
        setLoading(false)
      })
      .catch(() => { setErrorMsg('데이터를 불러오는 중 오류가 발생했어요.'); setLoading(false) })
  }, [router])

  // ── 토스트 표시
  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }, [])

  // ── 점수 재계산 (로컬) — 과제 완료 10점 포함, 주/전체 완주 보너스는 주차만
  const recalcScore = useCallback((updatedLogs: TrackingLog[]) => {
    const wLogs = updatedLogs.filter((l) => l.week_number > 0)
    const hLogs = updatedLogs.filter((l) => l.week_number === 0)

    const completedCount =
      wLogs.filter((l) => l.status === '완료').length +
      hLogs.filter((l) => l.status === '완료').length
    const baseScore = completedCount * 10

    const weekMap = new Map<number, { total: number; done: number }>()
    for (const log of wLogs) {
      if (!weekMap.has(log.week_number)) weekMap.set(log.week_number, { total: 0, done: 0 })
      const e = weekMap.get(log.week_number)!
      e.total++
      if (log.status === '완료') e.done++
    }
    let weekBonus = 0
    for (const { total, done } of weekMap.values()) {
      if (total > 0 && total === done) weekBonus += 20
    }
    const weeklyCompleted = wLogs.filter((l) => l.status === '완료').length
    const completionBonus = wLogs.length > 0 && wLogs.length === weeklyCompleted ? 50 : 0
    const totalScore = baseScore + weekBonus + completionBonus

    setMyScore((prev) => prev ? { ...prev, total_score: totalScore, completed_items: completedCount } : prev)
  }, [])

  // ── 상태 변경 (즉시 저장)
  const handleStatusChange = useCallback((logId: string, status: Status) => {
    setLogs((prev) => {
      const next = prev.map((l) => l.id === logId ? { ...l, status } : l)
      recalcScore(next)
      return next
    })

    if (status === '진행중') showToast(pick(IN_PROGRESS_MESSAGES))
    else if (status === '완료') {
      showToast(pick(DONE_MESSAGES))
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#16A34A', '#02855B', '#86EFAC', '#FDE68A', '#DBEAFE'],
      })
    }

    fetch('/api/tracking', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId, status }),
    }).catch(console.error)
  }, [showToast, recalcScore])

  // ── 메모 변경 (800ms 디바운스)
  const handleMemoChange = useCallback((logId: string, memo: string) => {
    setLogs((prev) => prev.map((l) => l.id === logId ? { ...l, memo } : l))

    if (memoTimers.current[logId]) clearTimeout(memoTimers.current[logId])
    memoTimers.current[logId] = setTimeout(() => {
      fetch('/api/tracking', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, memo }),
      }).catch(console.error)
    }, 800)
  }, [])

  // ── 통계 계산 (진행률은 주차 항목만, 과제 제외)
  const homeworkLogs = logs.filter((l) => l.week_number === 0).sort((a, b) => a.item_index - b.item_index)
  const weeklyLogs = logs.filter((l) => l.week_number > 0)

  const totalItems = weeklyLogs.length
  const completedItems = weeklyLogs.filter((l) => l.status === '완료').length
  const inProgressItems = weeklyLogs.filter((l) => l.status === '진행중').length
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
  const allCompleted = totalItems > 0 && completedItems === totalItems

  const weekGroups = groupByWeek(weeklyLogs, weekThemes)

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#8A8A8A]">체크리스트를 불러오고 있어요...</p>
        </div>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="flex items-center justify-center px-6 text-center" style={{ height: '100dvh' }}>
        <div>
          <p className="text-[#111111] font-medium mb-4">{errorMsg}</p>
          <button onClick={() => router.replace('/')} className="text-sm text-[#111111] font-medium underline">
            처음으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="relative flex items-center justify-center px-6 text-center" style={{ height: '100dvh' }}>
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-3">
          <button
            onClick={() => router.push('/actionplan')}
            className="flex items-center gap-0.5 h-8 px-2 rounded-xl active:bg-[#F5F5F5] text-[#8A8A8A]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-xs font-medium">이전</span>
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-0.5 h-8 px-2 rounded-xl active:bg-[#F5F5F5] text-[#8A8A8A]"
          >
            <span className="text-xs font-medium">홈</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
        </div>
        <div>
          <div className="w-16 h-16 bg-[#F5F5F5] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D4D4D4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <p className="text-[#111111] font-medium mb-1">아직 액션플랜이 확정되지 않았습니다.</p>
          <p className="text-sm text-[#8A8A8A] mb-5">액션플랜을 먼저 완성하고 확정해주세요.</p>
          <button
            onClick={() => router.push('/actionplan')}
            className="h-11 px-6 rounded-xl bg-[#111111] text-white text-sm font-semibold"
          >
            액션플랜 작성하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-[#F5F5F5]" style={{ minHeight: '100dvh' }}>
      {toast && <Toast message={toast} />}

      {/* 헤더 + 전체 진행률 */}
      <div className="bg-white border-b border-[#EBEBEB] px-4 pt-4 pb-4 shrink-0">
        <div className="flex items-center justify-between -mx-1 mb-2">
          <button
            onClick={() => router.push('/actionplan')}
            className="flex items-center gap-0.5 h-8 px-2 rounded-xl active:bg-[#F5F5F5] text-[#8A8A8A]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-xs font-medium">이전</span>
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-0.5 h-8 px-2 rounded-xl active:bg-[#F5F5F5] text-[#8A8A8A]"
          >
            <span className="text-xs font-medium">홈</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
        </div>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#8A8A8A] mb-0.5">30일 실행 체크리스트</p>
            <h1 className="text-base font-bold text-[#111111] tracking-tight">나의 실행 현황</h1>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className="text-2xl font-bold text-[#111111] tracking-tight">{progressPct}<span className="text-base font-medium text-[#8A8A8A]">%</span></p>
            <p className="text-xs text-[#8A8A8A]">{completedItems}/{totalItems} 완료</p>
          </div>
        </div>

        {/* 랭킹 카드 2개 */}
        {myScore !== null && (myScore.cohort_total > 0 || myScore.total_participants > 0) && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* 차수 내 순위 */}
            {myScore.cohort_total > 0 && myScore.cohort !== null ? (
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl px-3 py-2.5">
                <p className="text-[10px] font-bold text-[#16A34A] tracking-wide uppercase mb-1">{myScore.cohort}차수 내 순위</p>
                <p className="text-xl font-bold text-[#111111] leading-none">
                  {myScore.cohort_rank}위
                  <span className="text-xs font-normal text-[#8A8A8A] ml-1">/ {myScore.cohort_total}명</span>
                </p>
                <p className="text-xs text-[#16A34A] mt-0.5">완료율 {myScore.total_items > 0 ? Math.round((myScore.completed_items / myScore.total_items) * 100) : 0}%</p>
              </div>
            ) : (
              <div className="bg-[#F5F5F5] border border-[#EBEBEB] rounded-2xl px-3 py-2.5">
                <p className="text-[10px] font-bold text-[#8A8A8A] tracking-wide uppercase mb-1">차수 내 순위</p>
                <p className="text-sm text-[#D4D4D4]">차수 미지정</p>
              </div>
            )}
            {/* 전체 순위 */}
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl px-3 py-2.5">
              <p className="text-[10px] font-bold text-[#2563EB] tracking-wide uppercase mb-1">전체 순위</p>
              <p className="text-xl font-bold text-[#111111] leading-none">
                {myScore.rank}위
                <span className="text-xs font-normal text-[#8A8A8A] ml-1">/ {myScore.total_participants}명</span>
              </p>
              <p className="text-xs text-[#2563EB] mt-0.5">🏆 {myScore.total_score}점</p>
            </div>
          </div>
        )}

        {/* 프로그레스바 */}
        <div className="h-2.5 bg-[#EBEBEB] rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allCompleted ? 'bg-[#16A34A]' : 'bg-[#111111]'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex gap-3 text-xs text-[#8A8A8A]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] inline-block" />
            완료 {completedItems}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#2563EB] inline-block" />
            진행중 {inProgressItems}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#D4D4D4] inline-block" />
            미착수 {totalItems - completedItems - inProgressItems}
          </span>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 px-4 py-4 space-y-5">
        {/* 전체 완료 축하 */}
        {allCompleted && (
          <div className="bg-[#111111] rounded-2xl p-5 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-base font-bold text-white mb-1">30일 여정 완주!</p>
            <p className="text-sm text-white/60">모든 실행 항목을 완료했습니다. 정말 대단해요!</p>
          </div>
        )}

        {/* 과제 섹션 */}
        {homeworkLogs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[#D97706]">
                과제
              </span>
              <p className="text-sm font-bold text-[#111111]">구성원 공유 세션</p>
            </div>
            <div className="space-y-2">
              {homeworkLogs.map((item) => (
                <HomeworkItem key={item.id} item={item} onStatusChange={handleStatusChange} />
              ))}
            </div>
          </div>
        )}

        {/* 주차별 섹션 */}
        {weekGroups.map((group) => {
          const weekCompleted = group.items.filter((i) => i.status === '완료').length
          const weekTotal = group.items.length
          const weekPct = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0
          const weekAllDone = weekCompleted === weekTotal

          return (
            <div key={group.week}>
              {/* 주차 헤더 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    weekAllDone ? 'bg-[#16A34A] text-white' : 'bg-[#EBEBEB] text-[#3A3A3A]'
                  }`}>
                    {weekAllDone ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    ) : group.week}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#111111]">{group.week}주차</p>
                    {group.theme && <p className="text-xs text-[#8A8A8A]">{group.theme}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* 주차 미니 프로그레스바 */}
                  <div className="w-16 h-1.5 bg-[#EBEBEB] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${weekAllDone ? 'bg-[#16A34A]' : 'bg-[#2563EB]'}`}
                      style={{ width: `${weekPct}%` }}
                    />
                  </div>
                  <p className={`text-xs font-semibold ${weekAllDone ? 'text-[#16A34A]' : 'text-[#8A8A8A]'}`}>
                    {weekCompleted}/{weekTotal}
                  </p>
                </div>
              </div>

              {/* 항목 리스트 */}
              <div className="space-y-2">
                {group.items.map((item) => (
                  <TrackingItem
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    onMemoChange={handleMemoChange}
                  />
                ))}
              </div>
            </div>
          )
        })}

        <div className="h-4" />
      </div>
    </div>
  )
}
