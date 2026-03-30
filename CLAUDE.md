# HMG xClass 조직관리 교육 플랫폼

## 프로젝트 개요
현대자동차그룹(HMG) 리더 대상 조직관리 교육 플랫폼.
교육 당일 챗봇 실습 → 마스터플랜 도출 → 교육 이후 액션플랜 트래킹까지 하나로 연결.

## 기술 스택
- Frontend: Next.js (App Router), TypeScript 5, React 19, Tailwind CSS 4
- DB: Supabase (PostgreSQL)
- AI: Google Gemini 2.5 Flash API (`gemini-2.5-flash`, 스트리밍 필수)
- PDF 출력: html-to-image + jsPDF
- 배포: Vercel

## 환경변수 (.env.local)
```
GEMINI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
```

## 폴더 구조
```
/app
  /page.tsx                    ← 교육생 로그인 + 홈 대시보드 (진행 현황 + 다음 단계 안내)
  /chat/page.tsx               ← 오전 세션: 카드 1~3 Step1~4 챗봇 + 요약 확정
  /masterplan/page.tsx         ← 오후 세션: Step5 코칭 + 마스터플랜 AI 도출 + 편집
  /actionplan/page.tsx         ← 연간 플랜(Q1~Q4) + 30일 체크리스트 + AI 보완 챗봇
  /tracking/page.tsx           ← 교육 이후 체크리스트 수행 현황 + 리더보드
  /admin/page.tsx              ← 관리자 대시보드 (비밀번호 보호, CSV 내보내기)
  /api
    /chat/route.ts             ← Gemini 스트리밍 챗봇 (normal 모드 & supplement 모드)
    /card/route.ts             ← 카드 GET/POST(저장)/PATCH(Step5 업데이트)
    /card-summary/route.ts     ← 카드 AI 요약 생성 (스트리밍)
    /masterplan/route.ts       ← 마스터플랜 GET/POST(AI 도출)/PATCH(편집+확정)
    /actionplan/route.ts       ← 액션플랜 GET/POST(AI 도출)/PATCH(확정+트래킹 로그 생성)
    /progress/route.ts         ← 교육생 전체 진행 현황 (홈 대시보드용)
    /tracking/route.ts         ← 트래킹 로그 GET/PATCH(상태+메모 업데이트)
    /leaderboard/route.ts      ← 전체 참가자 점수 순위
    /admin/
      /auth/route.ts           ← 관리자 비밀번호 검증
      /progress/route.ts       ← 관리자용 전체 진행 현황
      /participant/route.ts    ← 개인별 상세 데이터
/lib
  /gemini.ts                   ← Gemini API 스트리밍 유틸 (generateStreamingResponse, generateSingleResponse, fetchStream)
  /supabase.ts                 ← Supabase 클라이언트 팩토리
  /prompts.ts                  ← 모든 AI 프롬프트 중앙 관리
  /types.ts                    ← TypeScript 타입 정의 (DB 엔티티 + 상수)
/components
  /chat/ChatWindow.tsx         ← 스트리밍 챗봇 UI (카드별, 단계별 재사용)
  /chat/MessageBubble.tsx      ← 메시지 말풍선 (user/model 스타일 구분)
  /tracking/Leaderboard.tsx    ← 바텀시트 리더보드 (현재 유저 하이라이트)
```

## 핵심 규칙

### 1. Gemini 스트리밍 필수
- 모든 AI 응답은 반드시 스트리밍으로 구현
- `fetch` + `ReadableStream` + SSE 방식 사용
- 절대로 `await` 후 한 번에 응답 반환하지 말 것
- 글자가 실시간으로 타이핑되듯 출력되어야 함

```typescript
// 올바른 스트리밍 구현 패턴 (lib/gemini.ts의 generateStreamingResponse 활용)
const stream = await ai.models.generateContentStream({...})
const encoder = new TextEncoder()
const readable = new ReadableStream({
  async start(controller) {
    for await (const chunk of stream) {
      const text = chunk.text()
      if (text) controller.enqueue(encoder.encode(`data: ${text}\n\n`))
    }
    controller.close()
  }
})
return new Response(readable, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  }
})
```

클라이언트에서는 `fetchStream(url, body, onChunk, onDone, onError)` 유틸 사용.

