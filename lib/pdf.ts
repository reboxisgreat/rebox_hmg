// =============================================
// PDF 생성 유틸리티 (공유)
// admin/page.tsx, masterplan/page.tsx, actionplan/page.tsx 에서 공통 사용
// =============================================

import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import type { QuarterlyPlan, WeeklyChecklist } from '@/lib/types'

// ── 내부 헬퍼 ────────────────────────────────────────────

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

async function renderSection(html: string): Promise<HTMLDivElement> {
  const { wrapper, content } = createHiddenContent(html)
  ;(content as HTMLDivElement & { __wrapper: HTMLDivElement }).__wrapper = wrapper
  return content
}

function cleanupSection(el: HTMLElement) {
  const wrapper = (el as HTMLDivElement & { __wrapper: HTMLDivElement }).__wrapper
  if (wrapper?.parentNode) wrapper.parentNode.removeChild(wrapper)
}

// ── 공개 API ─────────────────────────────────────────────

/**
 * HTML 섹션 배열을 받아 각 섹션을 하나의 페이지로 렌더링한 PDF를 반환.
 * 페이지 높이는 콘텐츠 높이에 맞춰 자동 조정 (A4 폭 고정).
 */
export async function buildPdf(htmlSections: string[]): Promise<jsPDF> {
  const RENDER_W = 720   // 렌더링 픽셀 폭
  const PDF_W_MM = 210   // A4 폭(mm) 고정

  let pdf: jsPDF | null = null

  for (const html of htmlSections) {
    const el = await renderSection(html)
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
      pdf = new jsPDF({ unit: 'mm', format: [PDF_W_MM, heightMm] })
    } else {
      pdf.addPage([PDF_W_MM, heightMm])
    }
    pdf.addImage(dataUrl, 'PNG', 0, 0, PDF_W_MM, heightMm)
  }

  return pdf!
}

export function buildMasterPlanHtml(mp: {
  slogan?: string | null
  customer_what?: string | null
  customer_why?: string | null
  process_what?: string | null
  process_why?: string | null
  people_what?: string | null
  people_why?: string | null
}): string {
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

export function buildActionPlanHtml(data: {
  yearly_plan: QuarterlyPlan[] | null
  monthly_checklist: WeeklyChecklist[] | null
}): string {
  const yearlyHtml = data.yearly_plan
    ? `<div style="margin-bottom:32px;">
        <h2 style="font-size:15px;font-weight:700;color:#111111;margin:0 0 14px;">연간 플랜 (Q1~Q4)</h2>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          ${data.yearly_plan.map((q) => `
            <div style="flex:1;min-width:300px;border:1px solid #EBEBEB;border-radius:10px;padding:14px 16px;">
              <p style="font-size:13px;font-weight:700;color:#111111;margin:0 0 4px;">${q.quarter}</p>
              <p style="font-size:11px;color:#8A8A8A;margin:0 0 10px;">${q.focus ?? ''}</p>
              ${(q.actions ?? []).map((a) => `<p style="font-size:12px;color:#3A3A3A;line-height:1.55;border-top:1px solid #F5F5F5;padding:5px 0;margin:0;">• ${a}</p>`).join('')}
            </div>`).join('')}
        </div>
      </div>` : ''

  const checklistHtml = data.monthly_checklist
    ? `<div>
        <h2 style="font-size:15px;font-weight:700;color:#111111;margin:0 0 14px;">30일 체크리스트</h2>
        ${data.monthly_checklist.map((week) => `
          <div style="margin-bottom:20px;">
            <h3 style="font-size:13px;font-weight:700;color:#111111;margin:0 0 8px;">
              ${week.week}주차${week.theme ? ` — ${week.theme}` : ''}
            </h3>
            ${week.items.map((item) => `
              <div style="background:#F5F5F5;border-radius:8px;padding:10px 12px;margin-bottom:6px;">
                <p style="font-size:12px;color:#111111;line-height:1.6;margin:0;">${item.content}</p>
              </div>`).join('')}
          </div>`).join('')}
      </div>` : ''

  return `<div style="padding:36px 40px;background:#ffffff;">
    <p style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A8A;margin:0 0 20px;">액션플랜</p>
    ${yearlyHtml}${checklistHtml}
  </div>`
}
