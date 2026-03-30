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

    if (password === adminPassword) {
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
