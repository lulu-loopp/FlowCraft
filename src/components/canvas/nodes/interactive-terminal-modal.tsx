'use client'

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Square, Terminal, Wifi, WifiOff } from 'lucide-react'
import { useInteractiveCoding } from '@/hooks/useInteractiveCoding'
import { InteractiveMessageList } from './interactive-message-list'
import { InteractiveInputBar } from './interactive-input-bar'
import { useUIStore } from '@/store/uiStore'
import { AiCodingAgentColors } from '@/styles/tokens'

interface Props {
  isOpen: boolean
  onClose: () => void
  nodeId: string
  workDir?: string
  cli?: string
}

export function InteractiveTerminalModal({ isOpen, onClose, nodeId, workDir, cli = 'claude' }: Props) {
  const { t } = useUIStore()
  const { status, messages, start, sendMessage, stop } = useInteractiveCoding(nodeId)
  const theme = cli === 'codex' ? AiCodingAgentColors.codex : AiCodingAgentColors.claudeCode
  const hex = theme.hex
  const cliName = cli === 'codex' ? 'Codex' : 'Claude Code'

  // Auto-start session when modal opens
  useEffect(() => {
    if (isOpen && status === 'idle') {
      start(workDir, cli)
    }
  }, [isOpen, status, start, workDir, cli])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const handleClose = async () => {
    if (status === 'connected') {
      await stop()
    }
    onClose()
  }

  if (!isOpen || typeof document === 'undefined') return null

  const isConnected = status === 'connected' || status === 'connecting'
  const isThinking = status === 'connecting'

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]"
      onClick={handleClose}
    >
      <div
        className="bg-slate-950 rounded-2xl shadow-2xl w-[900px] max-w-[95vw] h-[85vh] flex flex-col overflow-hidden border border-slate-800"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${hex}20` }}>
              <Terminal className="w-4 h-4" style={{ color: hex }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                {cliName} Terminal
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isThinking ? (
                  <>
                    <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: `${hex}80`, borderTopColor: 'transparent' }} />
                    <span className="text-[10px]" style={{ color: hex }}>{t('aiCoding.interactiveConnecting')}</span>
                  </>
                ) : isConnected ? (
                  <>
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400">{t('aiCoding.interactiveConnected')}</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] text-slate-500">{t('aiCoding.interactiveDisconnected')}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected && (
              <button
                onClick={stop}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-950/50 text-rose-400 border border-rose-800/40 hover:bg-rose-900/50 transition-colors"
              >
                <Square className="w-3 h-3" />
                {t('aiCoding.stopSession')}
              </button>
            )}
            {status === 'disconnected' && (
              <button
                onClick={() => start(workDir, cli)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                style={{ backgroundColor: `${hex}20`, color: hex, borderColor: `${hex}30`, borderWidth: 1 }}
              >
                <Terminal className="w-3 h-3" />
                {t('aiCoding.reconnect')}
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <InteractiveMessageList messages={messages} cli={cli} />

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-800 shrink-0 bg-slate-900/30">
          <InteractiveInputBar
            onSend={sendMessage}
            disabled={status === 'disconnected' || status === 'idle'}
            themeHex={hex}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
