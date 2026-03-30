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
      .select('card_number, card_topic, step1_keywords, step2_asis, step3_tobe, step4_action, step5_indicator, is_confirmed')
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
    const { participantId, cardNumber, cardData } = body as {
      participantId: string
      cardNumber: 1 | 2 | 3
      cardData: {
        step1?: { answer: string; chatHistory: ChatMessage[] }
        step2?: { answer: string; chatHistory: ChatMessage[] }
        step3?: { answer: string; chatHistory: ChatMessage[] }
        step4?: { answer: string; chatHistory: ChatMessage[] }
      }
    }

    if (!participantId || !cardNumber || !cardData) {
      return NextResponse.json({ error: '필수 데이터가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const allChats: ChatMessage[] = [
      ...(cardData.step1?.chatHistory ?? []),
      ...(cardData.step2?.chatHistory ?? []),
      ...(cardData.step3?.chatHistory ?? []),
      ...(cardData.step4?.chatHistory ?? []),
    ]

    const { error } = await supabase.from('card_responses').upsert(
      {
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
      },
      { onConflict: 'participant_id,card_number' }
    )

    if (error) throw error

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

// PATCH: Step5 성공지표 저장
export async function PATCH(req: NextRequest) {
  try {
    const { participantId, cardNumber, step5Indicator } = await req.json()

    if (!participantId || !cardNumber) {
      return NextResponse.json({ error: '필수 데이터가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { error } = await supabase
      .from('card_responses')
      .update({ step5_indicator: step5Indicator })
      .eq('participant_id', participantId)
      .eq('card_number', cardNumber)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Card step5 save error:', error)
    return NextResponse.json(
      { error: '성공지표 저장 중 오류가 발생했어요.' },
      { status: 500 }
    )
  }
}
