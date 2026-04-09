import { NextRequest, NextResponse } from 'next/server'
import { generateSingleResponse } from '@/lib/gemini'
import { getMasterPlanPrompt } from '@/lib/prompts'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { MasterPlanResult } from '@/lib/types'

// GET: 카드 응답 + 기존 마스터플랜 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const participantId = searchParams.get('participantId')

    if (!participantId) {
      return NextResponse.json({ error: '참가자 ID가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const [cardsResult, planResult] = await Promise.all([
      supabase
        .from('card_responses')
        .select('card_number, step1_keywords, step2_asis, step3_tobe, step4_action, step5_indicator, is_confirmed')
        .eq('participant_id', participantId)
        .order('card_number'),
      supabase
        .from('master_plans')
        .select('*')
        .eq('participant_id', participantId)
        .maybeSingle(),
    ])

    if (cardsResult.error) throw cardsResult.error

    return NextResponse.json({
      cards: cardsResult.data ?? [],
      masterPlan: planResult.data ?? null,
    })
  } catch (error) {
    console.error('MasterPlan GET error:', error)
    return NextResponse.json({ error: '데이터 조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}

// POST: 마스터플랜 AI 도출 + Supabase 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { participantId, participantName, cardResponses } = body

    if (!participantId || !cardResponses) {
      return NextResponse.json({ error: '필수 데이터가 없습니다.' }, { status: 400 })
    }

    const prompt = getMasterPlanPrompt(cardResponses, participantName ?? '리더')
    const raw = await generateSingleResponse(prompt, '마스터플랜을 도출해주세요.')

    const stripped = raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('MasterPlan raw response:', raw)
      throw new Error('JSON 파싱 실패')
    }
    const result: MasterPlanResult = JSON.parse(jsonMatch[0])

    const supabase = createSupabaseServiceClient()
    const { data, error: dbError } = await supabase
      .from('master_plans')
      .upsert(
        {
          participant_id: participantId,
          slogan: result.slogan,
          customer_strategy: result.customer.strategy,
          customer_what: result.customer.what,
          customer_why: result.customer.why,
          process_strategy: result.process.strategy,
          process_what: result.process.what,
          process_why: result.process.why,
          people_strategy: result.people.strategy,
          people_what: result.people.what,
          people_why: result.people.why,
          is_confirmed: false,
          is_stale: false,
        },
        { onConflict: 'participant_id' }
      )
      .select()
      .single()

    if (dbError) throw dbError

    // 액션플랜이 있으면 is_stale = true (마스터플랜이 바뀌었음을 알림)
    await supabase
      .from('action_plans')
      .update({ is_stale: true })
      .eq('participant_id', participantId)

    return NextResponse.json({ masterPlan: result, id: data.id })
  } catch (error) {
    console.error('MasterPlan POST error:', error)
    return NextResponse.json(
      { error: '마스터플랜 도출 중 오류가 발생했어요. 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}

// PATCH: 마스터플랜 수정 저장 (자동저장 + 확정)
export async function PATCH(req: NextRequest) {
  try {
    const { participantId, masterPlan, isConfirmed } = await req.json()

    if (!participantId || !masterPlan) {
      return NextResponse.json({ error: '필수 데이터가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { error } = await supabase
      .from('master_plans')
      .update({
        slogan: masterPlan.slogan,
        customer_strategy: masterPlan.customer_strategy,
        customer_what: masterPlan.customer_what,
        customer_why: masterPlan.customer_why,
        process_strategy: masterPlan.process_strategy,
        process_what: masterPlan.process_what,
        process_why: masterPlan.process_why,
        people_strategy: masterPlan.people_strategy,
        people_what: masterPlan.people_what,
        people_why: masterPlan.people_why,
        ...(isConfirmed !== undefined && { is_confirmed: isConfirmed }),
      })
      .eq('participant_id', participantId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('MasterPlan PATCH error:', error)
    return NextResponse.json({ error: '저장 중 오류가 발생했어요.' }, { status: 500 })
  }
}
