interface MessageBubbleProps {
  role: 'user' | 'model'
  content: string
  isStreaming?: boolean
}

export default function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#111111] flex items-center justify-center text-white text-[10px] font-bold shrink-0 mr-2 mt-0.5">
          AI
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-[#111111] text-white rounded-br-sm'
            : 'bg-white text-[#111111] rounded-bl-sm shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-[#EBEBEB]'
        }`}
      >
        {content}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}
