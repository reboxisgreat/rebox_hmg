import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { CARD_TOPICS } from '@/lib/types'
import type { ChatMessage } from '@/lib/types'

// GET: 교육생의 카드 응답 전체 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const participantId = searchParams.get('participantId')

    if (!participantId) {
      return NextResponse.json({ error: '참가자 ID가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('card_responses')
      .select('card_number, card_topic, step1_keywords, step2_asis, step3_tobe, step4_action, step5_indicator, is_confirmed, chat_history')
      .eq('participant_id', participantId)
      .order('card_number')

    if (error) throw error

    return NextResponse.json({ cards: data ?? [] })
  } catch (error) {
    console.error('Card GET error:', error)
    return NextResponse.json({ error: '데이터 조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { participantId, cardNumber } = body as { participantId: string; cardNumber: 1 | 2 | 3 }

    if (!participantId || !cardNumber) {
      return NextResponse.json({ error: '필수 데이터가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    let upsertData: Record<string, unknown>

    if (body.summary) {
      // 새 형식: 단일 채팅 기반 (summary + chatHistory)
      const summary = body.summary as {
        step1?: string; step2?: string; step3?: string; step4?: string; step5?: string
      }
      upsertData = {
        participant_id: participantId,
        card_number: cardNumber,
        card_topic: CARD_TOPICS[cardNumber],
        step1_keywords: summary.step1 ?? null,
        step2_asis: summary.step2 ?? null,
        step3_tobe: summary.step3 ?? null,
        step4_action: summary.step4 ?? null,
        step5_indicator: summary.step5 ?? null,
        is_confirmed: true,
        chat_history: (body.chatHistory as ChatMessage[]) ?? [],
      }
    } else {
      // 구 형식: Step별 chatData
      const cardData = body.cardData as {
        step1?: { answer: string; chatHistory: ChatMessage[] }
        step2?: { answer: string; chatHistory: ChatMessage[] }
        step3?: { answer: string; chatHistory: ChatMessage[] }
        step4?: { answer: string; chatHistory: ChatMessage[] }
      }
      if (!cardData) {
        return NextResponse.json({ error: '필수 데이터가 없습니다.' }, { status: 400 })
      }
      const allChats: ChatMessage[] = [
        ...(cardData.step1?.chatHistory ?? []),
        ...(cardData.step2?.chatHistory ?? []),
        ...(cardData.step3?.chatHistory ?? []),
        ...(cardData.step4?.chatHistory ?? []),
      ]
      upsertData = {
        participant_id: participantId,
        card_number: cardNumber,
        card_topic: CARD_TOPICS[cardNumber],
        step1_keywords: cardData.step1?.answer ?? null,
        step2_asis: cardData.step2?.answer ?? null,
        step3_tobe: cardData.step3?.answer ?? null,
        step4_action: cardData.step4?.answer ?? null,
        step5_indicator: null,
        is_confirmed: true,
        chat_history: allChats,
      }
    }

    const { error } = await supabase.from('card_responses').upsert(
      upsertData,
      { onConflict: 'participant_id,card_number' }
    )

    if (error) throw error

    // 마스터플랜이 있으면 is_stale = true (내용이 바뀌었음을 알림)
    await supabase
      .from('master_plans')
      .update({ is_stale: true })
      .eq('participant_id', participantId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Card save error:', error)
    return NextResponse.json(
      { error: '저장 중 오류가 발생했어요. 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}

// PUT: 카드 응답 내용 직접 수정 (마스터플랜/액션플랜 영향 없음)
export async function PUT(req: NextRequest) {
  try {
    const { participantId, cardNumber, fields } = await req.json() as {
      participantId: string
      cardNumber: 1 | 2 | 3
      fields: {
        step1_keywords?: string
        step2_asis?: string
        step3_tobe?: string
        step4_action?: string
        step5_indicator?: string
      }
    }

    if (!participantId || !cardNumber) {
      return NextResponse.json({ error: '필수 데이터가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { error } = await supabase
      .from('card_responses')
      .update(fields)
      .eq('participant_id', participantId)
      .eq('card_number', cardNumber)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Card PUT error:', error)
    return NextResponse.json({ error: '저장 중 오류가 발생했어요.' }, { status: 500 })
  }
}

// PATCH: Step5 성공지표 저장 OR 채팅 기록 임시 저장 OR 카드 미확정 처리
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { participantId, cardNumber, step5Indicator, chatHistory, isConfirmed } = body

    if (!participantId || !cardNumber) {
      return NextResponse.json({ error: '필수 데이터가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    if (isConfirmed === false) {
      // 카드 미확정: is_confirmed = false + 채팅 기록 초기화
      const { error } = await supabase
        .from('card_responses')
        .update({ is_confirmed: false, chat_history: [] })
        .eq('participant_id', participantId)
        .eq('card_number', cardNumber)
      if (error) throw error
      return NextResponse.json({ success: true })
    } else if (chatHistory !== undefined) {
      // 채팅 기록 임시 저장: 기존 레코드 있으면 chat_history만 업데이트, 없으면 신규 생성
      const { data: existing } = await supabase
        .from('card_responses')
        .select('id')
        .eq('participant_id', participantId)
        .eq('card_number', cardNumber)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('card_responses')
          .update({ chat_history: chatHistory })
          .eq('participant_id', participantId)
          .eq('card_number', cardNumber)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('card_responses')
          .insert({
            participant_id: participantId,
            card_number: cardNumber,
            card_topic: CARD_TOPICS[cardNumber as 1 | 2 | 3],
            chat_history: chatHistory,
            is_confirmed: false,
          })
        if (error) throw error
      }
    } else {
      // Step5 성공지표 저장
      const { error } = await supabase
        .from('card_responses')
        .update({ step5_indicator: step5Indicator })
        .eq('participant_id', participantId)
        .eq('card_number', cardNumber)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Card PATCH error:', error)
    return NextResponse.json(
      { error: '저장 중 오류가 발생했어요.' },
      { status: 500 }
    )
  }
}
