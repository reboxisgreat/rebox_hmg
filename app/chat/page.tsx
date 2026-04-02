'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, ChevronLeft, ArrowRight, X, ChevronDown, ChevronUp, Home } from 'lucide-react'
import Image from 'next/image'
import type { ChatMessage } from '@/lib/types'
import { CARD_TITLES, STEP_TITLES } from '@/lib/types'

// ── 스트리밍 유틸 ─────────────────────────────────────────────────────────────

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
    if (!res.ok) { onError('AI 응답을 가져오는 데 실패했어요. 다시 시도해주세요.'); return }
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
        } catch { /* ignore */ }
      }
    }
    onDone()
  } catch { onError('네트워크 오류가 발생했어요. 연결을 확인해주세요.') }
}

// ── SUMMARY 파싱 유틸 ─────────────────────────────────────────────────────────

interface CardSummary {
  step1: string
  step2: string
  step3: string
  step4: string
  step5: string
}

function parseSummary(content: string): CardSummary | null {
  const start = content.indexOf('__SUMMARY_START__')
  const end = content.indexOf('__SUMMARY_END__')
  if (start === -1 || end === -1 || end <= start) return null
  const jsonStr = content.slice(start + '__SUMMARY_START__'.length, end).trim()
  try {
    return JSON.parse(jsonStr)
  } catch { return null }
}

function getDisplayContent(content: string): string {
  const idx = content.indexOf('__SUMMARY_START__')
  if (idx === -1) return content
  const endIdx = content.indexOf('__SUMMARY_END__')
  const after = endIdx !== -1 ? content.slice(endIdx + '__SUMMARY_END__'.length).trim() : ''
  const before = content.slice(0, idx).trim()
  return [before, after].filter(Boolean).join('\n\n')
}

function parseKeywords(raw: string): string[] {
  // # 제거 후 쉼표·줄바꿈 기준 분리
  const cleaned = raw.replace(/#/g, '').trim()
  let parts = cleaned.split(/[,，、\n]+/).map(s => s.trim()).filter(Boolean)
  // 쉼표 없으면 공백 기준 분리 (예: "F1 주어=고객 문제정의")
  if (parts.length <= 1 && cleaned.includes(' ')) {
    parts = cleaned.split(/\s+/).map(s => s.trim()).filter(Boolean)
  }
  return parts.length > 0 ? parts : ['']
}

function parseItems(raw: string, splitComma = false): string[] {
  let lines = raw.split(/\n/).map(s => s.trim()).filter(Boolean)
  // 줄바꿈 없는 단일 텍스트는 ". " (마침표+공백) 기준으로만 분리 — 약어(RACI, etc.) 보호
  if (lines.length <= 1) lines = raw.split(/\.\s+/).map(s => s.trim()).filter(Boolean)
  // Action 전용: 쉼표 기준으로 추가 분리
  if (splitComma && lines.length <= 1) lines = raw.split(/,\s*/).map(s => s.trim()).filter(Boolean)
  const cleaned = lines
    .map(s => s.replace(/^[\d]+[.)]\s*|^[①②③④⑤⑥⑦⑧⑨⑩•\-·]\s*/, '').trim())
    .filter(Boolean)
  // 1~3자 대문자 조각(RACI 약어 분열 등)은 이전 항목 끝에 합치기
  const merged: string[] = []
  for (const line of cleaned) {
    if (/^[A-Z]{1,3}$/.test(line) && merged.length > 0) {
      merged[merged.length - 1] += line
    } else {
      merged.push(line)
    }
  }
  return merged
}

// ── 타입 ──────────────────────────────────────────────────────────────────────

type CardNumber = 1 | 2 | 3

interface SavedCard {
  card_number: CardNumber
  step1_keywords: string | null
  step2_asis: string | null
  step3_tobe: string | null
  step4_action: string | null
  step5_indicator: string | null
  is_confirmed: boolean
  chat_history: ChatMessage[] | null
}

const CARD_COLOR: Record<CardNumber, string> = { 1: '#DC2626', 2: '#D97706', 3: '#16A34A' }
const CARD_BG: Record<CardNumber, string> = { 1: '#FFF1F2', 2: '#FFFBEB', 3: '#F0FDF4' }
const CARD_BORDER: Record<CardNumber, string> = { 1: '#FECDD3', 2: '#FDE68A', 3: '#BBF7D0' }
const CARD_ICON_BG: Record<CardNumber, string> = { 1: '#FFE4E6', 2: '#FEF3C7', 3: '#DCFCE7' }
const CARD_SHORT_NAME: Record<CardNumber, string> = { 1: '고객가치관리', 2: '사람관리', 3: '프로세스관리' }
const CARD_LABEL_NAME: Record<CardNumber, string> = { 1: '고객가치 관리', 2: '사람관리', 3: '프로세스 관리' }

// ── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageContent />
    </Suspense>
  )
}

function ChatPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'loading' | 'chatting' | 'review'>('loading')

  // 현재 카드 상태 (URL ?card=N 으로 초기 카드 지정 가능)
  const initialCard = (() => {
    if (typeof window === 'undefined') return 1 as CardNumber
    const n = Number(new URLSearchParams(window.location.search).get('card'))
    return (n === 1 || n === 2 || n === 3) ? n as CardNumber : 1
  })()
  const [currentCard, setCurrentCard] = useState<CardNumber>(initialCard)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [chatError, setChatError] = useState('')
  const [currentStep, setCurrentStep] = useState(1)
  const [summary, setSummary] = useState<CardSummary | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryCollapsed, setSummaryCollapsed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shouldAutoStart, setShouldAutoStart] = useState(false)

  // 모달
  const [showResetModal, setShowResetModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [resetting, setResetting] = useState(false)

  // 리뷰 모드
  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [reviewCard, setReviewCard] = useState<CardNumber>(1)
  const [editingCard, setEditingCard] = useState<CardNumber | null>(null)
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const chatBottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatInitiatedRef = useRef(false)
  const participantIdRef = useRef<string | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const currentCardRef = useRef<CardNumber>(initialCard)
  const summaryAutoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { participantIdRef.current = participantId }, [participantId])
  useEffect(() => { currentCardRef.current = currentCard }, [currentCard])

  // Step 추적 (AI 메시지에서 [Step X/5] 패턴 감지)
  useEffect(() => {
    const allContent = messages.filter(m => m.role === 'model').map(m => m.content).join('')
    const matches = [...allContent.matchAll(/\[Step (\d)\/5\]/g)]
    if (matches.length > 0) {
      const maxStep = Math.max(...matches.map(m => parseInt(m[1])))
      setCurrentStep(maxStep)
    }
  }, [messages])

  // 스트리밍 완료 시 채팅 기록 자동저장 + SUMMARY 감지
  useEffect(() => {
    if (isStreaming || !participantIdRef.current || messagesRef.current.length === 0) return
    const lastModel = [...messagesRef.current].reverse().find(m => m.role === 'model')
    if (!lastModel) return

    // 채팅 기록 항상 저장 (step 미완료여도)
    fetch('/api/card', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: participantIdRef.current,
        cardNumber: currentCardRef.current,
        chatHistory: messagesRef.current,
      }),
    }).catch(() => {})

    const parsed = parseSummary(lastModel.content)
    if (parsed) {
      setSummary(parsed)
      setShowSummary(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming])

  // 인증 확인 + 저장 데이터 로드
  useEffect(() => {
    const id = localStorage.getItem('participant_id')
    if (!id) { router.replace('/'); return }
    setParticipantId(id)

    fetch(`/api/card?participantId=${id}`)
      .then(r => r.json())
      .then(({ cards }: { cards: SavedCard[] }) => {
        const confirmed = cards.filter(c => c.is_confirmed)
        if (confirmed.length === 3) {
          setSavedCards(confirmed.sort((a, b) => a.card_number - b.card_number))
          setPhase('review')
        } else {
          // URL ?card=N 파라미터가 있으면 우선 적용, 없으면 첫 미완료 카드
          // window.location.search 직접 읽기 (useSearchParams stale 문제 방지)
          const rawParam = new URLSearchParams(window.location.search).get('card')
          const urlCard = rawParam && ['1','2','3'].includes(rawParam)
            ? Number(rawParam) as CardNumber
            : null
          const next = urlCard ?? (([1, 2, 3] as CardNumber[]).find(
            n => !confirmed.find(c => c.card_number === n)
          ) ?? 1)
          setCurrentCard(next)
          currentCardRef.current = next
          setPhase('chatting')

          // 해당 카드의 채팅 기록 복원 (확정 카드 포함)
          const cardData = cards.find(c => c.card_number === next)
          if (cardData?.chat_history && cardData.chat_history.length > 0) {
            setMessages(cardData.chat_history)
            chatInitiatedRef.current = true
            // SUMMARY 복원
            const lastAI = [...cardData.chat_history].reverse().find(m => m.role === 'model')
            const parsed = lastAI ? parseSummary(lastAI.content) : null
            if (parsed) { setSummary(parsed); setShowSummary(true) }
          } else {
            setShouldAutoStart(true)
          }
        }
      })
      .catch(() => {
        setPhase('chatting')
        setShouldAutoStart(true)
      })
  }, [router, searchParams])

  // AI 자동 시작
  useEffect(() => {
    if (!shouldAutoStart || chatInitiatedRef.current) return
    chatInitiatedRef.current = true
    setShouldAutoStart(false)
    startAI([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoStart])

  // 스크롤
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startAI = useCallback((initialMessages: ChatMessage[]) => {
    setIsStreaming(true)
    const aiPlaceholder: ChatMessage = { role: 'model', content: '', timestamp: new Date().toISOString() }
    setMessages([...initialMessages, aiPlaceholder])

    fetchStream(
      '/api/chat',
      { cardNumber: currentCardRef.current, messages: initialMessages.map(m => ({ role: m.role, content: m.content })) },
      (chunk) => {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role !== 'model') return prev
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
        })
      },
      () => setIsStreaming(false),
      (err) => {
        setIsStreaming(false)
        setChatError(err)
        setMessages(initialMessages)
      }
    )
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return
    setChatError('')
    const userMsg: ChatMessage = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() }
    const updatedMessages = [...messages, userMsg]
    const aiPlaceholder: ChatMessage = { role: 'model', content: '', timestamp: new Date().toISOString() }
    setMessages([...updatedMessages, aiPlaceholder])
    setInput('')
    setIsStreaming(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    fetchStream(
      '/api/chat',
      { cardNumber: currentCardRef.current, messages: updatedMessages.map(m => ({ role: m.role, content: m.content })) },
      (chunk) => {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role !== 'model') return prev
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
        })
      },
      () => setIsStreaming(false),
      (err) => {
        setIsStreaming(false)
        setChatError(err)
        setMessages(prev =>
          prev[prev.length - 1]?.role === 'model' && prev[prev.length - 1]?.content === ''
            ? prev.slice(0, -1)
            : prev
        )
      }
    )
  }, [messages, isStreaming])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const handleReset = async () => {
    if (!participantId) return
    setResetting(true)
    try {
      // 현재 카드 chat 초기화 (확정된 카드는 유지)
    } catch { /* ignore */ } finally {
      setResetting(false)
      setShowResetModal(false)
      setMessages([])
      setSummary(null)
      setShowSummary(false)
      setSummaryCollapsed(false)
      setCurrentStep(1)
      setChatError('')
      setInput('')
      chatInitiatedRef.current = false
      setShouldAutoStart(true)
    }
  }

  const handleConfirmCard = async () => {
    if (!participantId || !summary) return
    setSaving(true)
    try {
      const res = await fetch('/api/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          cardNumber: currentCard,
          summary,
          chatHistory: messages,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? '저장 실패')
      }

      setShowConfirmModal(false)

      if (currentCard < 3) {
        const nextCard = (currentCard + 1) as CardNumber
        setCurrentCard(nextCard)
        currentCardRef.current = nextCard
        setMessages([])
        setSummary(null)
        setShowSummary(false)
        setSummaryCollapsed(false)
        setCurrentStep(1)
        setChatError('')
        setInput('')
        chatInitiatedRef.current = false
        setShouldAutoStart(true)
      } else {
        router.push('/masterplan')
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : '저장 중 오류가 발생했어요. 다시 시도해주세요.')
      setShowConfirmModal(false)
    } finally {
      setSaving(false)
    }
  }

  // 리뷰 모드 핸들러
  const handleStartEdit = useCallback((cardNum: CardNumber) => {
    const card = savedCards.find(c => c.card_number === cardNum)
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

  const updateSummaryField = useCallback((field: keyof CardSummary, value: string) => {
    setSummary(prev => {
      if (!prev) return prev
      const next = { ...prev, [field]: value }
      if (summaryAutoSaveTimer.current) clearTimeout(summaryAutoSaveTimer.current)
      summaryAutoSaveTimer.current = setTimeout(() => {
        if (!participantIdRef.current) return
        fetch('/api/card', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: participantIdRef.current,
            cardNumber: currentCardRef.current,
            fields: {
              step1_keywords: next.step1,
              step2_asis: next.step2,
              step3_tobe: next.step3,
              step4_action: next.step4,
              step5_indicator: next.step5,
            },
          }),
        }).catch(() => {})
      }, 1000)
      return next
    })
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!participantId || editingCard === null) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch('/api/card', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, cardNumber: editingCard, fields: editFields }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? '저장 실패')
      }
      setSavedCards(prev => prev.map(c =>
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
      ))
      setEditingCard(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '저장 오류가 발생했어요.')
    } finally {
      setEditSaving(false)
    }
  }, [participantId, editingCard, editFields])

  // ── 로딩 ────────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── 리뷰 모드 (3장 모두 완료) ───────────────────────────────────────────────
  if (phase === 'review') {
    const card = savedCards.find(c => c.card_number === reviewCard)
    const STEPS: { key: string; label: string; value: string | null }[] = [
      { key: 'step1_keywords', label: STEP_TITLES[1], value: card?.step1_keywords ?? null },
      { key: 'step2_asis',     label: STEP_TITLES[2], value: card?.step2_asis ?? null },
      { key: 'step3_tobe',     label: STEP_TITLES[3], value: card?.step3_tobe ?? null },
      { key: 'step4_action',   label: STEP_TITLES[4], value: card?.step4_action ?? null },
      { key: 'step5_indicator', label: STEP_TITLES[5], value: card?.step5_indicator ?? null },
    ]

    return (
      <div className="flex flex-col bg-[#F7F7F8]" style={{ height: '100dvh' }}>
        {/* 헤더 */}
        <div className="bg-[#f5f5f5] px-5 pt-3 pb-5 shrink-0">
          <div className="flex justify-end mb-2">
            <Image src="/메인로고.png" alt="메인 로고" width={160} height={80} className="object-contain" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div />
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 text-[#3A3A3A] active:opacity-60 transition-colors"
            >
              <Home size={15} />
              <span className="text-[12px] font-medium">홈으로 이동</span>
            </button>
          </div>
          <h1 className="text-[1.1rem] font-bold text-[#111] leading-tight mb-1">카드 실습 완료</h1>
          <p className="text-sm text-[#8A8A8A]">카드별 내용을 확인하고 수정할 수 있습니다.</p>
        </div>

        {/* 카드 탭 */}
        <div className="px-4 pt-4 pb-2 flex gap-2 shrink-0">
          {([1, 2, 3] as CardNumber[]).map(n => {
            const isActive = reviewCard === n
            const ICONS: Record<CardNumber, string> = { 1: '★', 2: '♦', 3: '●' }
            return (
              <button
                key={n}
                onClick={() => { setReviewCard(n); setEditingCard(null) }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                style={isActive
                  ? { background: CARD_COLOR[n], color: '#fff', border: `2px solid ${CARD_COLOR[n]}` }
                  : { background: CARD_BG[n], color: CARD_COLOR[n], border: `1.5px solid ${CARD_BORDER[n]}` }
                }
              >
                <span className="text-[11px]">{ICONS[n]}</span>
                {CARD_LABEL_NAME[n]}
              </button>
            )
          })}
        </div>

        {/* 카드 내용 */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="flex items-center justify-end mb-3">
            {editingCard !== reviewCard && (
              <button
                onClick={() => handleStartEdit(reviewCard)}
                className="flex items-center gap-1 h-8 px-3 rounded-xl bg-white border border-[#EBEBEB] text-xs font-medium text-[#3A3A3A] active:bg-[#F5F5F5] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                수정하기
              </button>
            )}
          </div>

          {editingCard === reviewCard ? (
            /* ── 편집 모드: 기존 textarea 폼 ── */
            <div className="space-y-3">
              {STEPS.map(({ key, label }) => (
                <div key={key} className="bg-white border border-[#EBEBEB] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#8A8A8A]">{label}</p>
                  </div>
                  <textarea
                    value={editFields[key] ?? ''}
                    onChange={(e) => setEditFields(prev => ({ ...prev, [key]: e.target.value }))}
                    rows={3}
                    className="w-full px-4 pb-3 text-sm text-[#111111] leading-relaxed resize-none focus:outline-none bg-transparent"
                    placeholder="내용을 입력해주세요"
                    disabled={editSaving}
                  />
                </div>
              ))}
              {editError && <p className="text-xs text-red-500 text-center">{editError}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingCard(null)} disabled={editSaving}
                  className="flex-1 h-11 rounded-xl border border-[#EBEBEB] bg-white text-sm font-medium text-[#8A8A8A] active:bg-[#F5F5F5] disabled:opacity-50">
                  취소
                </button>
                <button onClick={handleSaveEdit} disabled={editSaving}
                  className="flex-1 h-11 rounded-xl bg-[#111111] text-white text-sm font-semibold active:bg-[#3A3A3A] disabled:opacity-50">
                  {editSaving ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </div>
          ) : (
            /* ── 뷰 모드: 실물 카드 레이아웃 ── */
            <div
              className="rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.13)] overflow-hidden border relative"
              style={{ background: CARD_BG[reviewCard], borderColor: CARD_BORDER[reviewCard] }}
            >
              {/* 로고 — 우상단 절대 배치 */}
              <div className="absolute top-2 right-3">
                <Image src="/메인로고.png" alt="메인 로고" width={120} height={60} className="object-contain" />
              </div>
              {/* 카드 헤더 */}
              <div className="px-4 pt-3 pb-2 pr-32">
                <p className="text-lg font-extrabold leading-snug" style={{ color: CARD_COLOR[reviewCard] }}>
                  {CARD_TITLES[reviewCard]}
                </p>
              </div>

              {/* 부제 */}
              <div className="px-4 pb-3">
                <p className="text-xs leading-snug text-[#444]">
                  {CARD_LABEL_NAME[reviewCard]} 세션에서 가장 나의 머리와 마음을 때린{' '}
                  <span className="font-bold" style={{ color: CARD_COLOR[reviewCard] }}>
                    {CARD_LABEL_NAME[reviewCard]} <br/>#키워드 3가지
                  </span>
                </p>
              </div>

              {/* 키워드 */}
              <div className="px-4 pb-3 flex gap-2">
                {(() => {
                  const kws = parseKeywords(card?.step1_keywords ?? '')
                  return [0, 1, 2].map(i => (
                    <div key={i} className="flex-1 rounded-xl px-2 py-2.5 text-center border bg-white" style={{ borderColor: CARD_BORDER[reviewCard] }}>
                      <p className="text-xs font-bold leading-tight" style={{ color: CARD_COLOR[reviewCard] }}>#{(kws[i] ?? '').trim()}</p>
                    </div>
                  ))
                })()}
              </div>

              {/* 2×2 그리드 */}
              <div className="grid grid-cols-2 mx-4 mb-1 rounded-2xl overflow-hidden border" style={{ borderColor: CARD_BORDER[reviewCard] }}>
                {/* As-is */}
                <div className="bg-white px-3 py-3" style={{ borderRight: `1px solid ${CARD_BORDER[reviewCard]}`, borderBottom: `1px solid ${CARD_BORDER[reviewCard]}` }}>
                  <p className="text-[9px] font-bold mb-1 leading-snug" style={{ color: CARD_COLOR[reviewCard] }}>
                    As-is: 지금 나의 {CARD_LABEL_NAME[reviewCard]} 현재수준
                  </p>
                  <p className="text-xs text-[#444] leading-relaxed">{card?.step2_asis ?? ''}</p>
                </div>
                {/* To-be */}
                <div className="bg-white px-3 py-3" style={{ borderBottom: `1px solid ${CARD_BORDER[reviewCard]}` }}>
                  <p className="text-[9px] font-bold mb-1 leading-snug" style={{ color: CARD_COLOR[reviewCard] }}>
                    To-be: 2028년 12월 31일 {CARD_LABEL_NAME[reviewCard]} 지향점 모습
                  </p>
                  <p className="text-xs text-[#444] leading-relaxed">{card?.step3_tobe ?? ''}</p>
                </div>
                {/* Action */}
                <div className="bg-white px-3 py-3" style={{ borderRight: `1px solid ${CARD_BORDER[reviewCard]}` }}>
                  <p className="text-[9px] font-bold mb-2 leading-snug" style={{ color: CARD_COLOR[reviewCard] }}>
                    To-be로 가기 위해 내일부터 적용할 구체적 액션
                  </p>
                  <div className="space-y-1">
                    {parseItems(card?.step4_action ?? '', true).map((item, i) => (
                      <p key={i} className="text-xs text-[#444] leading-relaxed flex gap-1">
                        <span className="text-[#888] shrink-0">□</span>{item}
                      </p>
                    ))}
                  </div>
                </div>
                {/* Indicator */}
                <div className="bg-white px-3 py-3">
                  <p className="text-[9px] font-bold mb-2 leading-snug" style={{ color: CARD_COLOR[reviewCard] }}>
                    To-be로 도달했음을 증명하는 성공 지표
                  </p>
                  <div className="space-y-1">
                    {parseItems(card?.step5_indicator ?? '').map((item, i) => (
                      <p key={i} className="text-xs text-[#444] leading-relaxed flex gap-1">
                        <span className="text-[#888] shrink-0">□</span>{item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="h-4" />
        </div>

        {/* 하단 이동 버튼 */}
        <div className="px-4 pb-5 pt-3 border-t border-[#EBEBEB] bg-white shrink-0">
          <button
            onClick={() => router.push('/masterplan')}
            className="w-full h-12 rounded-2xl bg-[#111111] active:bg-[#3A3A3A] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            마스터플랜 보러가기
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    )
  }

  // ── 채팅 모드 ──────────────────────────────────────────────────────────────
  const progressPct = (currentStep / 5) * 100

  return (
    <div className="flex flex-col bg-[#F7F7F8]" style={{ height: '100dvh' }}>

      {/* 헤더 */}
      <div className="bg-[#f5f5f5] px-5 pt-3 pb-5 shrink-0">
        {/* 로고 — 최상단 */}
        <div className="flex justify-end mb-2">
          <Image src="/메인로고.png" alt="메인 로고" width={160} height={80} className="object-contain" />
        </div>

        <div className="flex items-center justify-between mb-3">
          {currentCard > 1 ? (
            <button
              onClick={() => router.push(`/chat?card=${currentCard - 1}`)}
              className="flex items-center gap-1.5 text-[#3A3A3A] active:opacity-60 transition-colors"
            >
              <ChevronLeft size={15} />
              <span className="text-[12px] font-medium">이전으로 가기</span>
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-[#3A3A3A] active:opacity-60 transition-colors"
          >
            <Home size={15} />
            <span className="text-[12px] font-medium">홈으로 이동</span>
          </button>
        </div>

        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-xs text-[#8A8A8A] mb-0.5">카드 {currentCard} / 3</p>
            <h1 className="text-[1.1rem] font-bold text-[#111] leading-tight">{CARD_TITLES[currentCard]}</h1>
          </div>
        </div>

        {/* Step 진행 바 */}
        <div className="w-full bg-black/10 rounded-full h-1.5 mb-2">
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: '#02855B' }}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-[#EBEBEB] text-[11px] font-semibold text-[#8A8A8A] shadow-sm active:bg-[#F5F5F5] transition-colors"
          >
            ↺ 초기화
          </button>
        </div>
      </div>

      {/* 채팅 메시지 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && isStreaming && (
          <div className="flex justify-start items-end gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: CARD_ICON_BG[currentCard] }}
            >
              <Sparkles size={13} color={CARD_COLOR[currentCard]} />
            </div>
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <span className="inline-flex gap-1">
                {[0, 1, 2].map(d => (
                  <span key={d} className="w-1.5 h-1.5 bg-[#8A8A8A] rounded-full animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
                ))}
              </span>
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const displayContent = getDisplayContent(msg.content)
          const isLastStreaming = isStreaming && i === messages.length - 1 && msg.role === 'model'
          if (msg.role === 'model' && !displayContent && !isLastStreaming) return null
          return (
            <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: CARD_ICON_BG[currentCard] }}
                >
                  <Sparkles size={13} color={CARD_COLOR[currentCard]} />
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#111111] text-white rounded-br-sm'
                  : 'bg-white text-[#111111] rounded-bl-sm shadow-sm'
              }`}>
                {displayContent || (
                  isLastStreaming && (
                    <span className="inline-flex gap-1">
                      {[0, 1, 2].map(d => (
                        <span key={d} className="w-1.5 h-1.5 bg-[#8A8A8A] rounded-full animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
                      ))}
                    </span>
                  )
                )}
              </div>
            </div>
          )
        })}

        {chatError && (
          <p className="text-center text-xs text-red-500 py-1">{chatError}</p>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* 최종 결과 패널 — 실물 카드 레이아웃 */}
      {showSummary && summary && (
        <div className="px-5 py-4 shrink-0 animate-panel-slide-up">
          <div
            className="rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.13)] overflow-hidden border"
            style={{ background: CARD_BG[currentCard], borderColor: CARD_BORDER[currentCard] }}
          >
            {/* ── 헤더 — 탭하면 접기/펼치기 ── */}
            <button
              onClick={() => setSummaryCollapsed(c => !c)}
              className="w-full px-5 pt-5 pb-4 flex items-start justify-between border-b text-left active:opacity-70 transition-opacity"
              style={{ borderColor: CARD_BORDER[currentCard] }}
            >
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-xl font-black leading-tight break-keep" style={{ color: CARD_COLOR[currentCard] }}>
                  {CARD_SHORT_NAME[currentCard]}
                </p>
                <p className="text-[11px] text-[#666] mt-1.5 leading-snug break-keep">
                  세션에서 가장 나의 머리와 마음을 때린{' '}
                  <span className="font-semibold" style={{ color: CARD_COLOR[currentCard] }}>
                    {CARD_SHORT_NAME[currentCard]}
                  </span>{' '}
                  <span className="whitespace-nowrap">#키워드 {parseKeywords(summary.step1 ?? '').length}가지</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Image src="/메인로고.png" alt="메인 로고" width={140} height={70} className="object-contain" />
                <span style={{ color: CARD_COLOR[currentCard] }}>
                  {summaryCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </div>
            </button>

            {!summaryCollapsed && <>
              {/* ── 키워드 — pill 3개 고정 ── */}
              <div
                className="px-5 pt-4 pb-4 flex gap-2.5 border-b"
                style={{ borderColor: CARD_BORDER[currentCard] }}
              >
                {(() => {
                  const keywords = parseKeywords(summary.step1 ?? '')
                  return [0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="flex-1 rounded-2xl px-2 py-3 flex items-center justify-center min-h-[48px] bg-white border"
                      style={{ borderColor: CARD_BORDER[currentCard] }}
                    >
                      <p className="text-[13px] font-bold text-center leading-tight break-keep" style={{ color: CARD_COLOR[currentCard] }}>
                        #{(keywords[i] ?? '').trim()}
                      </p>
                    </div>
                  ))
                })()}
              </div>

              {/* ── 2×2 그리드 ── */}
              <div className="grid grid-cols-2">
                {/* 좌상: As-is */}
                <div
                  className="p-4"
                  style={{
                    borderRight: `1px solid ${CARD_BORDER[currentCard]}`,
                    borderBottom: `1px solid ${CARD_BORDER[currentCard]}`,
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: CARD_COLOR[currentCard] }}>As-is</p>
                  <p className="text-[11px] font-semibold text-[#333] mb-2 leading-snug min-h-[2.5rem]">
                    지금 나의 {CARD_SHORT_NAME[currentCard]} 현재수준
                  </p>
                  <textarea
                    value={summary.step2 ?? ''}
                    onChange={e => updateSummaryField('step2', e.target.value)}
                    rows={4}
                    className="w-full bg-white/60 border rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:bg-white transition-all text-[13px] text-[#444] leading-relaxed"
                    style={{ borderColor: CARD_BORDER[currentCard] }}
                  />
                </div>
                {/* 우상: To-be */}
                <div
                  className="p-4"
                  style={{ borderBottom: `1px solid ${CARD_BORDER[currentCard]}` }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: CARD_COLOR[currentCard] }}>To-be</p>
                  <p className="text-[11px] font-semibold text-[#333] mb-2 leading-snug min-h-[2.5rem]">
                    2028년 12월 31일<br />{CARD_SHORT_NAME[currentCard]} 지향점 모습
                  </p>
                  <textarea
                    value={summary.step3 ?? ''}
                    onChange={e => updateSummaryField('step3', e.target.value)}
                    rows={4}
                    className="w-full bg-white/60 border rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:bg-white transition-all text-[13px] text-[#444] leading-relaxed"
                    style={{ borderColor: CARD_BORDER[currentCard] }}
                  />
                </div>
                {/* 좌하: 액션 */}
                <div
                  className="p-4"
                  style={{ borderRight: `1px solid ${CARD_BORDER[currentCard]}` }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: CARD_COLOR[currentCard] }}>Action</p>
                  <p className="text-[11px] font-semibold text-[#333] mb-2 leading-snug min-h-[2.5rem]">
                    To-be로 가기 위해<br />내일부터 적용할 구체적 액션
                  </p>
                  <textarea
                    value={summary.step4 ?? ''}
                    onChange={e => updateSummaryField('step4', e.target.value)}
                    rows={4}
                    className="w-full bg-white/60 border rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:bg-white transition-all text-[13px] text-[#444] leading-relaxed"
                    style={{ borderColor: CARD_BORDER[currentCard] }}
                  />
                </div>
                {/* 우하: 성공지표 */}
                <div className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: CARD_COLOR[currentCard] }}>Indicator</p>
                  <p className="text-[11px] font-semibold text-[#333] mb-2 leading-snug min-h-[2.5rem]">
                    To-be로 도달했음을<br />증명하는 성공 지표
                  </p>
                  <textarea
                    value={summary.step5 ?? ''}
                    onChange={e => updateSummaryField('step5', e.target.value)}
                    rows={4}
                    className="w-full bg-white/60 border rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:bg-white transition-all text-[13px] text-[#444] leading-relaxed"
                    style={{ borderColor: CARD_BORDER[currentCard] }}
                  />
                </div>
              </div>

              {/* ── 버튼 ── */}
              <div className="px-4 pb-5 pt-2 space-y-2">
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full rounded-2xl text-white text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  style={{ height: '52px', background: '#111111' }}
                >
                  {currentCard < 3 ? `확정하고 카드 ${currentCard + 1}로` : '확정 → 마스터플랜으로'}
                  <ArrowRight size={18} />
                </button>
                <button
                  onClick={() => setShowSummary(false)}
                  className="w-full rounded-2xl text-[#8A8A8A] text-sm font-medium"
                  style={{ height: '44px' }}
                >
                  계속 코칭 받기
                </button>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* 입력창 */}
      <div className="px-4 pb-5 pt-2 bg-white border-t border-[#EBEBEB] shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none px-4 py-3 rounded-2xl border border-[#EBEBEB] bg-[#F5F5F5] text-sm text-[#111] placeholder-[#8A8A8A] focus:outline-none focus:border-[#111] focus:bg-white disabled:opacity-50 leading-5 transition-colors overflow-y-auto"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="w-11 h-11 rounded-2xl text-white flex items-center justify-center disabled:opacity-40 shrink-0 transition-colors active:scale-[0.96]"
            style={{ background: CARD_COLOR[currentCard] }}
            aria-label="전송"
          >
            {isStreaming ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 초기화 모달 */}
      {showResetModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowResetModal(false) }}
        >
          <div className="bg-white rounded-t-3xl w-full max-w-lg px-6 pt-6 pb-10">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-bold text-[#111]">현재 카드를 처음부터 다시 시작할까요?</h2>
              <button onClick={() => setShowResetModal(false)} className="p-1 -mr-1 -mt-1">
                <X size={20} color="#8A8A8A" />
              </button>
            </div>
            <p className="text-sm text-[#8A8A8A] mb-6 leading-relaxed">
              카드 {currentCard} ({CARD_TITLES[currentCard]}) 대화 내용이 초기화됩니다.<br />
              이전에 확정한 카드는 유지됩니다.
            </p>
            <div className="space-y-2">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="w-full rounded-2xl bg-[#111111] text-white text-base font-semibold disabled:opacity-60 active:scale-[0.98] transition-all"
                style={{ height: '54px' }}
              >
                {resetting ? '초기화 중...' : '초기화'}
              </button>
              <button
                onClick={() => setShowResetModal(false)}
                className="w-full rounded-2xl text-[#8A8A8A] text-sm font-medium"
                style={{ height: '48px' }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 확정 모달 */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmModal(false) }}
        >
          <div className="bg-white rounded-t-3xl w-full max-w-lg px-6 pt-6 pb-10">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-bold text-[#111]">
                {currentCard < 3 ? `카드 ${currentCard + 1}로 이동할까요?` : '마스터플랜으로 이동할까요?'}
              </h2>
              <button onClick={() => setShowConfirmModal(false)} className="p-1 -mr-1 -mt-1">
                <X size={20} color="#8A8A8A" />
              </button>
            </div>
            <p className="text-sm text-[#8A8A8A] mb-6 leading-relaxed">
              카드 {currentCard} ({CARD_TITLES[currentCard]}) 내용이 저장됩니다.<br />
              저장 후에도 카드 실습 완료 화면에서 수정할 수 있어요.
            </p>
            <div className="space-y-2">
              <button
                onClick={handleConfirmCard}
                disabled={saving}
                className="w-full rounded-2xl bg-[#111111] text-white text-base font-semibold disabled:opacity-60 active:scale-[0.98] transition-all"
                style={{ height: '54px' }}
              >
                {saving ? '저장 중...' : currentCard < 3 ? `네, 카드 ${currentCard + 1}로 이동` : '네, 마스터플랜으로 이동'}
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-full rounded-2xl text-[#8A8A8A] text-sm font-medium"
                style={{ height: '48px' }}
              >
                계속 코칭 받기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
