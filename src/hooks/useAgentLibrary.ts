'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { IndividualEntry, PackEntry } from '@/types/registry'

// Cross-instance notification: all useAgentLibrary hooks share this
const listeners = new Set<() => void>()
function notifyAllInstances() {
  listeners.forEach(fn => fn())
}
export { notifyAllInstances as refreshAgentLibrary }

interface AgentLibrary {
  individuals: IndividualEntry[]
  packs: PackEntry[]
  loading: boolean
  refresh: () => Promise<void>
  saveIndividual: (data: SaveIndividualData) => Promise<{ name: string } | null>
  deleteIndividual: (name: string) => Promise<boolean>
  deletePack: (name: string) => Promise<boolean>
}

export interface SaveIndividualData {
  name: string
  description: string
  role: string
  systemPrompt_zh: string
  systemPrompt_en: string
  tools?: string[]
  skills?: string[]
  model?: string
  provider?: string
  maxIterations?: number
  personality?: {
    thinkingStyle?: string
    communicationStyle?: string
    valueOrientation?: string
    backstory?: string
    beliefs?: string
  }
  memory?: string
}

export function useAgentLibrary(): AgentLibrary {
  const [individuals, setIndividuals] = useState<IndividualEntry[]>([])
  const [packs, setPacks] = useState<PackEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [indRes, packRes] = await Promise.all([
        fetch('/api/agents/individuals'),
        fetch('/api/agents/packs'),
      ])
      const indData = await indRes.json()
      const packData = await packRes.json()
      if (Array.isArray(indData?.individuals)) setIndividuals(indData.individuals)
      if (Array.isArray(packData?.packs)) setPacks(packData.packs)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  // Register this instance for cross-instance notifications
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useEffect(() => {
    const handler = () => { refreshRef.current() }
    listeners.add(handler)
    refresh() // initial fetch
    return () => { listeners.delete(handler) }
  }, [refresh])

  const saveIndividual = useCallback(async (data: SaveIndividualData) => {
    try {
      const res = await fetch('/api/agents/individuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) return null
      const result = await res.json()
      notifyAllInstances()
      return result as { name: string }
    } catch {
      return null
    }
  }, [])

  const deleteIndividual = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/agents/individuals/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })
      if (res.ok) { notifyAllInstances(); return true }
      return false
    } catch {
      return false
    }
  }, [])

  const deletePack = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/agents/packs/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })
      if (res.ok) { notifyAllInstances(); return true }
      return false
    } catch {
      return false
    }
  }, [])

  return { individuals, packs, loading, refresh, saveIndividual, deleteIndividual, deletePack }
}
