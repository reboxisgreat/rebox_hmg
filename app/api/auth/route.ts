import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createSupabaseServiceClient } from '@/lib/supabase'

// POST: 로그인 (아이디 + 비밀번호 검증)
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('participants')
      .select('id, name, password')
      .eq('username', username.trim())
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    const passwordMatch = await bcrypt.compare(password, data.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    // 마지막 활동 시간 업데이트
    await supabase
      .from('participants')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', data.id)

    return NextResponse.json({ id: data.id, name: data.name })
  } catch (error) {
    console.error('Auth login error:', error)
    return NextResponse.json({ error: '오류가 발생했어요. 다시 시도해주세요.' }, { status: 500 })
  }
}
