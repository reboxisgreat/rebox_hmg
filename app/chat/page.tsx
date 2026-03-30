'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ChatWindow from '@/components/chat/ChatWindow'
import { CARD_TITLES, CARD_TOPICS, STEP_TITLES } from '@/lib/types'
import type { ChatMessage } from '@/lib/types'

async function fetchStream(
  url: string,
  body: object,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      onError('AI 응답을 가져오는 데 실패했어요. 다시 시도해주세요.')
      return
    }

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) { onError('스트림을 읽을 수 없어요.'); return }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') { onDone(); return }
        try {
          const parsed = JSON.parse(data)
          if (parsed.text) onChunk(parsed.text)
        } catch { /* 파싱 오류 무시 */ }
      }
    }
    onDone()
  } catch {
    onError('네트워크 오류가 발생했어요. 연결을 확인해주세요.')
  }
}

type CardNumber = 1 | 2 | 3
type StepNumber = 1 | 2 | 3 | 4

interface StepData {
  answer: string
  chatHistory: ChatMessage[]
}

type CardData = Partial<Record<`step${StepNumber}`, StepData>>

interface SavedCard {
  card_number: CardNumber
  step1_keywords: string | null
  step2_asis: string | null
  step3_tobe: string | null
  step4_action: string | null
  step5_indicator: string | null
  is_confirmed: boolean
}

const INITIAL_MESSAGES: Record<CardNumber, Record<StepNumber, string>> = {
  1: {
    1: '고객가치 관리 세션을 시작하겠습니다.\n오늘 강의에서 가장 인상 깊었던 키워드 3가지를 말씀해 주세요.',
    2: '감사합니다. 이제 현재수준(As-Is)을 짚어볼게요.\n지금 조직에서 고객가치 관리가 어떻게 이루어지고 있는지 솔직하게 들려주세요.',
    3: '깊이 있는 성찰이네요. 2028년 12월 31일,\n고객가치 관리가 어떤 모습으로 변화해 있으면 이상적일까요?',
    4: '명확한 지향점입니다. To-Be를 향해\n리더로서 당장 실행할 수 있는 첫 번째 액션은 무엇인가요?',
  },
  2: {
    1: '사람 관리 세션을 시작하겠습니다.\n오늘 강의에서 가장 인상 깊었던 키워드 3가지를 말씀해 주세요.',
    2: '지금 실(본부) 구성원들을 이끌면서\n가장 어려움을 느끼는 부분은 어떤 것인가요?',
    3: '2028년 12월 31일, 구성원들이 실장님을\n어떻게 표현하면 좋겠나요?',
    4: '좋은 지향점입니다. To-Be를 향해\n이번 주 안에 실행할 수 있는 가장 작은 액션은 무엇인가요?',
  },
  3: {
    1: '프로세스 관리 세션을 시작하겠습니다.\n오늘 강의에서 가장 인상 깊었던 키워드 3가지를 말씀해 주세요.',
    2: '지금 조직에서 가장 비효율적이라고 느끼는\n프로세스나 관행이 있다면 말씀해 주세요.',
    3: '2028년 12월 31일, 조직의 업무 방식이\n어떻게 달라져 있으면 이상적일까요?',
    4: '구체적인 지향점이네요. To-Be를 향해\n당장 다음 주에 없애거나 바꿀 수 있는 액션은 무엇인가요?',
  },
}

