import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { participantId, problemDefinitionId } = await request.json()
    if (!participantId || !problemDefinitionId) {
      return NextResponse.json({ error: '필수 파라미터가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    // 이미 좋아요했는지 확인
    const { data: existing } = await supabase
      .from('problem_definition_likes')
      .select('id')
      .eq('participant_id', participantId)
      .eq('problem_definition_id', problemDefinitionId)
      .maybeSingle()

    if (existing) {
      // 취소
      await supabase
        .from('problem_definition_likes')
        .delete()
        .eq('participant_id', participantId)
        .eq('problem_definition_id', problemDefinitionId)
      return NextResponse.json({ liked: false })
    } else {
      // 추가
      await supabase
        .from('problem_definition_likes')
        .insert({ participant_id: participantId, problem_definition_id: problemDefinitionId })
      return NextResponse.json({ liked: true })
    }
  } catch (error) {
    console.error('Problem def gallery like API error:', error)
    return NextResponse.json({ error: '오류가 발생했습니다.' }, { status: 500 })
  }
}