### 2. Supabase 클라이언트 구분
- 교육생 접근: `createSupabaseBrowserClient()` (anon key) → RLS 적용
- 관리자/서버: `createSupabaseServiceClient()` (service_role key) → RLS 우회
- API Route에서는 항상 `createSupabaseServiceClient()` 사용

### 3. 교육생 세션 관리
- 로그인 시 `participant_id` (UUID)와 `participant_name`을 `localStorage`에 저장
- 모든 페이지에서 `participant_id` 없으면 로그인 페이지(`/`)로 리다이렉트
- 홈(`/`)에서 진행 현황 기반 자동 다음 단계 안내:
  - 카드 미완료 → `/chat`
  - 카드 완료, 마스터플랜 없음 → `/masterplan`
  - 마스터플랜 완료, 액션플랜 없음 → `/actionplan`
  - 모두 완료 → `/tracking`

### 4. 모바일 최적화 필수
- 교육생은 스마트폰으로 접속
- 모든 UI는 모바일 퍼스트로 설계
- 터치 친화적 버튼 크기 (최소 44px)
- 채팅창 키보드 올라올 때 레이아웃 밀리지 않도록 처리

### 5. 프롬프트 관리
- 모든 프롬프트는 `/lib/prompts.ts`에서 중앙 관리
- 컴포넌트나 API route에 프롬프트 문자열 직접 작성 금지
- 카드별, 단계별 프롬프트 함수로 분리

현재 정의된 프롬프트 함수:
- `getCard1SystemPrompt()` - 고객가치 카드 코칭
- `getCard2SystemPrompt()` - 사람관리 카드 코칭
- `getCard3SystemPrompt()` - 프로세스 카드 코칭
- `getStep5SystemPrompt(cardResponses)` - Step5 성공지표 코칭
- `getCardSummaryPrompt()` - 카드 내용 AI 요약
- `getMasterPlanPrompt(cardResponses, participantName)` - 마스터플랜 JSON 생성
- `getActionPlanPrompt(masterPlan, participantName)` - 액션플랜 JSON 생성
- `getChecklistSupplementPrompt(masterPlan, monthlyChecklist)` - 체크리스트 보완 코칭

### 6. 에러 처리
- API 호출 실패 시 사용자에게 친절한 한국어 에러 메시지 표시
- Gemini API 오류 시 재시도 버튼 제공
- 네트워크 끊김 대비 중간 저장 로직 포함

## 카드 구조 (실습 내용)
```
카드 1: 고객가치 관리
카드 2: 사람 관리
카드 3: 프로세스 관리

공통 Step 구조:
- Step 1: 마음을 강타한 키워드 3가지 (자유 작성)
- Step 2: As-Is 현재수준
- Step 3: To-Be 지향점 (2028년 12월 31일 기준)
- Step 4: 당장 실행할 액션
- Step 5: 성공을 증명하는 지표 (오후 세션, 마스터플랜 페이지에서 입력)
```

## DB 스키마 (Supabase 테이블)

### `participants`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| name | text | 이름 |
| department | text | 소속 |
| email | text | 이메일 |
| created_at | timestamp | |
| last_active_at | timestamp | 마지막 활동 시간 |

### `card_responses`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| participant_id | uuid | FK → participants |
| card_number | 1\|2\|3 | 카드 번호 |
| card_topic | text | 고객가치\|사람관리\|프로세스 |
| step1_keywords | text | |
| step2_asis | text | |
| step3_tobe | text | |
| step4_action | text | |
| step5_indicator | text | |
| chat_history | jsonb | ChatMessage[] |
| is_confirmed | boolean | |

### `master_plans`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| participant_id | uuid | FK |
| slogan | text | 리더십 슬로건 |
| customer_what | text | |
| customer_why | text | |
| process_what | text | |
| process_why | text | |
| people_what | text | |
| people_why | text | |
| is_confirmed | boolean | |

### `action_plans`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| participant_id | uuid | FK |
| yearly_plan | jsonb | QuarterlyPlan[] (Q1~Q4) |
| monthly_checklist | jsonb | WeeklyChecklist[] (4주) |
| ai_supplement_chat | jsonb | ChatMessage[] |
| is_confirmed | boolean | |

