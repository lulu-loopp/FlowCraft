import React, { useState, useEffect } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { CheckCircle2, AlertCircle, Terminal, Play, FastForward, AlertTriangle } from 'lucide-react'
import { AiCodingAgentColors } from '@/styles/tokens'
import { AiCodingBody } from './ai-coding-body'
import { CodingAgentInstallGuide } from './coding-agent-install-guide'
import { OutputModal } from './output-modal'
import { InteractiveTerminalModal } from './interactive-terminal-modal'
import { Badge } from '@/components/ui/badge'
import { useUIStore } from '@/store/uiStore'
import { useCodingAgent } from '@/hooks/useCodingAgent'
import { useFlowStore } from '@/store/flowStore'
import { useRunFromNode } from '@/hooks/useRunFromNode'

export function AiCodingAgentNode({ id, data, selected }: NodeProps) {
  const { t } = useUIStore()
  const { isRunning: isFlowRunning } = useFlowStore()
  const runCtx = useRunFromNode()
  const [upstreamWarning, setUpstreamWarning] = useState<{ missingLabels: string[] } | null>(null)
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [showOutputModal, setShowOutputModal] = useState(false)
  const [showInteractive, setShowInteractive] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const cli = (data?.cli as string) || 'claude'
  const label = (data?.label as string) || t('node.aiCodingAgent')
  const nodeStatus = data?.status as string | undefined
  const currentOutput = (data?.currentOutput as string) || ''
  const theme = cli === 'codex' ? AiCodingAgentColors.codex : AiCodingAgentColors.claudeCode

  const { status, lines, fileChanges, isWaiting, startTime, sendInput, fullOutput } = useCodingAgent({
    nodeId: id,
    onComplete: (output) => {
      const store = useFlowStore.getState()
      store.setNodes(store.nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, status: 'success', currentOutput: output } } : n
      ))
    },
    onError: (err) => {
      const store = useFlowStore.getState()
      store.setNodes(store.nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, status: 'error', currentOutput: err } } : n
      ))
    },
  })

  // Clear stale status from persisted flow data on mount
  useEffect(() => {
    const store = useFlowStore.getState()
    const node = store.nodes.find(n => n.id === id)
    if (node && (node.data.status === 'error' || node.data.status === 'success')) {
      store.setNodes(store.nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, status: undefined, currentOutput: undefined } } : n
      ))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/tools/claude-code/check')
      .then(r => r.json())
      .then(d => {
        if (!cancelled) {
          const ok = cli === 'codex' ? d.codexInstalled : d.claudeInstalled
          setInstalled(ok)
        }
      })
      .catch(() => { if (!cancelled) setInstalled(false) })
    return () => { cancelled = true }
  }, [cli])

  const displayStatus = nodeStatus || status
  const isRunning = displayStatus === 'running'

  // Timer: track elapsed seconds while running (from either hook or flow executor)
  const timerStartRef = React.useRef<number | null>(null)
  useEffect(() => {
    if (isRunning) {
      // Use hook startTime if available, otherwise record now
      if (!timerStartRef.current) timerStartRef.current = startTime || Date.now()
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - timerStartRef.current!) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    } else {
      timerStartRef.current = null
    }
  }, [isRunning, startTime])
  const isSuccess = displayStatus === 'success'
  const isError = displayStatus === 'error'

  const { removeNode, duplicateNode, toggleNodeLock, nodes: allNodes } = useFlowStore()
  const currentNode = allNodes.find(n => n.id === id)
  const isLocked = currentNode ? currentNode.draggable === false : false

  return (
    <>
      <div className={`group relative w-[280px] ${isLocked ? 'nopan' : ''}`}>
        {/* ── Inline toolbar (copy / lock / delete) ── */}
        {selected && (
          <div
            className="absolute -top-11 left-1/2 -translate-x-1/2 z-10"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex gap-1 bg-white/95 p-1 rounded-lg shadow-xl shadow-slate-200/50 border border-slate-200 backdrop-blur-md">
              {/* Duplicate */}
              <button
                className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 active:scale-90 rounded-md transition-all"
                onClick={(e) => { e.stopPropagation(); duplicateNode(id); }}
                title={t('node.duplicate')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
              </button>
              {/* Lock / Unlock */}
              <button
                className={`p-2 rounded-md transition-all active:scale-90 ${isLocked ? 'text-amber-500 bg-amber-50' : 'text-slate-500 hover:text-amber-600 hover:bg-slate-50'}`}
                onClick={(e) => { e.stopPropagation(); toggleNodeLock(id); }}
                title={isLocked ? t('node.unlockPosition') : t('node.lockPosition')}
              >
                {isLocked ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                  </svg>
                )}
              </button>
              <div className="w-[1px] h-4 bg-slate-200 self-center mx-0.5" />
              {/* Delete */}
              <button
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 active:scale-90 rounded-md transition-all"
                onClick={(e) => { e.stopPropagation(); removeNode(id); }}
                title={t('node.delete')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {isRunning && (
          <div className="node-running-ring" style={{ '--glow-color': theme.hex, borderColor: `${theme.hex}66` } as React.CSSProperties} />
        )}
        <Handle type="target" position={Position.Left} style={{ background: theme.hex, borderColor: 'white' }}
          className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-left-2 !shadow-md transition-transform duration-150" />
        <Handle type="source" position={Position.Right} style={{ background: theme.hex, borderColor: 'white' }}
          className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-right-2 !shadow-md transition-transform duration-150" />

        <div className={`rounded-xl shadow-sm border-2 overflow-hidden transition-all ${selected ? theme.border : 'border-transparent'}`}>
        {/* Header — solid deep color */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: theme.headerBg }}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1 rounded-md bg-white/20 shrink-0"><Terminal className="w-5 h-5 text-white" /></div>
            <div className="font-semibold text-sm text-white truncate">{label}</div>
          </div>
          <div className="flex items-center gap-1">
            {isRunning && (
              <Badge variant="outline" className="border-transparent px-2 bg-white/20 text-white">
                <span className="thinking-dot mb-1">.</span><span className="thinking-dot mb-1">.</span><span className="thinking-dot mb-1">.</span>
              </Badge>
            )}
            {isSuccess && <CheckCircle2 className="w-4 h-4 text-white" />}
            {isError && <AlertCircle className="w-4 h-4 text-white animate-pulse" />}
          </div>
        </div>

        <AiCodingBody
          installed={installed} cli={cli} displayStatus={displayStatus}
          lines={lines} fileChanges={fileChanges} isWaiting={isWaiting}
          elapsed={elapsed} currentOutput={currentOutput} themeHex={theme.hex} bodyBg={theme.bodyBg}
          onSendInput={sendInput} onShowInstallGuide={() => setShowInstallGuide(true)} onShowOutput={() => setShowOutputModal(true)}
          onShowInteractive={() => setShowInteractive(true)}
        />
        </div>

      {/* Hover play buttons */}
      {runCtx && !isFlowRunning && !isRunning && !selected && (
        <div
          className="absolute -bottom-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="p-1.5 bg-white rounded-full shadow-md border border-slate-200
              text-slate-400 hover:text-emerald-600 hover:border-emerald-300
              active:scale-90 transition-all"
            onClick={async (e) => {
              e.stopPropagation();
              if (!runCtx) return;
              const result = await runCtx.runSingleNode(id);
              if (result?.needsWarning) setUpstreamWarning({ missingLabels: result.missingLabels });
            }}
            title={t('node.runSingle')}
          >
            <Play className="w-3 h-3" />
          </button>
          <button
            className="p-1.5 bg-white rounded-full shadow-md border border-slate-200
              text-slate-400 hover:text-teal-600 hover:border-teal-300
              active:scale-90 transition-all"
            onClick={(e) => { e.stopPropagation(); runCtx.runFromNode(id); }}
            title={t('node.runFromHere')}
          >
            <FastForward className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Upstream missing warning popup */}
      {upstreamWarning && (
        <div
          className="absolute -bottom-[88px] left-1/2 -translate-x-1/2 z-50 w-[240px]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-lg shadow-xl border border-amber-200 p-3">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {t('node.upstreamMissing').replace('{nodes}', upstreamWarning.missingLabels.join(', '))}
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="text-[11px] px-2 py-1 text-slate-500 hover:text-slate-700 rounded transition-colors"
                onClick={() => setUpstreamWarning(null)}
              >
                {t('node.cancel')}
              </button>
              <button
                className="text-[11px] px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors"
                onClick={async () => { setUpstreamWarning(null); if (runCtx) await runCtx.runSingleNode(id, { force: true }); }}
              >
                {t('node.runAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {showInstallGuide && <CodingAgentInstallGuide onClose={() => setShowInstallGuide(false)} />}
      {showOutputModal && (
        <OutputModal isOpen={showOutputModal} onClose={() => setShowOutputModal(false)} title={label} content={currentOutput || fullOutput} nodeType="agent" />
      )}
      {showInteractive && (
        <InteractiveTerminalModal isOpen={showInteractive} onClose={() => setShowInteractive(false)} nodeId={id} workDir={(data?.workDir as string) || undefined} cli={cli} />
      )}
    </>
  )
}
