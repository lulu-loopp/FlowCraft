import React from 'react'
import { NodeProps } from '@xyflow/react'
import { Eye, MessageCircle } from 'lucide-react'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { BaseNode } from './base-node'
import { OutputModal } from './output-modal'
import { FilePreviewModal } from '@/components/ui/file-preview-modal'
import { SaveAgentDialog } from '@/components/canvas/save-agent-dialog'
import { NodeIntervenePanel } from './node-intervene-panel'
import { FeedbackChatModal } from '@/components/agent/feedback-chat-modal'
import { useFlowStore } from '@/store/flowStore'
import { useUIStore } from '@/store/uiStore'
import type { AgentNodeData } from '@/types/flow'

export function AgentNode({ id, data, selected }: NodeProps) {
  const [showModal, setShowModal] = React.useState(false)
  const [showDocPreview, setShowDocPreview] = React.useState(false)
  const [showSaveDialog, setShowSaveDialog] = React.useState(false)
  const [showIntervene, setShowIntervene] = React.useState(false)
  const [showFeedback, setShowFeedback] = React.useState(false)
  const [agentMemory, setAgentMemory] = React.useState<string | undefined>(undefined)
  const flowId = useFlowStore(s => s.flowId)
  const { t } = useUIStore()

  const d = data as AgentNodeData
  const label = d.label || 'Agent'
  const description = d.description || t('node.agent.description')
  const status = d.status
  const logs = d.logs
  const currentToken = d.currentToken || ''
  const currentOutput = d.currentOutput || ''
  const documentUrl = d.documentUrl
  const documentName = d.documentName
  const isReference = d.isReference
  const systemPrompt = d.systemPrompt || ''
  const enabledTools = d.enabledTools || []
  const enabledSkills = d.enabledSkills || []
  const model = d.model || ''
  const provider = d.provider || ''
  const maxIterations = d.maxIterations || 10
  const personality = d.personality
  const individualName = d.individualName

  const handleSaveAsAgent = async () => {
    // Load current memory before opening save dialog
    try {
      if (individualName) {
        const res = await fetch(`/api/agents/individuals/${individualName}`)
        if (res.ok) { const d = await res.json(); setAgentMemory(d.memory || '') }
      } else if (flowId) {
        const res = await fetch(`/api/memory/${flowId}/${id}`)
        if (res.ok) { const d = await res.json(); setAgentMemory(d.content || '') }
      }
    } catch { /* ignore */ }
    setShowSaveDialog(true)
  }

  return (
    <>
      <BaseNode
        id={id}
        type="agent"
        label={label}
        description={description}
        status={status}
        selected={selected}
        isReference={isReference}
        onSaveAsAgent={handleSaveAsAgent}
        onDoubleClick={() => currentOutput && setShowModal(true)}
        personalityName={personality?.name}
        personalityRole={personality?.role}
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{t('tool.webSearch')}</span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{t('tool.pythonExecute')}</span>
        </div>

        {/* Streaming token while running */}
        {status === 'running' && currentToken && (
          <div className="mt-2 text-xs text-slate-600 bg-indigo-50 border border-indigo-100 rounded-lg p-2 font-mono max-h-20 overflow-hidden">
            <div className="text-indigo-400 text-[9px] uppercase tracking-wider mb-1">{t('node.agent.thinking')}</div>
            <div className="line-clamp-3">
              {currentToken}
              <span className="inline-block w-1.5 h-3 bg-indigo-500 animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        )}

        {/* Intervene button (running only) */}
        {status === 'running' && (
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setShowIntervene(p => !p) }}
              className="absolute -top-1 right-0 p-1 rounded-full bg-white/80 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
              title={t('intervene.title')}
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
            {showIntervene && (
              <NodeIntervenePanel
                nodeId={id}
                onClose={() => setShowIntervene(false)}
              />
            )}
          </div>
        )}


        {/* Step logs while running (no token yet) */}
        {status === 'running' && !currentToken && logs && logs.length > 0 && (
          <div className="mt-2 bg-slate-50 border border-slate-100 rounded-lg p-2 font-mono text-[10px] text-slate-600 space-y-1 ring-1 ring-indigo-200 ring-offset-1">
            <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-100 text-[9px] text-slate-400 uppercase tracking-tighter">
              <span>{t('node.agent.executionState')}</span>
              <span className="text-indigo-500 animate-pulse">{t('node.agent.streaming')}</span>
            </div>
            {logs!.slice(-3).map((log, i: number) => (
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
              <span className="text-[9px] text-emerald-500 uppercase tracking-wider font-medium">{t('node.agent.output')}</span>
              <button
                onClick={e => { e.stopPropagation(); setShowModal(true) }}
                className="text-[9px] text-slate-400 hover:text-indigo-500 transition-colors"
              >
                {t('node.agent.viewAll')}
              </button>
            </div>
            <div className="px-2 pb-2 max-h-32 overflow-y-auto prose-node text-slate-700">
              <MarkdownRenderer>{currentOutput.slice(0, 600)}</MarkdownRenderer>
              {currentOutput.length > 600 && (
                <p className="text-slate-400 text-xs mt-1">{t('node.agent.viewFull')}</p>
              )}
            </div>
          </div>
        )}

        {/* Document preview link */}
        {documentUrl && status === 'success' && (
          <button
            onClick={e => { e.stopPropagation(); setShowDocPreview(true) }}
            className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors w-full"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{documentName || t('node.output.viewDocument')}</span>
          </button>
        )}

        {/* Inline feedback button after completion */}
        {(status === 'success' || status === 'error') && personality?.name && (
          <button
            onClick={e => { e.stopPropagation(); setShowFeedback(true) }}
            className="flex items-center justify-center gap-1.5 mt-2 w-full px-2.5 py-1.5 text-[11px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors cursor-pointer"
            title={t('feedback.title')}
          >
            <MessageCircle className="w-3 h-3" />
            {t('feedback.title')}
          </button>
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

      {showDocPreview && documentName && flowId && (
        <FilePreviewModal
          isOpen={showDocPreview}
          onClose={() => setShowDocPreview(false)}
          title={documentName}
          flowId={flowId}
          filePath={`docs/${documentName}`}
          editable
        />
      )}

      {showFeedback && personality?.name && (
        <FeedbackChatModal
          agentName={personality.name}
          individualName={individualName}
          role={personality.role || label}
          memoryCount={0}
          runCount={0}
          systemPrompt={systemPrompt}
          existingMemory=""
          runOutput={currentOutput}
          flowId={flowId}
          nodeId={id}
          provider={provider}
          model={model}
          onClose={() => setShowFeedback(false)}
        />
      )}

      {showSaveDialog && (
        <SaveAgentDialog
          defaultName={personality?.name || label}
          defaultDescription={description}
          systemPrompt={systemPrompt}
          tools={enabledTools}
          skills={enabledSkills}
          model={model}
          provider={provider}
          maxIterations={maxIterations}
          personality={personality}
          memory={agentMemory}
          onClose={() => setShowSaveDialog(false)}
          onSaved={(savedName) => {
            setShowSaveDialog(false)
            // Link this node to the saved individual so memory/runCount sync
            const store = useFlowStore.getState()
            store.setNodes(store.nodes.map(n =>
              n.id === id ? { ...n, data: { ...n.data, individualName: savedName, isReference: true } } : n
            ))
          }}
        />
      )}
    </>
  )
}
