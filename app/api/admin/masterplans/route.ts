import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('master_plans')
      .select('id, participant_id, slogan, customer_what, customer_why, process_what, process_why, people_what, people_why, is_confirmed, participants(name, department)')
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Admin masterplans API error:', error)
    return NextResponse.json({ error: '마스터플랜 데이터를 불러오는 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
