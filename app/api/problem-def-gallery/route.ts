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

    // 같은 차수의 확정된 problem_definitions 조회
    const { data: defs, error } = await supabase
      .from('problem_definitions')
      .select('id, participant_id, step1_customer, step2_problem, step3_definition, step4_keywords, is_confirmed, participants!inner(name, department, cohort, username)')
      .not('step1_customer', 'is', null)
      .eq('participants.cohort', participant.cohort)
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!defs || defs.length === 0) return NextResponse.json({ data: [] })

    // 좋아요 집계
    const defIds = defs.map((d) => d.id)
    const { data: likes, error: lError } = await supabase
      .from('problem_definition_likes')
      .select('problem_definition_id, participant_id')
      .in('problem_definition_id', defIds)

    if (lError) throw lError

    const likeCountMap: Record<string, number> = {}
    const likedByMe: Record<string, boolean> = {}
    for (const like of likes ?? []) {
      likeCountMap[like.problem_definition_id] = (likeCountMap[like.problem_definition_id] ?? 0) + 1
      if (like.participant_id === participantId) {
        likedByMe[like.problem_definition_id] = true
      }
    }

    const HIDDEN_USERNAMES = ['rebox', 'test']
    const data = defs
      .filter((d) => !HIDDEN_USERNAMES.includes((d.participants as { username?: string })?.username ?? ''))
      .map((d) => ({
        ...d,
        like_count: likeCountMap[d.id] ?? 0,
        is_liked: likedByMe[d.id] ?? false,
      }))
      .sort((a, b) => b.like_count - a.like_count)

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Problem def gallery API error:', error)
    return NextResponse.json({ error: '데이터를 불러오는 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