### `tracking_logs`
액션플랜 확정 시 자동 생성. 체크리스트 아이템별 1개 행.
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| participant_id | uuid | FK |
| week_number | 1\|2\|3\|4 | 주차 |
| item_index | number | 아이템 인덱스 |
| item_content | text | 내용 |
| status | text | 미착수\|진행중\|완료 |
| memo | text | 메모 |
| updated_at | timestamp | |

### `admin_progress_view` (Supabase 뷰)
관리자 대시보드용 집계 뷰.

## 마스터플랜 출력 구조
```
슬로건 (1문장)
+ 영역별 테이블:
  고객가치 | What (액션+성공지표) | Why (이유 및 근거)
  프로세스 | What               | Why
  사람     | What               | Why
```

## 액션플랜 구조
```typescript
// 연간 계획 (Q1~Q4)
QuarterlyPlan {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  focus: string       // 분기별 집중 테마
  actions: string[]   // 3개 행동 과제
}

// 30일 체크리스트 (4주 × 3개)
WeeklyChecklist {
  week: 1 | 2 | 3 | 4
  theme: string  // 주차별 테마
  items: ChecklistItem[]
}

ChecklistItem {
  index: number
  content: string
  status: '미착수' | '진행중' | '완료'
  memo: string
}
```

## 점수 시스템 (리더보드)
```
base_score     = 완료 항목 수 × 10
week_bonus     = 주차 완료 수 × 20  (한 주 모든 항목 완료 시)
completion_bonus = 50               (전체 100% 완료 시)
total_score    = base_score + week_bonus + completion_bonus
```

## 카테고리 대표 색상 (전체 일관 적용)
카드 번호별 고정 색상 팔레트. 홈 카드 실습, 마스터플랜 카테고리 헤더 등 모든 곳에 동일하게 사용.

| 카테고리 | 카드 번호 | bg | border | icon-bg | text / accent |
|----------|-----------|-----|--------|---------|---------------|
| 고객가치 관리 | 1 | `#FFF1F2` | `#FECDD3` | `#FFE4E6` | `#DC2626` (red) |
| 사람 관리     | 2 | `#EFF6FF` | `#BFDBFE` | `#DBEAFE` | `#2563EB` (blue) |
| 프로세스 관리 | 3 | `#F0FDF4` | `#BBF7D0` | `#DCFCE7` | `#16A34A` (green) |

```typescript
// 공통 상수 (필요 시 lib/types.ts 또는 각 컴포넌트에 정의)
const CARD_BG      = { 1: '#FFF1F2', 2: '#EFF6FF', 3: '#F0FDF4' }
const CARD_BORDER  = { 1: '#FECDD3', 2: '#BFDBFE', 3: '#BBF7D0' }
const CARD_ICON_BG = { 1: '#FFE4E6', 2: '#DBEAFE', 3: '#DCFCE7' }
const CARD_COLOR   = { 1: '#DC2626', 2: '#2563EB', 3: '#16A34A' }
```

## 관리자 대시보드
- URL: `/admin` (비밀번호: ADMIN_PASSWORD 환경변수)
- 기능:
  - 전체 참가자 진행 현황 실시간 (30초 자동 갱신)
  - 카드 완료 현황 (시각적 블록), 마스터플랜/액션플랜 상태, 트래킹 진행률
  - 개인별 상세 보기 (탭: 카드 | 마스터플랜 | 액션플랜)
  - CSV 내보내기 (UTF-8 BOM, Excel 호환)
- Supabase `admin_progress_view` 뷰 활용

## 구현 완료 현황 (2026-03-28 기준)
- [x] 교육생 로그인 + 홈 대시보드 (진행 현황, 다음 단계 안내)
- [x] 카드 1~3 Step1~4 챗봇 + AI 요약 + 확정 저장
- [x] Step5 코칭 (마스터플랜 페이지에서)
- [x] 마스터플랜 AI 도출 + 편집 + 자동저장 + 확정
- [x] 연간 플랜(Q1~Q4) + 30일 체크리스트 AI 도출
- [x] AI 보완 챗봇 (supplement 모드)
- [x] 액션플랜 확정 시 tracking_logs 자동 생성
- [x] 체크리스트 수행 현황 트래킹 (상태 변경, 메모)
- [x] 점수 시스템 + 리더보드 바텀시트
- [x] 관리자 대시보드 + 개인별 상세 + CSV 내보내기
- [x] PDF 저장 (html-to-image + jsPDF)
- [ ] 이메일 알림 (SendGrid) - 미구현
