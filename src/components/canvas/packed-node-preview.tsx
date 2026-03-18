'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReactFlow, ReactFlowProvider, Background } from '@xyflow/react'
import { ArrowRight } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { usePreviewTypes } from './preview-types-context'
import type { Node, Edge } from '@xyflow/react'

interface Props {
  packName: string
  anchorEl: HTMLElement
  onMouseEnter: () => void
  onMouseLeave: () => void
  onEnterClick: () => void
}

export function PackedNodePreview({ packName, anchorEl, onMouseEnter, onMouseLeave, onEnterClick }: Props) {
  const { t } = useUIStore()
  const previewTypes = usePreviewTypes()
  const [internalFlow, setInternalFlow] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null)
  const [lastModified, setLastModified] = useState<string>('')

  useEffect(() => {
    if (!packName) return
    fetch(`/api/agents/packs/${encodeURIComponent(packName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.flow) return
        setInternalFlow({ nodes: data.flow.nodes || [], edges: data.flow.edges || [] })
        if (data.flow.version) {
          setLastModified(new Date(data.flow.version).toLocaleDateString())
        }
      })
      .catch(() => {})
  }, [packName])

  const rect = anchorEl.getBoundingClientRect()
  const style: React.CSSProperties = { position: 'fixed', left: rect.right + 12, top: rect.top, zIndex: 200 }
  if (rect.right + 12 + 320 > window.innerWidth) {
    style.left = rect.left - 320 - 12
  }

  const nodeCount = internalFlow?.nodes.length ?? 0

  return createPortal(
    <div style={style}
      className="w-[320px] rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-fade-in-up"
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="h-[160px] bg-slate-50 relative overflow-hidden">
        {internalFlow && internalFlow.nodes.length > 0 ? (
          <ReactFlowProvider>
            <ReactFlow
              nodes={internalFlow.nodes} edges={internalFlow.edges}
              nodeTypes={previewTypes?.nodeTypes} edgeTypes={previewTypes?.edgeTypes}
              defaultEdgeOptions={{ type: 'custom' }}
              fitView fitViewOptions={{ padding: 0.3 }}
              minZoom={0.05} panOnDrag={false} zoomOnScroll={false} zoomOnPinch={false}
              zoomOnDoubleClick={false} nodesDraggable={false}
              nodesConnectable={false} elementsSelectable={false}
              proOptions={{ hideAttribution: true }}>
              <Background gap={16} size={1} color="#e2e8f0" />
            </ReactFlow>
          </ReactFlowProvider>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-slate-300">
            {t('packed.loading')}
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">{packName}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {nodeCount} {t('agentLib.nodes')}
              {lastModified && <> &middot; {t('packed.lastModified')}: {lastModified}</>}
            </p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onEnterClick() }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors">
            {t('packed.enter')}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
