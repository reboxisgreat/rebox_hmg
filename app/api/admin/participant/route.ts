import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const [participantRes, cardsRes, masterplanRes, actionplanRes, trackingRes] = await Promise.all([
      supabase.from('participants').select('*').eq('id', id).single(),
      supabase
        .from('card_responses')
        .select('*')
        .eq('participant_id', id)
        .order('card_number', { ascending: true }),
      supabase.from('master_plans').select('*').eq('participant_id', id).maybeSingle(),
      supabase.from('action_plans').select('*').eq('participant_id', id).maybeSingle(),
      supabase
        .from('tracking_logs')
        .select('week_number, item_index, status, memo')
        .eq('participant_id', id),
    ])

    if (participantRes.error) throw participantRes.error

    // tracking_logs의 최신 상태를 monthly_checklist에 반영
    const actionPlan = actionplanRes.data
    if (actionPlan?.monthly_checklist && trackingRes.data && trackingRes.data.length > 0) {
      const logMap = new Map(
        trackingRes.data.map((l: { week_number: number; item_index: number; status: string; memo: string }) =>
          [`${l.week_number}-${l.item_index}`, l]
        )
      )
      actionPlan.monthly_checklist = actionPlan.monthly_checklist.map(
        (week: { week: number; theme: string; items: { index: number; content: string; status: string; memo: string }[] }) => ({
          ...week,
          items: week.items.map((item: { index: number; content: string; status: string; memo: string }) => {
            const log = logMap.get(`${week.week}-${item.index}`)
            return log ? { ...item, status: log.status, memo: log.memo } : item
          }),
        })
      )
    }

    return NextResponse.json({
      participant: participantRes.data,
      cards: cardsRes.data ?? [],
      masterPlan: masterplanRes.data ?? null,
      actionPlan: actionPlan ?? null,
    })
  } catch (error) {
    console.error('Admin participant API error:', error)
    return NextResponse.json(
      { error: '교육생 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 교육생 일괄 등록 (CSV 업로드용)
export async function POST(req: NextRequest) {
  try {
    const { participants } = await req.json()

    if (!Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json({ error: '등록할 교육생 데이터가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const rows = participants.map((p: { name: string; department: string; username: string; cohort: number | null }) => ({
      name: p.name?.trim() || '',
      department: p.department?.trim() || '',
      username: p.username?.trim() || '',
      cohort: p.cohort ?? null,
      password: '1234',
      password_changed: false,
    })).filter((p) => p.name)

    const { data, error } = await supabase
      .from('participants')
      .upsert(rows, { onConflict: 'username', ignoreDuplicates: false })
      .select('id, name')

    if (error) throw error

    return NextResponse.json({ success: true, count: data?.length ?? 0 })
  } catch (error) {
    console.error('Participant bulk import error:', error)
    return NextResponse.json(
      { error: '교육생 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PATCH: 비밀번호 초기화 (1234로 리셋) 또는 가산점 설정
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, admin_bonus, adminPassword } = body

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    // 가산점 설정
    if (admin_bonus !== undefined) {
      if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }
      const { error } = await supabase
        .from('participants')
        .update({ admin_bonus: Math.max(0, Number(admin_bonus)) })
        .eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // 비밀번호 초기화
    const { error } = await supabase
      .from('participants')
      .update({ password: '1234', password_changed: false })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin participant PATCH error:', error)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
