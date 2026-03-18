'use client'

import React, { useState, useRef } from 'react'
import { Send } from 'lucide-react'
import { SLASH_COMMANDS } from '@/lib/slash-commands'
import { useUIStore } from '@/store/uiStore'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
  themeHex?: string
}

export function InteractiveInputBar({ onSend, disabled, themeHex = '#D97757' }: Props) {
  const [value, setValue] = useState('')
  const [showSlash, setShowSlash] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { lang } = useUIStore()

  const filtered = showSlash
    ? SLASH_COMMANDS.filter(c => c.command.startsWith(value.toLowerCase()))
    : []

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    setShowSlash(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlash && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && filtered.length > 0)) {
        e.preventDefault()
        const cmd = filtered[selectedIdx]
        if (cmd) {
          setValue(cmd.command + ' ')
          setShowSlash(false)
        }
        if (e.key === 'Tab') return
        // If enter, let the completed command be sent on next enter
        return
      }
      if (e.key === 'Escape') {
        setShowSlash(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setValue(v)
    setSelectedIdx(0)
    setShowSlash(v.startsWith('/') && v.length >= 1 && !v.includes(' '))
  }

  const selectCommand = (cmd: string) => {
    setValue(cmd + ' ')
    setShowSlash(false)
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      {/* Slash command dropdown */}
      {showSlash && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.command}
              onClick={() => selectCommand(cmd.command)}
              className={`w-full px-3 py-2 flex items-center gap-3 text-left text-sm transition-colors ${
                i === selectedIdx ? 'bg-slate-700' : 'hover:bg-slate-700/50'
              }`}
            >
              <span className="font-mono font-medium shrink-0" style={{ color: themeHex }}>{cmd.command}</span>
              <span className="text-slate-400 text-xs truncate">
                {lang === 'zh' ? cmd.description.zh : cmd.description.en}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2">
        <span className="font-mono text-sm shrink-0" style={{ color: themeHex }}>❯</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? 'Connecting...' : 'Type a message or / for commands...'}
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none font-mono min-w-0"
          autoFocus
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 disabled:opacity-30 transition-colors shrink-0"
          onMouseEnter={e => (e.currentTarget.style.color = themeHex)}
          onMouseLeave={e => (e.currentTarget.style.color = '')}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
