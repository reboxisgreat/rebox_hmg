import { NextRequest, NextResponse } from 'next/server'
import { generateSingleResponse } from '@/lib/gemini'
import { getActionPlanPrompt } from '@/lib/prompts'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { QuarterlyPlan, WeeklyChecklist, ChecklistItem } from '@/lib/types'

interface ActionPlanResult {
  yearlyPlan: QuarterlyPlan[]
  monthlyChecklist: Array<{ week: 1 | 2 | 3 | 4; theme: string; items: string[] }>
}

// GET: 마스터플랜 확인 + 기존 액션플랜 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const participantId = searchParams.get('participantId')

    if (!participantId) {
      return NextResponse.json({ error: '참가자 ID가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const [masterResult, planResult] = await Promise.all([
      supabase
        .from('master_plans')
        .select('*')
        .eq('participant_id', participantId)
        .maybeSingle(),
      supabase
        .from('action_plans')
        .select('*')
        .eq('participant_id', participantId)
        .maybeSingle(),
    ])

    return NextResponse.json({
      masterPlan: masterResult.data ?? null,
      actionPlan: planResult.data ?? null,
    })
  } catch (error) {
    console.error('ActionPlan GET error:', error)
    return NextResponse.json({ error: '데이터 조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}

// POST: 액션플랜 AI 도출 + Supabase 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { participantId, participantName, masterPlan } = body

    if (!participantId || !masterPlan) {
      return NextResponse.json({ error: '필수 데이터가 없습니다.' }, { status: 400 })
    }

    const prompt = getActionPlanPrompt(masterPlan, participantName ?? '리더')
    const raw = await generateSingleResponse(prompt, '액션플랜을 도출해주세요.')

    // 마크다운 코드블록 제거 후 JSON 추출
    const stripped = raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('ActionPlan raw response:', raw)
      throw new Error('JSON 파싱 실패')
    }
    const result: ActionPlanResult = JSON.parse(jsonMatch[0])

    // 30일 체크리스트 구조 변환 (items를 ChecklistItem 배열로)
    const monthlyChecklist: WeeklyChecklist[] = result.monthlyChecklist.map((week) => ({
      week: week.week,
      theme: week.theme,
      items: week.items.map((content, index): ChecklistItem => ({
        index,
        content,
        status: '미착수',
        memo: '',
      })),
    }))

    // Supabase에 저장
    const supabase = createSupabaseServiceClient()
    const { data, error: dbError } = await supabase
      .from('action_plans')
      .upsert({
        participant_id: participantId,
        yearly_plan: result.yearlyPlan,
        monthly_checklist: monthlyChecklist,
        ai_supplement_chat: [],
        is_confirmed: false,
      }, { onConflict: 'participant_id' })
      .select()
      .single()

    if (dbError) throw dbError

    return NextResponse.json({
      yearlyPlan: result.yearlyPlan,
      monthlyChecklist,
      id: data.id,
    })
  } catch (error) {
    console.error('ActionPlan POST error:', error)
    return NextResponse.json(
      { error: '액션플랜 도출 중 오류가 발생했어요. 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}

// PATCH: 액션플랜 최종 확정 + tracking_logs 생성
export async function PATCH(req: NextRequest) {
  try {
    const { participantId, yearlyPlan, monthlyChecklist } = await req.json()

    if (!participantId || !yearlyPlan || !monthlyChecklist) {
      return NextResponse.json({ error: '필수 데이터가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    // 1. 액션플랜 확정 저장
    const { error: updateError } = await supabase
      .from('action_plans')
      .update({
        yearly_plan: yearlyPlan,
        monthly_checklist: monthlyChecklist,
        is_confirmed: true,
      })
      .eq('participant_id', participantId)

    if (updateError) throw updateError

    // 2. 기존 tracking_logs 삭제 후 재생성
    await supabase.from('tracking_logs').delete().eq('participant_id', participantId)

    const trackingLogs = (monthlyChecklist as WeeklyChecklist[]).flatMap((week) =>
      week.items.map((item: ChecklistItem) => ({
        participant_id: participantId,
        week_number: week.week,
        item_index: item.index,
        item_content: item.content,
        status: '미착수' as const,
        memo: null,
      }))
    )

    if (trackingLogs.length > 0) {
      const { error: insertError } = await supabase.from('tracking_logs').insert(trackingLogs)
      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ActionPlan PATCH error:', error)
    return NextResponse.json({ error: '저장 중 오류가 발생했어요.' }, { status: 500 })
  }
}
