import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

// GET: 참가자의 주차별 인증 현황 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const participantId = searchParams.get('participantId')

    if (!participantId) {
      return NextResponse.json({ error: '참가자 ID가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('weekly_proof_submissions')
      .select('id, week_number, status, image_urls, submitted_at, reviewed_at')
      .eq('participant_id', participantId)
      .order('week_number')

    if (error) throw error

    return NextResponse.json({ submissions: data ?? [] })
  } catch (error) {
    console.error('Weekly status GET error:', error)
    return NextResponse.json({ error: '조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}
