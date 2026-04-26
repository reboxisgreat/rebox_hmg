import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient()
    const [{ data, error }, { data: likes, error: likesError }] = await Promise.all([
      supabase
        .from('master_plans')
        .select('id, participant_id, slogan, customer_strategy, customer_what, customer_why, process_strategy, process_what, process_why, people_strategy, people_what, people_why, is_confirmed, participants(name, department, cohort)')
        .order('created_at', { ascending: true }),
      supabase
        .from('gallery_likes')
        .select('master_plan_id'),
    ])

    if (error) throw error
    if (likesError) throw likesError

    const likeCountMap: Record<string, number> = {}
    for (const like of likes ?? []) {
      likeCountMap[like.master_plan_id] = (likeCountMap[like.master_plan_id] ?? 0) + 1
    }

    const result = (data ?? []).map((mp) => ({
      ...mp,
      like_count: likeCountMap[mp.id] ?? 0,
    }))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Admin masterplans API error:', error)
    return NextResponse.json({ error: '마스터플랜 데이터를 불러오는 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
