'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Lottie from 'lottie-react'
import { Home, ChevronLeft, ChevronRight } from 'lucide-react'
import ChatWindow from '@/components/chat/ChatWindow'
import { CARD_TITLES } from '@/lib/types'
import type { ChatMessage } from '@/lib/types'
import gradientBg from '../../public/gradient-bg.json'

type CardNumber = 1 | 2 | 3
type Phase = 'loading' | 'error' | 'step5' | 'plan-ready' | 'generating' | 'editing' | 'saving'

interface CardRow {
  card_number: CardNumber
  step1_keywords: string | null
  step2_asis: string | null
  step3_tobe: string | null
  step4_action: string | null
  step5_indicator: string | null
  is_confirmed: boolean
}

interface MasterPlanState {
  slogan: string
  customer_strategy: string
  customer_what: string
  customer_why: string
  process_strategy: string
  process_what: string
  process_why: string
  people_strategy: string
  people_what: string
  people_why: string
}

const STEP5_INITIAL: Record<CardNumber, string> = {
  1: '이제 오후 세션입니다! 고객가치 관리 영역의 성공지표를 함께 만들어볼게요.\n오전에 작성하신 To-Be가 실현됐을 때, 어떤 숫자나 변화로 확인할 수 있을까요?',
  2: '잘 하셨어요! 다음은 사람 관리 영역입니다.\n2028년 말, 구성원 관련 어떤 수치가 달라져 있다면 성공이라고 할 수 있을까요?',
  3: '마지막입니다! 프로세스 관리 영역의 성공지표를 함께 도출해볼게요.\n회의, 보고, 업무 흐름에서 어떤 변화가 생기면 성공이라고 할 수 있을까요?',
}

const PLAN_ROWS: { label: string; strategyKey: keyof MasterPlanState; whatKey: keyof MasterPlanState; whyKey: keyof MasterPlanState; headerBg: string; headerText: string; accentBorder: string }[] = [
  { label: '고객가치', strategyKey: 'customer_strategy', whatKey: 'customer_what', whyKey: 'customer_why', headerBg: 'bg-[#FFF1F2]', headerText: 'text-[#DC2626]', accentBorder: 'border-l-[#DC2626]' },
  { label: '사람',    strategyKey: 'people_strategy',   whatKey: 'people_what',   whyKey: 'people_why',   headerBg: 'bg-[#FFFBEB]', headerText: 'text-[#D97706]', accentBorder: 'border-l-[#D97706]' },
  { label: '프로세스', strategyKey: 'process_strategy',  whatKey: 'process_what',  whyKey: 'process_why',  headerBg: 'bg-[#F0FDF4]', headerText: 'text-[#16A34A]', accentBorder: 'border-l-[#16A34A]' },
]

