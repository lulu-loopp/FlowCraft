/**
 * 服务端工具执行逻辑。
 * 只能在 Node.js 环境（API route / server action）里调用，不要在客户端 import。
 */

import { spawn, execFileSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const MAX_CODE_SIZE = 50_000
const MAX_AUTO_FIX_ATTEMPTS = 2

function readCode(input: Record<string, unknown>): string {
  const code = input.code
  if (typeof code !== 'string' || !code.trim()) {
    throw new Error('Missing code')
  }
  if (code.length > MAX_CODE_SIZE) {
    throw new Error(`Code is too large (max ${MAX_CODE_SIZE} chars)`)
  }
  return code
}

// ─── Bracket / quote auto-fix ───────────────────────────────────────────────

interface BracketFix {
  fixed: boolean
  code: string
  description: string
}

/**
 * Detect and fix unmatched brackets/parens/braces.
 * Handles: (), [], {}, template literals ``, strings "" ''
 * Returns the fixed code or original if unfixable.
 */
function autoFixBrackets(code: string): BracketFix {
  // Track bracket/paren/brace balance, respecting strings and comments
  const opens  = ['(', '[', '{']
  const closes = [')', ']', '}']
  const stack: string[] = []
  let inString: string | null = null // current string delimiter
  let inLineComment = false
  let inBlockComment = false
  let prevChar = ''

  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    const next = code[i + 1] || ''

    // Handle line comment
    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      prevChar = ch
      continue
    }

    // Handle block comment
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++ }
      prevChar = ch
      continue
    }

    // Check for comment start
    if (!inString && ch === '/' && next === '/') { inLineComment = true; prevChar = ch; continue }
    if (!inString && ch === '/' && next === '*') { inBlockComment = true; prevChar = ch; continue }

    // Handle string boundaries
    if (inString) {
      if (ch === inString && prevChar !== '\\') inString = null
      prevChar = ch
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      prevChar = ch
      continue
    }

    // Track brackets
    const openIdx = opens.indexOf(ch)
    if (openIdx >= 0) {
      stack.push(ch)
    }
    const closeIdx = closes.indexOf(ch)
    if (closeIdx >= 0) {
      // Check if it matches the top of stack
      if (stack.length > 0 && stack[stack.length - 1] === opens[closeIdx]) {
        stack.pop()
      } else {
        // Unexpected close — can't auto-fix this easily
        return { fixed: false, code, description: '' }
      }
    }

    prevChar = ch
  }

  if (stack.length === 0) {
    return { fixed: false, code, description: '' }
  }

  // Build closing sequence (reverse order)
  const closingChars = stack.reverse().map(ch => {
    const idx = opens.indexOf(ch)
    return closes[idx]
  }).join('')

  const fixedCode = code + '\n' + closingChars
  return {
    fixed: true,
    code: fixedCode,
    description: `Auto-fixed: appended ${closingChars.length} missing bracket(s): ${closingChars}`,
  }
}

/**
 * Try to fix Python indentation errors by normalizing mixed tabs/spaces.
 */
function autoFixPythonIndent(code: string, stderr: string): BracketFix {
  if (!stderr.includes('IndentationError') && !stderr.includes('TabError')) {
    return { fixed: false, code, description: '' }
  }
  // Replace tabs with 4 spaces
  const fixedCode = code.replace(/\t/g, '    ')
  if (fixedCode === code) return { fixed: false, code, description: '' }
  return { fixed: true, code: fixedCode, description: 'Auto-fixed: replaced tabs with spaces' }
}

// ─── Syntax pre-check ───────────────────────────────────────────────────────

function syntaxCheckJS(filePath: string): string | null {
  try {
    execFileSync('node', ['--check', filePath], { timeout: 5000, stdio: 'pipe' })
    return null
  } catch (err) {
    const e = err as { stderr?: Buffer }
    return e.stderr?.toString().trim() || 'Syntax error'
  }
}

function syntaxCheckPython(cmd: string, filePath: string): string | null {
  try {
    execFileSync(cmd, ['-m', 'py_compile', filePath], { timeout: 5000, stdio: 'pipe' })
    return null
  } catch (err) {
    const e = err as { stderr?: Buffer }
    return e.stderr?.toString().trim() || 'Syntax error'
  }
}

// ─── Execution helpers ──────────────────────────────────────────────────────

function runProcess(cmd: string, args: string[], cwd: string, timeout: number, env?: Record<string, string>): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    const proc = spawn(cmd, args, { cwd, timeout, env: { ...process.env, ...env } })
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    proc.on('close', () => resolve({ stdout: stdout.trim(), stderr: stderr.trim() }))
    proc.on('error', () => resolve({ stdout: '', stderr: `Error: ${cmd} not found` }))
  })
}

function formatOutput(stdout: string, stderr: string, defaultMsg: string): string {
  if (stderr) return `${stdout}\nstderr: ${stderr}`.trim()
  return stdout || defaultMsg
}

// ─── JS Execute ─────────────────────────────────────────────────────────────

