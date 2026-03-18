'use client'

import React, { useRef, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { AiCodingAgentColors } from '@/styles/tokens'
import type { InteractiveMessage } from '@/hooks/useInteractiveCoding'

interface Props {
  messages: InteractiveMessage[]
  cli?: string
}

export function InteractiveMessageList({ messages, cli = 'claude' }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const hex = cli === 'codex' ? AiCodingAgentColors.codex.hex : AiCodingAgentColors.claudeCode.hex

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {messages.map(msg => (
        <MessageBlock key={msg.id} msg={msg} hex={hex} />
      ))}
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-slate-500 text-sm">
          Type a message to start the conversation...
        </div>
      )}
    </div>
  )
}

function MessageBlock({ msg, hex }: { msg: InteractiveMessage; hex: string }) {
  switch (msg.type) {
    case 'system':
      return <SystemMessage content={msg.content} />
    case 'assistant':
      return <AssistantMessage content={msg.content} hex={hex} />
    case 'tool_use':
      return <ToolUseMessage toolName={msg.toolName} toolInput={msg.toolInput} />
    case 'tool_result':
      return <ToolResultMessage content={msg.content} isError={msg.isError} />
    case 'user':
      return <UserMessage content={msg.content} hex={hex} />
    case 'error':
      return <ErrorMessage content={msg.content} />
    case 'result':
      return <ResultMessage content={msg.content} />
    case 'text':
      return <TextMessage content={msg.content} />
    default:
      return <TextMessage content={msg.content} />
  }
}

function SystemMessage({ content }: { content: string }) {
  return (
    <div className="flex items-center gap-2 py-1 px-2">
      <div className="h-px flex-1 bg-slate-700" />
      <span className="text-[11px] text-slate-500 italic shrink-0">{content}</span>
      <div className="h-px flex-1 bg-slate-700" />
    </div>
  )
}

function AssistantMessage({ content, hex }: { content: string; hex: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg px-4 py-3" style={{ borderLeft: `2px solid ${hex}` }}>
      <div className="prose prose-sm prose-invert max-w-none text-slate-200 [&_pre]:bg-slate-900" style={{ '--tw-prose-code': hex } as React.CSSProperties}>
        <MarkdownRenderer>{content}</MarkdownRenderer>
      </div>
    </div>
  )
}

function ToolUseMessage({ toolName, toolInput }: { toolName?: string; toolInput?: string }) {
  const [expanded, setExpanded] = useState(false)
  const Chevron = expanded ? ChevronDown : ChevronRight

  return (
    <div className="bg-amber-950/30 rounded-lg border border-amber-900/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-950/20 transition-colors"
      >
        <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className="text-xs font-medium text-amber-400 font-mono">{toolName || 'tool'}</span>
        <Chevron className="w-3 h-3 text-amber-600 ml-auto shrink-0" />
      </button>
      {expanded && toolInput && (
        <div className="px-3 pb-2">
          <pre className="text-[11px] text-amber-300/70 bg-slate-900/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
            {toolInput}
          </pre>
        </div>
      )}
    </div>
  )
}

function ToolResultMessage({ content, isError }: { content: string; isError?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = content.length > 300
  const displayContent = isLong && !expanded ? content.substring(0, 300) + '...' : content

  return (
    <div className={`ml-4 rounded-lg border px-3 py-2 ${
      isError
        ? 'bg-rose-950/20 border-rose-900/30'
        : 'bg-emerald-950/20 border-emerald-900/30'
    }`}>
      <div className="flex items-center gap-1.5 mb-1">
        {isError
          ? <AlertCircle className="w-3 h-3 text-rose-400" />
          : <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        }
        <span className={`text-[10px] font-medium ${isError ? 'text-rose-400' : 'text-emerald-400'}`}>
          {isError ? 'Error' : 'Result'}
        </span>
      </div>
      <pre className={`text-[11px] font-mono whitespace-pre-wrap break-all ${
        isError ? 'text-rose-300/70' : 'text-emerald-300/70'
      }`}>
        {displayContent}
      </pre>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-slate-400 hover:text-slate-300 mt-1"
        >
          {expanded ? '▲ Show less' : '▼ Show more'}
        </button>
      )}
    </div>
  )
}

function UserMessage({ content, hex }: { content: string; hex: string }) {
  return (
    <div className="flex justify-end">
      <div className="rounded-lg px-4 py-2 max-w-[80%]" style={{ backgroundColor: `${hex}20`, border: `1px solid ${hex}30` }}>
        <p className="text-sm font-mono" style={{ color: hex }}>{content}</p>
      </div>
    </div>
  )
}

function ErrorMessage({ content }: { content: string }) {
  return (
    <div className="bg-rose-950/30 rounded-lg px-3 py-2 border border-rose-800/40 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
      <p className="text-xs text-rose-300">{content}</p>
    </div>
  )
}

function ResultMessage({ content }: { content: string }) {
  return (
    <div className="bg-emerald-950/30 rounded-lg px-4 py-3 border border-emerald-800/40">
      <div className="flex items-center gap-1.5 mb-1">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-medium text-emerald-400">Final Result</span>
      </div>
      <div className="prose prose-sm prose-invert max-w-none text-emerald-200">
        <MarkdownRenderer>{content}</MarkdownRenderer>
      </div>
    </div>
  )
}

function TextMessage({ content }: { content: string }) {
  return (
    <div className="px-2 py-1">
      <p className="text-xs text-slate-400 font-mono">{content}</p>
    </div>
  )
}
