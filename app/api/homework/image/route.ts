import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

// GET: Supabase Storage 비공개 이미지 서빙 (관리자용)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json({ error: '경로가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase.storage
      .from('homework-proofs')
      .download(path)

    if (error || !data) {
      return NextResponse.json({ error: '이미지를 불러올 수 없습니다.' }, { status: 404 })
    }

    const buffer = await data.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': data.type || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Homework image GET error:', error)
    return NextResponse.json({ error: '이미지 조회 중 오류가 발생했어요.' }, { status: 500 })
  }
}
