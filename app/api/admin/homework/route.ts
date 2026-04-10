import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

// GET: 전체 과제 인증샷 제출 목록 (관리자용)
export async function GET() {
  try {
    const supabase = createSupabaseServiceClient()

    const { data, error } = await supabase
      .from('homework_submissions')
      .select('id, participant_id, image_urls, status, submitted_at, reviewed_at, participants(name, department, cohort)')
      .order('submitted_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ submissions: data ?? [] })
  } catch (error) {
    console.error('Admin homework GET error:', error)
    return NextResponse.json({ error: '조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}
