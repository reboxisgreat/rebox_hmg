import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { generateStreamingResponse } from '@/lib/gemini'
import { getProblemDefinitionSystemPrompt } from '@/lib/prompts'
import type { Message } from '@/lib/gemini'

// GET: 저장된 진짜문제정의 로드
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const participantId = searchParams.get('participantId')
    if (!participantId) {
      return NextResponse.json({ error: '참가자 ID가 없습니다.' }, { status: 400 })
    }
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('problem_definitions')
      .select('*')
      .eq('participant_id', participantId)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Problem definition GET error:', error)
    return NextResponse.json({ error: '데이터 조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}

// POST: Gemini AI 코칭 스트리밍
export async function POST(req: NextRequest) {
  try {
    const { messages, stepResponses } = await req.json()
    const systemPrompt = getProblemDefinitionSystemPrompt(stepResponses)
    // Gemini API는 contents가 반드시 1개 이상이어야 함
    // 첫 코칭 시작 시 messages가 빈 배열이면 트리거 메시지를 추가
    const msgs: Message[] =
      Array.isArray(messages) && messages.length > 0
        ? (messages as Message[])
        : [{ role: 'user', content: '작성한 내용을 검토하고 코칭을 시작해주세요.' }]
    return generateStreamingResponse(systemPrompt, msgs)
  } catch (error) {
    console.error('Problem definition POST error:', error)
    return NextResponse.json({ error: 'AI 응답 중 오류가 발생했어요.' }, { status: 500 })
  }
}

// PUT: 진짜문제정의 저장/업데이트
export async function PUT(req: NextRequest) {
  try {
    const { participantId, step1, step2, step3, step4, chatHistory, isConfirmed } = await req.json()
    if (!participantId) {
      return NextResponse.json({ error: '참가자 ID가 없습니다.' }, { status: 400 })
    }
    const supabase = createSupabaseServiceClient()
    const { error } = await supabase.from('problem_definitions').upsert(
      {
        participant_id: participantId,
        step1_customer: step1,
        step2_problem: step2,
        step3_definition: step3,
        step4_keywords: step4,
        chat_history: chatHistory ?? [],
        is_confirmed: isConfirmed ?? false,
      },
      { onConflict: 'participant_id' }
    )
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Problem definition PUT error:', error)
    return NextResponse.json({ error: '저장 중 오류가 발생했어요.' }, { status: 500 })
  }
}
