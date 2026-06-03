import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

// DELETE: 주차 인증샷 삭제 (관리자용)
export async function DELETE(req: NextRequest) {
  try {
    const { submissionId, adminPassword } = await req.json()
    if (!submissionId || !adminPassword) {
      return NextResponse.json({ error: '필수 값이 없습니다.' }, { status: 400 })
    }

    const validPasswords = (process.env.ADMIN_PASSWORD ?? '').split(',').map((p) => p.trim())
    if (!validPasswords.includes(adminPassword)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const supabase = createSupabaseServiceClient()

    const { data: existing } = await supabase
      .from('weekly_proof_submissions')
      .select('image_urls')
      .eq('id', submissionId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: '제출 내역이 없습니다.' }, { status: 404 })
    }

    if (existing.image_urls?.length > 0) {
      await supabase.storage.from('homework-proofs').remove(existing.image_urls)
    }

    const { error } = await supabase
      .from('weekly_proof_submissions')
      .delete()
      .eq('id', submissionId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin weekly delete error:', error)
    return NextResponse.json({ error: '삭제 중 오류가 발생했어요.' }, { status: 500 })
  }
}

// GET: 전체 주차 인증 제출 목록 (관리자용)
export async function GET() {
  try {
    const supabase = createSupabaseServiceClient()

    const { data, error } = await supabase
      .from('weekly_proof_submissions')
      .select('id, participant_id, week_number, image_urls, status, submitted_at, reviewed_at, participants(name, department, cohort)')
      .order('submitted_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ submissions: data ?? [] })
  } catch (error) {
    console.error('Admin weekly GET error:', error)
    return NextResponse.json({ error: '조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}
