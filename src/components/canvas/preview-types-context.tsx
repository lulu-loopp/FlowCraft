'use client'

import { createContext, useContext } from 'react'
import type { NodeTypes, EdgeTypes } from '@xyflow/react'

interface PreviewTypesValue {
  nodeTypes: NodeTypes
  edgeTypes: EdgeTypes
}

const PreviewTypesContext = createContext<PreviewTypesValue | null>(null)

export const PreviewTypesProvider = PreviewTypesContext.Provider

export function usePreviewTypes(): PreviewTypesValue | null {
  return useContext(PreviewTypesContext)
}
