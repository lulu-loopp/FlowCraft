import React from 'react'
import { NodeProps } from '@xyflow/react'
import { Eye, MessageCircle, AlertTriangle, MessageSquare } from 'lucide-react'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { BaseNode } from './base-node'
import { OutputModal } from './output-modal'
import { FilePreviewModal } from '@/components/ui/file-preview-modal'
import { SaveAgentDialog } from '@/components/canvas/save-agent-dialog'
import { NodeIntervenePanel } from './node-intervene-panel'
import { FeedbackChatModal } from '@/components/agent/feedback-chat-modal'
import { AgentChatModal } from '@/components/agent/agent-chat-modal'
import { useFlowStore } from '@/store/flowStore'
import { useUIStore } from '@/store/uiStore'
import { useRunFromNode } from '@/hooks/useRunFromNode'
import type { AgentNodeData, InputFile } from '@/types/flow'
import { NON_MULTIMODAL_MODELS } from '@/types/model'

/** Auto-scrolling thinking block – always shows the latest tokens */
function ThinkingBlock({ text, label }: { text: string; label: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text])
  return (
    <div className="mt-2 text-xs text-slate-600 bg-indigo-50 border border-indigo-100 rounded-lg p-2 font-mono max-h-20 overflow-y-auto" ref={ref}>
      <div className="text-indigo-400 text-[9px] uppercase tracking-wider mb-1 sticky top-0 bg-indigo-50">{label}</div>
      <div className="whitespace-pre-wrap break-words">
        {text}
        <span className="inline-block w-1.5 h-3 bg-indigo-500 animate-pulse ml-0.5 align-middle" />
      </div>
    </div>
  )
}

export function AgentNode({ id, data, selected }: NodeProps) {
  const [showModal, setShowModal] = React.useState(false)
  const [showDocPreview, setShowDocPreview] = React.useState(false)
  const [showSaveDialog, setShowSaveDialog] = React.useState(false)
  const [showIntervene, setShowIntervene] = React.useState(false)
  const [showFeedback, setShowFeedback] = React.useState(false)
  const [showChat, setShowChat] = React.useState(false)
  const [chatData, setChatData] = React.useState<{ systemPrompt: string; memory: string; provider?: string; model?: string } | null>(null)
  const [agentMemory, setAgentMemory] = React.useState<string | undefined>(undefined)
  const flowId = useFlowStore(s => s.flowId)
  const nodes = useFlowStore(s => s.nodes)
  const edges = useFlowStore(s => s.edges)
  const { t } = useUIStore()
  const runCtx = useRunFromNode()

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

  // Warn when this agent uses a non-multimodal model but upstream input has images
  const showImageWarning = React.useMemo(() => {
    if (!NON_MULTIMODAL_MODELS.has(model)) return false
    const upstreamIds = edges.filter(e => e.target === id).map(e => e.source)
    return nodes.some(n =>
      upstreamIds.includes(n.id) &&
      n.type === 'io' &&
      ((n.data as Record<string, unknown>).inputFiles as InputFile[] | undefined)?.some(f => f.type === 'image')
    )
  }, [model, edges, id, nodes])

  const handleOpenChat = async () => {
    if (!individualName) return
    try {
      const res = await fetch(`/api/agents/individuals/${individualName}`)
      if (res.ok) {
        const d = await res.json()
        setChatData({
          systemPrompt: d.systemPrompt || d.content || '',
          memory: d.memory || '',
          provider: d.provider,
          model: d.model,
        })
        setShowChat(true)
      }
    } catch { /* ignore */ }
  }

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
        onRunFromHere={runCtx ? () => runCtx.runFromNode(id) : undefined}
        onRunSingleNode={runCtx ? (opts) => runCtx.runSingleNode(id, opts) : undefined}
        onDoubleClick={() => currentOutput && setShowModal(true)}
        personalityName={personality?.name}
        personalityRole={personality?.role}
      >
        {showImageWarning && (
          <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-700 leading-relaxed">
              <p className="font-medium">{t('config.imageWarningTitle')}</p>
              <p className="mt-0.5">{t('config.imageWarningHint')}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{t('tool.webSearch')}</span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{t('tool.pythonExecute')}</span>
        </div>

        {/* Iteration counter */}
        {status === 'running' && logs && logs.length > 0 && (() => {
          const iterations = logs.filter((s: { type: string }) => s.type === 'thinking').length
          return (
            <div className="flex items-center justify-end mb-1">
              <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                {iterations}/{maxIterations}
              </span>
            </div>
          )
        })()}

        {/* Streaming token while running */}
        {status === 'running' && currentToken && (
          <ThinkingBlock text={currentToken} label={t('node.agent.thinking')} />
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

        {/* Chat button for individual agents */}
        {individualName && status !== 'running' && (
          <button
            onClick={e => { e.stopPropagation(); handleOpenChat() }}
            className="flex items-center justify-center gap-1.5 mt-2 w-full px-2.5 py-1.5 text-[11px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
            title={t('agentLib.chat')}
          >
            <MessageSquare className="w-3 h-3" />
            {t('agentLib.chat')}
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

      {showChat && chatData && individualName && (
        <AgentChatModal
          agentName={individualName}
          role={personality?.role || label}
          memoryCount={0}
          runCount={0}
          systemPrompt={chatData.systemPrompt}
          existingMemory={chatData.memory}
          provider={chatData.provider}
          model={chatData.model}
          onClose={() => { setShowChat(false); setChatData(null) }}
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
