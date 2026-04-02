import { NextRequest, NextResponse } from 'next/server'
import { generateStreamingResponse } from '@/lib/gemini'
import {
  getCard1SystemPrompt, getCard2SystemPrompt, getCard3SystemPrompt,
  getStep5SystemPrompt, getChecklistSupplementPrompt,
} from '@/lib/prompts'
import type { Message } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cardNumber, step, messages, cardResponses, mode, masterPlan, yearlyPlan, monthlyChecklist } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: '메시지가 없습니다.' }, { status: 400 })
    }

    let systemPrompt: string

    if (mode === 'supplement') {
      if (!masterPlan || !yearlyPlan || !monthlyChecklist) {
        return NextResponse.json({ error: '보완 모드 데이터가 없습니다.' }, { status: 400 })
      }
      systemPrompt = getChecklistSupplementPrompt(masterPlan, yearlyPlan, monthlyChecklist)
    } else if (step === 5 && cardResponses) {
      systemPrompt = getStep5SystemPrompt(cardResponses)
    } else {
      switch (cardNumber) {
        case 1:
          systemPrompt = getCard1SystemPrompt()
          break
        case 2:
          systemPrompt = getCard2SystemPrompt()
          break
        case 3:
          systemPrompt = getCard3SystemPrompt()
          break
        default:
          return NextResponse.json({ error: '유효하지 않은 카드 번호입니다.' }, { status: 400 })
      }
    }

    // 빈 배열이면 AI가 먼저 말을 걸도록 트리거 메시지 추가
    const formattedMessages: Message[] =
      messages.length > 0
        ? messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'model',
            content: m.content,
          }))
        : [{ role: 'user' as const, content: '실습을 시작해주세요.' }]

    return generateStreamingResponse(systemPrompt, formattedMessages)
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'AI 응답 생성 중 오류가 발생했어요. 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
