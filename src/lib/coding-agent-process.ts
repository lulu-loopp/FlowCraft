import { ChildProcess } from 'child_process'

interface ProcessEntry {
  process: ChildProcess
  startedAt: number
  timeoutMs: number
  timeoutTimer: NodeJS.Timeout | null
}

/** Module-level Map: nodeId → running child process */
const processMap = new Map<string, ProcessEntry>()

export function setProcess(nodeId: string, proc: ChildProcess, timeoutMs: number): void {
  // Kill any existing process for this nodeId
  killProcess(nodeId)

  const entry: ProcessEntry = {
    process: proc,
    startedAt: Date.now(),
    timeoutMs,
    timeoutTimer: null,
  }

  // Set up timeout protection
  entry.timeoutTimer = setTimeout(() => {
    const e = processMap.get(nodeId)
    if (e && !e.process.killed) {
      e.process.kill('SIGTERM')
      setTimeout(() => {
        if (e.process && !e.process.killed) {
          e.process.kill('SIGKILL')
        }
      }, 3000)
    }
    processMap.delete(nodeId)
  }, timeoutMs)

  processMap.set(nodeId, entry)
}

export function getProcess(nodeId: string): ChildProcess | null {
  const entry = processMap.get(nodeId)
  return entry?.process ?? null
}

export function killProcess(nodeId: string): boolean {
  const entry = processMap.get(nodeId)
  if (!entry) return false
  if (entry.timeoutTimer) clearTimeout(entry.timeoutTimer)
  if (!entry.process.killed) {
    entry.process.kill('SIGTERM')
  }
  processMap.delete(nodeId)
  return true
}

export function writeToProcess(nodeId: string, input: string): boolean {
  const proc = getProcess(nodeId)
  if (!proc || !proc.stdin || proc.killed) return false
  proc.stdin.write(input + '\n')
  return true
}

export function getProcessInfo(nodeId: string): { startedAt: number; timeoutMs: number } | null {
  const entry = processMap.get(nodeId)
  if (!entry) return null
  return { startedAt: entry.startedAt, timeoutMs: entry.timeoutMs }
}
