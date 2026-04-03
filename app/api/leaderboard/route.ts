import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { ScoreEntry } from '@/lib/types'

// 점수 계산 상수
const POINTS_PER_ITEM = 10
const POINTS_PER_WEEK_BONUS = 20
const POINTS_ALL_COMPLETE_BONUS = 50

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient()

    // 모든 참가자 + 트래킹 로그 조회
    const [participantsResult, logsResult] = await Promise.all([
      supabase.from('participants').select('id, name, department, cohort'),
      supabase.from('tracking_logs').select('participant_id, week_number, status'),
    ])

    if (participantsResult.error) throw participantsResult.error
    if (logsResult.error) throw logsResult.error

    const participants = participantsResult.data ?? []
    const allLogs = logsResult.data ?? []

    // 참가자별 점수 계산
    const scores: Omit<ScoreEntry, 'rank' | 'cohort_rank'>[] = participants.map((p) => {
      const logs = allLogs.filter((l) => l.participant_id === p.id)
      const totalItems = logs.length
      const completedItems = logs.filter((l) => l.status === '완료').length
      const baseScore = completedItems * POINTS_PER_ITEM

      // 주차별 완주 보너스
      const weekMap = new Map<number, { total: number; completed: number }>()
      for (const log of logs) {
        const w = log.week_number
        if (!weekMap.has(w)) weekMap.set(w, { total: 0, completed: 0 })
        const entry = weekMap.get(w)!
        entry.total++
        if (log.status === '완료') entry.completed++
      }
      let weekBonus = 0
      for (const { total, completed } of weekMap.values()) {
        if (total > 0 && total === completed) weekBonus += POINTS_PER_WEEK_BONUS
      }

      // 전체 완주 보너스
      const completionBonus =
        totalItems > 0 && totalItems === completedItems ? POINTS_ALL_COMPLETE_BONUS : 0

      const totalScore = baseScore + weekBonus + completionBonus

      return {
        participant_id: p.id,
        name: p.name,
        department: p.department,
        cohort: p.cohort ?? null,
        base_score: baseScore,
        week_bonus: weekBonus,
        completion_bonus: completionBonus,
        total_score: totalScore,
        completed_items: completedItems,
        total_items: totalItems,
      }
    })

    // 전체 점수 내림차순 정렬 + 순위 부여 (동점 동순위)
    scores.sort((a, b) => b.total_score - a.total_score)
    const scoredAll: ScoreEntry[] = scores.map((s) => ({ ...s, rank: 0, cohort_rank: 0 }))
    let currentRank = 1
    for (let i = 0; i < scoredAll.length; i++) {
      if (i > 0 && scoredAll[i].total_score < scoredAll[i - 1].total_score) currentRank = i + 1
      scoredAll[i].rank = currentRank
    }

    // 차수별 cohort_rank 부여
    for (const cohort of [1, 2, 3]) {
      const group = scoredAll
        .filter((s) => s.cohort === cohort)
        .sort((a, b) => b.total_score - a.total_score)
      let cRank = 1
      for (let i = 0; i < group.length; i++) {
        if (i > 0 && group[i].total_score < group[i - 1].total_score) cRank = i + 1
        group[i].cohort_rank = cRank
      }
    }

    return NextResponse.json({ scores: scoredAll })
  } catch (error) {
    console.error('Leaderboard GET error:', error)
    return NextResponse.json({ error: '리더보드 조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}