export default function ChatPage() {
  const router = useRouter()
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [currentCard, setCurrentCard] = useState<CardNumber>(1)
  const [currentStep, setCurrentStep] = useState<StepNumber>(1)
  const [cardData, setCardData] = useState<Record<CardNumber, CardData>>({ 1: {}, 2: {}, 3: {} })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [chatKey, setChatKey] = useState(0)

  // 페이즈: loading → review (완료) 또는 step → summary (진행 중)
  const [phase, setPhase] = useState<'loading' | 'step' | 'summary' | 'review'>('loading')
  const [summaryText, setSummaryText] = useState('')
  const [summaryStreaming, setSummaryStreaming] = useState(false)
  const summaryBottomRef = useRef<HTMLDivElement>(null)

  // 리뷰 모드용
  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [reviewCard, setReviewCard] = useState<CardNumber>(1)
  const [editingCard, setEditingCard] = useState<CardNumber | null>(null)
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    const id = localStorage.getItem('participant_id')
    if (!id) { router.replace('/'); return }
    setParticipantId(id)

    // 기존 카드 데이터 확인
    fetch(`/api/card?participantId=${id}`)
      .then((r) => r.json())
      .then(({ cards }: { cards: SavedCard[] }) => {
        const confirmed = cards.filter((c) => c.is_confirmed)
        if (confirmed.length === 3) {
          // 3장 모두 완료 → 읽기 모드
          setSavedCards(confirmed.sort((a, b) => a.card_number - b.card_number))
          setPhase('review')
        } else {
          // 미완료 → 다음 카드부터 시작
          const next = ([1, 2, 3] as CardNumber[]).find(
            (n) => !confirmed.find((c) => c.card_number === n)
          ) ?? 1
          setCurrentCard(next)
          setPhase('step')
        }
      })
      .catch(() => setPhase('step'))
  }, [router])

  // 요약 텍스트 증가할 때마다 아래로 스크롤
  useEffect(() => {
    summaryBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [summaryText])

  const startSummary = useCallback((data: CardData, card: CardNumber) => {
    setSummaryText('')
    setSummaryStreaming(true)
    setPhase('summary')

    fetchStream(
      '/api/card-summary',
      {
        cardTopic: CARD_TOPICS[card],
        step1: data.step1?.answer ?? '',
        step2: data.step2?.answer ?? '',
        step3: data.step3?.answer ?? '',
        step4: data.step4?.answer ?? '',
      },
      (chunk) => setSummaryText((prev) => prev + chunk),
      () => setSummaryStreaming(false),
      () => {
        setSummaryStreaming(false)
        setSummaryText((prev) => prev || '요약 생성 중 오류가 발생했어요. 확정 후 다음 단계로 진행해주세요.')
      }
    )
  }, [])

  const handleConfirm = useCallback(async (messages: ChatMessage[]) => {
    setSaveError('')

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    const answer = lastUserMsg?.content ?? ''
    const stepKey = `step${currentStep}` as `step${StepNumber}`

    const newCardData: Record<CardNumber, CardData> = {
      ...cardData,
      [currentCard]: {
        ...cardData[currentCard],
        [stepKey]: { answer, chatHistory: messages },
      },
    }
    setCardData(newCardData)

    // Step 1~3: 다음 Step으로
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as StepNumber)
      setChatKey((k) => k + 1)
      return
    }

    // Step 4 완료 → 요약 페이즈
    startSummary(newCardData[currentCard], currentCard)
  }, [currentCard, currentStep, cardData, startSummary])

  // [수정하기]: 현재 카드 Step1부터 다시 작성
  const handleRevise = useCallback(() => {
    setCardData((prev) => ({ ...prev, [currentCard]: {} }))
    setCurrentStep(1)
    setPhase('step')
    setChatKey((k) => k + 1)
  }, [currentCard])

  // [수정 시작]: 해당 카드 편집 모드 진입
  const handleStartEdit = useCallback((cardNum: CardNumber) => {
    const card = savedCards.find((c) => c.card_number === cardNum)
    setEditFields({
      step1_keywords: card?.step1_keywords ?? '',
      step2_asis: card?.step2_asis ?? '',
      step3_tobe: card?.step3_tobe ?? '',
      step4_action: card?.step4_action ?? '',
      step5_indicator: card?.step5_indicator ?? '',
    })
    setEditError('')
    setEditingCard(cardNum)
  }, [savedCards])

  // [수정 저장]: PUT 요청으로 내용만 업데이트
  const handleSaveEdit = useCallback(async () => {
    if (!participantId || editingCard === null) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch('/api/card', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          cardNumber: editingCard,
          fields: editFields,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? '저장 실패')
      }
      // 로컬 상태 반영
      setSavedCards((prev) =>
        prev.map((c) =>
          c.card_number === editingCard
            ? {
                ...c,
                step1_keywords: editFields.step1_keywords || null,
                step2_asis: editFields.step2_asis || null,
                step3_tobe: editFields.step3_tobe || null,
                step4_action: editFields.step4_action || null,
                step5_indicator: editFields.step5_indicator || null,
              }
            : c
        )
      )
      setEditingCard(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '저장 오류가 발생했어요.')
    } finally {
      setEditSaving(false)
    }
  }, [participantId, editingCard, editFields])

  // [확정하고 다음 카드로]: Supabase 저장 후 이동
  const handleConfirmCard = useCallback(async () => {
    if (!participantId) return
    setSaving(true)
    setSaveError('')

    try {
      const res = await fetch('/api/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          cardNumber: currentCard,
          cardData: cardData[currentCard],
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? '저장 실패')
      }

      if (currentCard < 3) {
        setCurrentCard((prev) => (prev + 1) as CardNumber)
        setCurrentStep(1)
        setPhase('step')
        setChatKey((k) => k + 1)
      } else {
        router.push('/masterplan')
      }
    } catch (err) {
      console.error('저장 오류:', err)
      setSaveError('저장 중 오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }, [currentCard, cardData, participantId, router])

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── 읽기 모드 (카드 3장 모두 완료) ──────────────────────────────────────────
  if (phase === 'review') {
    const card = savedCards.find((c) => c.card_number === reviewCard)
    const STEPS: { label: string; value: string | null }[] = [
      { label: STEP_TITLES[1], value: card?.step1_keywords ?? null },
      { label: STEP_TITLES[2], value: card?.step2_asis ?? null },
      { label: STEP_TITLES[3], value: card?.step3_tobe ?? null },
      { label: STEP_TITLES[4], value: card?.step4_action ?? null },
      { label: STEP_TITLES[5], value: card?.step5_indicator ?? null },
    ]

    return (
      <div className="flex flex-col" style={{ height: '100dvh' }}>
        {/* 헤더 */}
        <header className="bg-white border-b border-[#EBEBEB] px-4 pt-3 pb-3 shrink-0">
          <div className="flex items-center justify-between -mx-1 mb-2">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-0.5 h-8 px-2 rounded-xl active:bg-[#F5F5F5] text-[#8A8A8A]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span className="text-xs font-medium">이전</span>
            </button>
            <p className="text-xs text-[#8A8A8A]">오전 세션 · 카드 작성 완료</p>
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
          {/* 카드 탭 */}
          <div className="flex gap-2">
            {([1, 2, 3] as CardNumber[]).map((n) => (
              <button
                key={n}
                onClick={() => { setReviewCard(n); setEditingCard(null) }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  reviewCard === n
                    ? 'bg-[#111111] text-white'
                    : 'bg-[#F5F5F5] text-[#8A8A8A] active:bg-[#EBEBEB]'
                }`}
              >
                카드 {n}
              </button>
            ))}
          </div>
        </header>

        {/* 카드 내용 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#F5F5F5]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-[#111111] tracking-tight">{CARD_TITLES[reviewCard]}</p>
            {editingCard !== reviewCard && (
              <button
                onClick={() => handleStartEdit(reviewCard)}
                className="flex items-center gap-1 h-8 px-3 rounded-xl bg-white border border-[#EBEBEB] text-xs font-medium text-[#3A3A3A] active:bg-[#F5F5F5] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                수정하기
              </button>
            )}
          </div>

          {editingCard === reviewCard ? (
            /* 편집 모드 */
            <div className="space-y-3">
              {([
                ['step1_keywords', STEP_TITLES[1]],
                ['step2_asis',     STEP_TITLES[2]],
                ['step3_tobe',     STEP_TITLES[3]],
                ['step4_action',   STEP_TITLES[4]],
                ['step5_indicator', STEP_TITLES[5]],
              ] as const).map(([field, label]) => (
                <div key={field} className="bg-white border border-[#EBEBEB] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#8A8A8A]">{label}</p>
                  </div>
                  <textarea
                    value={editFields[field] ?? ''}
                    onChange={(e) => setEditFields((prev) => ({ ...prev, [field]: e.target.value }))}
                    rows={3}
                    className="w-full px-4 pb-3 text-sm text-[#111111] leading-relaxed resize-none focus:outline-none bg-transparent"
                    placeholder="내용을 입력해주세요"
                    disabled={editSaving}
                  />
                </div>
              ))}
              {editError && <p className="text-xs text-red-500 text-center">{editError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditingCard(null)}
                  disabled={editSaving}
                  className="flex-1 h-11 rounded-xl border border-[#EBEBEB] bg-white text-sm font-medium text-[#8A8A8A] active:bg-[#F5F5F5] disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editSaving}
                  className="flex-1 h-11 rounded-xl bg-[#111111] text-white text-sm font-semibold active:bg-[#3A3A3A] disabled:opacity-50"
                >
                  {editSaving ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </div>
          ) : (
            /* 읽기 모드 */
            <div className="space-y-3">
              {STEPS.map(({ label, value }) => {
                if (!value) return null
                return (
                  <div key={label} className="bg-white border border-[#EBEBEB] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#8A8A8A]">{label}</p>
                    </div>
                    <p className="px-4 pb-3 text-sm text-[#111111] leading-relaxed whitespace-pre-wrap">{value}</p>
                  </div>
                )
              })}
            </div>
          )}
          <div className="h-4" />
        </div>

        {/* 하단 이동 버튼 */}
        <div className="px-4 pb-4 pt-2 border-t border-[#EBEBEB] bg-white shrink-0">
          <button
            onClick={() => router.push('/masterplan')}
            className="w-full h-12 rounded-xl bg-[#111111] active:bg-[#3A3A3A] text-white font-semibold text-sm transition-colors"
          >
            마스터플랜 보러가기 →
          </button>
        </div>
      </div>
    )
  }

  if (!participantId) return null

  const isLastCard = currentCard === 3
  const confirmLabel =
    currentStep < 4
      ? `Step ${currentStep} 확정 → Step ${currentStep + 1}로`
      : '내용 확인하기'

  return (
    <div className="relative flex flex-col" style={{ height: '100dvh' }}>
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-[#EBEBEB] px-4 pt-3 pb-2 shrink-0">
        {/* 카드 진행 바 (emerald — 승인된 용도) */}
        <div className="flex gap-1.5 mb-2.5">
          {([1, 2, 3] as CardNumber[]).map((card) => (
            <div
              key={card}
              className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${
                card < currentCard
                  ? 'bg-[#02855B]'
                  : card === currentCard
                  ? 'bg-[#02855B]/40'
                  : 'bg-[#EBEBEB]'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between -mx-1 mb-2">
          <button
            onClick={() => router.push('/')}
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

        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[#8A8A8A] mb-0.5">카드 {currentCard} / 3</p>
            <h1 className="text-base font-bold text-[#111111] leading-tight tracking-tight">
              {CARD_TITLES[currentCard]}
            </h1>
          </div>
          <div className="text-right shrink-0 ml-3">
            {phase === 'step' ? (
              <>
                <p className="text-xs text-[#8A8A8A] mb-0.5">Step {currentStep} / 4</p>
                <p className="text-sm font-bold text-[#111111] leading-tight">
                  {STEP_TITLES[currentStep]}
                </p>
              </>
            ) : (
              <p className="text-sm font-bold text-[#111111] leading-tight">정리 완료 확인</p>
            )}
          </div>
        </div>

        {/* Step 진행 바 (step 페이즈에서만, emerald — 승인된 용도) */}
        {phase === 'step' && (
          <div className="flex gap-1 mt-2">
            {([1, 2, 3, 4] as StepNumber[]).map((step) => (
              <div
                key={step}
                className={`flex-1 h-1 rounded-full transition-colors duration-300 ${
                  step < currentStep
                    ? 'bg-[#02855B]'
                    : step === currentStep
                    ? 'bg-[#02855B]/40'
                    : 'bg-[#EBEBEB]'
                }`}
              />
            ))}
          </div>
        )}
      </header>

      {/* 저장 오류 메시지 */}
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between shrink-0">
          <p className="text-sm text-red-600">{saveError}</p>
          <button
            onClick={() => setSaveError('')}
            className="text-xs text-red-400 underline ml-3 shrink-0"
          >
            닫기
          </button>
        </div>
      )}

      {/* 메인 영역 */}
      {phase === 'step' ? (
        <div className="flex-1 overflow-hidden">
          <ChatWindow
            key={`${currentCard}-${currentStep}-${chatKey}`}
            cardNumber={currentCard}
            step={currentStep}
            onConfirm={handleConfirm}
            confirmLabel={confirmLabel}
            initialMessage={INITIAL_MESSAGES[currentCard][currentStep]}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 요약 텍스트 영역 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#F5F5F5]">
            <div className="bg-white rounded-2xl border border-[#EBEBEB] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#8A8A8A] mb-3">
                카드 {currentCard} · {CARD_TITLES[currentCard]} 정리
              </p>
              {summaryText ? (
                <>
                  <p className="text-sm text-[#111111] whitespace-pre-wrap leading-relaxed">
                    {summaryText}
                  </p>
                  {summaryStreaming && (
                    <span className="inline-block w-0.5 h-4 bg-[#8A8A8A] animate-pulse ml-0.5 align-middle" />
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-[#8A8A8A] text-sm py-4">
                  <div className="w-4 h-4 border-2 border-[#111111] border-t-transparent rounded-full animate-spin shrink-0" />
                  AI가 내용을 정리하고 있어요...
                </div>
              )}
            </div>
            <div ref={summaryBottomRef} />
          </div>

          {/* 수정 / 확정 버튼 (스트리밍 완료 후 표시) */}
          {!summaryStreaming && (
            <div className="px-4 pb-4 pt-2 flex gap-3 shrink-0 border-t border-[#EBEBEB] bg-white">
              <button
                onClick={handleRevise}
                className="flex-1 h-12 rounded-xl border border-[#EBEBEB] bg-[#F5F5F5] text-[#3A3A3A] text-sm font-semibold active:bg-[#EBEBEB] transition-colors"
              >
                수정하기
              </button>
              <button
                onClick={handleConfirmCard}
                disabled={saving}
                className="flex-1 h-12 rounded-xl bg-[#111111] active:bg-[#3A3A3A] text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {saving
                  ? '저장 중...'
                  : isLastCard
                  ? '확정 → 마스터플랜으로'
                  : `확정하고 카드 ${currentCard + 1}로`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 저장 중 오버레이 */}
      {saving && (
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
