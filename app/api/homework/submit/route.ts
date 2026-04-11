import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

// POST: 과제 인증샷 업로드 + 제출
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const participantId = formData.get('participantId') as string | null
    const files = formData.getAll('images') as File[]

    if (!participantId) {
      return NextResponse.json({ error: '참가자 ID가 없습니다.' }, { status: 400 })
    }
    if (files.length === 0) {
      return NextResponse.json({ error: '인증샷을 1장 이상 업로드해주세요.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    // Supabase Storage에 이미지 업로드
    const imageUrls: string[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${participantId}/${crypto.randomUUID()}.${ext}`
      const arrayBuffer = await file.arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('homework-proofs')
        .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

      if (uploadError) throw uploadError
      imageUrls.push(path)
    }

    // homework_submissions upsert (재제출 시 pending 리셋)
    const { data, error } = await supabase
      .from('homework_submissions')
      .upsert(
        {
          participant_id: participantId,
          image_urls: imageUrls,
          status: 'approved',
          submitted_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
        },
        { onConflict: 'participant_id' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ submission: data })
  } catch (error) {
    console.error('Homework submit error:', error)
    return NextResponse.json({ error: '제출 중 오류가 발생했어요.' }, { status: 500 })
  }
}
