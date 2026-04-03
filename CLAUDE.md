# HMG xClass 조직관리 교육 플랫폼

현대자동차그룹(HMG) **실장급 리더** 대상 조직관리 교육 플랫폼.
교육 당일 챗봇 실습 → 마스터플랜 도출 → 교육 이후 액션플랜 트래킹까지 하나로 연결.

## 기술 스택
- Frontend: Next.js (App Router), TypeScript 5, React 19, Tailwind CSS 4
- DB: Supabase (PostgreSQL)
- AI: Google Gemini 2.5 Flash (`gemini-2.5-flash`, 스트리밍 필수)
- PDF: html-to-image + jsPDF / 배포: Vercel

## 환경변수 (.env.local)
```
GEMINI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
NEXT_PUBLIC_EDUCATION_END_DATE=2026-06-18
```

## 폴더 구조
```
/app
  /page.tsx                    ← 로그인 + 홈 대시보드
  /problem-definition/page.tsx ← 고객 진짜 문제 정의 (Step1~4 + AI 코치)
  /chat/page.tsx               ← 카드 1~3 Step1~4 챗봇 + 요약 확정
  /masterplan/page.tsx         ← Step5 코칭 + 마스터플랜 AI 도출 + 편집
  /actionplan/page.tsx         ← 연간 플랜(Q1~Q4) + 30일 체크리스트 + AI 챗봇
  /tracking/page.tsx           ← 체크리스트 수행 현황 + 리더보드
  /closed/page.tsx             ← 교육 마감 안내 페이지
  /admin/page.tsx              ← 관리자 대시보드 (비밀번호 보호, CSV 내보내기)
  /api
    /chat/route.ts             ← Gemini 스트리밍 (normal / supplement 모드)
    /card/route.ts             ← 카드 GET/POST/PATCH
    /masterplan/route.ts       ← 마스터플랜 GET/POST/PATCH
    /actionplan/route.ts       ← 액션플랜 GET/POST/PATCH
    /progress/route.ts         ← 홈 대시보드용 진행 현황
    /tracking/route.ts         ← 트래킹 로그 GET/PATCH
    /leaderboard/route.ts      ← 점수 순위 (차수별)
    /problem-definition/route.ts
    /admin/ → auth / progress / participant / masterplans
/lib
  /gemini.ts    ← 스트리밍 유틸 (generateStreamingResponse, fetchStream)
  /supabase.ts  ← 클라이언트 팩토리
  /prompts.ts   ← 모든 AI 프롬프트 중앙 관리
  /types.ts     ← TypeScript 타입 + 상수
  /utils.ts     ← isEducationEnded() 등 공통 유틸
/components
  /chat/ChatWindow.tsx / MessageBubble.tsx
  /tracking/Leaderboard.tsx
middleware.ts   ← 마감일 이후 /closed 자동 리다이렉트
```

## 핵심 규칙

### 1. Gemini 스트리밍 필수
모든 AI 응답은 `ReadableStream` + SSE 방식으로 스트리밍. `lib/gemini.ts`의 `generateStreamingResponse` 활용.
클라이언트는 `fetchStream(url, body, onChunk, onDone, onError)` 사용.
절대 `await` 후 한 번에 반환 금지.

```typescript
// API route 패턴
const stream = await ai.models.generateContentStream({...})
const readable = new ReadableStream({ async start(controller) {
  for await (const chunk of stream) {
    const text = chunk.text()
    if (text) controller.enqueue(encoder.encode(`data: ${text}\n\n`))
  }
  controller.close()
}})
return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }})
```

### 2. Supabase 클라이언트 구분
- API Route: 항상 `createSupabaseServiceClient()` (service_role, RLS 우회)
- 브라우저: `createSupabaseBrowserClient()` (anon key, RLS 적용)

### 3. 페이지 플로우 및 세션
- `participant_id` / `participant_name` → `localStorage` 저장
- 미로그인 시 `/` 리다이렉트
- 진행 현황 기반 자동 다음 단계: 카드 미완료 → `/chat` → `/masterplan` → `/actionplan` → `/tracking`
- `NEXT_PUBLIC_EDUCATION_END_DATE` 이후: middleware가 `/closed`로 리다이렉트 (관리자·API 제외)

### 4. 모바일 퍼스트
교육생은 스마트폰 접속. 버튼 최소 44px. 키보드 올라올 때 레이아웃 고정.

### 5. 용어 규칙 (실장급 대상)
| 금지 | 사용 |
|------|------|
| 팀원 | 구성원 |
| 팀 (조직 단위) | 조직 / 실(본부) |
| 리더 (단독) | 실장님 / 실장급 리더 |

프롬프트는 실(본부) 단위 거시적 관점. "팀장·팀원" 절대 금지.

### 6. 프롬프트 관리
모든 프롬프트는 `/lib/prompts.ts`에서만 관리. 컴포넌트·API route에 직접 작성 금지.
함수: `getCard1~3SystemPrompt()`, `getStep5SystemPrompt()`, `getMasterPlanPrompt()`, `getActionPlanPrompt()`, `getChecklistSupplementPrompt()`, `getProblemDefinitionSystemPrompt()`

### 7. 카드 색상 상수 (lib/types.ts)
| 카드 | bg | border | color |
|------|----|--------|-------|
| 1 고객가치 | `#FFF1F2` | `#FECDD3` | `#DC2626` |
| 2 사람관리 | `#FFFBEB` | `#FDE68A` | `#D97706` |
| 3 프로세스 | `#F0FDF4` | `#BBF7D0` | `#16A34A` |

## DB 테이블 (Supabase)
- `participants`: id, name, department, email, cohort(int4), last_active_at
- `card_responses`: participant_id, card_number(1|2|3), step1~5 필드, chat_history(jsonb), is_confirmed
- `master_plans`: participant_id, slogan, customer/process/people × what/why, is_confirmed
- `action_plans`: participant_id, yearly_plan(jsonb), monthly_checklist(jsonb), ai_supplement_chat(jsonb), is_confirmed
- `tracking_logs`: participant_id, week_number, item_index, item_content, status(미착수|진행중|완료), memo
- `problem_definitions`: participant_id, step1~4 필드, chat_history(jsonb), is_confirmed
- `admin_progress_view`: 관리자 대시보드용 집계 뷰

## 점수 시스템
`완료수 × 10` + `주 완주 × 20` + `전체 완주 보너스 50`. 차수(cohort)별 순위 별도 집계.

## 미구현
- 이메일 알림 (SendGrid)
