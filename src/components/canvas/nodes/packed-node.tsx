'use client'

import React, { useState, useRef, useCallback } from 'react'
import { NodeProps } from '@xyflow/react'
import { Package, RefreshCw, CheckCircle2, AlertCircle, AlertTriangle, Unplug, HelpCircle, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useFlowStore } from '@/store/flowStore'
import { useUIStore } from '@/store/uiStore'
import { PackedNodePreview } from '../packed-node-preview'
import { PackedNodeHandles } from './packed-node-handles'
import { NodeHelpModal } from './node-help-modal'
import { SharedEditDialog } from '../shared-edit-dialog'

export interface HandleConfig {
  id: string
  label: string
  type: 'input' | 'output'
  internalNodeId: string
}

export function PackedNode({ id, data, selected }: NodeProps) {
  const { removeNode, duplicateNode } = useFlowStore()
  const { t } = useUIStore()
  const [showPreview, setShowPreview] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showSharedDialog, setShowSharedDialog] = useState(false)
  const [usageCount, setUsageCount] = useState(1)
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const label = (data?.label as string) || 'Packed Agent'
  const status = data?.status as string
  const handleConfig = (data?.handleConfig as HandleConfig[]) || []
  const packName = (data?.packName as string) || ''
  const isShared = !!packName
  const hasUpdate = !!(data?.hasPackUpdate)
  const internalNodeNames = (data?.internalNodeNames as string[]) || []
  const internalNodeCount = (data?.internalNodeCount as number) || 0
  const internalEdgeCount = (data?.internalEdgeCount as number) || 0
  const runningInnerNodes = (data?.runningInnerNodes as string[]) || []
  const completedInnerNodes = (data?.completedInnerNodes as string[]) || []
  const innerProgress = data?.innerProgress as { completed: number; total: number } | undefined
  const handleResults = data?.handleResults as Record<string, { status: string }> | undefined
  const isRunning = status === 'running'
  const isPartial = status === 'partial'
  const isWaiting = status === 'waiting'

  const progressPercent = innerProgress && innerProgress.total > 0
    ? Math.round((innerProgress.completed / innerProgress.total) * 100)
    : 0

  const completedSet = new Set(completedInnerNodes)
  const runningSet = new Set(runningInnerNodes)

  // Display list: use internalNodeNames when available, fall back to union of running+completed
  const displayNodes = internalNodeNames.length > 0
    ? internalNodeNames
    : [...new Set([...completedInnerNodes, ...runningInnerNodes])]

  const handleMouseEnter = useCallback(() => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null }
    hoverTimer.current = setTimeout(() => setShowPreview(true), 1000)
  }, [])
  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null }
    leaveTimer.current = setTimeout(() => setShowPreview(false), 200)
  }, [])
  const handleDoubleClick = useCallback(() => {
    if (isShared) {
      // Shared pack: show choice dialog (edit shared vs create copy)
      fetch(`/api/agents/packs/${encodeURIComponent(packName)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          setUsageCount(d?.usageCount ?? 1)
          setShowSharedDialog(true)
        })
        .catch(() => {
          setUsageCount(1)
          setShowSharedDialog(true)
        })
    } else {
      // Independent copy: enter directly
      const store = useFlowStore.getState()
      if (store.pushViewStack) store.pushViewStack(id, label)
    }
  }, [id, packName, label, isShared])
  const handleUnpack = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); useFlowStore.getState().unpackNode?.(id)
  }, [id])
  const handleUpdatePack = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); useFlowStore.getState().updatePackVersion?.(id)
  }, [id])

  return (
    <div ref={setAnchorEl}
      className={`group relative w-[280px] rounded-xl bg-white shadow-sm border-2 transition-all
        ${isPartial ? 'border-amber-400' : selected ? 'border-violet-500' : 'border-transparent'} ${isWaiting ? 'opacity-60' : ''}`}
      onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onDoubleClick={handleDoubleClick}>

      {selected && (
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 z-10" onPointerDown={e => e.stopPropagation()}>
          <div className="flex gap-1 bg-white/95 p-1 rounded-lg shadow-xl shadow-slate-200/50 border border-slate-200 backdrop-blur-md">
            <button className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 active:scale-90 rounded-md transition-all"
              onClick={e => { e.stopPropagation(); duplicateNode(id) }} title={t('node.duplicate')}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
            <button className="p-2 text-slate-500 hover:text-orange-600 hover:bg-orange-50 active:scale-90 rounded-md transition-all"
              onClick={handleUnpack} title={t('packed.unpack')}>
              <Unplug className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-4 bg-slate-200 self-center mx-0.5" />
            <button className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 active:scale-90 rounded-md transition-all"
              onClick={e => { e.stopPropagation(); removeNode(id) }} title={t('node.delete')}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </button>
          </div>
        </div>
      )}

      {isRunning && <div className="node-running-ring" style={{ '--glow-color': '#7c3aed', borderColor: '#7c3aed66' } as React.CSSProperties} />}

      <PackedNodeHandles handleConfig={handleConfig} />

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between rounded-t-xl bg-violet-50">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="p-1.5 rounded-md bg-white shadow-sm shrink-0 text-violet-700"><Package className="w-4 h-4" /></div>
          <div className="font-semibold text-sm text-slate-800 truncate">{label}</div>
        </div>
        <div className="flex items-center gap-1">
          {/* Shared reference indicator */}
          {isShared && (
            <Layers className="w-3 h-3 text-slate-400 shrink-0" />
          )}
          {/* Help button - group-hover only */}
          <button
            onClick={e => { e.stopPropagation(); e.preventDefault(); setShowHelp(true) }}
            className="w-5 h-5 rounded-full bg-white/60 hover:bg-white text-slate-300 hover:text-slate-500
              flex items-center justify-center shrink-0 transition-all duration-200
              opacity-0 group-hover:opacity-100">
            <HelpCircle className="w-3 h-3" />
          </button>
          {isRunning && <Badge variant="outline" className="border-transparent bg-violet-100 text-violet-700 px-2"><span className="thinking-dot mb-1">.</span><span className="thinking-dot mb-1">.</span><span className="thinking-dot mb-1">.</span></Badge>}
          {status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {isPartial && <AlertTriangle className="w-4 h-4 text-amber-500" />}
          {status === 'error' && <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />}
          {hasUpdate && <button onClick={handleUpdatePack} className="p-0.5 rounded hover:bg-violet-100 transition-colors" title={t('packed.updateAvailable')}><RefreshCw className="w-3.5 h-3.5 text-amber-500" /></button>}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 bg-white/80 rounded-b-xl backdrop-blur-sm">
        {/* Idle / success / error / partial */}
        {!isRunning && !isPartial && (
          <>
            {internalNodeNames.length > 0 && <p className="text-xs text-slate-500 mb-1.5 truncate">{t('packed.contains')}: {internalNodeNames.join(' \u00b7 ')}</p>}
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span>{internalNodeCount} {t('agentLib.nodes')}</span>
              <span>{internalEdgeCount} {t('packed.edges')}</span>
            </div>
          </>
        )}

        {/* Partial success summary */}
        {isPartial && handleResults && (() => {
          const entries = Object.values(handleResults)
          const successCount = entries.filter(r => r.status === 'completed').length
          const failCount = entries.filter(r => r.status === 'error' || r.status === 'skipped').length
          return (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-600 font-medium">{successCount} {t('packed.handleSuccess')}</span>
              <span className="text-slate-300">/</span>
              <span className="text-rose-500 font-medium">{failCount} {t('packed.handleFailed')}</span>
            </div>
          )
        })()}

        {/* Running: show all nodes with individual status */}
        {isRunning && (
          <div className="space-y-2.5">
            {displayNodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {displayNodes.map(name => {
                  const isDone = completedSet.has(name)
                  const isCurrent = runningSet.has(name)
                  return (
                    <span key={name}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all
                        ${isDone
                          ? 'bg-emerald-100 text-emerald-700'
                          : isCurrent
                            ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-300'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                      {isDone && <CheckCircle2 className="w-2.5 h-2.5" />}
                      {isCurrent && <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse inline-block" />}
                      {!isDone && !isCurrent && <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />}
                      {name}
                    </span>
                  )
                })}
              </div>
            )}

            {/* Progress bar */}
            {innerProgress && innerProgress.total > 0 && (
              <div className="space-y-1">
                <div className="w-full h-1.5 bg-violet-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  {t('packed.nodeProgress')
                    .replace('{completed}', String(innerProgress.completed))
                    .replace('{total}', String(innerProgress.total))}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {showPreview && anchorEl && (
        <PackedNodePreview packName={packName} anchorEl={anchorEl}
          onMouseEnter={() => { if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null } }}
          onMouseLeave={() => { leaveTimer.current = setTimeout(() => setShowPreview(false), 200) }}
          onEnterClick={handleDoubleClick} />
      )}

      {showHelp && <NodeHelpModal nodeType="packed" onClose={() => setShowHelp(false)} />}

      {showSharedDialog && (
        <SharedEditDialog
          packName={packName}
          usageCount={usageCount}
          onEditShared={() => {
            setShowSharedDialog(false)
            const store = useFlowStore.getState()
            if (store.pushViewStack) store.pushViewStack(id, packName || label)
          }}
          onCreateCopy={() => {
            setShowSharedDialog(false)
            useFlowStore.getState().detachPackedNode(id)
          }}
          onCancel={() => setShowSharedDialog(false)}
        />
      )}
    </div>
  )
}
