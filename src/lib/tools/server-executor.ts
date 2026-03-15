/**
 * 服务端工具执行逻辑。
 * 只能在 Node.js 环境（API route / server action）里调用，不要在客户端 import。
 */

import vm from 'vm'
import { spawn } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export async function runCodeExecute(input: Record<string, unknown>): Promise<string> {
  const logs: string[] = []
  const sandbox = {
    console: { log: (...args: unknown[]) => logs.push(args.join(' ')) },
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
  }
  vm.createContext(sandbox)
  vm.runInContext(input.code as string, sandbox, { timeout: 5000 })
  return logs.join('\n') || 'No output'
}

// Windows Python Launcher (py) 优先，再 python3，最后 python
const PYTHON_CANDIDATES = ['py', 'python3', 'python']

// 判断 stderr 是否是"命令不存在"而非代码本身的错误
function isNotFoundError(stderr: string): boolean {
  return (
    stderr.includes('Python was not found') ||
    stderr.includes('No such file or directory') ||
    stderr.includes('not recognized as an internal or external command')
  )
}

export async function runPythonExecute(input: Record<string, unknown>): Promise<string> {
  const timeout = (input.timeout as number | undefined) ?? 10000
  const tmpFile = join(tmpdir(), `flowcraft_${Date.now()}.py`)
  writeFileSync(tmpFile, input.code as string)

  for (const cmd of PYTHON_CANDIDATES) {
    const result = await new Promise<{ ok: boolean; output: string }>((resolve) => {
      let stdout = ''
      let stderr = ''

      const proc = spawn(cmd, [tmpFile], {
        timeout,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      })

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

      proc.on('close', () => {
        const errTrimmed = stderr.trim()
        if (isNotFoundError(errTrimmed)) {
          resolve({ ok: false, output: '' })
        } else {
          const out = stdout.trim()
          const output = errTrimmed ? `${out}\nstderr: ${errTrimmed}`.trim() : out || 'No output'
          resolve({ ok: true, output })
        }
      })

      proc.on('error', () => resolve({ ok: false, output: '' }))
    })

    if (result.ok) {
      try { unlinkSync(tmpFile) } catch { /* ignore */ }
      return result.output
    }
  }

  try { unlinkSync(tmpFile) } catch { /* ignore */ }
  return 'Error: Python not found. Please install Python and ensure it is in PATH.'
}
