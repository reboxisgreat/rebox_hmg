-- =============================================
-- HMG xClass 차수(cohort) 기능 추가
-- =============================================

-- 1. participants 테이블에 차수 컬럼 추가
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS cohort INTEGER CHECK (cohort IN (1, 2, 3));

-- 2. 차수별 랭킹 뷰
CREATE OR REPLACE VIEW cohort_ranking_view AS
SELECT
  p.id,
  p.name,
  p.department,
  p.cohort,
  COUNT(DISTINCT CASE WHEN tl.status = '완료' THEN tl.id END) AS done_count,
  COUNT(DISTINCT tl.id) AS total_count,
  CASE
    WHEN COUNT(DISTINCT tl.id) = 0 THEN 0
    ELSE ROUND(
      COUNT(DISTINCT CASE WHEN tl.status = '완료' THEN tl.id END) * 100.0
      / COUNT(DISTINCT tl.id), 1
    )
  END AS completion_rate,
  RANK() OVER (
    PARTITION BY p.cohort
    ORDER BY
      COUNT(DISTINCT CASE WHEN tl.status = '완료' THEN tl.id END) * 100.0
      / NULLIF(COUNT(DISTINCT tl.id), 0) DESC
  ) AS cohort_rank
FROM participants p
LEFT JOIN tracking_logs tl ON p.id = tl.participant_id
GROUP BY p.id, p.name, p.department, p.cohort;

-- 3. 전체 랭킹 뷰
CREATE OR REPLACE VIEW total_ranking_view AS
SELECT
  p.id,
  p.name,
  p.department,
  p.cohort,
  COUNT(DISTINCT CASE WHEN tl.status = '완료' THEN tl.id END) AS done_count,
  COUNT(DISTINCT tl.id) AS total_count,
  CASE
    WHEN COUNT(DISTINCT tl.id) = 0 THEN 0
    ELSE ROUND(
      COUNT(DISTINCT CASE WHEN tl.status = '완료' THEN tl.id END) * 100.0
      / COUNT(DISTINCT tl.id), 1
    )
  END AS completion_rate,
  RANK() OVER (
    ORDER BY
      COUNT(DISTINCT CASE WHEN tl.status = '완료' THEN tl.id END) * 100.0
      / NULLIF(COUNT(DISTINCT tl.id), 0) DESC
  ) AS total_rank
FROM participants p
LEFT JOIN tracking_logs tl ON p.id = tl.participant_id
GROUP BY p.id, p.name, p.department, p.cohort;
