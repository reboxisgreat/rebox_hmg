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

    // 같은 차수의 확정된 마스터플랜 조회
    const { data: plans, error } = await supabase
      .from('master_plans')
      .select('id, participant_id, slogan, customer_what, customer_why, process_what, process_why, people_what, people_why, is_confirmed, participants!inner(name, department, cohort)')
      .eq('is_confirmed', true)
      .eq('participants.cohort', participant.cohort)
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!plans || plans.length === 0) return NextResponse.json({ data: [] })

    // 좋아요 집계: 각 마스터플랜의 like_count
    const planIds = plans.map((p) => p.id)
    const { data: likes, error: lError } = await supabase
      .from('gallery_likes')
      .select('master_plan_id, participant_id')
      .in('master_plan_id', planIds)

    if (lError) throw lError

    const likeCountMap: Record<string, number> = {}
    const likedByMe: Record<string, boolean> = {}
    for (const like of likes ?? []) {
      likeCountMap[like.master_plan_id] = (likeCountMap[like.master_plan_id] ?? 0) + 1
      if (like.participant_id === participantId) {
        likedByMe[like.master_plan_id] = true
      }
    }

    const data = plans
      .map((p) => ({
        ...p,
        like_count: likeCountMap[p.id] ?? 0,
        is_liked: likedByMe[p.id] ?? false,
      }))
      .sort((a, b) => b.like_count - a.like_count)

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Gallery API error:', error)
    return NextResponse.json({ error: '데이터를 불러오는 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
