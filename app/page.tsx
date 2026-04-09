'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { CARD_TITLES } from '@/lib/types'
import confettiData from '@/public/confetti.json'
import gradientBg from '@/public/gradient-bg.json'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })
import {
  ChevronRight,
  Map,
  CalendarCheck,
  BarChart3,
  Trophy,
  LogOut,
  ArrowRight,
  User,
  Target,
  Lock,
  LayoutGrid,
} from 'lucide-react'

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface ProgressData {
  participant: { name: string; department: string }
  problemDefinition: { is_confirmed: boolean } | null
  cards: { card_number: 1 | 2 | 3; is_confirmed: boolean }[]
  masterPlan: { slogan: string | null; is_confirmed: boolean } | null
  actionPlan: { is_confirmed: boolean } | null
  tracking: { completed: number; total: number }
  score?: { total_score: number; rank: number; total_participants: number; cohort: number | null }
}

// ── 카드 아이콘 ───────────────────────────────────────────────────────────────

const CARD_ICONS: Record<number, string> = { 1: '🎯', 2: '👥', 3: '⚙️' }

// ── 로그인 폼 ─────────────────────────────────────────────────────────────────

function LoginForm({ onLogin, onRegister }: { onLogin: (id: string, name: string) => void; onRegister: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmed = username.trim()
    if (!trimmed) { setError('아이디를 입력해주세요.'); return }
    if (!password) { setError('비밀번호를 입력해주세요.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '오류가 발생했어요.'); return }
      localStorage.setItem('participant_id', data.id)
      localStorage.setItem('participant_name', data.name)
      onLogin(data.id, data.name)
    } catch {
      setError('오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ minHeight: '100dvh', background: '#F7F7F8' }}>
      {/* 애니메이션 서클 배경 */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* 에메랄드 서클 — 좌상단 */}
        <div
          className="animate-float1 absolute rounded-full"
          style={{
            width: '80vw', height: '80vw',
            top: '-20vw', left: '-20vw',
            background: 'rgba(2, 133, 91, 0.35)',
            filter: 'blur(40px)',
          }}
        />
        {/* 블루 서클 — 우하단 */}
        <div
          className="animate-float2 absolute rounded-full"
          style={{
            width: '70vw', height: '70vw',
            bottom: '-15vw', right: '-15vw',
            background: 'rgba(37, 99, 235, 0.30)',
            filter: 'blur(45px)',
          }}
        />
        {/* 퍼플 서클 — 중앙 */}
        <div
          className="animate-float3 absolute rounded-full"
          style={{
            width: '60vw', height: '60vw',
            top: '28%', left: '15%',
            background: 'rgba(234, 179, 8, 0.30)',
            filter: 'blur(38px)',
          }}
        />
      </div>

      {/* 콘텐츠 */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 pt-16 pb-8">
        <div className="w-full max-w-md">
          {/* 로고 영역 */}
          <div className="mb-23 text-center">
            <img src="/main-logo.png" alt="리더스러닝랩 xClass" className="h-16 mx-auto object-contain mb-6" />
            <h1 className="text-[2rem] font-bold text-[#111] leading-tight tracking-tight mb-1.5">
              리더스러닝랩<br />xClass 조직관리 과정
            </h1>
            <p className="text-sm leading-relaxed">
              현대자동차그룹 실장급 리더 교육
            </p>
          </div>

          {/* 로그인 카드 */}
          <div className="relative mt-20">
            {/* 강아지 캐릭터 — 카드 위에 반쯤 걸쳐서 등장 */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 z-10 w-36 h-36">
              <img
                src="/dog-character.jpg"
                alt="강아지 캐릭터"
                className="w-full h-full object-cover object-top rounded-full shadow-lg border-4 border-white"
              />
            </div>
          <div className="bg-white rounded-3xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] p-7 pt-16">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#111] mb-1.5">아이디</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  className="w-full h-13 px-4 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-[#111] text-base placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors"
                  style={{ height: '52px' }}
                  autoComplete="username"
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
                  placeholder="비밀번호를 입력하세요"
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
                    실습 시작하기
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={onRegister}
                className="text-sm text-[#8A8A8A] active:text-[#111] transition-colors"
                disabled={loading}
              >
                계정이 없으신가요?{' '}
                <span className="font-semibold text-[#111]">회원가입</span>
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 회원가입 폼 ───────────────────────────────────────────────────────────────

function RegisterForm({ onLogin, onBack }: { onLogin: (id: string, name: string) => void; onBack: () => void }) {
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [cohort, setCohort] = useState<number | ''>('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmedUsername = username.trim()
    const trimmedName = name.trim()
    if (!trimmedUsername) { setError('아이디를 입력해주세요.'); return }
    if (!/^[a-zA-Z0-9]{4,20}$/.test(trimmedUsername)) {
      setError('아이디는 영문/숫자 4~20자로 입력해주세요.')
      return
    }
    if (!trimmedName) { setError('성함을 입력해주세요.'); return }
    if (!department.trim()) { setError('소속을 입력해주세요.'); return }
    if (!cohort) { setError('차수를 선택해주세요.'); return }
    if (!password) { setError('비밀번호를 입력해주세요.'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, name: trimmedName, department: department.trim(), cohort, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '오류가 발생했어요.'); return }
      localStorage.setItem('participant_id', data.id)
      localStorage.setItem('participant_name', data.name)
      onLogin(data.id, data.name)
    } catch {
      setError('오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ minHeight: '100dvh', background: '#F7F7F8' }}>
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="animate-float1 absolute rounded-full" style={{ width: '80vw', height: '80vw', top: '-20vw', left: '-20vw', background: 'rgba(2, 133, 91, 0.35)', filter: 'blur(40px)' }} />
        <div className="animate-float2 absolute rounded-full" style={{ width: '70vw', height: '70vw', bottom: '-15vw', right: '-15vw', background: 'rgba(37, 99, 235, 0.30)', filter: 'blur(45px)' }} />
        <div className="animate-float3 absolute rounded-full" style={{ width: '60vw', height: '60vw', top: '28%', left: '15%', background: 'rgba(234, 179, 8, 0.30)', filter: 'blur(38px)' }} />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 pt-12 pb-8">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <img src="/main-logo.png" alt="리더스러닝랩 xClass" className="h-10 mx-auto object-contain mb-3" />
            <h1 className="text-xl font-bold text-[#111]">회원가입</h1>
            <p className="text-xs text-[#8A8A8A] mt-1">리더스러닝랩 xClass 조직관리 과정</p>
          </div>

          <div className="bg-white rounded-3xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] p-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#111] mb-1.5">
                  아이디 <span className="text-red-500">*</span> <span className="text-xs font-normal text-[#8A8A8A]">(영문/숫자 4~20자)</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  className="w-full px-4 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-[#111] text-base placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors"
                  style={{ height: '52px' }}
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#111] mb-1.5">성함 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="실명을 입력하세요"
                  className="w-full px-4 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-[#111] text-base placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors"
                  style={{ height: '52px' }}
                  autoComplete="name"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#111] mb-1.5">소속 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="소속 부서/실을 입력하세요"
                  className="w-full px-4 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-[#111] text-base placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors"
                  style={{ height: '52px' }}
                  autoComplete="organization"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#111] mb-1.5">차수 <span className="text-red-500">*</span></label>
                <select
                  value={cohort}
                  onChange={(e) => setCohort(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-[#111] text-base focus:outline-none focus:border-[#111] focus:bg-white transition-colors"
                  style={{ height: '52px' }}
                  disabled={loading}
                >
                  <option value="">차수 선택</option>
                  <option value={1}>1차수</option>
                  <option value={2}>2차수</option>
                  <option value={3}>3차수</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#111] mb-1.5">
                  비밀번호 <span className="text-red-500">*</span> <span className="text-xs font-normal text-[#8A8A8A]">(6자 이상)</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full px-4 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-[#111] text-base placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors"
                  style={{ height: '52px' }}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#111] mb-1.5">비밀번호 확인 <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  className="w-full px-4 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-[#111] text-base placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors"
                  style={{ height: '52px' }}
                  autoComplete="new-password"
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
                    가입하기
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={onBack}
                className="text-sm text-[#8A8A8A] active:text-[#111] transition-colors"
                disabled={loading}
              >
                이미 계정이 있으신가요?{' '}
                <span className="font-semibold text-[#111]">로그인</span>
              </button>
            </div>
          </div>
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

  useEffect(() => {
    fetch(`/api/progress?participantId=${participantId}`)
      .then((r) => r.json())
      .then((data: ProgressData & { error?: string }) => {
        if (!data.error) setProgress(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [participantId])

  const isStepUnlocked = (step: number): boolean => {
    if (!progress) return step === 0
    switch (step) {
      case 0: return true
      case 1: return progress.problemDefinition?.is_confirmed === true
      case 2: return progress.cards.find((c) => c.card_number === 1)?.is_confirmed === true
      case 3: return progress.cards.find((c) => c.card_number === 2)?.is_confirmed === true
      case 4: return progress.cards.find((c) => c.card_number === 3)?.is_confirmed === true
      case 5: return progress.masterPlan?.is_confirmed === true
      case 6: return progress.actionPlan?.is_confirmed === true
      default: return false
    }
  }

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
    <div className="relative flex flex-col overflow-hidden" style={{ minHeight: '100dvh', background: '#F0F4F8' }}>
      {/* 전체 화면 애니메이션 배경 */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* 에메랄드 서클 — 좌상단 */}
        <div
          className="animate-float1 absolute rounded-full"
          style={{
            width: '80vw', height: '80vw',
            top: '-20vw', left: '-20vw',
            background: 'rgba(2, 133, 91, 0.35)',
            filter: 'blur(40px)',
          }}
        />
        {/* 블루 서클 — 우하단 */}
        <div
          className="animate-float2 absolute rounded-full"
          style={{
            width: '70vw', height: '70vw',
            bottom: '-15vw', right: '-15vw',
            background: 'rgba(37, 99, 235, 0.30)',
            filter: 'blur(45px)',
          }}
        />
        {/* 옐로 서클 — 중앙 */}
        <div
          className="animate-float3 absolute rounded-full"
          style={{
            width: '60vw', height: '60vw',
            top: '28%', left: '15%',
            background: 'rgba(234, 179, 8, 0.30)',
            filter: 'blur(38px)',
          }}
        />
      </div>

      {/* 헤더 */}
      <div className="relative px-5 pt-14 pb-5">
        {/* 헤더 콘텐츠 */}
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col gap-3">
              <img src="/main-logo.png" alt="리더스러닝랩 xClass" className="h-9 object-contain" />
              <span className="text-[14px] font-bold text-[#000000] tracking-[0.12em] pl-0.5">리더스러닝랩 xClass 조직관리 과정</span>
            </div>
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
                  <p className="text-[10px] font-bold text-[#CA8A04] tracking-wider leading-none">
                    {progress.score.cohort ? `${progress.score.cohort}차수 랭킹` : '주차별 랭킹'}
                  </p>
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
            <div className="rounded-3xl px-5 py-3 relative overflow-hidden flex items-center justify-between" style={{ backgroundImage: 'linear-gradient(60deg, #29323c 0%, #485563 100%)' }}>
              {/* 폭죽 애니메이션 — 좌측 */}
              <Lottie
                animationData={confettiData}
                loop={true}
                className="pointer-events-none flex-shrink-0"
                style={{ width: 56, height: 56 }}
              />
              {/* 텍스트 */}
              <div className="relative z-10 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-base font-bold text-white">모든 실습을 완료했습니다!</p>
                </div>
                <p className="text-xs text-white/50">각 항목을 눌러 내용을 다시 확인할 수 있어요.</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => router.push(getNextStep())}
              className="w-full bg-[#002C5F] rounded-3xl px-5 py-5 text-left active:bg-[#003a7a] transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-white/70 uppercase tracking-[0.1em]">다음 단계로</p>
                <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
                  <span className="text-xs font-bold text-white">{completedSteps}/{totalSteps}</span>
                </div>
              </div>
              {/* 진행 바 */}
              <div className="h-1.5 bg-white/20 rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-white">이어서 계속하기</p>
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <ArrowRight size={16} color="white" />
                </div>
              </div>
            </button>
          )}

          {/* 단계 카드 공통 상태 아이콘 */}
          {/* 1단계: 진짜문제 정의 */}
          <button
            onClick={() => isStepUnlocked(0) && router.push('/problem-definition')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-opacity text-left ${isStepUnlocked(0) ? 'active:opacity-80' : 'cursor-not-allowed'}`} style={{ backgroundColor: '#FCF8F1', boxShadow: '0 2px 12px rgba(0,0,0,0.09)', isolation: 'isolate', position: 'relative', zIndex: 1 }}
          >
            <div className={`flex items-center gap-3 ${!isStepUnlocked(0) ? 'opacity-40' : ''}`}>
              <div className="w-10 h-10 bg-[#FFF7ED] rounded-xl flex items-center justify-center shrink-0">
                <Target size={20} color="#EA580C" />
              </div>
              <div>
                <p className="text-[11px] text-[#AAAAAA] font-medium">1단계</p>
                <p className="text-[15px] font-bold text-[#111]">진짜문제 정의</p>
              </div>
            </div>
            {progress?.problemDefinition?.is_confirmed ? (
              <div className="w-7 h-7 rounded-full bg-[#111] flex items-center justify-center shrink-0">
                <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1 5L4.5 8.5L12 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            ) : !isStepUnlocked(0) ? (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0 opacity-40">
                <Lock size={12} color="#CCCCCC" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0">
                <ChevronRight size={14} color="#CCCCCC" />
              </div>
            )}
          </button>

          {/* 2단계: 고객가치 관리 */}
          <button
            onClick={() => isStepUnlocked(1) && router.push('/chat?card=1')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-opacity text-left ${isStepUnlocked(1) ? 'active:opacity-80' : 'cursor-not-allowed'}`} style={{ backgroundColor: '#FFD5C5', boxShadow: '0 2px 12px rgba(0,0,0,0.09)', isolation: 'isolate', position: 'relative', zIndex: 1 }}
          >
            <div className={`flex items-center gap-3 ${!isStepUnlocked(1) ? 'opacity-40' : ''}`}>
              <div className="w-10 h-10 bg-[#FFF1F2] rounded-xl flex items-center justify-center shrink-0">
                <span className="text-xl">{CARD_ICONS[1]}</span>
              </div>
              <div>
                <p className="text-[11px] text-[#AAAAAA] font-medium">2단계</p>
                <p className="text-[15px] font-bold text-[#111]">{CARD_TITLES[1]}</p>
              </div>
            </div>
            {(progress?.cards.find((c) => c.card_number === 1)?.is_confirmed ?? false) ? (
              <div className="w-7 h-7 rounded-full bg-[#111] flex items-center justify-center shrink-0">
                <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1 5L4.5 8.5L12 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            ) : !isStepUnlocked(1) ? (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0 opacity-40">
                <Lock size={12} color="#CCCCCC" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0">
                <ChevronRight size={14} color="#CCCCCC" />
              </div>
            )}
          </button>

          {/* 3단계: 사람 관리 */}
          <button
            onClick={() => isStepUnlocked(2) && router.push('/chat?card=2')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-opacity text-left ${isStepUnlocked(2) ? 'active:opacity-80' : 'cursor-not-allowed'}`} style={{ backgroundColor: '#FFEEC0', boxShadow: '0 2px 12px rgba(0,0,0,0.09)', isolation: 'isolate', position: 'relative', zIndex: 1 }}
          >
            <div className={`flex items-center gap-3 ${!isStepUnlocked(2) ? 'opacity-40' : ''}`}>
              <div className="w-10 h-10 bg-[#FFFBEB] rounded-xl flex items-center justify-center shrink-0">
                <span className="text-xl">{CARD_ICONS[2]}</span>
              </div>
              <div>
                <p className="text-[11px] text-[#AAAAAA] font-medium">3단계</p>
                <p className="text-[15px] font-bold text-[#111]">{CARD_TITLES[2]}</p>
              </div>
            </div>
            {(progress?.cards.find((c) => c.card_number === 2)?.is_confirmed ?? false) ? (
              <div className="w-7 h-7 rounded-full bg-[#111] flex items-center justify-center shrink-0">
                <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1 5L4.5 8.5L12 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            ) : !isStepUnlocked(2) ? (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0 opacity-40">
                <Lock size={12} color="#CCCCCC" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0">
                <ChevronRight size={14} color="#CCCCCC" />
              </div>
            )}
          </button>

          {/* 4단계: 프로세스 관리 */}
          <button
            onClick={() => isStepUnlocked(3) && router.push('/chat?card=3')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-opacity text-left ${isStepUnlocked(3) ? 'active:opacity-80' : 'cursor-not-allowed'}`} style={{ backgroundColor: '#D6EDD8', boxShadow: '0 2px 12px rgba(0,0,0,0.09)', isolation: 'isolate', position: 'relative', zIndex: 1 }}
          >
            <div className={`flex items-center gap-3 ${!isStepUnlocked(3) ? 'opacity-40' : ''}`}>
              <div className="w-10 h-10 bg-[#F0FDF4] rounded-xl flex items-center justify-center shrink-0">
                <span className="text-xl">{CARD_ICONS[3]}</span>
              </div>
              <div>
                <p className="text-[11px] text-[#AAAAAA] font-medium">4단계</p>
                <p className="text-[15px] font-bold text-[#111]">{CARD_TITLES[3]}</p>
              </div>
            </div>
            {(progress?.cards.find((c) => c.card_number === 3)?.is_confirmed ?? false) ? (
              <div className="w-7 h-7 rounded-full bg-[#111] flex items-center justify-center shrink-0">
                <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1 5L4.5 8.5L12 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            ) : !isStepUnlocked(3) ? (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0 opacity-40">
                <Lock size={12} color="#CCCCCC" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0">
                <ChevronRight size={14} color="#CCCCCC" />
              </div>
            )}
          </button>

          {/* 카드 갤러리 */}
          <button
            onClick={() => router.push('/card-gallery')}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl active:opacity-80 transition-opacity text-left"
            style={{ backgroundColor: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.09)', isolation: 'isolate', position: 'relative', zIndex: 1 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#EFF6FF] rounded-xl flex items-center justify-center shrink-0">
                <LayoutGrid size={20} color="#3B82F6" />
              </div>
              <div>
                <p className="text-[11px] text-[#AAAAAA] font-medium">{progress?.score?.cohort ? `${progress.score.cohort}차수` : '우리 차수'}</p>
                <p className="text-[15px] font-bold text-[#111]">카드 갤러리</p>
              </div>
            </div>
            <ChevronRight size={14} color="#CCCCCC" />
          </button>

          {/* 슬로건 */}
          {progress?.masterPlan?.is_confirmed && progress.masterPlan.slogan && (
            <button
              onClick={() => router.push('/masterplan')}
              className="relative w-full rounded-3xl overflow-hidden text-center active:scale-[0.98] transition-all bg-[#111111]"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
            >
              <div className="absolute inset-0 pointer-events-none [&_svg]:w-full [&_svg]:h-full" style={{ filter: 'brightness(0.55)' }}>
                <Lottie animationData={gradientBg} loop style={{ width: '100%', height: '100%' }} rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }} />
              </div>
              <div className="relative z-10 px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1 text-white/70">📣 나의 2026년 슬로건</p>
                <p className="text-[16px] font-bold leading-snug text-white break-keep">"{progress.masterPlan.slogan}"</p>
              </div>
            </button>
          )}

          {/* 5단계: 마스터플랜 */}
          <button
            onClick={() => isStepUnlocked(4) && router.push('/masterplan')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-opacity text-left ${isStepUnlocked(4) ? 'active:opacity-80' : 'cursor-not-allowed'}`} style={{ backgroundColor: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.09)', isolation: 'isolate', position: 'relative', zIndex: 1 }}
          >
            <div className={`flex items-center gap-3 ${!isStepUnlocked(4) ? 'opacity-40' : ''}`}>
              <div className="w-10 h-10 bg-[#FFF7ED] rounded-xl flex items-center justify-center shrink-0">
                <Map size={20} color="#EA580C" />
              </div>
              <div>
                <p className="text-[11px] text-[#AAAAAA] font-medium">5단계</p>
                <p className="text-[15px] font-bold text-[#111]">마스터플랜</p>
              </div>
            </div>
            {progress?.masterPlan?.is_confirmed ? (
              <div className="w-7 h-7 rounded-full bg-[#111] flex items-center justify-center shrink-0">
                <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1 5L4.5 8.5L12 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            ) : !isStepUnlocked(4) ? (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0 opacity-40">
                <Lock size={12} color="#CCCCCC" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0">
                <ChevronRight size={14} color="#CCCCCC" />
              </div>
            )}
          </button>

          {/* 6단계: 액션플랜 */}
          <button
            onClick={() => isStepUnlocked(5) && router.push('/actionplan')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-opacity text-left ${isStepUnlocked(5) ? 'active:opacity-80' : 'cursor-not-allowed'}`} style={{ backgroundColor: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.09)', isolation: 'isolate', position: 'relative', zIndex: 1 }}
          >
            <div className={`flex items-center gap-3 ${!isStepUnlocked(5) ? 'opacity-40' : ''}`}>
              <div className="w-10 h-10 bg-[#F5F3FF] rounded-xl flex items-center justify-center shrink-0">
                <CalendarCheck size={20} color="#7C3AED" />
              </div>
              <div>
                <p className="text-[11px] text-[#AAAAAA] font-medium">6단계</p>
                <p className="text-[15px] font-bold text-[#111]">액션플랜</p>
              </div>
            </div>
            {progress?.actionPlan?.is_confirmed ? (
              <div className="w-7 h-7 rounded-full bg-[#111] flex items-center justify-center shrink-0">
                <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1 5L4.5 8.5L12 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            ) : !isStepUnlocked(5) ? (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0 opacity-40">
                <Lock size={12} color="#CCCCCC" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0">
                <ChevronRight size={14} color="#CCCCCC" />
              </div>
            )}
          </button>

          {/* 7단계: 액션플랜 수행 현황 */}
          <button
            onClick={() => isStepUnlocked(6) && router.push('/tracking')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-opacity text-left ${isStepUnlocked(6) ? 'active:opacity-80' : 'cursor-not-allowed'}`} style={{ backgroundColor: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.09)', isolation: 'isolate', position: 'relative', zIndex: 1 }}
          >
            <div className={`flex items-center gap-3 ${!isStepUnlocked(6) ? 'opacity-40' : ''}`}>
              <div className="w-10 h-10 bg-[#ECFDF5] rounded-xl flex items-center justify-center shrink-0">
                <BarChart3 size={20} color="#059669" />
              </div>
              <div>
                <p className="text-[11px] text-[#AAAAAA] font-medium">7단계</p>
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-bold text-[#111]">액션플랜 수행 현황</p>
                  {isStepUnlocked(6) && progress?.score && progress.score.total_participants > 0 && (
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
                {isStepUnlocked(6) && progress && progress.tracking.total > 0 && (
                  <p className="text-[12px] text-[#000000] mt-0.5">
                    {progress.tracking.completed}/{progress.tracking.total}개 완료 · {trackingPct}%
                  </p>
                )}
              </div>
            </div>
            {progress && progress.tracking.total > 0 && trackingPct === 100 ? (
              <div className="w-7 h-7 rounded-full bg-[#111] flex items-center justify-center shrink-0">
                <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1 5L4.5 8.5L12 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            ) : !isStepUnlocked(6) ? (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0 opacity-40">
                <Lock size={12} color="#CCCCCC" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0">
                <ChevronRight size={14} color="#CCCCCC" />
              </div>
            )}
          </button>

          {/* 마스터플랜 갤러리 */}
          <button
            onClick={() => router.push('/gallery')}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl active:opacity-80 transition-opacity text-left"
            style={{ backgroundColor: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.09)', isolation: 'isolate', position: 'relative', zIndex: 1 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#EFF6FF] rounded-xl flex items-center justify-center shrink-0">
                <LayoutGrid size={20} color="#3B82F6" />
              </div>
              <div>
                <p className="text-[11px] text-[#AAAAAA] font-medium">{progress?.score?.cohort ? `${progress.score.cohort}차수` : '우리 차수'}</p>
                <p className="text-[15px] font-bold text-[#111]">마스터플랜 갤러리</p>
              </div>
            </div>
            <ChevronRight size={14} color="#CCCCCC" />
          </button>

          {/* 하단 메뉴 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onLogout}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl active:bg-[#F7F7F8] transition-colors" style={{ backgroundColor: '#ffffff', boxShadow: '0 2px 10px rgba(0,0,0,0.09)', isolation: 'isolate', position: 'relative', zIndex: 1 }}
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
  const [view, setView] = useState<'login' | 'register'>('login')

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
    setView('login')
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

  if (view === 'register') {
    return <RegisterForm onLogin={handleLogin} onBack={() => setView('login')} />
  }

  return <LoginForm onLogin={handleLogin} onRegister={() => setView('register')} />
}
