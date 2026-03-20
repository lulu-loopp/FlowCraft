'use client'

import { createContext, useContext } from 'react'

type RunFromNodeFn = (nodeId: string) => void
type RunSingleNodeFn = (nodeId: string, opts?: { force?: boolean }) => Promise<{ needsWarning: boolean; missingLabels: string[] } | void>

export interface RunFromNodeContextValue {
  runFromNode: RunFromNodeFn
  runSingleNode: RunSingleNodeFn
}

export const RunFromNodeContext = createContext<RunFromNodeContextValue | null>(null)

export function useRunFromNode(): RunFromNodeContextValue | null {
  return useContext(RunFromNodeContext)
}
