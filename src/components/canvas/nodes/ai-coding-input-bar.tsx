import React, { useState } from 'react'
import { Send } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

interface Props {
  isWaiting: boolean
  onSend: (input: string) => void
}

export function AiCodingInputBar({ isWaiting, onSend }: Props) {
  const [value, setValue] = useState('')
  const { t } = useUIStore()

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className={`flex items-center gap-1.5 mt-2 border rounded-lg px-2 py-1.5 transition-colors ${
        isWaiting
          ? 'border-amber-400 bg-amber-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isWaiting ? t('aiCoding.terminalWaiting') : t('aiCoding.terminalPlaceholder')}
        className="flex-1 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none min-w-0"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim()}
        className="p-1 rounded text-slate-400 hover:text-teal-600 disabled:opacity-30 transition-colors shrink-0"
      >
        <Send className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
