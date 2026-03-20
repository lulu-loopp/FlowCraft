import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { spawn } from 'child_process'
import { getWorkspaceDir } from '@/lib/workspace-manager'
import { requireMutationAuth } from '@/lib/api-auth'

interface Params {
  params: Promise<{ flowId: string }>
}

/** Extensions that support rich preview */
const RICH_PREVIEW = new Set(['.docx', '.xlsx'])
/** All previewable extensions */
const CONVERTIBLE = new Set([...RICH_PREVIEW, '.pptx', '.pdf'])

/**
 * GET /api/workspace/[flowId]/preview?path=file.pptx
 *
 * Returns different formats based on file type:
 * - .pdf:  { format: "iframe", url: "..." }       → frontend uses <iframe>
 * - .docx: { format: "html", content: "..." }     → frontend uses dangerouslySetInnerHTML
 * - .xlsx: { format: "html", content: "..." }     → frontend uses dangerouslySetInnerHTML
 * - .pptx: { format: "markdown", content: "..." } → frontend uses MarkdownRenderer
 *
 * Falls back to markitdown for all types if rich preview fails.
 */
export async function GET(req: Request, { params }: Params) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  const { flowId } = await params
  const { searchParams } = new URL(req.url)
  const filePath = searchParams.get('path')

  if (!filePath) {
    return NextResponse.json({ error: 'path parameter required' }, { status: 400 })
  }

  const normalized = path.normalize(filePath).replace(/\\/g, '/')
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const ext = path.extname(normalized).toLowerCase()
  if (!CONVERTIBLE.has(ext)) {
    return NextResponse.json({ error: `Preview not supported for ${ext} files` }, { status: 400 })
  }

  const wsDir = await getWorkspaceDir(flowId)
  const fullPath = path.join(wsDir, normalized)

  if (!fullPath.startsWith(path.resolve(wsDir) + path.sep)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  // Check file existence before attempting conversion
  try {
    await fs.access(fullPath)
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  try {
    // PDF: return iframe URL — no download=1 so it uses inline disposition
    if (ext === '.pdf') {
      const iframeUrl = `/api/workspace/${flowId}/file?path=${encodeURIComponent(normalized)}`
      return NextResponse.json({ format: 'iframe', url: iframeUrl })
    }

    // DOCX: convert to HTML with mammoth
    if (ext === '.docx') {
      try {
        const html = await convertDocxToHtml(fullPath)
        return NextResponse.json({ format: 'html', content: html })
      } catch {
        // Fall back to markitdown
        const markdown = await runMarkitdown(fullPath)
        return NextResponse.json({ content: markdown, format: 'markdown' })
      }
    }

    // XLSX: convert to HTML table with SheetJS
    if (ext === '.xlsx') {
      try {
        const html = await convertXlsxToHtml(fullPath)
        return NextResponse.json({ format: 'html', content: html })
      } catch {
        // Fall back to markitdown
        const markdown = await runMarkitdown(fullPath)
        return NextResponse.json({ content: markdown, format: 'markdown' })
      }
    }

    // PPTX and others: use markitdown
    const markdown = await runMarkitdown(fullPath)
    return NextResponse.json({ content: markdown, format: 'markdown' })
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Preview conversion failed'
    // Sanitize error: strip filesystem paths to avoid leaking server structure
    const msg = raw.replace(/[A-Z]:\\[^\s'"]+/gi, '<path>').replace(/\/[^\s'"]*\/workspace\//g, '<workspace>/')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/* ── DOCX → HTML via mammoth ─────────────────────────────────── */

async function convertDocxToHtml(filePath: string): Promise<string> {
  const mammoth = await import('mammoth')
  const buffer = await fs.readFile(filePath)
  const result = await mammoth.convertToHtml({ buffer })

  // Wrap in styled container
  return `<div class="docx-preview" style="font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #334155;">
    <style>
      .docx-preview h1 { font-size: 1.5em; font-weight: 700; margin: 1em 0 0.5em; color: #0f172a; }
      .docx-preview h2 { font-size: 1.25em; font-weight: 600; margin: 0.8em 0 0.4em; color: #1e293b; }
      .docx-preview h3 { font-size: 1.1em; font-weight: 600; margin: 0.6em 0 0.3em; color: #334155; }
      .docx-preview p { margin: 0.5em 0; }
      .docx-preview table { border-collapse: collapse; width: 100%; margin: 1em 0; }
      .docx-preview th, .docx-preview td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
      .docx-preview th { background: #f8fafc; font-weight: 600; }
      .docx-preview tr:nth-child(even) { background: #f8fafc; }
      .docx-preview ul, .docx-preview ol { padding-left: 1.5em; margin: 0.5em 0; }
      .docx-preview li { margin: 0.25em 0; }
      .docx-preview img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5em 0; }
      .docx-preview strong { font-weight: 600; }
    </style>
    ${result.value}
  </div>`
}

/* ── XLSX → HTML via SheetJS ─────────────────────────────────── */

async function convertXlsxToHtml(filePath: string): Promise<string> {
  const XLSX = await import('xlsx')
  const buffer = await fs.readFile(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const sheets: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const htmlTable = XLSX.utils.sheet_to_html(sheet, { id: `sheet-${sheetName}`, editable: false })

    sheets.push(`
      <div class="xlsx-sheet">
        ${workbook.SheetNames.length > 1 ? `<h3 class="sheet-name">${escapeHtml(sheetName)}</h3>` : ''}
        ${htmlTable}
      </div>
    `)
  }

  return `<div class="xlsx-preview">
    <style>
      .xlsx-preview { font-family: 'Segoe UI', system-ui, sans-serif; color: #334155; }
      .xlsx-preview .sheet-name { font-size: 1em; font-weight: 600; margin: 1.5em 0 0.5em; padding-bottom: 0.3em; border-bottom: 2px solid #0d9488; color: #0f172a; }
      .xlsx-preview .sheet-name:first-child { margin-top: 0; }
      .xlsx-preview table { border-collapse: collapse; width: 100%; margin: 0.5em 0 1.5em; font-size: 0.875em; }
      .xlsx-preview th, .xlsx-preview td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; white-space: nowrap; }
      .xlsx-preview th { background: #f1f5f9; font-weight: 600; position: sticky; top: 0; }
      .xlsx-preview tr:nth-child(even) { background: #f8fafc; }
      .xlsx-preview tr:hover { background: #f0fdfa; }
      .xlsx-preview td:first-child { color: #64748b; font-size: 0.8em; }
    </style>
    ${sheets.join('\n')}
  </div>`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/* ── Markitdown fallback ─────────────────────────────────────── */

const PYTHON_CANDIDATES = ['python', 'python3', 'py']

function runMarkitdown(filePath: string): Promise<string> {
  return tryCommands(PYTHON_CANDIDATES, filePath)
}

function tryCommands(cmds: string[], filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let idx = 0

    function attempt() {
      if (idx >= cmds.length) {
        reject(new Error('Python not found. Install Python and markitdown: pip install markitdown'))
        return
      }

      const cmd = cmds[idx++]
      let stdout = ''
      let stderr = ''

      // shell: true is required on Windows so that spawn can locate Python via PATH / PATHEXT
      const proc = spawn(cmd, ['-m', 'markitdown', filePath], {
        cwd: path.dirname(filePath),
        timeout: 30000,
        shell: process.platform === 'win32',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      })

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

      proc.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          resolve(stdout)
        } else if (stderr.includes('not found') || stderr.includes('not recognized')) {
          attempt() // try next python
        } else {
          reject(new Error(stderr.trim() || `markitdown exited with code ${code}`))
        }
      })

      proc.on('error', () => attempt())
    }

    attempt()
  })
}
