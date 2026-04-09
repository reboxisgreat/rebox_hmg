-- =============================================
-- 과제 트래킹 지원: tracking_logs week_number=0 허용
-- =============================================

-- 1. 기존 week_number CHECK 제약 제거 (이름이 다를 경우 아래 주석 참고)
ALTER TABLE tracking_logs DROP CONSTRAINT IF EXISTS tracking_logs_week_number_check;

-- 만약 위 명령이 실패하면 Supabase에서 실제 제약 이름 확인:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'tracking_logs'::regclass;
-- 그 후: ALTER TABLE tracking_logs DROP CONSTRAINT IF EXISTS <실제_제약_이름>;

-- 2. 0~4 허용하는 새 제약 추가 (0=과제, 1~4=주차)
ALTER TABLE tracking_logs
ADD CONSTRAINT tracking_logs_week_number_check
CHECK (week_number >= 0 AND week_number <= 4);
