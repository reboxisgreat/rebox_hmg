'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ChevronLeft, ArrowRight, X, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import type { ChatMessage } from '@/lib/types'

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
    if (!res.ok) { onError('AI 응답을 가져오는 데 실패했어요.'); return }
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
  } catch { onError('네트워크 오류가 발생했어요.') }
}

// ── 요약 유틸 ────────────────────────────────────────────────────────────────

interface Summary {
  step1: string
  step2: string
  step3: string
  step4: string
}

function parseSummary(content: string): Summary | null {
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
  const hashTags = raw.split(/\s+/).filter(t => t.startsWith('#')).map(t => t.slice(1).trim()).filter(Boolean)
  if (hashTags.length > 0) return hashTags
  return raw.split(/[,，、\s·]+/).map(s => s.replace(/^#+/, '').trim()).filter(Boolean)
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function ProblemDefinitionPage() {
  const router = useRouter()
  const [participantId, setParticipantId] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [chatError, setChatError] = useState('')

  const [currentStep, setCurrentStep] = useState(1)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryCollapsed, setSummaryCollapsed] = useState(false)

  const [saving, setSaving] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetting, setResetting] = useState(false)

  const [shouldAutoStart, setShouldAutoStart] = useState(false)

  const chatBottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatInitiatedRef = useRef(false)
  const participantIdRef = useRef<string | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const summaryAutoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { participantIdRef.current = participantId }, [participantId])

  useEffect(() => {
    const allContent = messages.filter(m => m.role === 'model').map(m => m.content).join('')
    const matches = [...allContent.matchAll(/\[Step (\d)\/4\]/g)]
    if (matches.length > 0) {
      const maxStep = Math.max(...matches.map(m => parseInt(m[1])))
      setCurrentStep(maxStep)
    }
  }, [messages])

  useEffect(() => {
    if (isStreaming || !participantIdRef.current || messagesRef.current.length === 0) return
    const lastModel = [...messagesRef.current].reverse().find(m => m.role === 'model')
    if (!lastModel) return

    const parsed = parseSummary(lastModel.content)
    if (parsed) {
      setSummary(parsed)
      setShowSummary(true)
      fetch('/api/problem-definition', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participantIdRef.current,
          step1: parsed.step1, step2: parsed.step2,
          step3: parsed.step3, step4: parsed.step4,
          chatHistory: messagesRef.current,
          isConfirmed: false,
        }),
      }).catch(() => {})
    } else {
      fetch('/api/problem-definition', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participantIdRef.current,
          step1: '', step2: '', step3: '', step4: '',
          chatHistory: messagesRef.current,
          isConfirmed: false,
        }),
      }).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming])

  useEffect(() => {
    const id = localStorage.getItem('participant_id')
    if (!id) { router.replace('/'); return }
    setParticipantId(id)

    fetch(`/api/problem-definition?participantId=${id}`)
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.chat_history?.length > 0) {
          setMessages(data.chat_history)
          chatInitiatedRef.current = true
          const lastAI = [...(data.chat_history as ChatMessage[])].reverse().find(m => m.role === 'model')
          const parsed = lastAI ? parseSummary(lastAI.content) : null
          if (parsed) {
            setSummary(parsed)
            setShowSummary(true)
          } else if (data.step3_definition) {
            setSummary({
              step1: data.step1_customer ?? '',
              step2: data.step2_problem ?? '',
              step3: data.step3_definition ?? '',
              step4: data.step4_keywords ?? '',
            })
            if (data.is_confirmed) setShowSummary(true)
          }
        } else {
          setShouldAutoStart(true)
        }
      })
      .catch(() => setShouldAutoStart(true))
  }, [router])

  useEffect(() => {
    if (!shouldAutoStart || chatInitiatedRef.current) return
    chatInitiatedRef.current = true
    setIsStreaming(true)
    const aiPlaceholder: ChatMessage = { role: 'model', content: '', timestamp: new Date().toISOString() }
    setMessages([aiPlaceholder])

    fetchStream(
      '/api/problem-definition',
      { messages: [] },
      (chunk) => {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role !== 'model') return prev
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
        })
      },
      () => setIsStreaming(false),
      (err) => { setIsStreaming(false); setChatError(err); setMessages([]) }
    )
  }, [shouldAutoStart])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 요약 필드 직접 수정 + 1초 디바운스 자동저장
  const updateSummaryField = useCallback((field: keyof Summary, value: string) => {
    setSummary(prev => {
      if (!prev) return prev
      const next = { ...prev, [field]: value }
      if (summaryAutoSaveTimer.current) clearTimeout(summaryAutoSaveTimer.current)
      summaryAutoSaveTimer.current = setTimeout(() => {
        if (!participantIdRef.current) return
        fetch('/api/problem-definition', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: participantIdRef.current,
            step1: next.step1, step2: next.step2,
            step3: next.step3, step4: next.step4,
            chatHistory: messagesRef.current,
            isConfirmed: false,
          }),
        }).catch(() => {})
      }, 1000)
      return next
    })
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
      '/api/problem-definition',
      { messages: updatedMessages.map(m => ({ role: m.role, content: m.content })) },
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
      await fetch('/api/problem-definition', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          step1: '', step2: '', step3: '', step4: '',
          chatHistory: [],
          isConfirmed: false,
        }),
      })
    } catch { /* ignore */ } finally {
      setResetting(false)
      setShowResetModal(false)
      setMessages([])
      setSummary(null)
      setShowSummary(false)
      setCurrentStep(1)
      setChatError('')
      setInput('')
      chatInitiatedRef.current = false
      setShouldAutoStart(true)
    }
  }

  const handleConfirm = async () => {
    if (!participantId || !summary) return
    setSaving(true)
    if (summaryAutoSaveTimer.current) clearTimeout(summaryAutoSaveTimer.current)
    try {
      await fetch('/api/problem-definition', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          step1: summary.step1, step2: summary.step2,
          step3: summary.step3, step4: summary.step4,
          chatHistory: messages,
          isConfirmed: true,
        }),
      })
    } catch { /* ignore */ } finally {
      setSaving(false)
      setShowConfirmModal(false)
      router.push('/chat')
    }
  }

  if (!participantId) return null

  const progressPct = (currentStep / 4) * 100

  // 편집 가능한 textarea 스타일 (포커스 전 텍스트처럼, 포커스 시 입력 박스)
  const editableClass = "w-full bg-transparent resize-none focus:outline-none focus:bg-white focus:border focus:border-[#A6444C]/30 focus:rounded-lg focus:px-2 focus:py-1 transition-all leading-relaxed"

  return (
    <div className="flex flex-col bg-[#F7F7F8]" style={{ height: '100dvh' }}>

      {/* 헤더 */}
      <div className="bg-[#f5f5f5] px-5 pt-3 pb-5 shrink-0">
        {/* 로고 — 최상단 */}
        <div className="flex justify-end mb-2">
          <Image src="/메인로고.png" alt="메인 로고" width={160} height={80} className="object-contain" />
        </div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-sm active:opacity-60 transition-colors"
          >
            <ChevronLeft size={16} />
            홈
          </button>
        </div>
        <div className="flex items-end justify-between mb-2">
          <h1 className="text-[1.2rem] font-bold leading-tight">고객의 진짜 문제 정의 내리기</h1>
          <span className="text-xs font-bold text-[#02855B] shrink-0 ml-3 mb-0.5">Step {currentStep}/4</span>
        </div>
        <div className="w-full bg-black/10 rounded-full h-1.5 mb-2">
          <div
            className="bg-[#02855B] h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
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
            <div className="w-7 h-7 bg-[#F0FDF4] rounded-lg flex items-center justify-center shrink-0">
              <Sparkles size={13} color="#02855B" />
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
                <div className="w-7 h-7 bg-[#F0FDF4] rounded-lg flex items-center justify-center shrink-0">
                  <Sparkles size={13} color="#02855B" />
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

      {/* 최종 결과 패널 */}
      {showSummary && summary && (
        <div className="px-4 pb-3 shrink-0 animate-panel-slide-up">
          <div className="rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.13)] overflow-hidden border border-[#A6444C]" style={{ background: '#FFF9F0' }}>

            {/* HEADER — 탭하면 접기/펼치기 */}
            <button
              onClick={() => setSummaryCollapsed(c => !c)}
              className="w-full px-5 pt-4 pb-3 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-[#A6444C] leading-snug">
                    {summaryCollapsed ? '고객의 진짜 문제 정의 내리기' : <>고객의 진짜 문제 정의 내리기:<br/>고객의 진짜 문제 정렬 툴킷</>}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Image src="/메인로고.png" alt="메인 로고" width={160} height={80} className="object-contain" />
                <span className="text-[10px] text-[#A6444C] font-semibold">
                  {summaryCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </div>
            </button>

            {/* BODY + BUTTONS — 접혔을 때 숨김 */}
            {!summaryCollapsed && <div className="px-4 pb-4 space-y-2">

              {/* 나의 고객 */}
              <div className="bg-white rounded-2xl px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#A6444C' }}>나의 고객</p>
                <textarea
                  value={summary.step1}
                  onChange={e => updateSummaryField('step1', e.target.value)}
                  rows={2}
                  className={`${editableClass} text-sm text-[#333]`}
                />
              </div>

              {/* 진짜 문제 */}
              <div className="bg-white rounded-2xl px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#A6444C' }}>가장 시급히, 우선적으로 해결하고 싶은 고객의 진짜 문제</p>
                <textarea
                  value={summary.step2}
                  onChange={e => updateSummaryField('step2', e.target.value)}
                  rows={3}
                  className={`${editableClass} text-sm text-[#333]`}
                />
              </div>

              {/* 한 문장 정의 */}
              <div className="bg-white rounded-2xl px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#A6444C' }}>수정된 고객의 진짜 문제 한 문장</p>
                <textarea
                  value={summary.step3}
                  onChange={e => updateSummaryField('step3', e.target.value)}
                  rows={3}
                  className={`${editableClass} text-sm text-[#444] italic`}
                />
              </div>

              {/* 주요 키워드 */}
              <div className="bg-white rounded-2xl px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: '#A6444C' }}>주요 키워드 (원인)</p>
                <textarea
                  value={summary.step4}
                  onChange={e => updateSummaryField('step4', e.target.value)}
                  rows={1}
                  placeholder="#키워드1 #키워드2 #키워드3"
                  className={`${editableClass} text-sm text-[#333] mb-2`}
                />
                <div className="flex flex-wrap gap-1.5">
                  {parseKeywords(summary.step4).map((kw, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: '#A6444C' }}>
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>}

            {!summaryCollapsed && <div className="px-4 pb-5 space-y-2">
              <button
                onClick={() => setShowConfirmModal(true)}
                className="w-full rounded-2xl bg-[#111111] text-white text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                style={{ height: '45px' }}
              >
                다음 카드로 이동(고객가치 관리)
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full rounded-2xl text-[#8A8A8A] text-sm font-medium active:text-[#111] transition-colors"
                style={{ height: '44px' }}
              >
                홈으로 이동
              </button>
            </div>}
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
            className="w-11 h-11 rounded-2xl bg-[#02855B] active:bg-[#026644] text-white flex items-center justify-center disabled:opacity-40 shrink-0 transition-colors"
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
              <h2 className="text-lg font-bold text-[#111]">처음부터 다시 시작하시겠습니까?</h2>
              <button onClick={() => setShowResetModal(false)} className="p-1 -mr-1 -mt-1">
                <X size={20} color="#8A8A8A" />
              </button>
            </div>
            <p className="text-sm text-[#8A8A8A] mb-6 leading-relaxed">
              지금까지의 대화 내용이 모두 초기화됩니다.
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

      {/* 확인 모달 */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmModal(false) }}
        >
          <div className="bg-white rounded-t-3xl w-full max-w-lg px-6 pt-6 pb-10">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-bold text-[#111]">카드 실습으로 이동할까요?</h2>
              <button onClick={() => setShowConfirmModal(false)} className="p-1 -mr-1 -mt-1">
                <X size={20} color="#8A8A8A" />
              </button>
            </div>
            <p className="text-sm text-[#8A8A8A] mb-6 leading-relaxed">
              고객 문제 정의 내용은 저장됩니다. <br/>언제든지 돌아와서 수정할 수 있어요.
            </p>
            <div className="space-y-2">
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="w-full rounded-2xl bg-[#111111] text-white text-base font-semibold disabled:opacity-60 active:scale-[0.98] transition-all"
                style={{ height: '54px' }}
              >
                {saving ? '저장 중...' : '네, 카드 실습으로 이동'}
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
