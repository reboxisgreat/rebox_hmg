import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// =============================================
// 브라우저용 클라이언트 (교육생 접근, RLS 적용)
// =============================================
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// =============================================
// 서버용 클라이언트 (API Route, 관리자, RLS 우회)
// =============================================
export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
