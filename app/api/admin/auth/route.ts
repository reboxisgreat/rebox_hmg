import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()

    if (!password) {
      return NextResponse.json({ success: false }, { status: 400 })
    }

    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.')
      return NextResponse.json({ success: false }, { status: 500 })
    }

    const validPasswords = adminPassword.split(',').map((p) => p.trim())
    if (validPasswords.includes(password)) {
      const res = NextResponse.json({ success: true })
      // 슈퍼 관리자 비밀번호로 로그인한 경우에만 마감 후 bypass 쿠키 발급 (24시간)
      const superPassword = process.env.SUPER_ADMIN_PASSWORD
      if (superPassword && password === superPassword) {
        res.cookies.set('admin_bypass', 'true', {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24,
        })
      }
      return res
    }

    return NextResponse.json({ success: false })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
