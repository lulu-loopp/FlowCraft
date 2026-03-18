import React from 'react'
import { AlertTriangle, Terminal } from 'lucide-react'
import { AiCodingTerminal } from './ai-coding-terminal'
import { AiCodingInputBar } from './ai-coding-input-bar'
import { AiCodingFileChanges } from './ai-coding-file-changes'
import { useUIStore } from '@/store/uiStore'
import type { TerminalLine, FileChange } from '@/hooks/useCodingAgent'

interface Props {
  installed: boolean | null
  cli: string
  displayStatus: string
  lines: TerminalLine[]
  fileChanges: FileChange[]
  isWaiting: boolean
  elapsed: number
  currentOutput: string
  themeHex: string
  bodyBg: string
  onSendInput: (input: string) => void
  onShowInstallGuide: () => void
  onShowOutput: () => void
  onShowInteractive: () => void
}

export function AiCodingBody({
  installed, cli, displayStatus, lines, fileChanges, isWaiting,
  elapsed, currentOutput, themeHex, bodyBg, onSendInput, onShowInstallGuide, onShowOutput, onShowInteractive,
}: Props) {
  const { t } = useUIStore()
  const isRunning = displayStatus === 'running'
  const isSuccess = displayStatus === 'success'
  const isError = displayStatus === 'error'

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-3" style={{ backgroundColor: bodyBg }}>
      {/* Not installed */}
      {installed === false && !isRunning && !isSuccess && (
        <div className="flex flex-col items-center gap-2 py-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <span className="text-xs text-slate-500">
            {t('aiCoding.notInstalled')} {cli === 'codex' ? 'Codex' : 'Claude Code'}
          </span>
          <button onClick={e => { e.stopPropagation(); onShowInstallGuide() }}
            className="text-[11px] font-medium transition-colors" style={{ color: themeHex }}>
            {t('aiCoding.installGuide')}
          </button>
        </div>
      )}

      {/* Idle */}
      {installed !== false && !isRunning && !isSuccess && !isError && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">{t('aiCoding.idle')}</p>
          <button onClick={e => { e.stopPropagation(); onShowInteractive() }}
            className="flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-1 transition-colors"
            style={{ color: themeHex, backgroundColor: `${themeHex}15` }}
            title={t('aiCoding.openInteractive')}>
            <Terminal className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Running */}
      {isRunning && (
        <>
          <AiCodingTerminal lines={lines} />
          <AiCodingFileChanges changes={fileChanges} maxShow={3} />
          <AiCodingInputBar isWaiting={isWaiting} onSend={onSendInput} />
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 bg-slate-100 rounded-full h-1 overflow-hidden">
              <div className="node-loading-bar h-full rounded-full" style={{ backgroundColor: themeHex, width: '33%' }} />
            </div>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">{formatElapsed(elapsed)}</span>
          </div>
        </>
      )}

      {/* Success */}
      {isSuccess && (
        <>
          <AiCodingFileChanges changes={fileChanges} />
          <div className="flex gap-2 mt-2">
            <button onClick={e => { e.stopPropagation(); onShowOutput() }}
              className="flex-1 text-[11px] font-medium rounded-lg px-2.5 py-1.5 transition-colors"
              style={{ color: themeHex, backgroundColor: `${themeHex}10`, border: `1px solid ${themeHex}30` }}>
              {t('aiCoding.viewOutput')}
            </button>
            <button onClick={e => { e.stopPropagation(); onShowInteractive() }}
              className="flex items-center justify-center gap-1 text-[11px] font-medium rounded-lg px-2.5 py-1.5 transition-colors"
              style={{ color: themeHex, backgroundColor: `${themeHex}10`, border: `1px solid ${themeHex}30` }}
              title={t('aiCoding.openInteractive')}>
              <Terminal className="w-3 h-3" />
            </button>
          </div>
        </>
      )}

      {/* Error */}
      {isError && (
        <>
          <div className="text-xs text-rose-500 bg-rose-50 rounded-lg p-2 mt-1">
            {currentOutput || t('aiCoding.error')}
          </div>
          <button onClick={e => { e.stopPropagation(); onShowInteractive() }}
            className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] font-medium rounded-lg px-2.5 py-1.5 transition-colors"
            style={{ color: themeHex, backgroundColor: `${themeHex}10`, border: `1px solid ${themeHex}30` }}
            title={t('aiCoding.openInteractive')}>
            <Terminal className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  )
}
