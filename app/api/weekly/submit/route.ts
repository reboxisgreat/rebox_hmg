import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

// POST: 주차별 인증샷 업로드
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const participantId = formData.get('participantId') as string | null
    const weekNumberRaw = formData.get('weekNumber') as string | null
    const images = formData.getAll('images') as File[]

    if (!participantId || !weekNumberRaw) {
      return NextResponse.json({ error: '참가자 ID 또는 주차 정보가 없습니다.' }, { status: 400 })
    }
    const weekNumber = parseInt(weekNumberRaw, 10)
    if (weekNumber < 1 || weekNumber > 4) {
      return NextResponse.json({ error: '잘못된 주차 번호입니다.' }, { status: 400 })
    }
    if (images.length === 0) {
      return NextResponse.json({ error: '이미지가 없습니다.' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    // 이미지 업로드
    const uploadedPaths: string[] = []
    for (const image of images) {
      const ext = image.name.split('.').pop() ?? 'jpg'
      const uuid = crypto.randomUUID()
      const path = `weekly/${participantId}/week${weekNumber}/${uuid}.${ext}`
      const buffer = await image.arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('homework-proofs')
        .upload(path, buffer, { contentType: image.type, upsert: false })

      if (uploadError) throw uploadError
      uploadedPaths.push(path)
    }

    // upsert: 재제출 시 status → pending, image_urls 갱신
    const { data, error } = await supabase
      .from('weekly_proof_submissions')
      .upsert(
        {
          participant_id: participantId,
          week_number: weekNumber,
          image_urls: uploadedPaths,
          status: 'pending',
          submitted_at: new Date().toISOString(),
          reviewed_at: null,
        },
        { onConflict: 'participant_id,week_number' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ submission: data })
  } catch (error) {
    console.error('Weekly submit POST error:', error)
    return NextResponse.json({ error: '업로드 중 오류가 발생했어요.' }, { status: 500 })
  }
}
