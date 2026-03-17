import React from 'react'
import { NodeProps } from '@xyflow/react'
import ReactMarkdown from 'react-markdown'
import { BaseNode } from './base-node'
import { OutputModal } from './output-modal'
import { useUIStore } from '@/store/uiStore'

export function AgentNode({ id, data, selected }: NodeProps) {
  const [showModal, setShowModal] = React.useState(false)
  const { t } = useUIStore()

  const label = (data?.label as string) || 'Agent'
  const description = (data?.description as string) || 'Executes autonomous tasks'
  const status = data?.status as string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = data?.logs as any[]
  const currentToken = (data?.currentToken as string) || ''
  const currentOutput = (data?.currentOutput as string) || ''

  return (
    <>
      <BaseNode
        id={id}
        type="agent"
        label={label}
        description={description}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status={status as any}
        selected={selected}
        onDoubleClick={() => currentOutput && setShowModal(true)}
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Search Tool</span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Python Env</span>
        </div>

        {/* Streaming token while running */}
        {status === 'running' && currentToken && (
          <div className="mt-2 text-xs text-slate-600 bg-indigo-50 border border-indigo-100 rounded-lg p-2 font-mono max-h-20 overflow-hidden">
            <div className="text-indigo-400 text-[9px] uppercase tracking-wider mb-1">Thinking...</div>
            <div className="line-clamp-3">
              {currentToken}
              <span className="inline-block w-1.5 h-3 bg-indigo-500 animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        )}

        {/* Step logs while running (no token yet) */}
        {status === 'running' && !currentToken && logs && logs.length > 0 && (
          <div className="mt-2 bg-slate-50 border border-slate-100 rounded-lg p-2 font-mono text-[10px] text-slate-600 space-y-1 ring-1 ring-indigo-200 ring-offset-1">
            <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-100 text-[9px] text-slate-400 uppercase tracking-tighter">
              <span>{t('node.agent.executionState')}</span>
              <span className="text-indigo-500 animate-pulse">{t('node.agent.streaming')}</span>
            </div>
            {(logs as { type: string; content: string }[]).slice(-3).map((log, i: number) => (
              <div key={`${log.type}-${i}`} className="flex animate-fade-in-up">
                <span className="text-indigo-600 mr-1 font-bold shrink-0">[{log.type}]</span>
                <span className="truncate">{log.content}</span>
              </div>
            ))}
          </div>
        )}

        {/* Markdown output after completion */}
        {status === 'success' && currentOutput && (
          <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-2 pt-2 pb-1">
              <span className="text-[9px] text-emerald-500 uppercase tracking-wider font-medium">Output</span>
              <button
                onClick={e => { e.stopPropagation(); setShowModal(true) }}
                className="text-[9px] text-slate-400 hover:text-indigo-500 transition-colors"
              >
                {t('node.agent.viewAll')}
              </button>
            </div>
            <div className="px-2 pb-2 max-h-32 overflow-y-auto prose-node text-slate-700">
              <ReactMarkdown>{currentOutput.slice(0, 600)}</ReactMarkdown>
              {currentOutput.length > 600 && (
                <p className="text-slate-400 text-xs mt-1">{t('node.agent.viewFull')}</p>
              )}
            </div>
          </div>
        )}

        {status === 'running' && (
          <div className="w-full bg-slate-100 rounded-full h-1 mt-3 overflow-hidden relative">
            <div className="node-loading-bar absolute inset-y-0 left-0 w-1/3 bg-indigo-500 rounded-full" />
          </div>
        )}
      </BaseNode>

      {showModal && (
        <OutputModal isOpen={showModal} onClose={() => setShowModal(false)} title={label} content={currentOutput} nodeType="agent" />
      )}
    </>
  )
}
