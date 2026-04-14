import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const participantId = request.nextUrl.searchParams.get('participantId')
  if (!participantId) {
    return NextResponse.json({ error: 'participantId가 필요합니다.' }, { status: 400 })
  }

  try {
    const supabase = createSupabaseServiceClient()

    // 참가자의 cohort 조회
    const { data: participant, error: pError } = await supabase
      .from('participants')
      .select('cohort')
      .eq('id', participantId)
      .single()

    if (pError || !participant) {
      return NextResponse.json({ error: '참가자를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (participant.cohort === null) {
      return NextResponse.json({ data: [] })
    }

    // 같은 차수의 확정된 card_responses 조회
    const { data: cards, error } = await supabase
      .from('card_responses')
      .select('id, participant_id, card_number, card_topic, step1_keywords, step2_asis, step3_tobe, step4_action, step5_indicator, is_confirmed, participants!inner(name, department, cohort)')
      .not('step1_keywords', 'is', null)
      .eq('participants.cohort', participant.cohort)
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!cards || cards.length === 0) return NextResponse.json({ data: [] })

    // 좋아요 집계
    const cardIds = cards.map((c) => c.id)
    const { data: likes, error: lError } = await supabase
      .from('card_gallery_likes')
      .select('card_response_id, participant_id')
      .in('card_response_id', cardIds)

    if (lError) throw lError

    const likeCountMap: Record<string, number> = {}
    const likedByMe: Record<string, boolean> = {}
    for (const like of likes ?? []) {
      likeCountMap[like.card_response_id] = (likeCountMap[like.card_response_id] ?? 0) + 1
      if (like.participant_id === participantId) {
        likedByMe[like.card_response_id] = true
      }
    }

    const HIDDEN_IDS = ['rebox']
    const data = cards
      .filter((c) => !HIDDEN_IDS.includes(c.participant_id))
      .map((c) => ({
        ...c,
        like_count: likeCountMap[c.id] ?? 0,
        is_liked: likedByMe[c.id] ?? false,
      }))
      .sort((a, b) => b.like_count - a.like_count)

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Card gallery API error:', error)
    return NextResponse.json({ error: '데이터를 불러오는 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
