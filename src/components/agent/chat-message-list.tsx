'use client'

import React, { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  messages: ChatMessage[]
  status: 'idle' | 'thinking'
}

export function ChatMessageList({ messages, status }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map(msg => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[75%] px-3 py-2 text-sm leading-relaxed rounded-xl ${
            msg.role === 'user'
              ? 'bg-indigo-50 text-slate-700 rounded-br-sm'
              : 'bg-slate-50 text-slate-700 rounded-bl-sm'
          }`}>
            {msg.role === 'assistant' ? (
              <ReactMarkdown components={{
                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              }}>{msg.content || '...'}</ReactMarkdown>
            ) : (
              <span className="whitespace-pre-wrap">{msg.content}</span>
            )}
          </div>
        </div>
      ))}
      {status === 'thinking' && messages[messages.length - 1]?.role !== 'assistant' && (
        <div className="flex justify-start">
          <div className="bg-slate-50 rounded-xl rounded-bl-sm px-3 py-2 flex gap-1">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