export default function MasterPlanPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [participantName, setParticipantName] = useState('리더')
  const [cards, setCards] = useState<CardRow[]>([])
  const [currentStep5Card, setCurrentStep5Card] = useState<CardNumber>(1)
  const [chatKey, setChatKey] = useState(0)
  const [masterPlan, setMasterPlan] = useState<MasterPlanState>({
    slogan: '',
    customer_strategy: '', customer_what: '', customer_why: '',
    process_strategy: '', process_what: '', process_why: '',
    people_strategy: '', people_what: '', people_why: '',
  })
  const [generateError, setGenerateError] = useState('')
  const [isPostCompletion, setIsPostCompletion] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [isStale, setIsStale] = useState(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  const setTextareaRef = useCallback((key: string) => (el: HTMLTextAreaElement | null) => {
    if (el) textareaRefs.current.set(key, el)
    else textareaRefs.current.delete(key)
  }, [])

  // masterPlan 변경 시 모든 textarea 높이 동기화
  useEffect(() => {
    textareaRefs.current.forEach(el => {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    })
  }, [masterPlan])

  // ── 초기 데이터 로드 ──────────────────────────────────────────────
  useEffect(() => {
    const id = localStorage.getItem('participant_id')
    const name = localStorage.getItem('participant_name') ?? '리더'
    if (!id) { router.replace('/'); return }

    setParticipantId(id)
    setParticipantName(name)

    // 액션플랜 확정 여부도 함께 조회해 수정 플로우 구분
    Promise.all([
      fetch(`/api/masterplan?participantId=${id}`).then((r) => r.json()),
      fetch(`/api/actionplan?participantId=${id}`).then((r) => r.json()),
    ]).then(([data, actionData]: [
      { cards: CardRow[]; masterPlan: (MasterPlanState & { id: string; is_stale: boolean }) | null; error?: string },
      { actionPlan: { is_confirmed: boolean } | null }
    ]) => {
      if (actionData.actionPlan?.is_confirmed) setIsPostCompletion(true)

        if (data.error) { setErrorMsg(data.error); setPhase('error'); return }

        const fetchedCards = data.cards
        setCards(fetchedCards)

        // 마스터플랜이 이미 있으면 편집 화면으로 (카드 확정 여부 무관)
        if (data.masterPlan) {
          const mp = data.masterPlan
          setMasterPlan({
            slogan: mp.slogan ?? '',
            customer_strategy: mp.customer_strategy ?? '',
            customer_what: mp.customer_what ?? '',
            customer_why: mp.customer_why ?? '',
            process_strategy: mp.process_strategy ?? '',
            process_what: mp.process_what ?? '',
            process_why: mp.process_why ?? '',
            people_strategy: mp.people_strategy ?? '',
            people_what: mp.people_what ?? '',
            people_why: mp.people_why ?? '',
          })
          setIsStale(mp.is_stale ?? false)
          setPhase('editing')
          return
        }

        // 마스터플랜 없을 때: 카드 3장 모두 확정되어야 함
        if (fetchedCards.length < 3 || fetchedCards.some((c) => !c.is_confirmed)) {
          setErrorMsg('아직 카드 작성이 완료되지 않았습니다.')
          setPhase('error')
          return
        }

        // Step5가 모두 완료되었으면 도출 대기
        if (fetchedCards.every((c) => c.step5_indicator)) {
          setPhase('plan-ready')
          return
        }

        // 첫 번째 미완성 카드에서 Step5 시작
        const nextCard = ([1, 2, 3] as CardNumber[]).find(
          (n) => !fetchedCards.find((c) => c.card_number === n)?.step5_indicator
        ) ?? 1
        setCurrentStep5Card(nextCard)
        setPhase('step5')
      })
      .catch(() => { setErrorMsg('데이터를 불러오는 중 오류가 발생했어요.'); setPhase('error') })
  }, [router])

  // 카드 미완성 시 /chat으로 자동 이동
  useEffect(() => {
    if (phase === 'error' && errorMsg === '아직 카드 작성이 완료되지 않았습니다.') {
      const t = setTimeout(() => router.replace('/chat'), 2500)
      return () => clearTimeout(t)
    }
  }, [phase, errorMsg, router])

  // ── Step5용 cardResponses (API /chat에 전달) ──────────────────────
  const cardResponses = useMemo(() => {
    const get = (n: CardNumber) => cards.find((c) => c.card_number === n)
    return {
      card1: { step1: get(1)?.step1_keywords ?? '', step2: get(1)?.step2_asis ?? '', step3: get(1)?.step3_tobe ?? '', step4: get(1)?.step4_action ?? '' },
      card2: { step1: get(2)?.step1_keywords ?? '', step2: get(2)?.step2_asis ?? '', step3: get(2)?.step3_tobe ?? '', step4: get(2)?.step4_action ?? '' },
      card3: { step1: get(3)?.step1_keywords ?? '', step2: get(3)?.step2_asis ?? '', step3: get(3)?.step3_tobe ?? '', step4: get(3)?.step4_action ?? '' },
    }
  }, [cards])

  // ── Step5 확정 ────────────────────────────────────────────────────
  const handleStep5Confirm = useCallback(async (messages: ChatMessage[]) => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    const indicator = lastUser?.content ?? ''

    // Supabase에 step5 저장 (실패해도 진행)
    fetch('/api/card', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, cardNumber: currentStep5Card, step5Indicator: indicator }),
    }).catch(console.error)

    setCards((prev) => prev.map((c) =>
      c.card_number === currentStep5Card ? { ...c, step5_indicator: indicator } : c
    ))

    if (currentStep5Card < 3) {
      setCurrentStep5Card((prev) => (prev + 1) as CardNumber)
      setChatKey((k) => k + 1)
    } else {
      setPhase('plan-ready')
    }
  }, [participantId, currentStep5Card])

  // ── 마스터플랜 도출 ───────────────────────────────────────────────
  const handleGeneratePlan = useCallback(async () => {
    if (!participantId) return
    setPhase('generating')
    setGenerateError('')

    const get = (n: CardNumber) => cards.find((c) => c.card_number === n)
    const fullCardResponses = {
      card1: { ...cardResponses.card1, step5: get(1)?.step5_indicator ?? '' },
      card2: { ...cardResponses.card2, step5: get(2)?.step5_indicator ?? '' },
      card3: { ...cardResponses.card3, step5: get(3)?.step5_indicator ?? '' },
    }

    try {
      const res = await fetch('/api/masterplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, participantName, cardResponses: fullCardResponses }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const mp = data.masterPlan
      setMasterPlan({
        slogan: mp.slogan,
        customer_strategy: mp.customer.strategy,
        customer_what: mp.customer.what,
        customer_why: mp.customer.why,
        process_strategy: mp.process.strategy,
        process_what: mp.process.what,
        process_why: mp.process.why,
        people_strategy: mp.people.strategy,
        people_what: mp.people.what,
        people_why: mp.people.why,
      })
      setIsStale(false)
      setPhase('editing')
    } catch {
      setGenerateError('마스터플랜 도출 중 오류가 발생했어요. 다시 시도해주세요.')
      setPhase('plan-ready')
    }
  }, [participantId, participantName, cards, cardResponses])

  // ── 인라인 편집 (디바운스 자동저장) ──────────────────────────────
  const handleFieldChange = useCallback((field: keyof MasterPlanState, value: string) => {
    const updated = { ...masterPlan, [field]: value }
    setMasterPlan(updated)

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      if (!participantId) return
      fetch('/api/masterplan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, masterPlan: updated }),
      }).catch(console.error)
    }, 1000)
  }, [participantId, masterPlan])

  // ── 마스터플랜 확정 ───────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!participantId) return
    setPhase('saving')
    try {
      await fetch('/api/masterplan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, masterPlan, isConfirmed: true }),
      })
      router.push('/actionplan')
    } catch {
      setPhase('editing')
    }
  }, [participantId, masterPlan, router])

  // ── 렌더 ─────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#8A8A8A]">데이터를 불러오고 있어요...</p>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex items-center justify-center px-6 text-center" style={{ height: '100dvh' }}>
        <div>
          <p className="text-[#111111] font-medium mb-2">{errorMsg}</p>
          {errorMsg === '아직 카드 작성이 완료되지 않았습니다.' && (
            <p className="text-sm text-[#8A8A8A]">잠시 후 카드 작성 페이지로 이동합니다...</p>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'step5') {
    const isLastCard = currentStep5Card === 3
    return (
      <div className="relative flex flex-col" style={{ height: '100dvh' }}>
        <header className="bg-white border-b border-[#EBEBEB] px-4 pt-3 pb-2 shrink-0">
          {/* 영역 진행 바 (emerald — 승인된 용도) */}
          <div className="flex gap-1.5 mb-2.5">
            {([1, 2, 3] as CardNumber[]).map((n) => (
              <div
                key={n}
                className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${
                  n < currentStep5Card ? 'bg-[#02855B]' : n === currentStep5Card ? 'bg-[#02855B]/40' : 'bg-[#EBEBEB]'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between -mx-1 mb-2">
            <button
              onClick={() => router.push('/chat')}
              className="flex items-center gap-1.5 h-8 px-2 rounded-xl active:opacity-60 text-[#3A3A3A]"
            >
              <ChevronLeft size={15} />
              <span className="text-xs font-medium">이전으로</span>
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 h-8 px-2 rounded-xl active:opacity-60 text-[#3A3A3A]"
            >
              <Home size={15} />
              <span className="text-xs font-medium">홈</span>
            </button>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-[#8A8A8A] mb-0.5">오후 세션 · 영역 {currentStep5Card} / 3</p>
              <h1 className="text-base font-bold text-[#111111] leading-tight tracking-tight">
                {CARD_TITLES[currentStep5Card]}
              </h1>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className="text-xs text-[#8A8A8A] mb-0.5">Step 5</p>
              <p className="text-sm font-bold text-[#111111] leading-tight">성공지표 도출</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <ChatWindow
            key={`step5-${currentStep5Card}-${chatKey}`}
            cardNumber={currentStep5Card}
            step={5}
            cardResponses={cardResponses}
            onConfirm={handleStep5Confirm}
            confirmLabel={isLastCard ? '성공지표 확정 → 마스터플랜 준비' : `성공지표 확정 → 다음 영역으로`}
            initialMessage={STEP5_INITIAL[currentStep5Card]}
          />
        </div>
      </div>
    )
  }

  if (phase === 'plan-ready' || (phase === 'generating' && generateError)) {
    return (
      <div className="relative flex flex-col items-center justify-center px-6 gap-6 bg-[#F5F5F5]" style={{ height: '100dvh' }}>
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-3">
          <button
            onClick={() => router.push('/chat')}
            className="flex items-center gap-1.5 h-8 px-2 rounded-xl active:opacity-60 text-[#3A3A3A]"
          >
            <ChevronLeft size={15} />
            <span className="text-xs font-medium">이전으로</span>
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 h-8 px-2 rounded-xl active:opacity-60 text-[#3A3A3A]"
          >
            <Home size={15} />
            <span className="text-xs font-medium">홈</span>
          </button>
        </div>
        <div className="text-center">
          <div className="text-5xl mb-4">🎯</div>
          <h1 className="text-xl font-bold text-[#111111] mb-2 tracking-tight">성공지표 작성 완료!</h1>
          <p className="text-sm text-[#8A8A8A]">AI가 마스터플랜을 도출합니다.</p>
          {generateError && (
            <p className="text-sm text-red-500 mt-3">{generateError}</p>
          )}
        </div>
        <button
          onClick={handleGeneratePlan}
          className="w-full max-w-sm h-14 rounded-xl bg-[#111111] active:bg-[#3A3A3A] text-white font-semibold text-base transition-colors"
        >
          마스터플랜 도출하기
        </button>
      </div>
    )
  }

  if (phase === 'generating') {
    return (
      <div className="flex items-center justify-center px-6" style={{ height: '100dvh' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base font-semibold text-[#111111] mb-1 tracking-tight">마스터플랜을 작성하고 있습니다...</p>
          <p className="text-sm text-[#8A8A8A]">AI가 전체 카드 내용을 분석하고 있어요</p>
        </div>
      </div>
    )
  }

  // ── editing / saving 페이즈 ───────────────────────────────────────
  return (
    <div className="relative flex flex-col" style={{ height: '100dvh' }}>
      {/* 헤더 */}
      <header className="bg-white border-b border-[#EBEBEB] px-4 py-3 shrink-0">
        <div className="flex justify-end mb-1">
          <Image src="/main-logo.png" alt="메인 로고" width={160} height={80} className="object-contain" />
        </div>
        <div className="flex items-center justify-between -mx-1 mb-1">
          {isPostCompletion ? (
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 h-8 px-2 rounded-xl active:opacity-60 text-[#3A3A3A]"
            >
              <Home size={15} />
              <span className="text-xs font-medium">홈</span>
            </button>
          ) : (
            <button
              onClick={() => router.push('/chat')}
              className="flex items-center gap-1.5 h-8 px-2 rounded-xl active:opacity-60 text-[#3A3A3A]"
            >
              <ChevronLeft size={15} />
              <span className="text-xs font-medium">이전으로</span>
            </button>
          )}
          {isPostCompletion ? (
            <button
              onClick={() => router.push('/actionplan')}
              className="flex items-center gap-1.5 h-8 px-2 rounded-xl active:opacity-60 text-[#3A3A3A]"
            >
              <span className="text-xs font-medium">다음으로</span>
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 h-8 px-2 rounded-xl active:opacity-60 text-[#3A3A3A]"
            >
              <Home size={15} />
              <span className="text-xs font-medium">홈</span>
            </button>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-base font-bold text-[#111111] tracking-tight">나의 조직관리 마스터플랜</h1>
            <p className="text-xs text-[#8A8A8A] mt-0.5">내용을 수정하면 자동 저장됩니다</p>
          </div>
          <button
            onClick={() => setShowRegenerateConfirm(true)}
            className="text-[11px] font-medium text-[#8A8A8A] underline underline-offset-2 active:text-[#3A3A3A] shrink-0 mb-0.5"
          >
            다시 생성하기
          </button>
        </div>
      </header>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F5F5F5]">
        {/* 카드 변경 경고 배너 */}
        {isStale && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
            <p className="text-[12px] text-[#92400E] leading-snug">⚠️ 카드 내용이 변경되었어요. 마스터플랜 다시 생성을 권장합니다.</p>
            <button
              onClick={() => setShowRegenerateConfirm(true)}
              className="shrink-0 text-[11px] font-semibold text-[#B45309] underline underline-offset-2 active:opacity-60"
            >
              다시 생성
            </button>
          </div>
        )}
        {/* 슬로건 — dark featured card */}
        <div className="relative rounded-2xl overflow-hidden text-center bg-[#111111]">
          {/* Lottie 배경 — 절대 배치, 높이는 콘텐츠가 결정 */}
          <div className="absolute inset-0 pointer-events-none [&_svg]:w-full [&_svg]:h-full" style={{ filter: 'brightness(0.55)' }}>
            <Lottie
              animationData={gradientBg}
              loop
              style={{ width: '100%', height: '100%' }}
              rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }}
            />
          </div>
          {/* 콘텐츠 */}
          <div className="relative z-10 p-4">
            <p className="text-[12px] font-bold tracking-[0.12em] uppercase text-white/70 mb-2">📣 나의 2026년 슬로건</p>
            <textarea
              ref={setTextareaRef('slogan')}
              value={masterPlan.slogan}
              onChange={(e) => handleFieldChange('slogan', e.target.value)}
              placeholder="슬로건을 입력하세요"
              className="w-full text-[18px] font-bold text-white text-center bg-transparent resize-none focus:outline-none overflow-hidden leading-tight placeholder-white/40 py-0 h-auto break-keep"
            />
          </div>
        </div>

        {/* 영역별 카드 */}
        {PLAN_ROWS.map(({ label, strategyKey, whatKey, whyKey, headerBg, headerText, accentBorder }) => (
          <div key={label} className={`bg-white border border-[#EBEBEB] border-l-4 ${accentBorder} rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]`}>
            <div className={`px-4 py-2.5 ${headerBg}`}>
              <p className={`text-sm font-bold ${headerText}`}>{label}</p>
            </div>
            <div className="divide-y divide-[#EBEBEB]">
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-[#8A8A8A] mb-1.5">조직관리 전략 — 성공지표</p>
                <textarea
                  ref={setTextareaRef(strategyKey)}
                  value={masterPlan[strategyKey]}
                  onChange={(e) => handleFieldChange(strategyKey, e.target.value)}
                  placeholder="성공지표를 입력하세요"
                  className="w-full text-sm text-[#111111] bg-transparent resize-none focus:outline-none leading-relaxed placeholder-[#D4D4D4] py-0 h-auto"
                />
              </div>
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-[#8A8A8A] mb-1.5">What — 핵심 액션</p>
                <textarea
                  ref={setTextareaRef(whatKey)}
                  value={masterPlan[whatKey]}
                  onChange={(e) => handleFieldChange(whatKey, e.target.value)}
                  placeholder="성공지표를 달성하기 위한 핵심 액션을 입력하세요"
                  className="w-full text-sm text-[#111111] bg-transparent resize-none focus:outline-none leading-relaxed placeholder-[#D4D4D4] py-0 h-auto"
                />
              </div>
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-[#8A8A8A] mb-1.5">Why — 이유 및 근거</p>
                <textarea
                  ref={setTextareaRef(whyKey)}
                  value={masterPlan[whyKey]}
                  onChange={(e) => handleFieldChange(whyKey, e.target.value)}
                  placeholder="이유와 근거를 입력하세요"
                  className="w-full text-sm text-[#111111] bg-transparent resize-none focus:outline-none leading-relaxed placeholder-[#D4D4D4] py-0 h-auto"
                />
              </div>
            </div>
          </div>
        ))}

        <div className="h-2" />
      </div>

      {/* 하단 버튼 */}
      <div className="px-4 pb-4 pt-2 border-t border-[#EBEBEB] bg-white shrink-0">
        {isPostCompletion ? (
          <div className="space-y-2">
            <button
              onClick={() => router.push('/actionplan')}
              className="w-full h-12 rounded-xl bg-[#111111] active:bg-[#3A3A3A] text-white font-semibold text-sm transition-colors"
            >
              액션플랜으로 →
            </button>
            <p className="text-center text-xs text-[#8A8A8A]">수정 내용은 자동으로 저장됩니다</p>
          </div>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={phase === 'saving'}
            className="w-full h-12 rounded-xl bg-[#111111] active:bg-[#3A3A3A] text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            확정하고 액션플랜으로
          </button>
        )}
      </div>

      {/* 재생성 확인 다이얼로그 */}
      {showRegenerateConfirm && (
        <div className="absolute inset-0 bg-black/40 flex items-end justify-center z-50 pb-8 px-4">
          <div className="w-full bg-white rounded-2xl p-5 shadow-xl">
            <p className="text-[15px] font-bold text-[#111111] mb-1">마스터플랜을 다시 생성할까요?</p>
            <p className="text-xs text-[#8A8A8A] mb-5">AI가 새로운 마스터플랜을 도출합니다. 기존 내용은 덮어씌워집니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="flex-1 h-11 rounded-xl border border-[#EBEBEB] text-[#3A3A3A] font-semibold text-sm active:bg-[#F5F5F5]"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowRegenerateConfirm(false)
                  handleGeneratePlan()
                }}
                className="flex-1 h-11 rounded-xl bg-[#111111] text-white font-semibold text-sm active:bg-[#3A3A3A]"
              >
                다시 생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 저장 중 오버레이 */}
      {phase === 'saving' && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-[#3A3A3A]">저장 중...</p>
          </div>
        </div>
      )}
    </div>
  )
}
