'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { QuarterlyPlan, WeeklyChecklist, ChecklistItem, ChatMessage } from '@/lib/types'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

type Phase = 'loading' | 'no-masterplan' | 'generating' | 'editing' | 'saving' | 'confirmed' | 'error'

interface MasterPlanData {
  slogan: string
  customer_strategy: string | null
  customer_what: string
  customer_why: string
  process_strategy: string | null
  process_what: string
  process_why: string
  people_strategy: string | null
  people_what: string
  people_why: string
  is_confirmed: boolean
}

// ─── AI 보완 챗봇 컴포넌트 ────────────────────────────────────────────────────

function SupplementChat({
  masterPlan,
  yearlyPlan,
  monthlyChecklist,
}: {
  masterPlan: MasterPlanData
  yearlyPlan: QuarterlyPlan[]
  monthlyChecklist: WeeklyChecklist[]
}) {
  const INIT_MSG = '30일 실행 로드맵을 함께 점검해볼게요! 실행이 막히거나 더 구체화하고 싶은 항목이 있으신가요?'
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: INIT_MSG, timestamp: new Date().toISOString() },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return
      setError('')

      const userMsg: ChatMessage = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() }
      const aiMsg: ChatMessage = { role: 'model', content: '', timestamp: new Date().toISOString() }
      const next = [...messages, userMsg]
      setMessages([...next, aiMsg])
      setInput('')
      setStreaming(true)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'

      const masterPlanForApi = {
        slogan: masterPlan.slogan,
        customer: { strategy: masterPlan.customer_strategy, what: masterPlan.customer_what, why: masterPlan.customer_why },
        process: { strategy: masterPlan.process_strategy, what: masterPlan.process_what, why: masterPlan.process_why },
        people: { strategy: masterPlan.people_strategy, what: masterPlan.people_what, why: masterPlan.people_why },
      }
      const yearlyPlanForApi = yearlyPlan.map((q) => ({
        quarter: q.quarter,
        focus: q.focus,
        actions: q.actions,
      }))
      const clForPrompt = monthlyChecklist.map((w) => ({
        week: w.week,
        theme: w.theme,
        items: w.items.map((i) => i.content),
      }))

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'supplement',
            masterPlan: masterPlanForApi,
            yearlyPlan: yearlyPlanForApi,
            monthlyChecklist: clForPrompt,
            messages: next.map((m) => ({ role: m.role, content: m.content })),
          }),
        })

        if (!res.ok) {
          setError('AI 응답을 가져오는 데 실패했어요. 다시 시도해주세요.')
          setStreaming(false)
          setMessages((p) => p.slice(0, -1))
          return
        }

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        if (!reader) { setError('스트림을 읽을 수 없어요.'); setStreaming(false); return }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          for (const line of decoder.decode(value, { stream: true }).split('\n')) {
            if (!line.startsWith('data: ')) continue
            const d = line.slice(6)
            if (d === '[DONE]') { setStreaming(false); return }
            try {
              const parsed = JSON.parse(d)
              if (parsed.text) {
                setMessages((prev) => {
                  const last = prev[prev.length - 1]
                  if (last?.role !== 'model') return prev
                  return [...prev.slice(0, -1), { ...last, content: last.content + parsed.text }]
                })
              }
            } catch { /* 파싱 오류 무시 */ }
          }
        }
        setStreaming(false)
      } catch {
        setError('네트워크 오류가 발생했어요. 연결을 확인해주세요.')
        setStreaming(false)
      }
    },
    [messages, streaming, masterPlan, yearlyPlan, monthlyChecklist]
  )

  const adjustHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-[#EBEBEB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="bg-[#F5F5F5] border-b border-[#EBEBEB] px-4 py-2.5">
        <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#111111]">AI 코치와 함께 보완하기</p>
        <p className="text-xs text-[#8A8A8A] mt-0.5">체크리스트를 더 구체적으로 만들어 보세요</p>
      </div>

      {/* 메시지 목록 */}
      <div className="h-64 overflow-y-auto px-4 py-3 space-y-2 bg-[#F5F5F5]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#111111] text-white rounded-br-sm'
                  : 'bg-white border border-[#EBEBEB] text-[#111111] rounded-bl-sm'
              }`}
            >
              {msg.content}
              {streaming && i === messages.length - 1 && msg.role === 'model' && msg.content === '' && (
                <span className="inline-block w-1.5 h-4 bg-[#8A8A8A] rounded-full animate-pulse" />
              )}
            </div>
          </div>
        ))}
        {error && (
          <div className="text-center py-1">
            <p className="text-xs text-red-500">{error}</p>
            <button
              onClick={() => {
                setError('')
                const last = [...messages].reverse().find((m) => m.role === 'user')
                if (last) send(last.content)
              }}
              className="text-xs text-[#111111] font-medium mt-1"
            >
              다시 시도
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="px-4 py-3 border-t border-[#EBEBEB] bg-white flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); adjustHeight() }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="질문을 입력하세요..."
          rows={1}
          disabled={streaming}
          className="flex-1 resize-none px-3 py-2.5 rounded-2xl border border-[#EBEBEB] bg-[#F5F5F5] text-sm text-[#111111] placeholder-[#8A8A8A] focus:outline-none focus:border-[#111111] focus:bg-white disabled:opacity-50 transition-colors"
          style={{ minHeight: '44px', maxHeight: '100px' }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || streaming}
          className="w-11 h-11 rounded-2xl bg-[#02855B] active:bg-[#026644] text-white flex items-center justify-center disabled:opacity-40 shrink-0 transition-colors"
          aria-label="전송"
        >
          {streaming ? (
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
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function ActionPlanPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [participantName, setParticipantName] = useState('리더')
  const [masterPlan, setMasterPlan] = useState<MasterPlanData | null>(null)
  const [yearlyPlan, setYearlyPlan] = useState<QuarterlyPlan[]>([])
  const [monthlyChecklist, setMonthlyChecklist] = useState<WeeklyChecklist[]>([])
  const [showChecklist, setShowChecklist] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [savedToast, setSavedToast] = useState(false)
  const checklistRef = useRef<HTMLDivElement>(null)
  const savedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoad = useRef(true)

  // ── 액션플랜 AI 도출
  const generateActionPlan = useCallback(async (id: string, name: string, mp: MasterPlanData) => {
    setPhase('generating')
    setGenerateError('')

    const masterPlanForApi = {
      slogan: mp.slogan,
      customer: { strategy: mp.customer_strategy, what: mp.customer_what, why: mp.customer_why },
      process: { strategy: mp.process_strategy, what: mp.process_what, why: mp.process_why },
      people: { strategy: mp.people_strategy, what: mp.people_what, why: mp.people_why },
    }

    try {
      const res = await fetch('/api/actionplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: id, participantName: name, masterPlan: masterPlanForApi }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setYearlyPlan(data.yearlyPlan)
      setMonthlyChecklist(data.monthlyChecklist)
      setPhase('editing')
    } catch {
      setGenerateError('액션플랜 도출 중 오류가 발생했어요. 다시 시도해주세요.')
    }
  }, [])

  // ── 초기 데이터 로드
  useEffect(() => {
    const id = localStorage.getItem('participant_id')
    const name = localStorage.getItem('participant_name') ?? '리더'
    if (!id) { router.replace('/'); return }

    setParticipantId(id)
    setParticipantName(name)

    fetch(`/api/actionplan?participantId=${id}`)
      .then((r) => r.json())
      .then((data: {
        masterPlan: MasterPlanData | null
        actionPlan: { yearly_plan: QuarterlyPlan[]; monthly_checklist: WeeklyChecklist[]; is_confirmed: boolean } | null
        error?: string
      }) => {
        if (data.error) { setErrorMsg(data.error); setPhase('error'); return }

        const mp = data.masterPlan
        if (!mp || !mp.is_confirmed) { setPhase('no-masterplan'); return }

        setMasterPlan(mp)

        const ap = data.actionPlan
        if (ap) {
          setYearlyPlan(ap.yearly_plan ?? [])
          setMonthlyChecklist(ap.monthly_checklist ?? [])
          if (ap.is_confirmed) {
            setShowChecklist(true)
            setPhase('confirmed')
          } else {
            setPhase('editing')
          }
          setTimeout(() => { isInitialLoad.current = false }, 500)
          return
        }

        // 액션플랜 없음 → 자동 생성
        generateActionPlan(id, name, mp)
      })
      .catch(() => { setErrorMsg('데이터를 불러오는 중 오류가 발생했어요.'); setPhase('error') })
  }, [router, generateActionPlan])

  // no-masterplan 시 자동 이동
  useEffect(() => {
    if (phase === 'no-masterplan') {
      const t = setTimeout(() => router.replace('/masterplan'), 2500)
      return () => clearTimeout(t)
    }
  }, [phase, router])

  // 체크리스트 표시 시 스크롤
  useEffect(() => {
    if (showChecklist && checklistRef.current) {
      setTimeout(() => checklistRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [showChecklist])

  // ── 편집 핸들러

  const handleFocusChange = useCallback((qi: number, value: string) => {
    setYearlyPlan((prev) => prev.map((q, i) => i !== qi ? q : { ...q, focus: value }))
  }, [])

  const handleActionChange = useCallback((qi: number, ai: number, value: string) => {
    setYearlyPlan((prev) => prev.map((q, i) =>
      i !== qi ? q : { ...q, actions: q.actions.map((a, j) => j !== ai ? a : value) }
    ))
  }, [])

  const handleActionDelete = useCallback((qi: number, ai: number) => {
    setYearlyPlan((prev) => prev.map((q, i) =>
      i !== qi ? q : { ...q, actions: q.actions.filter((_, j) => j !== ai) }
    ))
  }, [])

  const handleActionAdd = useCallback((qi: number) => {
    setYearlyPlan((prev) => prev.map((q, i) =>
      i !== qi ? q : { ...q, actions: [...q.actions, ''] }
    ))
  }, [])

  const handleChecklistChange = useCallback((wi: number, ii: number, value: string) => {
    setMonthlyChecklist((prev) => prev.map((w, i) =>
      i !== wi ? w : { ...w, items: w.items.map((item, j) => j !== ii ? item : { ...item, content: value }) }
    ))
  }, [])

  const handleChecklistDelete = useCallback((wi: number, ii: number) => {
    setMonthlyChecklist((prev) => prev.map((w, i) =>
      i !== wi ? w : {
        ...w,
        items: w.items.filter((_, j) => j !== ii).map((item, j) => ({ ...item, index: j })),
      }
    ))
  }, [])

  const handleChecklistAdd = useCallback((wi: number) => {
    setMonthlyChecklist((prev) => prev.map((w, i) => {
      if (i !== wi) return w
      const newItem: ChecklistItem = { index: w.items.length, content: '', status: '미착수', memo: '' }
      return { ...w, items: [...w.items, newItem] }
    }))
  }, [])

  // ── PDF 저장
  const handleDownloadPDF = async () => {
    const element = document.getElementById('pdf-content')
    if (!element) return

    // 전체 높이 캡처를 위해 일시적으로 overflow 해제
    const parent = element.parentElement
    const prevOverflow = parent?.style.overflow ?? ''
    const prevMaxHeight = parent?.style.maxHeight ?? ''
    if (parent) {
      parent.style.overflow = 'visible'
      parent.style.maxHeight = 'none'
    }

    try {
      const dataUrl = await toPng(element, {
        cacheBust: true,
        pixelRatio: 2,
      })

      const img = new window.Image()
      img.src = dataUrl
      await new Promise<void>((resolve) => { img.onload = () => resolve() })

      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (img.height * imgWidth) / img.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const today = new Date().toISOString().slice(0, 10)
      pdf.save(`HMG_조직관리플랜_${today}.pdf`)
    } finally {
      if (parent) {
        parent.style.overflow = prevOverflow
        parent.style.maxHeight = prevMaxHeight
      }
    }
  }

  // ── 자동저장 (confirmed 상태에서 데이터 변경 시 1초 디바운스)
  useEffect(() => {
    if (isInitialLoad.current) return
    if (phase !== 'confirmed' || !participantId) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/actionplan', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId, yearlyPlan, monthlyChecklist }),
        })
        if (savedToastTimer.current) clearTimeout(savedToastTimer.current)
        setSavedToast(true)
        savedToastTimer.current = setTimeout(() => setSavedToast(false), 2000)
      } catch { /* silent */ }
    }, 1000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearlyPlan, monthlyChecklist])

  // ── 확정 / 변경 저장
  const handleConfirm = useCallback(async () => {
    if (!participantId) return
    const wasConfirmed = phase === 'confirmed'
    setPhase('saving')
    try {
      const res = await fetch('/api/actionplan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, yearlyPlan, monthlyChecklist }),
      })
      if (!res.ok) throw new Error()
      setPhase('confirmed')
      if (wasConfirmed) {
        if (savedToastTimer.current) clearTimeout(savedToastTimer.current)
        setSavedToast(true)
        savedToastTimer.current = setTimeout(() => setSavedToast(false), 2000)
      }
    } catch {
      setPhase(wasConfirmed ? 'confirmed' : 'editing')
    }
  }, [participantId, yearlyPlan, monthlyChecklist, phase])

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

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

  if (phase === 'no-masterplan') {
    return (
      <div className="flex items-center justify-center px-6 text-center" style={{ height: '100dvh' }}>
        <div>
          <p className="text-[#111111] font-medium mb-2">마스터플랜을 먼저 완성해주세요.</p>
          <p className="text-sm text-[#8A8A8A]">잠시 후 마스터플랜 페이지로 이동합니다...</p>
        </div>
      </div>
    )
  }

  if (phase === 'generating') {
    return (
      <div className="relative flex items-center justify-center px-6" style={{ height: '100dvh' }}>
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-3">
          <button
            onClick={() => router.push('/masterplan')}
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
        <div className="text-center">
          {!generateError ? (
            <>
              <div className="w-12 h-12 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-base font-semibold text-[#111111] mb-1 tracking-tight">1년 액션플랜을 작성하고 있습니다...</p>
              <p className="text-sm text-[#8A8A8A]">AI가 마스터플랜을 분석하고 있어요</p>
            </>
          ) : (
            <>
              <p className="text-sm text-red-500 mb-5">{generateError}</p>
              {masterPlan && participantId && (
                <button
                  onClick={() => generateActionPlan(participantId, participantName, masterPlan)}
                  className="h-12 px-6 rounded-xl bg-[#111111] active:bg-[#3A3A3A] text-white font-semibold text-sm transition-colors"
                >
                  다시 시도하기
                </button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'error') {
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

  // ── editing / saving / confirmed 페이즈 ──────────────────────────────────

  return (
    <div className="relative flex flex-col" style={{ height: '100dvh' }}>
      {/* 저장 완료 토스트 */}
      {savedToast && (
        <div className="fixed bottom-8 left-1/2 z-50 animate-[toastPop_0.45s_cubic-bezier(0.34,1.56,0.64,1)_both]"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div className="px-7 py-4 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.28)] text-base font-bold whitespace-nowrap bg-[#111111] text-white">
            변경사항이 저장되었습니다 ✓
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-white border-b border-[#EBEBEB] px-4 py-3 shrink-0">
        <div className="flex justify-end mb-1">
          <Image src="/main-logo.png" alt="메인 로고" width={160} height={80} className="object-contain" />
        </div>
        <div className="flex items-center justify-between -mx-1 mb-1">
          <button
            onClick={() => router.push('/masterplan')}
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
        <h1 className="text-base font-bold text-[#111111] tracking-tight">1년 액션플랜 &amp; 30일 체크리스트</h1>
        <p className="text-xs text-[#8A8A8A] mt-0.5">
          {phase === 'confirmed' ? '내용을 수정하고 저장하면 트래킹에 반영됩니다' : '내용을 자유롭게 수정하세요'}
        </p>
      </header>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 bg-[#F5F5F5]">
        <div id="pdf-content">
        {/* 1년 액션플랜 섹션 */}
        {(() => {
          const QUARTER_CONFIG = [
            { headerBg: '#FFF7ED', border: '#FAE4CC', accent: '#EA580C', label: '#EA580C' },
            { headerBg: '#F0FDF4', border: '#BBF7D0', accent: '#16A34A', label: '#16A34A' },
            { headerBg: '#FEFCE8', border: '#FDE68A', accent: '#D97706', label: '#D97706' },
            { headerBg: '#FEF2F2', border: '#FECACA', accent: '#DC2626', label: '#DC2626' },
          ]
          return (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-[#111111] rounded-xl flex items-center justify-center shrink-0">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#111111]">1년 액션플랜</p>
              <p className="text-xs text-[#8A8A8A] mt-0.5">Q1 ~ Q4 분기별 행동 과제</p>
            </div>
          </div>
          <div className="space-y-3">
            {yearlyPlan.map((quarter, qi) => (
              <div key={qi} className="rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)] border bg-white"
                style={{ borderColor: QUARTER_CONFIG[qi % 4].border }}>
                <div className="border-b px-4 py-3"
                  style={{ backgroundColor: QUARTER_CONFIG[qi % 4].headerBg, borderColor: QUARTER_CONFIG[qi % 4].border }}>
                  <span className="inline-block text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 rounded-full bg-white border mb-1.5"
                    style={{ color: QUARTER_CONFIG[qi % 4].label, borderColor: QUARTER_CONFIG[qi % 4].border }}>
                    {quarter.quarter}
                  </span>
                  <textarea
                    value={quarter.focus}
                    onChange={(e) => handleFocusChange(qi, e.target.value)}
                    rows={2}
                    className="w-full text-base font-bold text-[#111111] bg-transparent focus:outline-none placeholder-[#D4D4D4] resize-none leading-snug block"
                    placeholder="핵심 집중 영역"
                  />
                </div>
                <div className="px-4 py-3 space-y-2">
                  {quarter.actions.map((action, ai) => (
                    <div key={ai} className="flex gap-2 items-start">
                      <span className="text-xs text-[#D4D4D4] mt-2.5 shrink-0 w-4 text-center">{ai + 1}</span>
                      <textarea
                        value={action}
                        onChange={(e) => handleActionChange(qi, ai, e.target.value)}
                        rows={2}
                        className="flex-1 text-sm text-[#111111] rounded-xl px-3 py-2 resize-none focus:outline-none leading-snug transition-colors"
                        style={{ backgroundColor: QUARTER_CONFIG[qi % 4].headerBg }}
                      />
                      <button
                        onClick={() => handleActionDelete(qi, ai)}
                        className="w-8 h-8 text-[#D4D4D4] active:text-red-400 flex items-center justify-center rounded-lg text-xl leading-none shrink-0 mt-1"
                        aria-label="삭제"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => handleActionAdd(qi)}
                    className="w-full py-2.5 text-xs font-medium rounded-xl border border-dashed transition-colors active:opacity-70"
                    style={{ color: QUARTER_CONFIG[qi % 4].accent, borderColor: QUARTER_CONFIG[qi % 4].border }}
                  >
                    + 항목 추가
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
          )
        })()}

        {/* 30일 체크리스트 버튼 또는 섹션 */}
        {!showChecklist ? (
          <button
            onClick={() => setShowChecklist(true)}
            className="w-full rounded-2xl border border-[#EBEBEB] bg-white active:scale-[0.98] transition-all shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-5 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#ECFDF5] rounded-xl flex items-center justify-center shrink-0">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#02855B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-[11px] text-[#8A8A8A] font-medium">다음 단계</p>
                <p className="text-[15px] font-bold text-[#111111]">30일 체크리스트 도출하기</p>
              </div>
            </div>
            <div className="w-7 h-7 rounded-full border border-[#DDDDDD] flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CCCCCC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </button>
        ) : (
          <div ref={checklistRef} className="mt-2 space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-[#02855B] rounded-xl flex items-center justify-center shrink-0">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#111111]">30일 체크리스트</p>
                <p className="text-xs text-[#8A8A8A] mt-0.5">4주간 실행 체크리스트</p>
              </div>
            </div>
            {monthlyChecklist.map((week, wi) => (
              <div key={wi} className="bg-white border border-[#D1FAE5] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(2,133,91,0.08)]">
                <div className="bg-[#F0FDF4] border-b border-[#D1FAE5] px-4 py-3">
                  <span className="inline-block text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 rounded-full bg-white border border-[#D1FAE5] text-[#16A34A] mb-1.5">
                    {week.week}주차
                  </span>
                  <p className="text-base font-bold text-[#111111] leading-snug">{week.theme}</p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {week.items.map((item, ii) => (
                    <div key={ii} className="flex gap-2 items-center">
                      {item.isFixed ? (
                        <div
                          className="flex-1 text-sm text-[#555] bg-[#F0FDF4] rounded-xl px-3 py-2 border border-[#D1FAE5] leading-snug"
                          style={{ minHeight: '44px', display: 'flex', alignItems: 'center' }}
                        >
                          {item.content}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={item.content}
                          onChange={(e) => handleChecklistChange(wi, ii, e.target.value)}
                          className="flex-1 text-sm text-[#111111] bg-[#F0FDF4] rounded-xl px-3 py-2 border border-[#D1FAE5] focus:outline-none focus:border-[#02855B] focus:bg-white transition-colors"
                          placeholder="항목을 입력하세요"
                          style={{ minHeight: '44px' }}
                        />
                      )}
                      {!item.isFixed && (
                        <button
                          onClick={() => handleChecklistDelete(wi, ii)}
                          className="w-8 h-8 text-[#D4D4D4] active:text-red-400 flex items-center justify-center rounded-lg text-xl leading-none shrink-0"
                          aria-label="삭제"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => handleChecklistAdd(wi)}
                    className="w-full py-2.5 text-xs font-medium text-[#16A34A] border border-dashed border-[#D1FAE5] rounded-xl active:bg-[#F0FDF4] transition-colors"
                  >
                    + 항목 추가
                  </button>
                </div>
              </div>
            ))}

            {/* AI 보완 챗봇 */}
            {masterPlan && (
              <div className="mt-3">
                <SupplementChat masterPlan={masterPlan} yearlyPlan={yearlyPlan} monthlyChecklist={monthlyChecklist} />
              </div>
            )}
          </div>
        )}

        <div className="h-2" />
        </div>{/* /pdf-content */}
      </div>

      {/* 하단 버튼 */}
      <div className="px-4 pb-4 pt-2 border-t border-[#EBEBEB] bg-white shrink-0">
        {phase === 'confirmed' ? (
          <div className="space-y-2.5">
            <button
              onClick={() => router.push('/tracking')}
              className="w-full h-12 rounded-2xl bg-[#111111] active:scale-[0.98] active:bg-[#2A2A2A] text-white font-semibold text-sm transition-all shadow-[0_2px_12px_rgba(0,0,0,0.09)]"
            >
              트래킹 →
            </button>
            <button
              onClick={handleDownloadPDF}
              className="w-full h-12 rounded-2xl border border-[#EBEBEB] bg-white active:bg-[#F5F5F5] active:scale-[0.98] text-[#3A3A3A] font-semibold text-sm transition-all"
            >
              PDF로 저장하기
            </button>
          </div>
        ) : showChecklist ? (
          <button
            onClick={handleConfirm}
            disabled={phase === 'saving'}
            className="w-full h-12 rounded-2xl bg-[#111111] active:scale-[0.98] active:bg-[#2A2A2A] text-white font-semibold text-sm disabled:opacity-50 transition-all shadow-[0_2px_12px_rgba(0,0,0,0.09)]"
          >
            최종 확정하기
          </button>
        ) : (
          <p className="text-center text-xs text-[#8A8A8A]">1년 플랜을 검토한 후 체크리스트를 도출하세요</p>
        )}
      </div>

      {/* 저장 중 오버레이 */}
      {(phase as string) === 'saving' && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-[#3A3A3A]">저장하고 있어요...</p>
          </div>
        </div>
      )}
    </div>
  )
}
