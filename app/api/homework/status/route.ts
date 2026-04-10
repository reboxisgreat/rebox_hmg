import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

// GET: 과제 제출 현황 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const participantId = searchParams.get('participantId')

    if (!participantId) {
      return NextResponse.json({ error: '참가자 ID가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('homework_submissions')
      .select('id, status, image_urls, submitted_at, reviewed_at')
      .eq('participant_id', participantId)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ submission: data })
  } catch (error) {
    console.error('Homework status error:', error)
    return NextResponse.json({ error: '조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}
