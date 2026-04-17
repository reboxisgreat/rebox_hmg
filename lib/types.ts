// =============================================
// HMG xClass 조직관리 교육 플랫폼
// TypeScript 타입 정의
// =============================================

// 교육생
export interface Participant {
  id: string
  name: string
  department: string
  username: string
  cohort: number | null
  created_at: string
  last_active_at: string
}

// 카드 작성 내용 (Step 1~5)
export interface CardResponse {
  id: string
  participant_id: string
  card_number: 1 | 2 | 3
  card_topic: '고객가치' | '사람관리' | '프로세스'
  step1_keywords: string | null
  step2_asis: string | null
  step3_tobe: string | null
  step4_action: string | null
  step5_indicator: string | null
  is_confirmed: boolean
  chat_history: ChatMessage[] | null
  created_at: string
  updated_at: string
}

// 챗봇 메시지
export interface ChatMessage {
  role: 'user' | 'model'
  content: string
  timestamp: string
}

// 마스터플랜
export interface MasterPlan {
  id: string
  participant_id: string
  slogan: string | null
  customer_strategy: string | null
  customer_what: string | null
  customer_why: string | null
  process_strategy: string | null
  process_what: string | null
  process_why: string | null
  people_strategy: string | null
  people_what: string | null
  people_why: string | null
  is_confirmed: boolean
  created_at: string
  updated_at: string
}

// 마스터플랜 갤러리 카드 (참가자 정보 포함)
export interface MasterPlanCard {
  id: string
  participant_id: string
  slogan: string | null
  customer_strategy: string | null
  customer_what: string | null
  customer_why: string | null
  process_strategy: string | null
  process_what: string | null
  process_why: string | null
  people_strategy: string | null
  people_what: string | null
  people_why: string | null
  is_confirmed: boolean
  participants: { name: string; department: string | null } | null
}

// 마스터플랜 AI 도출 결과 (JSON 파싱용)
export interface MasterPlanResult {
  slogan: string
  customer: { strategy: string; what: string; why: string }
  process: { strategy: string; what: string; why: string }
  people: { strategy: string; what: string; why: string }
}

// 1년 액션플랜 분기별 항목
export interface QuarterlyPlan {
  quarter: string
  focus: string
  actions: string[]
}

// 30일 체크리스트 주차별 항목
export interface WeeklyChecklist {
  week: 1 | 2 | 3 | 4
  theme: string
  items: ChecklistItem[]
}

// 체크리스트 개별 항목
export interface ChecklistItem {
  index: number
  content: string
  status: '미착수' | '진행중' | '완료'
  memo: string
  isFixed?: boolean  // true면 수정·삭제 불가 (고정 항목)
}

// 액션플랜 전체
export interface ActionPlan {
  id: string
  participant_id: string
  yearly_plan: QuarterlyPlan[] | null
  monthly_checklist: WeeklyChecklist[] | null
  ai_supplement_chat: ChatMessage[] | null
  is_confirmed: boolean
  created_at: string
  updated_at: string
}

// 트래킹 로그
export interface TrackingLog {
  id: string
  participant_id: string
  week_number: 0 | 1 | 2 | 3 | 4
  item_index: number
  item_content: string
  status: '미착수' | '진행중' | '완료'
  memo: string | null
  updated_at: string
}

// 관리자 대시보드용 진행 현황
export interface AdminProgressRow {
  id: string
  name: string
  department: string
  username: string
  cohort: number | null
  last_active_at: string
  problem_definition_status: '완료' | '미완료'
  cards_completed: number       // 0~3
  step5_completed: number       // 0~3
  masterplan_status: '완료' | '미완료'
  actionplan_status: '완료' | '미완료'
  tracking_done: number
  tracking_total: number
  homework_proof_status: 'none' | 'pending' | 'approved' | 'rejected'
  weekly_proof_approved: number   // 0~4, 승인된 주차 수
  is_hidden?: boolean
}

// 과제 인증샷 제출
export interface HomeworkSubmission {
  id: string
  participant_id: string
  image_urls: string[]
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  reviewed_at: string | null
}

// 주차별 인증샷 제출
export interface WeeklyProofSubmission {
  id: string
  participant_id: string
  week_number: 1 | 2 | 3 | 4
  image_urls: string[]
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  reviewed_at: string | null
}

// 리더보드 점수 항목
export interface ScoreEntry {
  participant_id: string
  name: string
  department: string
  cohort: number | null
  base_score: number      // 주차 완료 항목 × 10
  week_bonus: number      // 주차 완주 보너스 × 20
  completion_bonus: number // 전체 완주 보너스 50
  homework_bonus: number  // 과제 인증샷 제출 시 50
  weekly_proof_bonus: number // 주차 인증샷 제출 시 주당 +50
  admin_bonus: number     // 관리자 가산점
  total_score: number
  completed_items: number
  total_items: number
  rank: number
  cohort_rank: number
}

// 내 점수 + 순위 (트래킹 페이지용)
export interface MyScore {
  total_score: number
  rank: number
  total_participants: number
  cohort_rank: number
  cohort_total: number
  cohort: number | null
  completed_items: number
  total_items: number
  homework_bonus: number
  weekly_proof_bonus: number
  admin_bonus: number
}

// 카드 번호 → 주제 매핑
export const CARD_TOPICS: Record<1 | 2 | 3, '고객가치' | '사람관리' | '프로세스'> = {
  1: '고객가치',
  2: '사람관리',
  3: '프로세스',
}

// 카드 번호 → 한글 제목 매핑
export const CARD_TITLES: Record<1 | 2 | 3, string> = {
  1: '고객가치 관리',
  2: '사람 관리',
  3: '프로세스 관리',
}

// Step 번호 → 한글 제목 매핑
export const STEP_TITLES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '마음을 강타한 키워드 3가지',
  2: '현재수준 (As-Is)',
  3: '지향점 (To-Be, 2028년 12월 31일)',
  4: '당장 실행할 액션',
  5: '성공을 증명하는 지표',
}

export const HOMEWORK_ITEMS = [
  '[모집] 리더를 한자리에 모아 교육 내용 공유 세션을 엽니다',
  '[공유] 실습카드 이미지를 보여주며 #해시태그 중심으로 핵심 내용을 설명합니다',
  '[실습] 리더들이 직접 실습카드를 작성하고 서로 공유합니다',
  '[질문] 내용이 기억이 나지 않는다면, AI 정직이 코치에게 질문하여 해결합니다',
]
