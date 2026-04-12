import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

function calcScore(
  logs: { week_number: number; status: string }[],
  homeworkApproved: boolean,
  weeklyProofCount: number,
  adminBonus: number,
) {
  const weeklyLogs = logs.filter((l) => l.week_number > 0)
  const totalItems = weeklyLogs.length
  const completedItems = weeklyLogs.filter((l) => l.status === '완료').length
  const baseScore = completedItems * 10
  const weekMap = new Map<number, { total: number; done: number }>()
  for (const log of weeklyLogs) {
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
  const homeworkBonus = homeworkApproved ? 50 : 0
  const weeklyProofBonus = weeklyProofCount * 50
  return baseScore + weekBonus + completionBonus + homeworkBonus + weeklyProofBonus + adminBonus
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const participantId = searchParams.get('participantId')

    if (!participantId) {
      return NextResponse.json({ error: '참가자 ID가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const [participantResult, cardsResult, masterResult, actionResult, trackingResult, allLogsResult, problemDefResult, allParticipantsResult, allSubmissionsResult, allWeeklyProofsResult] = await Promise.all([
      supabase
        .from('participants')
        .select('name, department, cohort')
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
      supabase
        .from('participants')
        .select('id, cohort, admin_bonus'),
      supabase
        .from('homework_submissions')
        .select('participant_id, status'),
      supabase
        .from('weekly_proof_submissions')
        .select('participant_id, status'),
    ])

    const myLogs = trackingResult.data ?? []
    const allLogs = allLogsResult.data ?? []
    const allParticipants = allParticipantsResult.data ?? []
    const allSubmissions = allSubmissionsResult.data ?? []
    const allWeeklyProofs = allWeeklyProofsResult.data ?? []
    const myCohort = participantResult.data?.cohort ?? null

    const myHomeworkApproved = allSubmissions.some((s) => s.participant_id === participantId && s.status === 'approved')
    const myWeeklyProofCount = allWeeklyProofs.filter((s) => s.participant_id === participantId && s.status === 'approved').length
    const myAdminBonus = allParticipants.find((p) => p.id === participantId)?.admin_bonus ?? 0
    const myScore = calcScore(myLogs, myHomeworkApproved, myWeeklyProofCount, myAdminBonus)

    // 차수 내 순위 (cohort가 있으면 차수 기준, 없으면 전체 기준)
    const rankGroup = myCohort
      ? allParticipants.filter((p) => p.cohort === myCohort)
      : allParticipants
    const rankScores = rankGroup.map((p) => {
      const homeworkApproved = allSubmissions.some((s) => s.participant_id === p.id && s.status === 'approved')
      const weeklyProofCount = allWeeklyProofs.filter((s) => s.participant_id === p.id && s.status === 'approved').length
      const adminBonus = p.admin_bonus ?? 0
      return calcScore(allLogs.filter((l) => l.participant_id === p.id), homeworkApproved, weeklyProofCount, adminBonus)
    })
    const myRank = rankScores.filter((s) => s > myScore).length + 1

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
        total_participants: rankGroup.length,
        cohort: myCohort,
      },
    })
  } catch (error) {
    console.error('Progress GET error:', error)
    return NextResponse.json({ error: '데이터 조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}
