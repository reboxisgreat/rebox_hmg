import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { participantId, cardResponseId } = await request.json()
    if (!participantId || !cardResponseId) {
      return NextResponse.json({ error: '필수 파라미터가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    // 이미 좋아요했는지 확인
    const { data: existing } = await supabase
      .from('card_gallery_likes')
      .select('id')
      .eq('participant_id', participantId)
      .eq('card_response_id', cardResponseId)
      .maybeSingle()

    if (existing) {
      // 취소
      await supabase
        .from('card_gallery_likes')
        .delete()
        .eq('participant_id', participantId)
        .eq('card_response_id', cardResponseId)
      return NextResponse.json({ liked: false })
    } else {
      // 추가
      await supabase
        .from('card_gallery_likes')
        .insert({ participant_id: participantId, card_response_id: cardResponseId })
      return NextResponse.json({ liked: true })
    }
  } catch (error) {
    console.error('Card gallery like API error:', error)
    return NextResponse.json({ error: '오류가 발생했습니다.' }, { status: 500 })
  }
}
