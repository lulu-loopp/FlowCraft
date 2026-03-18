import React, { useRef, useEffect } from 'react'
import type { TerminalLine } from '@/hooks/useCodingAgent'

interface Props {
  lines: TerminalLine[]
  maxHeight?: string
}

export function AiCodingTerminal({ lines, maxHeight = 'max-h-32' }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  if (lines.length === 0) return null

  return (
    <div
      ref={scrollRef}
      className={`${maxHeight} overflow-y-auto bg-slate-900 rounded-lg p-2 font-mono text-[10px] leading-relaxed space-y-0.5`}
    >
      {lines.slice(-50).map((line, i) => (
        <div key={`${line.ts}-${i}`} className={getLineClass(line.type)}>
          {line.content}
        </div>
      ))}
      <span className="inline-block w-1.5 h-3 bg-green-400 animate-pulse ml-0.5 align-middle" />
    </div>
  )
}

function getLineClass(type: TerminalLine['type']): string {
  switch (type) {
    case 'user': return 'text-cyan-300'
    case 'stderr': return 'text-red-400'
    case 'system': return 'text-yellow-400'
    default: return 'text-green-300'
  }
}
