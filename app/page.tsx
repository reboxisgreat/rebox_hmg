'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CARD_TITLES } from '@/lib/types'
import {
  ChevronRight,
  CheckCircle2,
  Circle,
  MessageSquare,
  Map,
  CalendarCheck,
  BarChart3,
  Trophy,
  LogOut,
  KeyRound,
  Sparkles,
  ArrowRight,
  User,
  Target,
} from 'lucide-react'

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface ProgressData {
  participant: { name: string; department: string }
  problemDefinition: { is_confirmed: boolean } | null
  cards: { card_number: 1 | 2 | 3; is_confirmed: boolean }[]
  masterPlan: { slogan: string | null; is_confirmed: boolean } | null
  actionPlan: { is_confirmed: boolean } | null
  tracking: { completed: number; total: number }
  score?: { total_score: number; rank: number; total_participants: number }
}

// ── 카드 아이콘 ───────────────────────────────────────────────────────────────

const CARD_ICONS: Record<number, string> = { 1: '🎯', 2: '👥', 3: '⚙️' }

// ── 비밀번호 변경 폼 ───────────────────────────────────────────────────────────

function ChangePasswordForm({
  participantId,
  participantName,
  isFirstTime,
  onDone,
  onSkip,
  onBack,
}: {
  participantId: string
  participantName: string
  isFirstTime: boolean
  onDone: () => void
  onSkip?: () => void
  onBack?: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!newPassword) { setError('새 비밀번호를 입력해주세요.'); return }
    if (newPassword.length < 4) { setError('비밀번호는 4자 이상이어야 합니다.'); return }
    if (newPassword !== confirmPassword) { setError('새 비밀번호가 일치하지 않습니다.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '오류가 발생했어요.'); return }
      onDone()
    } catch {
      setError('오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] p-8">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-[#8A8A8A] mb-6 -ml-1 active:text-[#111] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            홈으로
          </button>
        )}
        <div className="w-12 h-12 bg-[#F0FDF4] rounded-2xl flex items-center justify-center mb-6">
          <KeyRound size={22} color="#02855B" />
        </div>
        <h1 className="text-2xl font-bold text-[#111] mb-1">
          {isFirstTime ? '초기 비밀번호 변경' : '비밀번호 변경'}
        </h1>
        <p className="text-sm text-[#8A8A8A] mb-7 leading-relaxed">
          {isFirstTime
            ? `${participantName}님, 보안을 위해 초기 비밀번호를 변경해주세요.`
            : '새 비밀번호를 설정하세요.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#111] mb-1.5">현재 비밀번호</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={isFirstTime ? '초기 비밀번호 (1234)' : '현재 비밀번호'}
              className="w-full h-12 px-4 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-[#111] text-base placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors"
              autoComplete="current-password"
              autoFocus
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#111] mb-1.5">새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호 (4자 이상)"
              className="w-full h-12 px-4 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-[#111] text-base placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#111] mb-1.5">새 비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 재입력"
              className="w-full h-12 px-4 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-[#111] text-base placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 mt-2 rounded-2xl bg-[#111] text-white text-base font-semibold disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            {loading ? '변경 중...' : '비밀번호 변경하기'}
          </button>
          {isFirstTime && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={loading}
              className="w-full h-12 mt-2 rounded-2xl text-[#8A8A8A] text-sm font-medium active:bg-[#F0F0F0] transition-colors"
            >
              다음에 변경하기
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

// ── 로그인 폼 ─────────────────────────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: (id: string, name: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingUser, setPendingUser] = useState<{ id: string; name: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmed = email.trim()
    if (!trimmed) { setError('이메일을 입력해주세요.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('올바른 이메일 주소를 입력해주세요.')
      return
    }
    if (!password) { setError('비밀번호를 입력해주세요.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '오류가 발생했어요.'); return }
      localStorage.setItem('participant_id', data.id)
      localStorage.setItem('participant_name', data.name)
      if (!data.passwordChanged) {
        setPendingUser({ id: data.id, name: data.name })
      } else {
        onLogin(data.id, data.name)
      }
    } catch {
      setError('오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  if (pendingUser) {
    return (
      <ChangePasswordForm
        participantId={pendingUser.id}
        participantName={pendingUser.name}
        isFirstTime={true}
        onDone={() => onLogin(pendingUser.id, pendingUser.name)}
        onSkip={() => onLogin(pendingUser.id, pendingUser.name)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* 상단 브랜딩 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pt-16 pb-8">
        <div className="w-full max-w-md">
          {/* 로고 영역 */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 bg-[#111] text-white px-4 py-2 rounded-2xl mb-6">
              <Sparkles size={14} />
              <span className="text-xs font-bold tracking-[0.12em] uppercase">HMG xClass</span>
            </div>
            <h1 className="text-[2rem] font-bold text-[#111] leading-tight tracking-tight mb-2">
              조직관리<br />교육 플랫폼
            </h1>
            <p className="text-sm text-[#8A8A8A] leading-relaxed">
              현대자동차그룹 리더 교육 프로그램
            </p>
          </div>

          {/* 로그인 카드 */}
          <div className="bg-white rounded-3xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] p-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#111] mb-1.5">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@hyundai.com"
                  className="w-full h-13 px-4 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-[#111] text-base placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors"
                  style={{ height: '52px' }}
                  autoComplete="email"
                  inputMode="email"
                  autoFocus
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#111] mb-1.5">비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  className="w-full h-13 px-4 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-[#111] text-base placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors"
                  style={{ height: '52px' }}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
              {error && (
                <div className="bg-red-50 rounded-xl px-4 py-2.5">
                  <p className="text-sm text-red-500 text-center">{error}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#111] text-white text-base font-semibold disabled:opacity-60 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                style={{ height: '54px' }}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    교육 시작하기
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-[#B0B0B0]">사전 등록된 참가자만 접속할 수 있습니다.</p>
        </div>
      </div>
    </div>
  )
}

// ── 홈 화면 ───────────────────────────────────────────────────────────────────

function HomePage({
  participantId,
  participantName,
  onLogout,
}: {
  participantId: string
  participantName: string
  onLogout: () => void
}) {
  const router = useRouter()
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showChangePassword, setShowChangePassword] = useState(false)

  useEffect(() => {
    fetch(`/api/progress?participantId=${participantId}`)
      .then((r) => r.json())
      .then((data: ProgressData & { error?: string }) => {
        if (!data.error) setProgress(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [participantId])

  const getNextStep = () => {
    if (!progress) return '/problem-definition'
    if (!progress.problemDefinition?.is_confirmed) return '/problem-definition'
    const allCards = ([1, 2, 3] as const).every(
      (n) => progress.cards.find((c) => c.card_number === n)?.is_confirmed
    )
    if (!allCards) return '/chat'
    if (!progress.masterPlan?.is_confirmed) return '/masterplan'
    if (!progress.actionPlan?.is_confirmed) return '/actionplan'
    return '/tracking'
  }

  if (showChangePassword) {
    return (
      <ChangePasswordForm
        participantId={participantId}
        participantName={participantName}
        isFirstTime={false}
        onDone={() => setShowChangePassword(false)}
        onBack={() => setShowChangePassword(false)}
      />
    )
  }

  const allDone =
    progress !== null &&
    progress.problemDefinition?.is_confirmed === true &&
    ([1, 2, 3] as const).every((n) => progress.cards.find((c) => c.card_number === n)?.is_confirmed) &&
    progress.masterPlan?.is_confirmed === true &&
    progress.actionPlan?.is_confirmed === true

  const trackingPct =
    progress && progress.tracking.total > 0
      ? Math.round((progress.tracking.completed / progress.tracking.total) * 100)
      : 0

  // 전체 단계 진행률 계산 (진짜문제정의1 + 카드3 + 마스터플랜1 + 액션플랜1 = 6단계)
  const completedSteps = progress
    ? (progress.problemDefinition?.is_confirmed ? 1 : 0)
      + (([1, 2, 3] as const).filter((n) => progress.cards.find((c) => c.card_number === n)?.is_confirmed).length)
      + (progress.masterPlan?.is_confirmed ? 1 : 0)
      + (progress.actionPlan?.is_confirmed ? 1 : 0)
    : 0
  const totalSteps = 6

  return (
    <div className="flex flex-col bg-[#F7F7F8]" style={{ minHeight: '100dvh' }}>
      {/* 헤더 */}
      <div className="bg-white px-5 pt-14 pb-5">
        <div className="flex items-start justify-between mb-4">
          <div className="inline-flex items-center gap-1.5 bg-[#F0FDF4] px-3 py-1.5 rounded-full">
            <Sparkles size={11} color="#02855B" />
            <span className="text-[10px] font-bold text-[#02855B] tracking-[0.12em] uppercase">HMG xClass</span>
          </div>
          <button
            onClick={onLogout}
            className="p-2 rounded-xl active:bg-[#F7F7F8] transition-colors"
          >
            <LogOut size={18} color="#B0B0B0" />
          </button>
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[1.6rem] font-bold text-[#111] leading-tight tracking-tight">
            안녕하세요,<br />{participantName}님!
          </h1>
          {progress?.score ? (
            <button
              onClick={() => router.push('/ranking')}
              className="shrink-0 mt-1 rounded-2xl overflow-hidden shadow-md flex items-center gap-3 px-4 py-3 active:opacity-80 transition-opacity"
              style={{ background: '#FEF9C3' }}
            >
              <span className="text-2xl leading-none">🏆</span>
              <div>
                <p className="text-[10px] font-bold text-[#CA8A04] tracking-wider leading-none">RANKING</p>
                <p className="text-2xl font-black text-[#92400E] leading-tight">{progress.score.rank}위</p>
                <p className="text-[10px] text-[#A16207] leading-none">{progress.score.total_participants}명 중</p>
              </div>
              <ChevronRight size={14} color="#CA8A04" />
            </button>
          ) : (
            <div className="shrink-0 mt-1 rounded-2xl overflow-hidden shadow-md flex items-center gap-3 px-4 py-3"
              style={{ background: '#F3F4F6' }}>
              <span className="text-2xl leading-none">🏅</span>
              <div>
                <p className="text-[10px] font-bold text-[#9CA3AF] tracking-wider leading-none">RANKING</p>
                <p className="text-base font-black text-[#6B7280] leading-tight">미참여</p>
                <p className="text-[10px] text-[#9CA3AF] leading-none">지금 시작해보세요!</p>
              </div>
            </div>
          )}
        </div>
        {progress?.participant.department && (
          <div className="flex items-center gap-1.5 mt-2">
            <User size={12} color="#8A8A8A" />
            <p className="text-sm text-[#8A8A8A]">{progress.participant.department}</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#111] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#8A8A8A]">불러오는 중...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 px-4 pt-4 pb-8 space-y-3">

          {/* 전체 진행 카드 */}
          {allDone ? (
            <div className="bg-[#111] rounded-3xl px-5 py-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🎉</span>
                <p className="text-base font-bold text-white">모든 과정 완료!</p>
              </div>
              <p className="text-xs text-white/50">각 항목을 눌러 내용을 다시 확인할 수 있어요.</p>
            </div>
          ) : (
            <button
              onClick={() => router.push(getNextStep())}
              className="w-full bg-[#111] rounded-3xl px-5 py-5 text-left active:scale-[0.98] transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-[0.1em]">다음 단계로</p>
                <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
                  <span className="text-xs font-bold text-white">{completedSteps}/{totalSteps}</span>
                </div>
              </div>
              {/* 진행 바 */}
              <div className="h-1.5 bg-white/10 rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-white">이어서 계속하기</p>
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                  <ArrowRight size={16} color="white" />
                </div>
              </div>
            </button>
          )}

          {/* 1단계: 진짜문제 정의 */}
          <button
            onClick={() => router.push('/problem-definition')}
            className="w-full flex items-center justify-between px-5 py-4 bg-white rounded-3xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] active:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFF7ED] rounded-2xl flex items-center justify-center shrink-0">
                <Target size={20} color="#EA580C" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-[0.08em]">1단계</p>
                <p className="text-base font-bold text-[#111]">진짜문제 정의</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {progress?.problemDefinition?.is_confirmed ? (
                <CheckCircle2 size={20} color="#02855B" />
              ) : (
                <Circle size={20} color="#D4D4D4" />
              )}
              <ChevronRight size={16} color="#D4D4D4" />
            </div>
          </button>

          {/* 2단계: 카드 실습 */}
          <div className="bg-white rounded-3xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-center gap-3 px-5 pt-4 pb-3">
              <div className="w-9 h-9 bg-[#EFF6FF] rounded-xl flex items-center justify-center shrink-0">
                <MessageSquare size={18} color="#2563EB" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-[0.08em]">2단계</p>
                <p className="text-base font-bold text-[#111]">카드 실습</p>
              </div>
            </div>
            <div className="px-4 space-y-2 pb-4">
            {([1, 2, 3] as const).map((n) => {
              const done = progress?.cards.find((c) => c.card_number === n)?.is_confirmed ?? false
              const CARD_BG: Record<number, string> = { 1: '#FFF1F2', 2: '#EFF6FF', 3: '#F0FDF4' }
              const CARD_BORDER: Record<number, string> = { 1: '#FECDD3', 2: '#BFDBFE', 3: '#BBF7D0' }
              const CARD_ICON_BG: Record<number, string> = { 1: '#FFE4E6', 2: '#DBEAFE', 3: '#DCFCE7' }
              return (
                <button
                  key={n}
                  onClick={() => router.push('/chat')}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl active:opacity-80 transition-opacity text-left border"
                  style={{ backgroundColor: CARD_BG[n], borderColor: CARD_BORDER[n] }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl w-9 h-9 flex items-center justify-center rounded-xl" style={{ backgroundColor: CARD_ICON_BG[n] }}>{CARD_ICONS[n]}</span>
                    <p className="text-base font-semibold text-[#111]">{CARD_TITLES[n]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {done ? (
                      <CheckCircle2 size={20} color="#02855B" />
                    ) : (
                      <Circle size={20} color="#D4D4D4" />
                    )}
                    <ChevronRight size={16} color="#D4D4D4" />
                  </div>
                </button>
              )
            })}
            </div>
          </div>

          {/* 슬로건 */}
          {progress?.masterPlan?.is_confirmed && progress.masterPlan.slogan && (
            <button
              onClick={() => router.push('/masterplan')}
              className="w-full rounded-3xl px-5 py-4 text-left active:scale-[0.98] transition-all"
              style={{ background: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
            >
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1">나의 리더십 슬로건</p>
              <p className="text-base font-bold text-white leading-snug">"{progress.masterPlan.slogan}"</p>
            </button>
          )}

          {/* 2열 그리드: 마스터플랜 + 액션플랜 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/masterplan')}
              className="rounded-3xl p-4 active:scale-[0.97] transition-all relative"
              style={progress?.masterPlan?.is_confirmed
                ? { background: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }
                : { background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              {progress?.masterPlan?.is_confirmed && (
                <div className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center">
                  <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                    <path d="M1 5L5 9L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              <div className="flex flex-col items-center justify-center gap-2 pt-4 pb-1">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={progress?.masterPlan?.is_confirmed ? { background: 'rgba(255,255,255,0.15)' } : { background: '#FFF7ED' }}>
                  <Map size={20} color={progress?.masterPlan?.is_confirmed ? '#fff' : '#EA580C'} />
                </div>
                <p className="text-base font-bold leading-snug text-center"
                  style={{ color: progress?.masterPlan?.is_confirmed ? '#fff' : '#111' }}>마스터플랜</p>
              </div>
            </button>

            <button
              onClick={() => router.push('/actionplan')}
              className="rounded-3xl p-4 active:scale-[0.97] transition-all relative"
              style={progress?.actionPlan?.is_confirmed
                ? { background: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }
                : { background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              {progress?.actionPlan?.is_confirmed && (
                <div className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center">
                  <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                    <path d="M1 5L5 9L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              <div className="flex flex-col items-center justify-center gap-2 pt-4 pb-1">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={progress?.actionPlan?.is_confirmed ? { background: 'rgba(255,255,255,0.15)' } : { background: '#F5F3FF' }}>
                  <CalendarCheck size={20} color={progress?.actionPlan?.is_confirmed ? '#fff' : '#7C3AED'} />
                </div>
                <p className="text-base font-bold leading-snug text-center"
                  style={{ color: progress?.actionPlan?.is_confirmed ? '#fff' : '#111' }}>액션플랜</p>
              </div>
            </button>
          </div>

          {/* 30일 트래킹 */}
          <button
            onClick={() => router.push('/tracking')}
            className="w-full bg-white rounded-3xl p-5 text-left active:scale-[0.98] transition-all shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#ECFDF5] rounded-2xl flex items-center justify-center">
                  <BarChart3 size={20} color="#059669" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-[0.08em]">30일 트래킹</p>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-[#111]">실행 현황</p>
                    {progress?.score && progress.score.total_participants > 0 && (
                      <div
                        role="button"
                        onClick={(e) => { e.stopPropagation(); router.push('/ranking') }}
                        className="flex items-center gap-1 bg-[#FEF9C3] rounded-full px-2 py-0.5 active:opacity-70 cursor-pointer"
                      >
                        <Trophy size={11} color="#CA8A04" />
                        <span className="text-xs font-bold text-[#CA8A04]">{progress.score.rank}위</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight size={16} color="#D4D4D4" />
            </div>

            {progress && progress.tracking.total > 0 ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#8A8A8A]">
                    {progress.tracking.completed}개 완료 / {progress.tracking.total}개
                  </span>
                  <span className={`text-sm font-bold ${trackingPct === 100 ? 'text-[#059669]' : 'text-[#111]'}`}>
                    {trackingPct}%
                  </span>
                </div>
                <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${trackingPct === 100 ? 'bg-[#059669]' : 'bg-[#111]'}`}
                    style={{ width: `${trackingPct}%` }}
                  />
                </div>
                {progress.score && progress.score.total_participants > 0 && (
                  <p className="mt-2 text-xs text-[#8A8A8A]">
                    총 {progress.score.total_score}점 · 전체 {progress.score.total_participants}명 중 {progress.score.rank}위
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-[#B0B0B0]">액션플랜 확정 후 트래킹을 시작할 수 있어요.</p>
            )}
          </button>

          {/* 하단 메뉴 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowChangePassword(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] active:bg-[#F7F7F8] transition-colors"
            >
              <KeyRound size={14} color="#8A8A8A" />
              <span className="text-xs font-semibold text-[#8A8A8A]">비밀번호 변경</span>
            </button>
            <button
              onClick={onLogout}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] active:bg-[#F7F7F8] transition-colors"
            >
              <LogOut size={14} color="#8A8A8A" />
              <span className="text-xs font-semibold text-[#8A8A8A]">로그아웃</span>
            </button>
          </div>

        </div>
      )}
    </div>
  )
}

// ── 루트 페이지 ───────────────────────────────────────────────────────────────

export default function RootPage() {
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [participantName, setParticipantName] = useState('')
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('participant_id')
    const name = localStorage.getItem('participant_name') ?? ''
    setParticipantId(id)
    setParticipantName(name)
    setChecked(true)
  }, [])

  const handleLogin = (id: string, name: string) => {
    setParticipantId(id)
    setParticipantName(name)
  }

  const handleLogout = () => {
    localStorage.removeItem('participant_id')
    localStorage.removeItem('participant_name')
    setParticipantId(null)
    setParticipantName('')
  }

  if (!checked) return null

  if (participantId) {
    return (
      <HomePage
        participantId={participantId}
        participantName={participantName}
        onLogout={handleLogout}
      />
    )
  }

  return <LoginForm onLogin={handleLogin} />
}
