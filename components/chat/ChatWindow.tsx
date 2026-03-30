'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import MessageBubble from './MessageBubble'
import type { ChatMessage } from '@/lib/types'

async function fetchStream(
  url: string,
  body: object,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      onError('AI 응답을 가져오는 데 실패했어요. 다시 시도해주세요.')
      return
    }

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      onError('스트림을 읽을 수 없어요.')
      return
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') { onDone(); return }
        try {
          const parsed = JSON.parse(data)
          if (parsed.text) onChunk(parsed.text)
        } catch { /* 파싱 오류 무시 */ }
      }
    }

    onDone()
  } catch {
    onError('네트워크 오류가 발생했어요. 연결을 확인해주세요.')
  }
}

interface ChatWindowProps {
  cardNumber: 1 | 2 | 3
  step?: number
  cardResponses?: object
  onConfirm?: (messages: ChatMessage[]) => void
  confirmLabel?: string
  initialMessage?: string
}

export default function ChatWindow({
  cardNumber,
  step,
  cardResponses,
  onConfirm,
  confirmLabel = '확정하고 다음 단계로',
  initialMessage,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessage
      ? [{ role: 'model', content: initialMessage, timestamp: new Date().toISOString() }]
      : []
  )
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 새 메시지 생길 때마다 스크롤 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // textarea 높이 자동 조절
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [input, adjustTextareaHeight])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    setError('')
    const userMessage: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...messages, userMessage]
    const aiPlaceholder: ChatMessage = {
      role: 'model',
      content: '',
      timestamp: new Date().toISOString(),
    }
    setMessages([...updatedMessages, aiPlaceholder])
    setInput('')
    setIsStreaming(true)

    // textarea 높이 리셋
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    fetchStream(
      '/api/chat',
      {
        cardNumber,
        step,
        cardResponses,
        messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      },
      (chunk) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role !== 'model') return prev
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
        })
      },
      () => {
        setIsStreaming(false)
      },
      (errMsg) => {
        setIsStreaming(false)
        setError(errMsg)
        // AI placeholder 제거
        setMessages((prev) =>
          prev[prev.length - 1]?.role === 'model' && prev[prev.length - 1]?.content === ''
            ? prev.slice(0, -1)
            : prev
        )
      }
    )
  }, [messages, isStreaming, cardNumber, step, cardResponses])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // 확정 버튼: AI가 응답했고 유저가 최소 1번 대화한 경우에만 노출
  const hasUserMessage = messages.some((m) => m.role === 'user')
  const lastIsModel = messages.length > 0 && messages[messages.length - 1].role === 'model'
  const lastModelContent = lastIsModel ? messages[messages.length - 1].content : ''
  const canConfirm = !isStreaming && hasUserMessage && lastIsModel && lastModelContent.length > 0

  return (
    <div className="flex flex-col h-full bg-[#F5F5F5]">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <p className="text-center text-[#8A8A8A] text-sm mt-12">
            메시지를 입력하면 AI 코치가 응답합니다.
          </p>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role}
            content={msg.content}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'model'}
          />
        ))}

        {error && (
          <div className="flex justify-center py-2">
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600 text-center max-w-xs">
              <p>{error}</p>
              <button
                onClick={() => {
                  setError('')
                  // 마지막 user 메시지로 재시도
                  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
                  if (lastUser) sendMessage(lastUser.content)
                }}
                className="mt-2 text-xs text-[#111111] font-medium"
              >
                다시 시도
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 확정 버튼 */}
      {onConfirm && canConfirm && (
        <div className="px-4 pb-2 shrink-0">
          <button
            onClick={() => onConfirm(messages)}
            className="w-full h-11 rounded-xl bg-[#111111] active:bg-[#3A3A3A] text-white text-sm font-semibold transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      )}

      {/* 입력창 */}
      <div className="shrink-0 px-4 pb-4 pt-2 border-t border-[#EBEBEB] bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none px-4 py-3 rounded-2xl border border-[#EBEBEB] bg-[#F5F5F5] text-sm text-[#111111] placeholder-[#8A8A8A] focus:outline-none focus:border-[#111111] focus:bg-white disabled:opacity-50 overflow-y-auto leading-5 transition-colors"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="w-11 h-11 rounded-2xl bg-[#02855B] active:bg-[#026644] text-white flex items-center justify-center disabled:opacity-40 shrink-0 transition-colors"
            aria-label="전송"
          >
            {isStreaming ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
