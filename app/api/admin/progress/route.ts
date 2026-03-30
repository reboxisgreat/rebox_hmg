import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient()

    const [progressResult, problemDefResult] = await Promise.all([
      supabase
        .from('admin_progress_view')
        .select('*')
        .order('last_active_at', { ascending: false }),
      supabase
        .from('problem_definitions')
        .select('participant_id, is_confirmed'),
    ])

    if (progressResult.error) throw progressResult.error

    const problemDefMap = new Map(
      (problemDefResult.data ?? []).map((pd) => [pd.participant_id, pd.is_confirmed])
    )

    const data = (progressResult.data ?? []).map((row) => ({
      ...row,
      problem_definition_status: problemDefMap.get(row.id) ? '완료' : '미완료',
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Admin progress API error:', error)
    return NextResponse.json(
      { error: '데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