export async function runCodeExecute(input: Record<string, unknown>): Promise<string> {
  let code = readCode(input)
  const rawTimeout = typeof input.timeout === 'number' ? input.timeout : 15000
  const timeout = Math.min(Math.max(rawTimeout, 100), 30000)
  const cwd = typeof input._cwd === 'string' && input._cwd ? input._cwd : process.cwd()
  const nodeEnv = { NODE_PATH: join(process.cwd(), 'node_modules') }

  // Wrap top-level await in async IIFE so CommonJS mode works
  if (/\bawait\b/.test(code) && !/async\s+function|async\s*\(/.test(code.split('\n')[0] || '')) {
    code = `(async () => {\n${code}\n})();`
  }

  for (let attempt = 0; attempt <= MAX_AUTO_FIX_ATTEMPTS; attempt++) {
    // Use .cjs extension to force CommonJS mode (Node.js v22+ treats .js with
    // top-level await as ESM, which breaks require() and NODE_PATH resolution)
    const tmpFile = join(tmpdir(), `flowcraft_${Date.now()}.cjs`)
    writeFileSync(tmpFile, code)

    // Pre-check syntax
    const syntaxErr = syntaxCheckJS(tmpFile)
    if (syntaxErr) {
      try { unlinkSync(tmpFile) } catch { /* ignore */ }

      // Try auto-fix brackets
      const fix = autoFixBrackets(code)
      if (fix.fixed && attempt < MAX_AUTO_FIX_ATTEMPTS) {
        code = fix.code
        continue // retry with fixed code
      }

      // Can't fix — return syntax error
      return `stderr: ${syntaxErr}`
    }

    // Syntax OK — execute
    const { stdout, stderr } = await runProcess('node', [tmpFile], cwd, timeout, nodeEnv)
    try { unlinkSync(tmpFile) } catch { /* ignore */ }

    if (!stderr) {
      const prefix = attempt > 0 ? `[Auto-fixed syntax before execution]\n` : ''
      return prefix + (stdout || 'Code executed successfully (no output). Use console.log() to see results.')
    }

    // Runtime error — no auto-fix for these
    return formatOutput(stdout, stderr, '')
  }

  return 'Error: auto-fix attempts exhausted'
}

// ─── Python Execute ─────────────────────────────────────────────────────────

// Windows Python Launcher (py) 优先，再 python3，最后 python
const PYTHON_CANDIDATES = ['py', 'python3', 'python']

function isNotFoundError(stderr: string): boolean {
  return (
    stderr.includes('Python was not found') ||
    stderr.includes('No such file or directory') ||
    stderr.includes('not recognized as an internal or external command')
  )
}

export async function runPythonExecute(input: Record<string, unknown>): Promise<string> {
  let code = readCode(input)
  const rawTimeout = typeof input.timeout === 'number' ? input.timeout : 10000
  const timeout = Math.min(Math.max(rawTimeout, 100), 20000)
  const cwd = typeof input._cwd === 'string' && input._cwd ? input._cwd : process.cwd()
  const pyEnv = { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }

  for (const cmd of PYTHON_CANDIDATES) {
    for (let attempt = 0; attempt <= MAX_AUTO_FIX_ATTEMPTS; attempt++) {
      const tmpFile = join(tmpdir(), `flowcraft_${Date.now()}.py`)
      writeFileSync(tmpFile, code)

      // Pre-check syntax
      const syntaxErr = syntaxCheckPython(cmd, tmpFile)
      if (syntaxErr) {
        if (isNotFoundError(syntaxErr)) {
          try { unlinkSync(tmpFile) } catch { /* ignore */ }
          break // try next Python candidate
        }

        try { unlinkSync(tmpFile) } catch { /* ignore */ }

        // Try auto-fix: brackets first, then indentation
        const bracketFix = autoFixBrackets(code)
        if (bracketFix.fixed && attempt < MAX_AUTO_FIX_ATTEMPTS) {
          code = bracketFix.code
          continue
        }
        const indentFix = autoFixPythonIndent(code, syntaxErr)
        if (indentFix.fixed && attempt < MAX_AUTO_FIX_ATTEMPTS) {
          code = indentFix.code
          continue
        }

        // Can't fix
        return `stderr: ${syntaxErr}`
      }

      // Syntax OK — execute
      const { stdout, stderr } = await runProcess(cmd, [tmpFile], cwd, timeout, pyEnv)
      try { unlinkSync(tmpFile) } catch { /* ignore */ }

      if (isNotFoundError(stderr)) break // try next Python candidate

      if (!stderr) {
        const prefix = attempt > 0 ? `[Auto-fixed syntax before execution]\n` : ''
        return prefix + (stdout || 'Code executed successfully (no output). Use print() to see results.')
      }

      // Runtime error with IndentationError — try fix
      if (attempt < MAX_AUTO_FIX_ATTEMPTS) {
        const indentFix = autoFixPythonIndent(code, stderr)
        if (indentFix.fixed) {
          code = indentFix.code
          continue
        }
      }

      return formatOutput(stdout, stderr, '')
    }
  }

  return 'Error: Python not found. Please install Python and ensure it is in PATH.'
}
