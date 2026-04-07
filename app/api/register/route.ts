import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createSupabaseServiceClient } from '@/lib/supabase'

// POST: 교육생 자가 회원가입
export async function POST(req: NextRequest) {
  try {
    const { username, name, department, cohort, password } = await req.json()

    // 필드 검증
    if (!username || !name || !cohort || !password) {
      return NextResponse.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9]{4,20}$/.test(username)) {
      return NextResponse.json({ error: '아이디는 영문/숫자 4~20자로 입력해주세요.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 })
    }
    if (![1, 2, 3].includes(Number(cohort))) {
      return NextResponse.json({ error: '올바른 차수를 선택해주세요.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    // 아이디 중복 확인
    const { data: existing } = await supabase
      .from('participants')
      .select('id')
      .eq('username', username.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 })
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10)

    // 교육생 생성
    const { data, error } = await supabase
      .from('participants')
      .insert({
        username: username.trim(),
        name: name.trim(),
        department: (department ?? '').trim(),
        cohort: Number(cohort),
        password: hashedPassword,
        password_changed: true,
      })
      .select('id, name')
      .single()

    if (error) throw error

    // 마지막 활동 시간 업데이트
    await supabase
      .from('participants')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', data.id)

    return NextResponse.json({ id: data.id, name: data.name })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: '오류가 발생했어요. 다시 시도해주세요.' }, { status: 500 })
  }
}
