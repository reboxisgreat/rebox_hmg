import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

// POST: 로그인 (이메일 + 비밀번호 검증)
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('participants')
      .select('id, name, password, password_changed')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: '등록되지 않은 참가자입니다. 담당자에게 문의하세요.' }, { status: 401 })
    }
    if (data.password !== password) {
      return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    // 마지막 활동 시간 업데이트
    await supabase
      .from('participants')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', data.id)

    return NextResponse.json({
      id: data.id,
      name: data.name,
      passwordChanged: data.password_changed ?? false,
    })
  } catch (error) {
    console.error('Auth login error:', error)
    return NextResponse.json({ error: '오류가 발생했어요. 다시 시도해주세요.' }, { status: 500 })
  }
}

// PATCH: 비밀번호 변경
export async function PATCH(req: NextRequest) {
  try {
    const { participantId, currentPassword, newPassword } = await req.json()

    if (!participantId || !currentPassword || !newPassword) {
      return NextResponse.json({ error: '필수 항목이 없습니다.' }, { status: 400 })
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    // 현재 비밀번호 확인
    const { data, error: fetchError } = await supabase
      .from('participants')
      .select('password')
      .eq('id', participantId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!data) return NextResponse.json({ error: '참가자를 찾을 수 없습니다.' }, { status: 404 })
    if (data.password !== currentPassword) {
      return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    const { error } = await supabase
      .from('participants')
      .update({ password: newPassword, password_changed: true })
      .eq('id', participantId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Auth password change error:', error)
    return NextResponse.json({ error: '비밀번호 변경 중 오류가 발생했어요.' }, { status: 500 })
  }
}
