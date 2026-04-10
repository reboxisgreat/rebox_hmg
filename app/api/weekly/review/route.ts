import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

// PATCH: 관리자 주차 인증 승인/반려
export async function PATCH(req: NextRequest) {
  try {
    const { submissionId, action, adminPassword } = await req.json()

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }
    if (!submissionId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const { data, error } = await supabase
      .from('weekly_proof_submissions')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ submission: data })
  } catch (error) {
    console.error('Weekly review PATCH error:', error)
    return NextResponse.json({ error: '처리 중 오류가 발생했어요.' }, { status: 500 })
  }
}
