'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ArrowRight, ChevronLeft, FileDown, X } from 'lucide-react'
import type { ChatMessage } from '@/lib/types'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

// ── 스트리밍 유틸 ────────────────────────────────────────────────────────────

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

// ── PDF 유틸 ─────────────────────────────────────────────────────────────────

function buildProblemDefPdfHtml(
  name: string,
  department: string,
  date: string,
  step1: string,
  step2: string,
  step3: string,
  step4: string
): string {
  const keywords = step4
    .split(/[,#\n]+/)
    .map((k) => k.replace(/^[\s#]+/, '').trim())
    .filter((k) => k.length > 0)
  const keywordBadges = keywords
    .map(
      (k) =>
        `<span style="display:inline-block;background:#111111;color:#fff;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;margin:0 6px 6px 0;">#${k}</span>`
    )
    .join('')

  return `
    <div style="padding:48px 48px 40px;background:#ffffff;">
      <div style="margin-bottom:32px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:0.14em;color:#8A8A8A;margin:0 0 8px;text-transform:uppercase;">HMG xClass · 고객의 진짜 문제 정의하기</p>
        <h1 style="font-size:26px;font-weight:700;color:#111111;margin:0 0 4px;">${name}</h1>
        ${department ? `<p style="font-size:14px;color:#8A8A8A;margin:0 0 4px;">${department}</p>` : ''}
        <p style="font-size:12px;color:#B0B0B0;margin:0;">${date}</p>
      </div>
      <div style="margin-bottom:24px;">
        <div style="background:#F5F5F5;border-radius:12px;padding:14px 18px;margin-bottom:10px;">
          <p style="font-size:10px;font-weight:600;color:#8A8A8A;margin:0 0 5px;text-transform:uppercase;letter-spacing:0.08em;">Step 1 · 나의 고객은 누구인가?</p>
          <p style="font-size:13px;color:#111111;line-height:1.65;margin:0;">${step1}</p>
        </div>
        <div style="background:#F5F5F5;border-radius:12px;padding:14px 18px;">
          <p style="font-size:10px;font-weight:600;color:#8A8A8A;margin:0 0 5px;text-transform:uppercase;letter-spacing:0.08em;">Step 2 · 가장 시급히 해결하고 싶은 고객의 문제는?</p>
          <p style="font-size:13px;color:#111111;line-height:1.65;margin:0;">${step2}</p>
        </div>
      </div>
      <div style="background:#111111;border-radius:16px;padding:24px 28px;margin-bottom:20px;">
        <p style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin:0 0 10px;">고객의 진짜 문제 정의</p>
        <p style="font-size:18px;font-weight:700;color:#ffffff;line-height:1.6;margin:0;">"${step3}"</p>
      </div>
      <div>
        <p style="font-size:10px;font-weight:600;color:#8A8A8A;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.08em;">Step 4 · 핵심 키워드 (원인)</p>
        <div style="display:flex;flex-wrap:wrap;">${keywordBadges}</div>
      </div>
    </div>`
}

async function buildPdfFromSection(html: string): Promise<jsPDF> {
  const RENDER_W = 720
  const PDF_W_MM = 210
  const wrapper = document.createElement('div')
  wrapper.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-1;'
  document.body.appendChild(wrapper)
  const content = document.createElement('div')
  content.style.cssText =
    'width:720px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
  content.innerHTML = html
  wrapper.appendChild(content)
  await new Promise<void>((resolve) => setTimeout(resolve, 200))
  const elH = content.scrollHeight
  const heightMm = (elH * PDF_W_MM) / RENDER_W
  const dataUrl = await toPng(content, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    width: RENDER_W,
    height: elH,
  })
  if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper)
  const pdf = new jsPDF({ unit: 'mm', format: [PDF_W_MM, heightMm] })
  pdf.addImage(dataUrl, 'PNG', 0, 0, PDF_W_MM, heightMm)
  return pdf
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function ProblemDefinitionPage() {
  const router = useRouter()
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [participantName, setParticipantName] = useState('')
  const [participantDept, setParticipantDept] = useState('')

  const [step1, setStep1] = useState('')
  const [step2, setStep2] = useState('')
  const [step3, setStep3] = useState('')
  const [step4, setStep4] = useState('')

  const [chatStarted, setChatStarted] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [chatError, setChatError] = useState('')

  const [pdfLoading, setPdfLoading] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const chatBottomRef = useRef<HTMLDivElement>(null)
  const chatSectionRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatInitiatedRef = useRef(false)
  const stepsRef = useRef({ step1, step2, step3, step4 })

  useEffect(() => {
    stepsRef.current = { step1, step2, step3, step4 }
  }, [step1, step2, step3, step4])

  // auth check + load saved data
  useEffect(() => {
    const id = localStorage.getItem('participant_id')
    const name = localStorage.getItem('participant_name') ?? ''
    if (!id) { router.replace('/'); return }
    setParticipantId(id)
    setParticipantName(name)

    fetch(`/api/problem-definition?participantId=${id}`)
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          setStep1(data.step1_customer ?? '')
          setStep2(data.step2_problem ?? '')
          setStep3(data.step3_definition ?? '')
          setStep4(data.step4_keywords ?? '')
          if (data.chat_history && data.chat_history.length > 0) {
            setMessages(data.chat_history)
            setChatStarted(true)
            chatInitiatedRef.current = true
          }
        }
      })
      .catch(() => {})

    fetch(`/api/progress?participantId=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.participant?.department) setParticipantDept(data.participant.department)
      })
      .catch(() => {})
  }, [router])

  // scroll to chat section when it starts
  useEffect(() => {
    if (chatStarted && !chatInitiatedRef.current) {
      setTimeout(() => {
        chatSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [chatStarted])

  // scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // auto-start AI review when chat opens for the first time
  useEffect(() => {
    if (!chatStarted || chatInitiatedRef.current) return
    chatInitiatedRef.current = true

    const { step1: s1, step2: s2, step3: s3, step4: s4 } = stepsRef.current
    setIsStreaming(true)
    const aiPlaceholder: ChatMessage = { role: 'model', content: '', timestamp: new Date().toISOString() }
    setMessages([aiPlaceholder])

    fetchStream(
      '/api/problem-definition',
      { messages: [], stepResponses: { step1: s1, step2: s2, step3: s3, step4: s4 } },
      (chunk) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role !== 'model') return prev
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
        })
      },
      () => setIsStreaming(false),
      (err) => {
        setIsStreaming(false)
        setChatError(err)
        setMessages([])
      }
    )
  }, [chatStarted])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return
      setChatError('')
      const userMessage: ChatMessage = {
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      }
      const updatedMessages = [...messages, userMessage]
      const aiPlaceholder: ChatMessage = {
        role: 'model',
        content: '',
        timestamp: new Date().toISOString(),
      }
      setMessages([...updatedMessages, aiPlaceholder])
      setInput('')
      setIsStreaming(true)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'

      const { step1: s1, step2: s2, step3: s3, step4: s4 } = stepsRef.current
      fetchStream(
        '/api/problem-definition',
        {
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          stepResponses: { step1: s1, step2: s2, step3: s3, step4: s4 },
        },
        (chunk) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last?.role !== 'model') return prev
            return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
          })
        },
        () => setIsStreaming(false),
        (err) => {
          setIsStreaming(false)
          setChatError(err)
          setMessages((prev) =>
            prev[prev.length - 1]?.role === 'model' && prev[prev.length - 1]?.content === ''
              ? prev.slice(0, -1)
              : prev
          )
        }
      )
    },
    [messages, isStreaming]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handlePDF = async () => {
    if (pdfLoading) return
    setPdfLoading(true)
    try {
      const date = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      const html = buildProblemDefPdfHtml(participantName, participantDept, date, step1, step2, step3, step4)
      const pdf = await buildPdfFromSection(html)
      const dateStr = new Date().toISOString().slice(0, 10)
      pdf.save(`HMG_진짜문제정의_${participantName}_${dateStr}.pdf`)
    } catch (e) {
      console.error(e)
    } finally {
      setPdfLoading(false)
    }
  }

  const handleNavigateToChat = async () => {
    if (!participantId) return
    setSaving(true)
    try {
      await fetch('/api/problem-definition', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          step1,
          step2,
          step3,
          step4,
          chatHistory: messages,
          isConfirmed: true,
        }),
      })
    } catch {
      // ignore, still navigate
    } finally {
      setSaving(false)
      setShowConfirmModal(false)
      router.push('/chat')
    }
  }

  const allFilled = step1.trim() && step2.trim() && step3.trim() && step4.trim()

  if (!participantId) return null

  return (
    <div className="flex flex-col bg-[#F7F7F8]" style={{ minHeight: '100dvh' }}>
      {/* 헤더 */}
      <div className="bg-[#111111] px-5 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-white/50 text-sm active:text-white transition-colors"
          >
            <ChevronLeft size={16} />
            홈
          </button>
          <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
            <Sparkles size={11} color="rgba(255,255,255,0.7)" />
            <span className="text-[10px] font-bold text-white/70 tracking-[0.12em] uppercase">
              HMG xClass
            </span>
          </div>
        </div>
        <h1 className="text-[1.4rem] font-bold text-white leading-tight">
          고객의 진짜<br />문제 정의하기
        </h1>
        <p className="text-sm text-white/50 mt-1.5">
          카드 실습 전, 고객 문제를 명확히 정의해보세요.
        </p>
      </div>

      <div className="flex-1 px-4 pt-5 pb-8 space-y-4">

        {/* Step 1 */}
        <div className="bg-white rounded-3xl px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <p className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-[0.1em] mb-1">Step 1</p>
          <p className="text-base font-bold text-[#111] mb-3">나의 고객은 누구인가?</p>
          <textarea
            value={step1}
            onChange={(e) => setStep1(e.target.value)}
            placeholder="예: 구매 고객, 협력사 담당자, 나의 리더, 영업사원"
            rows={2}
            className="w-full resize-none px-4 py-3 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-sm text-[#111] placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors leading-relaxed"
          />
        </div>

        {/* Step 2 */}
        <div className="bg-white rounded-3xl px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <p className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-[0.1em] mb-1">Step 2</p>
          <p className="text-base font-bold text-[#111] mb-3">가장 시급히 해결하고 싶은 고객의 문제는?</p>
          <textarea
            value={step2}
            onChange={(e) => setStep2(e.target.value)}
            placeholder="지금 가장 먼저 해결하고 싶은 고객의 어려움을 적어주세요"
            rows={3}
            className="w-full resize-none px-4 py-3 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-sm text-[#111] placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors leading-relaxed"
          />
        </div>

        {/* Step 3 */}
        <div className="bg-white rounded-3xl px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <p className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-[0.1em] mb-1">Step 3</p>
          <p className="text-base font-bold text-[#111] mb-1">한 문장으로 정의</p>
          <p className="text-xs text-[#8A8A8A] mb-3">주어 = 고객 &nbsp;·&nbsp; 목적어 = 고객의 진짜 문제</p>
          <div className="bg-[#F0FDF4] rounded-xl px-3 py-2.5 mb-3">
            <p className="text-xs text-[#02855B] leading-relaxed">
              힌트: ○○(고객)은 ○○해서, ○○하지 못하고 있다.
            </p>
          </div>
          <textarea
            value={step3}
            onChange={(e) => setStep3(e.target.value)}
            placeholder="고객이 ○○해서, ○○하지 못하고 있다."
            rows={3}
            className="w-full resize-none px-4 py-3 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-sm text-[#111] placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors leading-relaxed"
          />
        </div>

        {/* Step 4 */}
        <div className="bg-white rounded-3xl px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <p className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-[0.1em] mb-1">Step 4</p>
          <p className="text-base font-bold text-[#111] mb-3">핵심 키워드 (원인)</p>
          <textarea
            value={step4}
            onChange={(e) => setStep4(e.target.value)}
            placeholder="예: #충분한 기능 설명, #소통 부재"
            rows={2}
            className="w-full resize-none px-4 py-3 rounded-xl border border-[#E8E8E8] bg-[#F7F7F8] text-sm text-[#111] placeholder-[#B0B0B0] focus:outline-none focus:border-[#111] focus:bg-white transition-colors leading-relaxed"
          />
        </div>

        {/* AI 코치 버튼 (챗봇 미시작 시) */}
        {!chatStarted && (
          <button
            onClick={() => { if (allFilled) setChatStarted(true) }}
            disabled={!allFilled}
            className="w-full rounded-2xl bg-[#02855B] text-white text-base font-semibold disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            style={{ height: '54px' }}
          >
            <Sparkles size={18} />
            AI 코치에게 검토 받기
          </button>
        )}

        {/* 챗봇 UI */}
        {chatStarted && (
          <div ref={chatSectionRef} className="space-y-3">
            <div className="bg-white rounded-3xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {/* 챗봇 헤더 */}
              <div className="px-5 pt-4 pb-3 border-b border-[#F0F0F0]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-[#F0FDF4] rounded-xl flex items-center justify-center shrink-0">
                    <Sparkles size={15} color="#02855B" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#111]">AI 코치</p>
                    <p className="text-xs text-[#8A8A8A]">작성 내용 기반 코칭</p>
                  </div>
                </div>
              </div>

              {/* 메시지 목록 */}
              <div className="px-4 py-4 space-y-2 max-h-[480px] overflow-y-auto">
                {messages.length === 0 && isStreaming && (
                  <div className="flex justify-start">
                    <div className="bg-[#F5F5F5] rounded-2xl rounded-bl-sm px-4 py-3">
                      <span className="inline-flex gap-1">
                        {[0, 1, 2].map((d) => (
                          <span
                            key={d}
                            className="w-1.5 h-1.5 bg-[#8A8A8A] rounded-full animate-bounce"
                            style={{ animationDelay: `${d * 0.15}s` }}
                          />
                        ))}
                      </span>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-[#111111] text-white rounded-br-sm'
                          : 'bg-[#F5F5F5] text-[#111111] rounded-bl-sm'
                      }`}
                    >
                      {msg.content}
                      {isStreaming &&
                        i === messages.length - 1 &&
                        msg.role === 'model' &&
                        msg.content === '' && (
                          <span className="inline-flex gap-1 ml-1">
                            {[0, 1, 2].map((d) => (
                              <span
                                key={d}
                                className="w-1.5 h-1.5 bg-[#8A8A8A] rounded-full animate-bounce"
                                style={{ animationDelay: `${d * 0.15}s` }}
                              />
                            ))}
                          </span>
                        )}
                    </div>
                  </div>
                ))}
                {chatError && (
                  <div className="text-center py-2">
                    <p className="text-xs text-red-500">{chatError}</p>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* 입력창 */}
              <div className="px-4 pb-4 pt-2 border-t border-[#EBEBEB] bg-white">
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
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* PDF 저장 버튼 */}
            <button
              onClick={handlePDF}
              disabled={pdfLoading}
              className="w-full rounded-2xl border border-[#E8E8E8] bg-white text-sm font-semibold text-[#3A3A3A] disabled:opacity-50 active:bg-[#F7F7F8] transition-all flex items-center justify-center gap-2"
              style={{ height: '52px' }}
            >
              {pdfLoading ? (
                <div className="w-4 h-4 border-2 border-[#3A3A3A] border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileDown size={17} />
              )}
              {pdfLoading ? 'PDF 생성 중...' : 'PDF로 저장하기'}
            </button>
          </div>
        )}

        {/* 카드 실습으로 이동 버튼 */}
        <button
          onClick={() => setShowConfirmModal(true)}
          className="w-full rounded-2xl bg-[#111111] text-white text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          style={{ height: '54px' }}
        >
          카드 실습으로 이동
          <ArrowRight size={18} />
        </button>
      </div>

      {/* 확인 모달 */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmModal(false) }}
        >
          <div className="bg-white rounded-t-3xl w-full max-w-lg px-6 pt-6 pb-10">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-bold text-[#111]">카드 실습으로 이동할까요?</h2>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1 -mr-1 -mt-1"
              >
                <X size={20} color="#8A8A8A" />
              </button>
            </div>
            <p className="text-sm text-[#8A8A8A] mb-6 leading-relaxed">
              진짜 문제 정의 내용은 저장됩니다. 언제든지 돌아와서 수정할 수 있어요.
            </p>
            <div className="space-y-2">
              <button
                onClick={handleNavigateToChat}
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
                계속 작업하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
