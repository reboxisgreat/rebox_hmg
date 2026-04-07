'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AdminProgressRow, CardResponse, MasterPlan, ActionPlan, Participant, ScoreEntry } from '@/lib/types'
import { CARD_TITLES, STEP_TITLES } from '@/lib/types'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import JSZip from 'jszip'

// ─────────────────────────────────────────────
// 로그인 화면
// ─────────────────────────────────────────────
function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.success) {
        sessionStorage.setItem('isAdmin', 'true')
        onSuccess()
      } else {
        setError('비밀번호가 올바르지 않습니다.')
      }
    } catch {
      setError('서버 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-5">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-[#EBEBEB] p-8">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold text-[#02855B] tracking-widest uppercase mb-1">리더스러닝랩 xClass 조직관리 과정</p>
          <h1 className="text-xl font-bold text-[#111111]">관리자 로그인</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            autoFocus
            className="w-full h-12 px-4 rounded-xl border border-[#EBEBEB] bg-[#F5F5F5] text-base focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
          />
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full h-12 rounded-xl bg-[#111111] active:bg-[#3A3A3A] text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {loading ? '확인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// PDF 생성 유틸리티
// ─────────────────────────────────────────────

// overflow:hidden 래퍼 안에 넣어서 화면에 표시 안 하면서도
// 브라우저가 내부 요소의 레이아웃(scrollHeight 등)을 정상 계산하게 한다.
function createHiddenContent(html: string): { wrapper: HTMLDivElement; content: HTMLDivElement } {
  const wrapper = document.createElement('div')
  wrapper.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-1;'
  document.body.appendChild(wrapper)

  const content = document.createElement('div')
  content.style.cssText =
    'width:720px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
  content.innerHTML = html
  wrapper.appendChild(content)
  return { wrapper, content }
}

// 콘텐츠 높이 = 페이지 높이인 가변 크기 PDF를 생성한다.
// A4 고정 높이를 쓰지 않으므로 내용 아래 여백이 생기지 않는다.
async function buildPdf(htmlSections: string[]): Promise<jsPDF> {
  const RENDER_W = 720   // 렌더링 픽셀 폭
  const PDF_W_MM = 210   // A4 폭(mm) 고정

  let pdf: jsPDF | null = null

  for (const html of htmlSections) {
    const el = await renderSection(html)
    // 브라우저 레이아웃 완료 대기
    await new Promise<void>((resolve) => setTimeout(resolve, 200))

    const elH = el.scrollHeight
    const heightMm = (elH * PDF_W_MM) / RENDER_W

    const dataUrl = await toPng(el, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: RENDER_W,
      height: elH,
    })
    cleanupSection(el)

    if (!pdf) {
      // 첫 페이지는 생성자에서 크기 지정
      pdf = new jsPDF({ unit: 'mm', format: [PDF_W_MM, heightMm] })
    } else {
      pdf.addPage([PDF_W_MM, heightMm])
    }
    pdf.addImage(dataUrl, 'PNG', 0, 0, PDF_W_MM, heightMm)
  }

  return pdf!
}

function buildCoverHtml(p: Participant): string {
  const date = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  return `
    <div style="padding:48px;background:#111111;">
      <p style="font-size:10px;font-weight:600;letter-spacing:0.14em;color:rgba(255,255,255,0.45);margin:0 0 20px;text-transform:uppercase;">HMG xClass 조직관리 교육</p>
      <h1 style="font-size:32px;font-weight:700;color:#ffffff;margin:0 0 6px;">${p.name}</h1>
      <p style="font-size:16px;color:rgba(255,255,255,0.65);margin:0 0 32px;">${p.department ?? ''}</p>
      <div style="border-top:1px solid rgba(255,255,255,0.12);padding-top:20px;display:flex;flex-direction:column;gap:6px;">
        ${p.username ? `<p style="font-size:12px;color:rgba(255,255,255,0.55);margin:0;">아이디: ${p.username}</p>` : ''}
        <p style="font-size:12px;color:rgba(255,255,255,0.55);margin:0;">출력일: ${date}</p>
      </div>
    </div>`
}

const CARD_DOT_COLORS: Record<number, string> = { 1: '#DC2626', 2: '#D97706', 3: '#16A34A' }

// 카드 한 장만 렌더링 (페이지 분할 없이 한 페이지에 딱 맞게)
function buildSingleCardHtml(cardNum: 1 | 2 | 3, cards: CardResponse[], sectionLabel?: string): string {
  const card = cards.find((c) => c.card_number === cardNum)
  const dot = CARD_DOT_COLORS[cardNum]
  const steps = card
    ? ([
        ['step1_keywords', 1], ['step2_asis', 2], ['step3_tobe', 3],
        ['step4_action', 4], ['step5_indicator', 5],
      ] as const).filter(([f]) => card[f as keyof CardResponse])
    : []
  const sectionHeader = sectionLabel
    ? `<p style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A8A;margin:0 0 20px;">카드 응답</p>`
    : ''
  const stepsHtml = card && steps.length > 0
    ? steps.map(([field, stepNum]) => {
        const val = card[field as keyof CardResponse] as string
        return `<div style="background:#F5F5F5;border-radius:10px;padding:12px 16px;margin-bottom:8px;">
          <p style="font-size:10px;font-weight:600;color:#8A8A8A;margin:0 0 5px;">Step ${stepNum}. ${STEP_TITLES[stepNum]}</p>
          <p style="font-size:13px;color:#111111;line-height:1.65;margin:0;">${val}</p>
        </div>`
      }).join('')
    : '<p style="font-size:13px;color:#8A8A8A;font-style:italic;margin:0;">미작성</p>'
  return `
    <div style="padding:36px 40px;background:#ffffff;">
      ${sectionHeader}
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="width:28px;height:28px;border-radius:50%;background:${dot};color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${cardNum}</div>
        <h2 style="font-size:16px;font-weight:700;color:#111111;margin:0;">${CARD_TITLES[cardNum]}</h2>
      </div>
      ${stepsHtml}
    </div>`
}

// buildCardsHtml은 탭 PDF(단일 섹션)용으로 유지 — 전체 3장을 하나의 이미지로
function buildCardsHtml(cards: CardResponse[]): string {
  const rows = ([1, 2, 3] as const).map((num) => {
    const card = cards.find((c) => c.card_number === num)
    const dot = CARD_DOT_COLORS[num]
    const steps = card
      ? ([
          ['step1_keywords', 1], ['step2_asis', 2], ['step3_tobe', 3],
          ['step4_action', 4], ['step5_indicator', 5],
        ] as const).filter(([f]) => card[f as keyof CardResponse])
      : []
    return `
      <div style="margin-bottom:32px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <div style="width:26px;height:26px;border-radius:50%;background:${dot};color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${num}</div>
          <h2 style="font-size:15px;font-weight:700;color:#111111;margin:0;">${CARD_TITLES[num]}</h2>
        </div>
        ${card && steps.length > 0
          ? steps.map(([field, stepNum]) => {
              const val = card[field as keyof CardResponse] as string
              return `<div style="background:#F5F5F5;border-radius:10px;padding:12px 16px;margin-bottom:8px;">
                <p style="font-size:10px;font-weight:600;color:#8A8A8A;margin:0 0 5px;">Step ${stepNum}. ${STEP_TITLES[stepNum]}</p>
                <p style="font-size:13px;color:#111111;line-height:1.65;margin:0;">${val}</p>
              </div>`
            }).join('')
          : '<p style="font-size:13px;color:#8A8A8A;font-style:italic;margin:0;">미작성</p>'
        }
      </div>`
  }).join('')
  return `<div style="padding:36px 40px;background:#ffffff;">${rows}</div>`
}

function buildMasterPlanHtml(mp: MasterPlan): string {
  const areas = [
    { label: '고객가치', whatKey: 'customer_what' as const, whyKey: 'customer_why' as const, color: '#2563EB', bg: '#EFF6FF' },
    { label: '프로세스', whatKey: 'process_what' as const,  whyKey: 'process_why' as const,  color: '#EA580C', bg: '#FFF7ED' },
    { label: '사람',    whatKey: 'people_what' as const,    whyKey: 'people_why' as const,    color: '#D97706', bg: '#FFFBEB' },
  ]
  const areasHtml = areas.map(({ label, whatKey, whyKey, color, bg }) => `
    <div style="border:1px solid #EBEBEB;border-left:4px solid ${color};border-radius:10px;overflow:hidden;margin-bottom:12px;">
      <div style="background:${bg};padding:10px 16px;">
        <p style="font-size:14px;font-weight:700;color:${color};margin:0;">${label}</p>
      </div>
      <div style="padding:14px 16px;background:#ffffff;">
        <p style="font-size:10px;font-weight:600;color:#8A8A8A;margin:0 0 4px;">What</p>
        <p style="font-size:13px;color:#111111;line-height:1.65;margin:0 0 12px;">${mp[whatKey] ?? '-'}</p>
        <p style="font-size:10px;font-weight:600;color:#8A8A8A;margin:0 0 4px;">Why</p>
        <p style="font-size:13px;color:#111111;line-height:1.65;margin:0;">${mp[whyKey] ?? '-'}</p>
      </div>
    </div>`).join('')
  return `
    <div style="padding:36px 40px;background:#ffffff;">
      <p style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A8A;margin:0 0 20px;">마스터플랜</p>
      <div style="background:#111111;border-radius:14px;padding:22px 28px;margin-bottom:20px;">
        <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin:0 0 6px;">슬로건</p>
        <p style="font-size:18px;font-weight:700;color:#ffffff;margin:0;">${mp.slogan ?? ''}</p>
      </div>
      ${areasHtml}
    </div>`
}

function buildActionPlanHtml(ap: ActionPlan): string {
  const yearlyHtml = ap.yearly_plan
    ? `<div style="margin-bottom:32px;">
        <h2 style="font-size:15px;font-weight:700;color:#111111;margin:0 0 14px;">연간 플랜 (Q1~Q4)</h2>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          ${ap.yearly_plan.map((q: { quarter: string; focus: string; actions: string[] }) => `
            <div style="flex:1;min-width:300px;border:1px solid #EBEBEB;border-radius:10px;padding:14px 16px;">
              <p style="font-size:13px;font-weight:700;color:#111111;margin:0 0 4px;">${q.quarter}</p>
              <p style="font-size:11px;color:#8A8A8A;margin:0 0 10px;">${q.focus ?? ''}</p>
              ${(q.actions ?? []).map((a: string) => `<p style="font-size:12px;color:#3A3A3A;line-height:1.55;border-top:1px solid #F5F5F5;padding:5px 0;margin:0;">• ${a}</p>`).join('')}
            </div>`).join('')}
        </div>
      </div>` : ''

  const checklistHtml = ap.monthly_checklist
    ? `<div>
        <h2 style="font-size:15px;font-weight:700;color:#111111;margin:0 0 14px;">30일 체크리스트</h2>
        ${ap.monthly_checklist.map((week: { week: number; theme: string; items: Array<{ index: number; content: string; status: string }> }) => `
          <div style="margin-bottom:20px;">
            <h3 style="font-size:13px;font-weight:700;color:#111111;margin:0 0 8px;">
              ${week.week}주차${week.theme ? ` — ${week.theme}` : ''}
            </h3>
            ${week.items.map((item) => {
              const sc = item.status === '완료' ? '#16A34A' : item.status === '진행중' ? '#2563EB' : '#6B7280'
              const sb = item.status === '완료' ? '#DCFCE7' : item.status === '진행중' ? '#DBEAFE' : '#F3F4F6'
              return `<div style="display:flex;align-items:flex-start;gap:10px;background:#F5F5F5;border-radius:8px;padding:10px 12px;margin-bottom:6px;">
                <span style="background:${sb};color:${sc};font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;flex-shrink:0;white-space:nowrap;">${item.status}</span>
                <p style="font-size:12px;color:#111111;line-height:1.6;margin:0;">${item.content}</p>
              </div>`
            }).join('')}
          </div>`).join('')}
      </div>` : ''

  return `<div style="padding:36px 40px;background:#ffffff;">
    <p style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A8A;margin:0 0 20px;">액션플랜</p>
    ${yearlyHtml}${checklistHtml}
  </div>`
}

interface ParticipantDetailFull {
  participant: Participant
  cards: CardResponse[]
  masterPlan: MasterPlan | null
  actionPlan: ActionPlan | null
}

async function renderSection(html: string): Promise<HTMLDivElement> {
  const { wrapper, content } = createHiddenContent(html)
  ;(content as HTMLDivElement & { __wrapper: HTMLDivElement }).__wrapper = wrapper
  return content
}

function cleanupSection(el: HTMLElement) {
  const wrapper = (el as HTMLDivElement & { __wrapper: HTMLDivElement }).__wrapper
  if (wrapper?.parentNode) wrapper.parentNode.removeChild(wrapper)
}

async function generateParticipantPDF(detail: ParticipantDetailFull): Promise<jsPDF> {
  const { participant, cards, masterPlan, actionPlan } = detail
  // 표지 / 카드응답 / 마스터플랜 / 액션플랜 — 각 섹션이 딱 맞는 높이의 페이지로 생성됨
  const sections = [buildCoverHtml(participant), buildCardsHtml(cards)]
  if (masterPlan) sections.push(buildMasterPlanHtml(masterPlan))
  if (actionPlan) sections.push(buildActionPlanHtml(actionPlan))
  return buildPdf(sections)
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10)
}

function CohortBadge({ cohort, size = 'sm' }: { cohort: number; size?: 'sm' | 'xs' }) {
  const colors: Record<number, string> = {
    1: 'bg-[#DBEAFE] text-[#1D4ED8]',
    2: 'bg-[#D1FAE5] text-[#065F46]',
    3: 'bg-[#FEF3C7] text-[#92400E]',
  }
  const cls = colors[cohort] ?? 'bg-[#F3F4F6] text-[#374151]'
  const padding = size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-2 py-0.5'
  return <span className={`${cls} ${padding} rounded-full font-semibold`}>{cohort}차수</span>
}

// ─────────────────────────────────────────────
// 교육생 상세 모달
// ─────────────────────────────────────────────
interface ParticipantDetail {
  participant: Participant
  cards: CardResponse[]
  masterPlan: MasterPlan | null
  actionPlan: ActionPlan | null
}

function DetailModal({
  participantId,
  onClose,
  initialTab = 'cards',
}: {
  participantId: string
  onClose: () => void
  initialTab?: 'cards' | 'masterplan' | 'actionplan'
}) {
  const [detail, setDetail] = useState<ParticipantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'cards' | 'masterplan' | 'actionplan'>(initialTab)
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pdfLoading, setPdfLoading] = useState<'tab' | 'all' | null>(null)

  const handleResetPassword = async () => {
    if (!confirm(`${detail?.participant.name}님의 비밀번호를 1234로 초기화할까요?`)) return
    setResetting(true)
    setResetMsg(null)
    try {
      const res = await fetch('/api/admin/participant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: participantId }),
      })
      const data = await res.json()
      if (!res.ok) { setResetMsg({ type: 'err', text: data.error ?? '오류가 발생했습니다.' }); return }
      setResetMsg({ type: 'ok', text: '비밀번호가 1234로 초기화되었습니다.' })
    } catch {
      setResetMsg({ type: 'err', text: '오류가 발생했습니다. 다시 시도해주세요.' })
    } finally {
      setResetting(false)
    }
  }

  const handleTabPDF = async () => {
    if (!detail || pdfLoading) return
    setPdfLoading('tab')
    try {
      const cover = buildCoverHtml(detail.participant)
      let pdf: jsPDF
      let filename: string

      if (activeTab === 'cards') {
        pdf = await buildPdf([cover, buildCardsHtml(detail.cards)])
        filename = `HMG_xClass_${detail.participant.name}_카드응답_${getDateStr()}.pdf`
      } else if (activeTab === 'masterplan' && detail.masterPlan) {
        pdf = await buildPdf([cover, buildMasterPlanHtml(detail.masterPlan)])
        filename = `HMG_xClass_${detail.participant.name}_마스터플랜_${getDateStr()}.pdf`
      } else if (activeTab === 'actionplan' && detail.actionPlan) {
        pdf = await buildPdf([cover, buildActionPlanHtml(detail.actionPlan)])
        filename = `HMG_xClass_${detail.participant.name}_액션플랜_${getDateStr()}.pdf`
      } else {
        return
      }
      pdf.save(filename)
    } catch (e) {
      console.error(e)
    } finally {
      setPdfLoading(null)
    }
  }

  const handleAllPDF = async () => {
    if (!detail || pdfLoading) return
    setPdfLoading('all')
    try {
      const pdf = await generateParticipantPDF(detail)
      pdf.save(`HMG_xClass_${detail.participant.name}_${getDateStr()}.pdf`)
    } catch (e) {
      console.error(e)
    } finally {
      setPdfLoading(null)
    }
  }

  useEffect(() => {
    fetch(`/api/admin/participant?id=${participantId}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [participantId])

  // 모달 바깥 클릭 시 닫기
  const backdropRef = useRef<HTMLDivElement>(null)
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }

  // ESC 키 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EBEBEB] shrink-0">
          <div>
            {detail && (
              <>
                <h2 className="text-lg font-bold text-[#111111]">{detail.participant.name}</h2>
                <p className="text-sm text-[#8A8A8A]">{detail.participant.department} · {detail.participant.username}</p>
              </>
            )}
            {loading && <div className="h-10 bg-[#F5F5F5] rounded-xl w-48 animate-pulse" />}
          </div>
          <div className="flex items-center gap-2">
            {detail && (
              <>
                <button
                  onClick={handleAllPDF}
                  disabled={!!pdfLoading}
                  className="h-9 px-3 rounded-xl bg-[#111111] text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                >
                  {pdfLoading === 'all' ? (
                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  )}
                  전체 다운로드
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={resetting}
                  className="h-9 px-3 rounded-xl border border-[#EBEBEB] text-xs font-medium text-[#8A8A8A] hover:bg-[#FFF5F5] hover:text-red-500 hover:border-red-200 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {resetting ? '초기화 중...' : '비밀번호 초기화'}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-[#8A8A8A] hover:bg-[#EBEBEB]"
            >
              ✕
            </button>
          </div>
        </div>
        {resetMsg && (
          <div className={`mx-6 mt-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
            resetMsg.type === 'ok'
              ? 'bg-[#DCFCE7] text-[#16A34A]'
              : 'bg-red-50 text-red-600'
          }`}>
            {resetMsg.text}
          </div>
        )}

        {/* 탭 */}
        <div className="flex items-center border-b border-[#EBEBEB] px-6 shrink-0">
          <div className="flex flex-1">
            {(['cards', 'masterplan', 'actionplan'] as const).map((tab) => {
              const labels = { cards: '카드 응답', masterplan: '마스터플랜', actionplan: '액션플랜' }
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`mr-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-[#111111] text-[#111111]'
                      : 'border-transparent text-[#8A8A8A]'
                  }`}
                >
                  {labels[tab]}
                </button>
              )
            })}
          </div>
          {detail && (
            <button
              onClick={handleTabPDF}
              disabled={!!pdfLoading}
              className="mb-1 h-8 px-3 rounded-lg border border-[#EBEBEB] text-xs font-medium text-[#3A3A3A] hover:bg-[#F5F5F5] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
            >
              {pdfLoading === 'tab' ? (
                <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              )}
              PDF 다운로드
            </button>
          )}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-[#F5F5F5] rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!loading && detail && activeTab === 'cards' && (
            <div className="space-y-6">
              {([1, 2, 3] as const).map((cardNum) => {
                const card = detail.cards.find((c) => c.card_number === cardNum)
                return (
                  <div key={cardNum}>
                    <h3 className="text-sm font-bold text-[#111111] mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#111111] text-white text-xs flex items-center justify-center">
                        {cardNum}
                      </span>
                      {CARD_TITLES[cardNum]}
                    </h3>
                    {card ? (
                      <div className="space-y-2">
                        {([
                          ['step1_keywords', 1],
                          ['step2_asis', 2],
                          ['step3_tobe', 3],
                          ['step4_action', 4],
                          ['step5_indicator', 5],
                        ] as const).map(([field, stepNum]) => {
                          const val = card[field as keyof CardResponse] as string | null
                          if (!val) return null
                          return (
                            <div key={field} className="bg-[#F5F5F5] rounded-xl px-4 py-3">
                              <p className="text-xs font-semibold text-[#8A8A8A] mb-1">
                                Step {stepNum}. {STEP_TITLES[stepNum]}
                              </p>
                              <p className="text-sm text-[#111111] leading-relaxed">{val}</p>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-[#8A8A8A] italic">미작성</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!loading && detail && activeTab === 'masterplan' && (() => {
            const mp = detail.masterPlan
            if (!mp) return <p className="text-sm text-[#8A8A8A] italic text-center mt-8">마스터플랜 미작성</p>
            return (
              <div className="space-y-4">
                <div className="bg-[#111111] rounded-2xl px-5 py-4">
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/50 mb-1">슬로건</p>
                  <p className="text-base font-bold text-white">{mp.slogan}</p>
                </div>
                {([
                  ['고객가치', 'customer_what', 'customer_why', 'bg-[#EFF6FF]', 'text-[#2563EB]', 'border-l-[#2563EB]'],
                  ['프로세스', 'process_what',  'process_why',  'bg-[#FFF7ED]', 'text-[#EA580C]', 'border-l-[#EA580C]'],
                  ['사람',    'people_what',   'people_why',   'bg-[#FFFBEB]', 'text-[#D97706]', 'border-l-[#D97706]'],
                ] as const).map(([label, whatKey, whyKey, hBg, hText, lBorder]) => (
                  <div key={label} className={`border border-[#EBEBEB] border-l-4 ${lBorder} rounded-2xl overflow-hidden`}>
                    <div className={`px-4 py-2.5 ${hBg}`}>
                      <p className={`text-sm font-bold ${hText}`}>{label}</p>
                    </div>
                    <div className="px-4 py-3 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-[#8A8A8A] mb-1">What</p>
                        <p className="text-sm text-[#111111] leading-relaxed">
                          {(mp[whatKey as keyof MasterPlan] as string) ?? '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#8A8A8A] mb-1">Why</p>
                        <p className="text-sm text-[#111111] leading-relaxed">
                          {(mp[whyKey as keyof MasterPlan] as string) ?? '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {!loading && detail && activeTab === 'actionplan' && (
            detail.actionPlan?.monthly_checklist ? (
              <div className="space-y-4">
                {detail.actionPlan.monthly_checklist.map((week) => (
                  <div key={week.week}>
                    <h3 className="text-sm font-bold text-[#111111] mb-2">
                      {week.week}주차
                      {week.theme && <span className="ml-2 text-xs font-normal text-[#8A8A8A]">— {week.theme}</span>}
                    </h3>
                    <div className="space-y-2">
                      {week.items.map((item) => (
                        <div
                          key={item.index}
                          className="flex items-start gap-3 bg-[#F5F5F5] rounded-xl px-4 py-3"
                        >
                          <span
                            className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
                              item.status === '완료'
                                ? 'bg-[#DCFCE7] text-[#16A34A]'
                                : item.status === '진행중'
                                ? 'bg-[#DBEAFE] text-[#2563EB]'
                                : 'bg-[#F3F4F6] text-[#6B7280]'
                            }`}
                          >
                            {item.status}
                          </span>
                          <p className="text-sm text-[#111111] leading-relaxed">{item.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#8A8A8A] italic text-center mt-8">액션플랜 미작성</p>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 관리자 대시보드
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 마스터플랜 갤러리 컴포넌트
// ─────────────────────────────────────────────
interface MasterPlanCard {
  id: string
  participant_id: string
  slogan: string | null
  customer_what: string | null
  customer_why: string | null
  process_what: string | null
  process_why: string | null
  people_what: string | null
  people_why: string | null
  is_confirmed: boolean
  participants: { name: string; department: string | null } | null
}

const PINNED_KEY = 'admin_pinned_masterplans'

function MasterPlanGallery({ onSelectParticipant }: { onSelectParticipant: (id: string) => void }) {
  const [cards, setCards] = useState<MasterPlanCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(PINNED_KEY)
      return new Set(saved ? JSON.parse(saved) : [])
    } catch { return new Set() }
  })

  const togglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setPinnedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(PINNED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  useEffect(() => {
    fetch('/api/admin/masterplans')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setCards(d.data ?? [])
      })
      .catch(() => setError('데이터를 불러오는 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const sortedCards = [...cards].sort((a, b) => {
    const ap = pinnedIds.has(a.id) ? 0 : 1
    const bp = pinnedIds.has(b.id) ? 0 : 1
    return ap - bp
  })

  const AREAS = [
    { whatKey: 'customer_what' as const, whyKey: 'customer_why' as const, label: '고객가치', color: '#DC2626', bg: '#FFF1F2', border: '#FECDD3' },
    { whatKey: 'process_what' as const, whyKey: 'process_why' as const, label: '프로세스', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
    { whatKey: 'people_what' as const, whyKey: 'people_why' as const, label: '사람', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden shadow-sm">
            <div className="h-16 bg-[#E5E5E5] animate-pulse" />
            {[1, 2, 3].map((j) => (
              <div key={j} className="m-3 rounded-xl border border-[#F0F0F0] p-3 space-y-2">
                <div className="h-3 bg-[#F5F5F5] rounded animate-pulse w-1/4" />
                <div className="h-3 bg-[#F5F5F5] rounded animate-pulse w-full" />
                <div className="h-3 bg-[#F5F5F5] rounded animate-pulse w-3/4" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-16 text-[#8A8A8A] text-sm">아직 도출된 마스터플랜이 없습니다.</div>
    )
  }

  const pinnedCount = sortedCards.filter((c) => pinnedIds.has(c.id)).length

  return (
    <div className="space-y-4">
      {pinnedCount > 0 && (
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#CA8A04"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
          <p className="text-[12px] font-bold text-[#CA8A04]">상단 고정 {pinnedCount}개</p>
          <div className="flex-1 h-px bg-[#FDE68A]" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedCards.map((card) => {
          const pinned = pinnedIds.has(card.id)
          return (
            <div
              key={card.id}
              className={`rounded-2xl overflow-hidden shadow-sm transition-all ${
                pinned
                  ? 'border-2 border-[#FCD34D] shadow-[0_0_0_3px_rgba(252,211,77,0.2)]'
                  : 'border border-[#EBEBEB] hover:shadow-md hover:border-[#CCCCCC]'
              }`}
              style={{ backgroundColor: 'white' }}
            >
              {/* 슬로건 헤더 */}
              <div className="bg-[#111111] px-4 py-3 flex items-start justify-between gap-2">
                <button
                  onClick={() => onSelectParticipant(card.participant_id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[11px] font-bold text-white/90 truncate">{card.participants?.name ?? '-'}</p>
                    <span className="text-[9px] text-white/40 truncate shrink-0">{card.participants?.department ?? ''}</span>
                  </div>
                  <p className="text-[10px] font-semibold text-white/40 mb-0.5 uppercase tracking-wider">슬로건</p>
                  <p className="text-[13px] font-bold text-white leading-snug">
                    {card.slogan ?? <span className="text-white/30 italic font-normal">미작성</span>}
                  </p>
                </button>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                    card.is_confirmed ? 'bg-[#ECFDF5] text-[#02855B]' : 'bg-white/10 text-white/40'
                  }`}>
                    {card.is_confirmed ? '확정' : '미확정'}
                  </span>
                  <button
                    onClick={(e) => togglePin(e, card.id)}
                    title={pinned ? '고정 해제' : '상단 고정'}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      pinned
                        ? 'bg-[#FCD34D] hover:bg-[#FBD224]'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={pinned ? '#111' : 'rgba(255,255,255,0.6)'}><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                  </button>
                </div>
              </div>
              {/* 3영역 */}
              <button
                onClick={() => onSelectParticipant(card.participant_id)}
                className="w-full p-3 space-y-2 text-left"
              >
                {AREAS.map(({ whatKey, whyKey, label, color, bg, border }) => (
                  <div key={whatKey} className="rounded-xl border p-3" style={{ backgroundColor: bg, borderColor: border }}>
                    <p className="text-[11px] font-bold mb-2" style={{ color }}>{label}</p>
                    <div className="space-y-1.5">
                      <div>
                        <p className="text-[10px] font-semibold text-[#8A8A8A] mb-0.5">What</p>
                        <p className="text-[12px] text-[#1A1A1A] leading-relaxed">
                          {card[whatKey] ?? <span className="text-[#CCCCCC] italic">미작성</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-[#8A8A8A] mb-0.5">Why</p>
                        <p className="text-[12px] text-[#3A3A3A] leading-relaxed">
                          {card[whyKey] ?? <span className="text-[#CCCCCC] italic">미작성</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// CSV 업로드 모달
// ─────────────────────────────────────────────
function CsvUploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Array<{ name: string; department: string; username: string; cohort: number | null }>>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parseCSV = (raw: string) => {
    const lines = raw.trim().split('\n').filter(Boolean)
    const parsed: Array<{ name: string; department: string; username: string; cohort: number | null }> = []
    for (const line of lines) {
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      if (cols.length < 2) continue
      const [name, department, username, cohortStr] = cols
      if (!name || name === '이름') continue // 헤더 건너뜀
      const cohortNum = parseInt(cohortStr ?? '', 10)
      parsed.push({
        name,
        department: department ?? '',
        username: username ?? '',
        cohort: [1, 2, 3].includes(cohortNum) ? cohortNum : null,
      })
    }
    return parsed
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const raw = ev.target?.result as string
      setText(raw)
      setPreview(parseCSV(raw))
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    setPreview(parseCSV(e.target.value))
  }

  const handleUpload = async () => {
    if (preview.length === 0) return
    setUploading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: preview }),
      })
      const data = await res.json()
      if (!res.ok) { setResult({ type: 'err', msg: data.error ?? '오류가 발생했습니다.' }); return }
      setResult({ type: 'ok', msg: `${data.count}명이 등록되었습니다.` })
      setTimeout(() => { onDone(); onClose() }, 1500)
    } catch {
      setResult({ type: 'err', msg: '서버 오류가 발생했습니다.' })
    } finally {
      setUploading(false)
    }
  }

  const backdrop = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={backdrop}
      onClick={(e) => { if (e.target === backdrop.current) onClose() }}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl w-full max-w-xl flex flex-col shadow-xl max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EBEBEB] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#111111]">교육생 일괄 등록</h2>
            <p className="text-xs text-[#8A8A8A] mt-0.5">CSV 파일 또는 직접 붙여넣기 — 컬럼: 이름, 소속, 아이디, 차수</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-[#8A8A8A]">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* 파일 업로드 */}
          <div>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="h-9 px-4 rounded-xl border border-dashed border-[#D4D4D4] text-sm text-[#8A8A8A] hover:border-[#111111] hover:text-[#111111] transition-colors"
            >
              CSV 파일 선택
            </button>
            <span className="text-xs text-[#8A8A8A] ml-3">또는 아래에 직접 붙여넣기</span>
          </div>
          {/* 텍스트 입력 */}
          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder={`이름,소속,아이디,차수\n홍길동,마케팅실,gildong123,1\n김영희,전략실,younghee456,2`}
            rows={6}
            className="w-full rounded-xl border border-[#EBEBEB] bg-[#F5F5F5] px-4 py-3 text-sm font-mono text-[#3A3A3A] focus:outline-none focus:border-[#111111] resize-none"
          />
          {/* 미리보기 */}
          {preview.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#8A8A8A] mb-2">{preview.length}명 미리보기</p>
              <div className="rounded-xl border border-[#EBEBEB] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#F5F5F5] border-b border-[#EBEBEB]">
                      {['이름', '소속', '아이디', '차수'].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-[#8A8A8A]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((p, i) => (
                      <tr key={i} className="border-b border-[#F5F5F5]">
                        <td className="px-3 py-2 font-medium text-[#111111]">{p.name}</td>
                        <td className="px-3 py-2 text-[#8A8A8A]">{p.department}</td>
                        <td className="px-3 py-2 text-[#8A8A8A]">{p.username}</td>
                        <td className="px-3 py-2">
                          {p.cohort ? (
                            <CohortBadge cohort={p.cohort} />
                          ) : (
                            <span className="text-[#D4D4D4]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {preview.length > 10 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-center text-[#8A8A8A]">... 외 {preview.length - 10}명</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {result && (
            <div className={`px-4 py-3 rounded-xl text-sm font-medium ${result.type === 'ok' ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-red-50 text-red-600'}`}>
              {result.msg}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-[#EBEBEB] shrink-0 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-5 rounded-xl border border-[#EBEBEB] text-sm font-medium text-[#8A8A8A]">취소</button>
          <button
            onClick={handleUpload}
            disabled={uploading || preview.length === 0}
            className="h-10 px-5 rounded-xl bg-[#111111] text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {uploading && <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
            {uploading ? '등록 중...' : `${preview.length}명 등록`}
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'progress' | 'ranking' | 'gallery'>('progress')
  const [rows, setRows] = useState<AdminProgressRow[]>([])
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedInitialTab, setSelectedInitialTab] = useState<'cards' | 'masterplan' | 'actionplan'>('cards')
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [bulkPdfLoading, setBulkPdfLoading] = useState(false)
  const [cohortFilter, setCohortFilter] = useState<'all' | 1 | 2 | 3>('all')
  const [rankingSubTab, setRankingSubTab] = useState<'cohort' | 'total'>('cohort')
  const [showCsvUpload, setShowCsvUpload] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    setFetchError('')
    try {
      const [progressRes, leaderboardRes] = await Promise.all([
        fetch('/api/admin/progress'),
        fetch('/api/leaderboard'),
      ])
      if (!progressRes.ok || !leaderboardRes.ok) throw new Error('fetch failed')
      const [progressJson, leaderboardJson] = await Promise.all([
        progressRes.json(),
        leaderboardRes.json(),
      ])
      setRows(progressJson.data ?? [])
      setScores(leaderboardJson.scores ?? [])
      setLastRefreshed(new Date())
    } catch {
      setFetchError('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  // 최초 로드 + 30초 자동 갱신
  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(fetchData, 30_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchData])

  // 현재 필터 적용된 rows
  const filteredRows = cohortFilter === 'all' ? rows : rows.filter((r) => r.cohort === cohortFilter)

  const downloadCSV = () => {
    const headers = ['이름', '소속', '아이디', '차수', '진짜문제정의', '카드완료', '마스터플랜', '액션플랜', '트래킹완료율', '마지막접속']
    const csvRows = filteredRows.map((r) => [
      r.name,
      r.department,
      r.username,
      r.cohort ? `${r.cohort}차수` : '-',
      r.problem_definition_status,
      `${r.cards_completed}/3`,
      r.masterplan_status,
      r.actionplan_status,
      r.tracking_total > 0 ? `${Math.round((r.tracking_done / r.tracking_total) * 100)}%` : '0%',
      r.last_active_at ? new Date(r.last_active_at).toLocaleString('ko-KR') : '-',
    ].map((v) => `"${v}"`))

    const csv = [headers, ...csvRows].map((row) => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hmg_xclass_진행현황_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadAllPDF = async () => {
    if (bulkPdfLoading || rows.length === 0) return
    setBulkPdfLoading(true)
    try {
      const zip = new JSZip()
      for (const row of rows) {
        const res = await fetch(`/api/admin/participant?id=${row.id}`)
        if (!res.ok) continue
        const detail: ParticipantDetailFull = await res.json()
        const pdf = await generateParticipantPDF(detail)
        const blob = pdf.output('blob')
        zip.file(`HMG_xClass_${row.name}_${getDateStr()}.pdf`, blob)
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `HMG_xClass_전체_${getDateStr()}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    } finally {
      setBulkPdfLoading(false)
    }
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return '-'
    const d = new Date(iso)
    const now = new Date()
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diffMin < 1) return '방금 전'
    if (diffMin < 60) return `${diffMin}분 전`
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}시간 전`
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  const completedCount = filteredRows.filter((r) => r.cards_completed === 3).length
  const masterplanCount = filteredRows.filter((r) => r.masterplan_status === '완료').length
  const actionplanCount = filteredRows.filter((r) => r.actionplan_status === '완료').length

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* 헤더 */}
      <header className="bg-white border-b border-[#EBEBEB] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <img src="/main-logo.png" alt="리더스러닝랩 xClass" className="h-7 object-contain mb-0.5" />
              <h1 className="text-lg font-bold text-[#111111]">관리자 대시보드</h1>
            </div>
            <div className="flex gap-1 bg-[#F5F5F5] rounded-xl p-1">
              {([
                { id: 'progress', label: '진행 현황' },
                { id: 'ranking', label: '랭킹' },
                { id: 'gallery', label: '마스터플랜 갤러리' },
              ] as const).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === id
                      ? 'bg-white text-[#111111] shadow-sm'
                      : 'text-[#8A8A8A] hover:text-[#111111]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#8A8A8A]">
              {lastRefreshed.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 기준
            </span>
            <button
              onClick={fetchData}
              disabled={loading}
              className="h-9 px-4 rounded-xl border border-[#EBEBEB] bg-white text-sm font-medium text-[#3A3A3A] hover:bg-[#F5F5F5] disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              새로고침
            </button>
            {activeTab === 'progress' && (
              <>
                <button
                  onClick={() => setShowCsvUpload(true)}
                  className="h-9 px-4 rounded-xl border border-[#EBEBEB] bg-white text-sm font-medium text-[#3A3A3A] hover:bg-[#F5F5F5] flex items-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  교육생 업로드
                </button>
                <button
                  onClick={downloadAllPDF}
                  disabled={bulkPdfLoading || rows.length === 0}
                  className="h-9 px-4 rounded-xl border border-[#EBEBEB] bg-white text-sm font-medium text-[#3A3A3A] hover:bg-[#F5F5F5] disabled:opacity-50 flex items-center gap-1.5"
                >
                  {bulkPdfLoading ? (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  )}
                  {bulkPdfLoading ? 'PDF 생성 중...' : '전체 PDF 다운로드'}
                </button>
                <button
                  onClick={downloadCSV}
                  disabled={rows.length === 0}
                  className="h-9 px-4 rounded-xl bg-[#111111] active:bg-[#3A3A3A] text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  엑셀 다운로드
                </button>
              </>
            )}
            <button
              onClick={onLogout}
              className="h-9 px-4 rounded-xl border border-[#EBEBEB] text-sm font-medium text-[#8A8A8A] hover:bg-[#F5F5F5]"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* 랭킹 탭 */}
        {activeTab === 'ranking' && (
          <div>
            {/* 서브탭 */}
            <div className="flex gap-1 bg-[#F5F5F5] rounded-xl p-1 w-fit mb-5">
              {([
                { id: 'cohort', label: '차수별 랭킹' },
                { id: 'total', label: '전체 랭킹' },
              ] as const).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setRankingSubTab(id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    rankingSubTab === id ? 'bg-white text-[#111111] shadow-sm' : 'text-[#8A8A8A] hover:text-[#111111]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 차수별 랭킹 */}
            {rankingSubTab === 'cohort' && (
              <div className="space-y-6">
                {[1, 2, 3].map((cohort) => {
                  const cohortScores = scores.filter((s) => s.cohort === cohort)
                    .sort((a, b) => a.cohort_rank - b.cohort_rank)
                  if (cohortScores.length === 0) return null
                  return (
                    <div key={cohort}>
                      <div className="flex items-center gap-3 mb-3">
                        <CohortBadge cohort={cohort} size="xs" />
                        <span className="text-xs text-[#8A8A8A]">{cohortScores.length}명</span>
                      </div>
                      <div className="bg-white rounded-2xl border border-[#EBEBEB] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#EBEBEB] bg-[#F5F5F5]">
                                {['차수 내 순위', '이름', '소속', '완료 항목', '기본 점수', '주차 보너스', '완주 보너스', '총점'].map((h) => (
                                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#8A8A8A] whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {cohortScores.map((s, idx) => {
                                const medal = s.cohort_rank === 1 ? '🥇' : s.cohort_rank === 2 ? '🥈' : s.cohort_rank === 3 ? '🥉' : null
                                const pct = s.total_items > 0 ? Math.round((s.completed_items / s.total_items) * 100) : 0
                                const isTop3 = s.cohort_rank <= 3 && s.total_score > 0
                                return (
                                  <tr key={s.participant_id} className={`border-b border-[#F5F5F5] ${isTop3 ? 'bg-[#FAFFF8]' : idx % 2 === 0 ? '' : 'bg-[#FAFAFA]'}`}>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className={`font-bold ${s.cohort_rank === 1 ? 'text-[#B45309]' : s.cohort_rank === 2 ? 'text-[#6B7280]' : s.cohort_rank === 3 ? 'text-[#92400E]' : 'text-[#8A8A8A]'}`}>
                                        {medal ? `${medal} ` : ''}{s.cohort_rank}위
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-[#111111] whitespace-nowrap">{s.name}</td>
                                    <td className="px-4 py-3 text-[#8A8A8A] max-w-[160px] truncate">{s.department}</td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-20 h-1.5 bg-[#EBEBEB] rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-[#16A34A]' : 'bg-[#111111]'}`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-xs text-[#8A8A8A] whitespace-nowrap">{s.completed_items}/{s.total_items}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-[#111111] font-medium">{s.base_score}점</td>
                                    <td className="px-4 py-3">{s.week_bonus > 0 ? <span className="text-[#2563EB] font-medium">+{s.week_bonus}점</span> : <span className="text-[#D4D4D4]">-</span>}</td>
                                    <td className="px-4 py-3">{s.completion_bonus > 0 ? <span className="text-[#16A34A] font-medium">+{s.completion_bonus}점</span> : <span className="text-[#D4D4D4]">-</span>}</td>
                                    <td className="px-4 py-3"><span className={`font-bold text-base ${isTop3 ? 'text-[#02855B]' : 'text-[#111111]'}`}>{s.total_score}점</span></td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {/* 차수 미지정 */}
                {(() => {
                  const noCohort = scores.filter((s) => s.cohort === null).sort((a, b) => a.rank - b.rank)
                  if (noCohort.length === 0) return null
                  return (
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F3F4F6] text-[#6B7280]">차수 미지정</span>
                        <span className="text-xs text-[#8A8A8A]">{noCohort.length}명</span>
                      </div>
                      <div className="bg-white rounded-2xl border border-[#EBEBEB] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#EBEBEB] bg-[#F5F5F5]">
                                {['순위', '이름', '소속', '완료 항목', '기본 점수', '주차 보너스', '완주 보너스', '총점'].map((h) => (
                                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#8A8A8A] whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {noCohort.map((s, idx) => {
                                const pct = s.total_items > 0 ? Math.round((s.completed_items / s.total_items) * 100) : 0
                                return (
                                  <tr key={s.participant_id} className={`border-b border-[#F5F5F5] ${idx % 2 === 0 ? '' : 'bg-[#FAFAFA]'}`}>
                                    <td className="px-4 py-3 text-[#8A8A8A] font-bold whitespace-nowrap">{s.rank}위</td>
                                    <td className="px-4 py-3 font-medium text-[#111111] whitespace-nowrap">{s.name}</td>
                                    <td className="px-4 py-3 text-[#8A8A8A] max-w-[160px] truncate">{s.department}</td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-20 h-1.5 bg-[#EBEBEB] rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-[#16A34A]' : 'bg-[#111111]'}`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-xs text-[#8A8A8A] whitespace-nowrap">{s.completed_items}/{s.total_items}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-[#111111] font-medium">{s.base_score}점</td>
                                    <td className="px-4 py-3">{s.week_bonus > 0 ? <span className="text-[#2563EB] font-medium">+{s.week_bonus}점</span> : <span className="text-[#D4D4D4]">-</span>}</td>
                                    <td className="px-4 py-3">{s.completion_bonus > 0 ? <span className="text-[#16A34A] font-medium">+{s.completion_bonus}점</span> : <span className="text-[#D4D4D4]">-</span>}</td>
                                    <td className="px-4 py-3"><span className="font-bold text-base text-[#111111]">{s.total_score}점</span></td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* 전체 랭킹 */}
            {rankingSubTab === 'total' && (
              <div>
                {/* 요약 */}
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    { label: '전체 참여자', value: scores.length, unit: '명' },
                    { label: '트래킹 시작', value: scores.filter((s) => s.total_items > 0).length, unit: '명' },
                    { label: '전체 완주', value: scores.filter((s) => s.total_items > 0 && s.completed_items === s.total_items).length, unit: '명' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-white rounded-2xl border border-[#EBEBEB] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <p className="text-xs text-[#8A8A8A] mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold text-[#111111]">{stat.value}<span className="text-sm font-normal text-[#8A8A8A] ml-1">{stat.unit}</span></p>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border border-[#EBEBEB] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#EBEBEB] bg-[#F5F5F5]">
                          {['전체 순위', '이름', '소속', '차수', '완료 항목', '기본 점수', '주차 보너스', '완주 보너스', '총점'].map((h) => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#8A8A8A] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loading && Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="border-b border-[#F5F5F5]">
                            {Array.from({ length: 9 }).map((_, j) => (
                              <td key={j} className="px-4 py-3"><div className="h-4 bg-[#F5F5F5] rounded animate-pulse" /></td>
                            ))}
                          </tr>
                        ))}
                        {!loading && scores.length === 0 && (
                          <tr><td colSpan={9} className="text-center py-12 text-[#8A8A8A] text-sm">트래킹 데이터가 없습니다.</td></tr>
                        )}
                        {!loading && scores.sort((a, b) => a.rank - b.rank).map((s, idx) => {
                          const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : null
                          const pct = s.total_items > 0 ? Math.round((s.completed_items / s.total_items) * 100) : 0
                          const isTop3 = s.rank <= 3 && s.total_score > 0
                          return (
                            <tr key={s.participant_id} className={`border-b border-[#F5F5F5] ${isTop3 ? 'bg-[#FAFFF8]' : idx % 2 === 0 ? '' : 'bg-[#FAFAFA]'}`}>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`font-bold ${s.rank === 1 ? 'text-[#B45309]' : s.rank === 2 ? 'text-[#6B7280]' : s.rank === 3 ? 'text-[#92400E]' : 'text-[#8A8A8A]'}`}>
                                  {medal ? `${medal} ` : ''}{s.rank}위
                                </span>
                              </td>
                              <td className="px-4 py-3 font-medium text-[#111111] whitespace-nowrap">{s.name}</td>
                              <td className="px-4 py-3 text-[#8A8A8A] max-w-[160px] truncate">{s.department}</td>
                              <td className="px-4 py-3">
                                {s.cohort ? (
                                  <CohortBadge cohort={s.cohort} size="xs" />
                                ) : <span className="text-[#D4D4D4] text-xs">-</span>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-[#EBEBEB] rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-[#16A34A]' : 'bg-[#111111]'}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-[#8A8A8A] whitespace-nowrap">{s.completed_items}/{s.total_items}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-[#111111] font-medium">{s.base_score}점</td>
                              <td className="px-4 py-3">{s.week_bonus > 0 ? <span className="text-[#2563EB] font-medium">+{s.week_bonus}점</span> : <span className="text-[#D4D4D4]">-</span>}</td>
                              <td className="px-4 py-3">{s.completion_bonus > 0 ? <span className="text-[#16A34A] font-medium">+{s.completion_bonus}점</span> : <span className="text-[#D4D4D4]">-</span>}</td>
                              <td className="px-4 py-3"><span className={`font-bold text-base ${isTop3 ? 'text-[#02855B]' : 'text-[#111111]'}`}>{s.total_score}점</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!loading && scores.length > 0 && (
                    <div className="px-4 py-3 border-t border-[#EBEBEB] text-xs text-[#8A8A8A] text-right">
                      총 {scores.length}명 · 30초마다 자동 갱신
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 진행 현황 탭 */}
        {activeTab === 'progress' && <>
        {/* 차수 필터 */}
        <div className="flex gap-1 bg-[#F5F5F5] rounded-xl p-1 w-fit mb-5">
          {([
            { id: 'all', label: '전체' },
            { id: 1, label: '1차수' },
            { id: 2, label: '2차수' },
            { id: 3, label: '3차수' },
          ] as const).map(({ id, label }) => (
            <button
              key={String(id)}
              onClick={() => setCohortFilter(id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                cohortFilter === id ? 'bg-white text-[#111111] shadow-sm' : 'text-[#8A8A8A] hover:text-[#111111]'
              }`}
            >
              {label}
              {id !== 'all' && (
                <span className="ml-1.5 text-xs text-[#8A8A8A]">
                  {rows.filter((r) => r.cohort === id).length}명
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: cohortFilter === 'all' ? '전체 교육생' : `${cohortFilter}차수 교육생`, value: filteredRows.length, unit: '명', color: 'text-[#111111]' },
            { label: '카드 완료', value: completedCount, unit: `/ ${filteredRows.length}`, color: 'text-[#111111]' },
            { label: '마스터플랜 완료', value: masterplanCount, unit: `/ ${filteredRows.length}`, color: 'text-[#111111]' },
            { label: '액션플랜 완료', value: actionplanCount, unit: `/ ${filteredRows.length}`, color: 'text-[#111111]' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-[#EBEBEB] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-xs text-[#8A8A8A] mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
                <span className="text-sm font-normal text-[#8A8A8A] ml-1">{stat.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* 에러 */}
        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
            <p className="text-sm text-red-600">{fetchError}</p>
            <button onClick={fetchData} className="text-xs text-[#111111] underline ml-4">
              재시도
            </button>
          </div>
        )}

        {/* 테이블 */}
        <div className="bg-white rounded-2xl border border-[#EBEBEB] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#EBEBEB] bg-[#F5F5F5]">
                  {['이름', '소속', '차수', '진짜문제정의', '카드완료', '마스터플랜', '액션플랜', '트래킹 완료율', '마지막 접속'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#8A8A8A] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#F5F5F5]">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-[#F5F5F5] rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                )}
                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-[#8A8A8A] text-sm">
                      {cohortFilter === 'all' ? '등록된 교육생이 없습니다.' : `${cohortFilter}차수 교육생이 없습니다.`}
                    </td>
                  </tr>
                )}
                {!loading && filteredRows.map((row) => {
                  const trackingRate = row.tracking_total > 0
                    ? Math.round((row.tracking_done / row.tracking_total) * 100)
                    : 0

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className="border-b border-[#F5F5F5] hover:bg-[#F5F5F5] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-[#111111] whitespace-nowrap">{row.name}</td>
                      <td className="px-4 py-3 text-[#8A8A8A] max-w-[160px] truncate">{row.department}</td>
                      <td className="px-4 py-3">
                        {row.cohort ? (
                          <CohortBadge cohort={row.cohort} size="xs" />
                        ) : <span className="text-[#D4D4D4] text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.problem_definition_status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {[1, 2, 3].map((n) => (
                              <div
                                key={n}
                                className={`w-4 h-4 rounded-sm ${
                                  n <= row.cards_completed ? 'bg-[#111111]' : 'bg-[#EBEBEB]'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-[#8A8A8A]">{row.cards_completed}/3</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.masterplan_status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={row.actionplan_status} />
                          {row.tracking_total > 0 && (
                            <span className="text-xs text-[#8A8A8A] whitespace-nowrap">{row.tracking_total}개</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-[#EBEBEB] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#111111] rounded-full transition-all"
                              style={{ width: `${trackingRate}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#8A8A8A] whitespace-nowrap">{trackingRate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#8A8A8A] text-xs whitespace-nowrap">
                        {formatTime(row.last_active_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!loading && filteredRows.length > 0 && (
            <div className="px-4 py-3 border-t border-[#EBEBEB] text-xs text-[#8A8A8A] text-right">
              {cohortFilter === 'all' ? `전체 ${rows.length}명` : `${cohortFilter}차수 ${filteredRows.length}명 / 전체 ${rows.length}명`} · 30초마다 자동 갱신
            </div>
          )}
        </div>

        </>}

        {/* 마스터플랜 갤러리 탭 */}
        {activeTab === 'gallery' && (
          <MasterPlanGallery
            onSelectParticipant={(id) => {
              setSelectedInitialTab('masterplan')
              setSelectedId(id)
            }}
          />
        )}
      </main>

      {/* 상세 모달 */}
      {selectedId && (
        <DetailModal
          participantId={selectedId}
          initialTab={selectedInitialTab}
          onClose={() => { setSelectedId(null); setSelectedInitialTab('cards') }}
        />
      )}

      {/* CSV 업로드 모달 */}
      {showCsvUpload && (
        <CsvUploadModal
          onClose={() => setShowCsvUpload(false)}
          onDone={fetchData}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: '완료' | '미완료' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        status === '완료'
          ? 'bg-[#DCFCE7] text-[#16A34A]'
          : 'bg-[#F3F4F6] text-[#6B7280]'
      }`}
    >
      {status}
    </span>
  )
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem('isAdmin') === 'true')
  }, [])

  const handleLogout = () => {
    sessionStorage.removeItem('isAdmin')
    setIsAdmin(false)
  }

  // hydration 전 렌더 방지
  if (isAdmin === null) return null

  if (!isAdmin) {
    return <AdminLogin onSuccess={() => setIsAdmin(true)} />
  }

  return <AdminDashboard onLogout={handleLogout} />
}
