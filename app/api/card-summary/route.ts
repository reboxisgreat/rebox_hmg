import { NextRequest, NextResponse } from 'next/server'
import { generateStreamingResponse } from '@/lib/gemini'
import { getCardSummaryPrompt } from '@/lib/prompts'

export async function POST(req: NextRequest) {
  try {
    const { cardTopic, step1, step2, step3, step4 } = await req.json()

    if (!cardTopic) {
      return NextResponse.json({ error: '카드 정보가 없습니다.' }, { status: 400 })
    }

    const systemPrompt = getCardSummaryPrompt()
    const userMessage = `[${cardTopic} 카드 작성 내용]\n키워드: ${step1 ?? ''}\n현재수준(As-Is): ${step2 ?? ''}\n지향점(To-Be): ${step3 ?? ''}\n실행액션: ${step4 ?? ''}`

    return generateStreamingResponse(systemPrompt, [{ role: 'user', content: userMessage }])
  } catch (error) {
    console.error('Card summary error:', error)
    return NextResponse.json({ error: '요약 생성 중 오류가 발생했어요.' }, { status: 500 })
  }
}
