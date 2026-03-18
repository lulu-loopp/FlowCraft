'use client'

import React from 'react'
import { Handle, Position } from '@xyflow/react'
import type { HandleConfig } from './packed-node'

interface Props {
  handleConfig: HandleConfig[]
}

function getHandleTop(index: number, total: number) {
  if (total <= 1) return '50%'
  const step = 100 / (total + 1)
  return `${step * (index + 1)}%`
}

export function PackedNodeHandles({ handleConfig }: Props) {
  const inputHandles = handleConfig.filter(h => h.type === 'input')
  const outputHandles = handleConfig.filter(h => h.type === 'output')

  const effectiveInputs = inputHandles.length > 0
    ? inputHandles
    : [{ id: 'target-default', label: '', type: 'input' as const, internalNodeId: '' }]

  const effectiveOutputs = outputHandles.length > 0
    ? outputHandles
    : [{ id: 'source-default', label: '', type: 'output' as const, internalNodeId: '' }]

  return (
    <>
      {/* Input handle labels */}
      {inputHandles.length > 0 && inputHandles.map((h, i) => (
        <div key={`label-${h.id}`} className="absolute left-0 flex items-center"
          style={{ top: getHandleTop(i, inputHandles.length), transform: 'translateX(-100%) translateY(-50%)', paddingRight: 4 }}>
          <span className="text-[9px] text-slate-400 whitespace-nowrap">{h.label}</span>
        </div>
      ))}
      {/* Input handles */}
      {effectiveInputs.map((h, i) => (
        <Handle key={h.id} type="target" position={Position.Left} id={h.id}
          style={{ background: '#7c3aed', borderColor: 'white', top: getHandleTop(i, effectiveInputs.length) }}
          className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-left-2 !shadow-md transition-transform duration-150" />
      ))}

      {/* Output handle labels */}
      {outputHandles.length > 0 && outputHandles.map((h, i) => (
        <div key={`label-${h.id}`} className="absolute right-0 flex items-center"
          style={{ top: getHandleTop(i, outputHandles.length), transform: 'translateX(100%) translateY(-50%)', paddingLeft: 4 }}>
          <span className="text-[9px] text-slate-400 whitespace-nowrap">{h.label}</span>
        </div>
      ))}
      {/* Output handles */}
      {effectiveOutputs.map((h, i) => (
        <Handle key={h.id} type="source" position={Position.Right} id={h.id}
          style={{ background: '#7c3aed', borderColor: 'white', top: getHandleTop(i, effectiveOutputs.length) }}
          className="!w-4 !h-4 !rounded-full !border-2 hover:!scale-125 !-right-2 !shadow-md transition-transform duration-150" />
      ))}
    </>
  )
}
