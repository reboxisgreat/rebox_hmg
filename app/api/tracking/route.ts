import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { WeeklyChecklist } from '@/lib/types'
import { HOMEWORK_ITEMS } from '@/lib/types'

const POINTS_PER_ITEM = 10
const POINTS_PER_WEEK_BONUS = 20
const POINTS_ALL_COMPLETE_BONUS = 50

function calcScore(logs: { week_number: number; status: string }[], homeworkApproved = false, weeklyProofApprovedCount = 0) {
  const weeklyLogs = logs.filter((l) => l.week_number > 0)

  // 완료 점수: 주차 항목만 (과제는 인증샷 승인 시 별도 보너스)
  const completedCount = weeklyLogs.filter((l) => l.status === '완료').length
  const baseScore = completedCount * POINTS_PER_ITEM

  // 주 완주 보너스: 주차 항목만
  const weekMap = new Map<number, { total: number; completed: number }>()
  for (const log of weeklyLogs) {
    if (!weekMap.has(log.week_number)) weekMap.set(log.week_number, { total: 0, completed: 0 })
    const e = weekMap.get(log.week_number)!
    e.total++
    if (log.status === '완료') e.completed++
  }
  let weekBonus = 0
  for (const { total, completed } of weekMap.values()) {
    if (total > 0 && total === completed) weekBonus += POINTS_PER_WEEK_BONUS
  }

  // 전체 완주 보너스: 주차 항목만
  const weeklyCompleted = weeklyLogs.filter((l) => l.status === '완료').length
  const completionBonus =
    weeklyLogs.length > 0 && weeklyLogs.length === weeklyCompleted ? POINTS_ALL_COMPLETE_BONUS : 0

  // 과제 인증샷 승인 보너스
  const homeworkBonus = homeworkApproved ? 50 : 0

  // 주차별 인증샷 승인 보너스 (주당 +50)
  const weeklyProofBonus = weeklyProofApprovedCount * 50

  return baseScore + weekBonus + completionBonus + homeworkBonus + weeklyProofBonus
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

    const [logsResult, planResult, allLogsResult, participantResult, allParticipantsResult, submissionResult, allSubmissionsResult, weeklyProofResult, allWeeklyProofResult] = await Promise.all([
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
      supabase
        .from('participants')
        .select('id, cohort')
        .eq('id', participantId)
        .maybeSingle(),
      supabase
        .from('participants')
        .select('id, cohort'),
      supabase
        .from('homework_submissions')
        .select('id, status, image_urls, submitted_at, reviewed_at')
        .eq('participant_id', participantId)
        .maybeSingle(),
      supabase
        .from('homework_submissions')
        .select('participant_id, status'),
      supabase
        .from('weekly_proof_submissions')
        .select('id, week_number, status, image_urls, submitted_at, reviewed_at')
        .eq('participant_id', participantId)
        .order('week_number'),
      supabase
        .from('weekly_proof_submissions')
        .select('participant_id, week_number, status'),
    ])

    if (logsResult.error) throw logsResult.error

    // 과제 logs 누락 시 자동 삽입 (이전 저장 데이터 호환)
    const existingLogs = logsResult.data ?? []
    const hasWeeklyLogs = existingLogs.some((l) => l.week_number > 0)
    const hasHomeworkLogs = existingLogs.some((l) => l.week_number === 0)
    if (hasWeeklyLogs && !hasHomeworkLogs) {
      const homeworkLogs = HOMEWORK_ITEMS.map((content, index) => ({
        participant_id: participantId,
        week_number: 0,
        item_index: index,
        item_content: content,
        status: '미착수' as const,
        memo: null,
      }))
      const { data: inserted, error: hwError } = await supabase
        .from('tracking_logs')
        .insert(homeworkLogs)
        .select()
      if (!hwError && inserted) {
        existingLogs.push(...inserted)
      } else if (hwError) {
        console.warn('과제 logs 자동 삽입 실패:', hwError)
      }
    }

    // 주차별 테마 추출
    const weekThemes: Record<number, string> = {}
    const checklist = planResult.data?.monthly_checklist as WeeklyChecklist[] | null
    if (checklist) {
      for (const week of checklist) {
        weekThemes[week.week] = week.theme
      }
    }

    // 내 점수 계산
    const myLogs = existingLogs
    const mySubmission = submissionResult.data ?? null
    const myHomeworkApproved = mySubmission?.status === 'approved'
    const myWeeklyProofs = weeklyProofResult.data ?? []
    const myWeeklyProofApprovedCount = myWeeklyProofs.filter((s) => s.status === 'approved').length
    const myScore = calcScore(myLogs, myHomeworkApproved, myWeeklyProofApprovedCount)
    const myCohort = participantResult.data?.cohort ?? null

    // 전체 참가자 목록 기반으로 순위 계산 (트래킹 미시작자 포함)
    const allLogs = allLogsResult.data ?? []
    const allParticipants = allParticipantsResult.data ?? []
    const allSubmissions = allSubmissionsResult.data ?? []
    const allWeeklyProofs = allWeeklyProofResult.data ?? []
    const allScores = allParticipants.map((p) => {
      const approved = allSubmissions.some((s) => s.participant_id === p.id && s.status === 'approved')
      const weeklyApprovedCount = allWeeklyProofs.filter((s) => s.participant_id === p.id && s.status === 'approved').length
      return calcScore(allLogs.filter((l) => l.participant_id === p.id), approved, weeklyApprovedCount)
    })
    const myRank = allScores.filter((s) => s > myScore).length + 1
    const totalParticipants = allParticipants.length

    // 차수별 순위 계산
    let cohortRank = 0
    let cohortTotal = 0
    if (myCohort) {
      const cohortParticipants = allParticipants.filter((p) => p.cohort === myCohort)
      const cohortScores = cohortParticipants.map((p) => {
        const approved = allSubmissions.some((s) => s.participant_id === p.id && s.status === 'approved')
        const weeklyApprovedCount = allWeeklyProofs.filter((s) => s.participant_id === p.id && s.status === 'approved').length
        return calcScore(allLogs.filter((l) => l.participant_id === p.id), approved, weeklyApprovedCount)
      })
      cohortRank = cohortScores.filter((s) => s > myScore).length + 1
      cohortTotal = cohortParticipants.length
    }

    return NextResponse.json({
      logs: myLogs,
      weekThemes,
      homeworkSubmission: mySubmission,
      weeklyProofSubmissions: myWeeklyProofs,
      myScore: {
        total_score: myScore,
        rank: myRank,
        total_participants: totalParticipants,
        cohort_rank: cohortRank,
        cohort_total: cohortTotal,
        cohort: myCohort,
        completed_items: myLogs.filter((l) => l.week_number > 0 && l.status === '완료').length,
        total_items: myLogs.filter((l) => l.week_number > 0).length,
        homework_bonus: myHomeworkApproved ? 50 : 0,
        weekly_proof_bonus: myWeeklyProofApprovedCount * 50,
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
