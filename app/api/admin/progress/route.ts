import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const includeHidden = searchParams.get('include_hidden') === 'true'

    const supabase = createSupabaseServiceClient()

    const [progressResult, problemDefResult, homeworkResult, weeklyResult, hiddenResult] = await Promise.all([
      supabase
        .from('admin_progress_view')
        .select('*')
        .order('last_active_at', { ascending: false }),
      supabase
        .from('problem_definitions')
        .select('participant_id, is_confirmed'),
      supabase
        .from('homework_submissions')
        .select('participant_id, status'),
      supabase
        .from('weekly_proof_submissions')
        .select('participant_id, status'),
      supabase
        .from('participants')
        .select('id, is_hidden'),
    ])

    if (progressResult.error) throw progressResult.error

    const problemDefMap = new Map(
      (problemDefResult.data ?? []).map((pd) => [pd.participant_id, pd.is_confirmed])
    )

    const homeworkMap = new Map(
      (homeworkResult.data ?? []).map((h) => [h.participant_id, h.status])
    )

    const weeklyMap = new Map<string, number>()
    for (const w of weeklyResult.data ?? []) {
      if (w.status === 'approved') {
        weeklyMap.set(w.participant_id, (weeklyMap.get(w.participant_id) ?? 0) + 1)
      }
    }

    const hiddenMap = new Map<string, boolean>(
      (hiddenResult.data ?? []).map((p: { id: string; is_hidden: boolean | null }) => [p.id, p.is_hidden ?? false])
    )

    const allRows = (progressResult.data ?? []).map((row) => ({
      ...row,
      problem_definition_status: problemDefMap.get(row.id) ? '완료' : '미완료',
      homework_proof_status: homeworkMap.get(row.id) ?? 'none',
      weekly_proof_approved: weeklyMap.get(row.id) ?? 0,
      is_hidden: hiddenMap.get(row.id) ?? false,
    }))

    const data = includeHidden ? allRows : allRows.filter((r) => !r.is_hidden)

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Admin progress API error:', error)
    return NextResponse.json(
      { error: '데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
