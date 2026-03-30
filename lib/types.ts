// =============================================
// HMG xClass 조직관리 교육 플랫폼
// TypeScript 타입 정의
// =============================================

// 교육생
export interface Participant {
  id: string
  name: string
  department: string
  email: string
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
  customer_what: string | null
  customer_why: string | null
  process_what: string | null
  process_why: string | null
  people_what: string | null
  people_why: string | null
  is_confirmed: boolean
  created_at: string
  updated_at: string
}

// 마스터플랜 AI 도출 결과 (JSON 파싱용)
export interface MasterPlanResult {
  slogan: string
  customer: { what: string; why: string }
  process: { what: string; why: string }
  people: { what: string; why: string }
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
  week_number: 1 | 2 | 3 | 4
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
  email: string
  last_active_at: string
  problem_definition_status: '완료' | '미완료'
  cards_completed: number       // 0~3
  step5_completed: number       // 0~3
  masterplan_status: '완료' | '미완료'
  actionplan_status: '완료' | '미완료'
  tracking_done: number
  tracking_total: number
}

// 리더보드 점수 항목
export interface ScoreEntry {
  participant_id: string
  name: string
  department: string
  base_score: number      // 완료 항목 × 10
  week_bonus: number      // 주차 완주 보너스 × 20
  completion_bonus: number // 전체 완주 보너스 50
  total_score: number
  completed_items: number
  total_items: number
  rank: number
}

// 내 점수 + 순위 (트래킹 페이지용)
export interface MyScore {
  total_score: number
  rank: number
  total_participants: number
  completed_items: number
  total_items: number
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
