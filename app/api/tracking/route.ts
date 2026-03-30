import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { WeeklyChecklist } from '@/lib/types'

const POINTS_PER_ITEM = 10
const POINTS_PER_WEEK_BONUS = 20
const POINTS_ALL_COMPLETE_BONUS = 50

function calcScore(logs: { week_number: number; status: string }[]) {
  const totalItems = logs.length
  const completedItems = logs.filter((l) => l.status === '완료').length
  const baseScore = completedItems * POINTS_PER_ITEM

  const weekMap = new Map<number, { total: number; completed: number }>()
  for (const log of logs) {
    if (!weekMap.has(log.week_number)) weekMap.set(log.week_number, { total: 0, completed: 0 })
    const e = weekMap.get(log.week_number)!
    e.total++
    if (log.status === '완료') e.completed++
  }
  let weekBonus = 0
  for (const { total, completed } of weekMap.values()) {
    if (total > 0 && total === completed) weekBonus += POINTS_PER_WEEK_BONUS
  }
  const completionBonus =
    totalItems > 0 && totalItems === completedItems ? POINTS_ALL_COMPLETE_BONUS : 0

  return baseScore + weekBonus + completionBonus
}

// GET: tracking_logs + 주차별 테마 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const participantId = searchParams.get('participantId')

    if (!participantId) {
      return NextResponse.json({ error: '참가자 ID가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const [logsResult, planResult, allLogsResult] = await Promise.all([
      supabase
        .from('tracking_logs')
        .select('*')
        .eq('participant_id', participantId)
        .order('week_number')
        .order('item_index'),
      supabase
        .from('action_plans')
        .select('monthly_checklist')
        .eq('participant_id', participantId)
        .maybeSingle(),
      supabase
        .from('tracking_logs')
        .select('participant_id, week_number, status'),
    ])

    if (logsResult.error) throw logsResult.error

    // 주차별 테마 추출
    const weekThemes: Record<number, string> = {}
    const checklist = planResult.data?.monthly_checklist as WeeklyChecklist[] | null
    if (checklist) {
      for (const week of checklist) {
        weekThemes[week.week] = week.theme
      }
    }

    // 내 점수 계산
    const myLogs = logsResult.data ?? []
    const myScore = calcScore(myLogs)

    // 전체 참가자 점수로 내 순위 계산
    const allLogs = allLogsResult.data ?? []
    const participantIds = [...new Set(allLogs.map((l) => l.participant_id))]
    const allScores = participantIds.map((pid) =>
      calcScore(allLogs.filter((l) => l.participant_id === pid))
    )
    // 내 점수보다 높은 사람 수 + 1 = 내 순위
    const myRank = allScores.filter((s) => s > myScore).length + 1
    const totalParticipants = participantIds.length

    return NextResponse.json({
      logs: myLogs,
      weekThemes,
      myScore: {
        total_score: myScore,
        rank: myRank,
        total_participants: totalParticipants,
        completed_items: myLogs.filter((l) => l.status === '완료').length,
        total_items: myLogs.length,
      },
    })
  } catch (error) {
    console.error('Tracking GET error:', error)
    return NextResponse.json({ error: '데이터 조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}

// PATCH: 항목 상태 또는 메모 업데이트
export async function PATCH(req: NextRequest) {
  try {
    const { logId, status, memo } = await req.json()

    if (!logId) {
      return NextResponse.json({ error: '항목 ID가 없습니다.' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (status !== undefined) updates.status = status
    if (memo !== undefined) updates.memo = memo

    const supabase = createSupabaseServiceClient()
    const { error } = await supabase
      .from('tracking_logs')
      .update(updates)
      .eq('id', logId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tracking PATCH error:', error)
    return NextResponse.json({ error: '저장 중 오류가 발생했어요.' }, { status: 500 })
  }
}
