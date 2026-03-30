import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

function calcScore(logs: { week_number: number; status: string }[]) {
  const totalItems = logs.length
  const completedItems = logs.filter((l) => l.status === '완료').length
  const baseScore = completedItems * 10
  const weekMap = new Map<number, { total: number; done: number }>()
  for (const log of logs) {
    if (!weekMap.has(log.week_number)) weekMap.set(log.week_number, { total: 0, done: 0 })
    const e = weekMap.get(log.week_number)!
    e.total++
    if (log.status === '완료') e.done++
  }
  let weekBonus = 0
  for (const { total, done } of weekMap.values()) {
    if (total > 0 && total === done) weekBonus += 20
  }
  const completionBonus = totalItems > 0 && totalItems === completedItems ? 50 : 0
  return baseScore + weekBonus + completionBonus
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const participantId = searchParams.get('participantId')

    if (!participantId) {
      return NextResponse.json({ error: '참가자 ID가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const [participantResult, cardsResult, masterResult, actionResult, trackingResult, allLogsResult, problemDefResult] = await Promise.all([
      supabase
        .from('participants')
        .select('name, department')
        .eq('id', participantId)
        .single(),
      supabase
        .from('card_responses')
        .select('card_number, is_confirmed')
        .eq('participant_id', participantId),
      supabase
        .from('master_plans')
        .select('slogan, is_confirmed')
        .eq('participant_id', participantId)
        .maybeSingle(),
      supabase
        .from('action_plans')
        .select('is_confirmed')
        .eq('participant_id', participantId)
        .maybeSingle(),
      supabase
        .from('tracking_logs')
        .select('week_number, status')
        .eq('participant_id', participantId),
      supabase
        .from('tracking_logs')
        .select('participant_id, week_number, status'),
      supabase
        .from('problem_definitions')
        .select('is_confirmed')
        .eq('participant_id', participantId)
        .maybeSingle(),
    ])

    const myLogs = trackingResult.data ?? []
    const allLogs = allLogsResult.data ?? []
    const myScore = calcScore(myLogs)
    const participantIds = [...new Set(allLogs.map((l) => l.participant_id))]
    const allScores = participantIds.map((pid) =>
      calcScore(allLogs.filter((l) => l.participant_id === pid))
    )
    const myRank = allScores.filter((s) => s > myScore).length + 1

    return NextResponse.json({
      participant: participantResult.data ?? { name: '', department: '' },
      cards: cardsResult.data ?? [],
      masterPlan: masterResult.data ?? null,
      actionPlan: actionResult.data ?? null,
      problemDefinition: problemDefResult.data ?? null,
      tracking: {
        total: myLogs.length,
        completed: myLogs.filter((t) => t.status === '완료').length,
      },
      score: {
        total_score: myScore,
        rank: myRank,
        total_participants: participantIds.length,
      },
    })
  } catch (error) {
    console.error('Progress GET error:', error)
    return NextResponse.json({ error: '데이터 조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}
