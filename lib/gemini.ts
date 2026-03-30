import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const MODEL = 'gemini-2.5-flash'

// =============================================
// 타입 정의
// =============================================
export interface Message {
  role: 'user' | 'model'
  content: string
}

// =============================================
// 스트리밍 응답 생성 (API Route에서 사용)
// =============================================
export async function generateStreamingResponse(
  systemPrompt: string,
  messages: Message[]
): Promise<Response> {
  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }))

  const stream = await ai.models.generateContentStream({
    model: MODEL,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
    contents,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.text
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// =============================================
// 단일 응답 생성 (마스터플랜, 액션플랜 도출용)
// JSON 구조화 출력이 필요할 때 사용
// =============================================
export async function generateSingleResponse(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
  })

  return response.text ?? ''
}

// =============================================
// 프론트엔드 스트리밍 수신 유틸 (클라이언트용)
// =============================================
export async function fetchStream(
  url: string,
  body: object,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void
) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      onError('AI 응답을 가져오는 데 실패했어요. 다시 시도해주세요.')
      return
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      onError('스트림을 읽을 수 없어요.')
      return
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            onDone()
            return
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) onChunk(parsed.text)
          } catch {
            // 파싱 오류 무시
          }
        }
      }
    }

    onDone()
  } catch {
    onError('네트워크 오류가 발생했어요. 연결을 확인해주세요.')
  }
}
