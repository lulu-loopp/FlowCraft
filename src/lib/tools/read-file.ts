/**
 * read_file — Built-in tool for reading workspace file contents.
 * Always available to all agents (no checkbox needed).
 *
 * - Text/code files: read directly as utf-8
 * - .docx: extract text via mammoth
 * - .xlsx: extract cell data via xlsx
 * - .pptx: extract slide text via python-pptx (Python subprocess)
 * - .pdf: extract text via pdf-parse
 * - Binary/image: return file info only
 */

import { readFile } from 'fs/promises'
import { join, extname, resolve, isAbsolute } from 'path'
import type { Tool } from '@/types/tool'

// Known binary formats that need special extraction
const OFFICE_EXTS = new Set(['.docx', '.xlsx', '.pptx', '.pdf'])
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'])
const BINARY_EXTS = new Set(['.zip', '.tar', '.gz', '.7z', '.rar', '.exe', '.dll', '.bin', '.mp3', '.mp4', '.wav', '.avi', '.mov'])

export function createReadFileTool(): Tool {
  return {
    definition: {
      name: 'read_file',
      description: '读取工作区中的文件内容。支持文本文件、代码文件（.py/.js/.ts/.c 等）、CSV、JSON、Markdown 以及 Office 文档（.docx/.xlsx/.pptx）和 PDF。对于 Office/PDF 文件会自动提取文本内容。调用前请参考工作区文件列表确认文件路径。',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '工作区内的相对文件路径，如 "report.docx" 或 "data/output.csv"',
          },
        },
        required: ['path'],
      },
    },
    execute: async () => {
      throw new Error('read_file must run server-side')
    },
  }
}

export async function runReadFile(input: Record<string, unknown>): Promise<string> {
  const filePath = input.path
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return 'Error: path is required'
  }

  const cwd = input._cwd as string | undefined
  if (!cwd) {
    return 'Error: no workspace context available'
  }

  // Security: prevent path traversal
  const normalized = filePath.replace(/\\/g, '/')
  if (normalized.startsWith('..') || normalized.includes('/../') || isAbsolute(normalized)) {
    return 'Error: invalid path (path traversal not allowed)'
  }

  const fullPath = join(cwd, normalized)

  // Ensure resolved path is inside workspace
  if (!resolve(fullPath).startsWith(resolve(cwd))) {
    return 'Error: invalid path'
  }

  const ext = extname(normalized).toLowerCase()

  try {
    // Images — return metadata only
    if (IMAGE_EXTS.has(ext)) {
      const { stat } = await import('fs/promises')
      const st = await stat(fullPath)
      return `[Image file: ${normalized}, size: ${(st.size / 1024).toFixed(1)} KB, type: ${ext}]\nImage content cannot be extracted as text.`
    }

    // Pure binary — return metadata only
    if (BINARY_EXTS.has(ext)) {
      const { stat } = await import('fs/promises')
      const st = await stat(fullPath)
      return `[Binary file: ${normalized}, size: ${(st.size / 1024).toFixed(1)} KB, type: ${ext}]\nBinary content cannot be displayed.`
    }

    // Office / PDF — special extraction
    if (OFFICE_EXTS.has(ext)) {
      return await extractOfficeContent(fullPath, ext)
    }

    // Everything else — try reading as text
    const content = await readFile(fullPath, 'utf-8')
    // Truncate very large files
    if (content.length > 50000) {
      return content.slice(0, 50000) + `\n\n... (truncated, total ${content.length} chars)`
    }
    return content
  } catch (err) {
    return `Error reading file "${normalized}": ${err instanceof Error ? err.message : 'unknown error'}`
  }
}

async function extractOfficeContent(fullPath: string, ext: string): Promise<string> {
  switch (ext) {
    case '.docx':
      return extractDocx(fullPath)
    case '.xlsx':
      return extractXlsx(fullPath)
    case '.pptx':
      return extractPptx(fullPath)
    case '.pdf':
      return extractPdf(fullPath)
    default:
      return `Unsupported format: ${ext}`
  }
}

async function extractDocx(fullPath: string): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const buffer = await readFile(fullPath)
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value.trim()
    return text || '(Document is empty)'
  } catch (err) {
    return `Error extracting .docx: ${err instanceof Error ? err.message : 'unknown'}`
  }
}

async function extractXlsx(fullPath: string): Promise<string> {
  try {
    const XLSX = await import('xlsx')
    // Read via buffer to avoid Windows file locking issues
    const buffer = await readFile(fullPath)
    const workbook = XLSX.read(buffer)
    const parts: string[] = []
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(sheet)
      parts.push(`## Sheet: ${sheetName}\n${csv}`)
    }
    return parts.join('\n\n') || '(Workbook is empty)'
  } catch (err) {
    return `Error extracting .xlsx: ${err instanceof Error ? err.message : 'unknown'}`
  }
}

async function extractPptx(fullPath: string): Promise<string> {
  // Use Python subprocess since python-pptx is more reliable for text extraction
  const { spawn } = await import('child_process')
  const script = `
import sys
from pptx import Presentation
prs = Presentation(sys.argv[1])
for i, slide in enumerate(prs.slides, 1):
    texts = []
    for shape in slide.shapes:
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                t = para.text.strip()
                if t:
                    texts.append(t)
    if texts:
        print(f"## Slide {i}")
        print("\\n".join(texts))
        print()
`
  return new Promise<string>((resolve) => {
    let stdout = ''
    let stderr = ''
    const proc = spawn('python', ['-c', script, fullPath], {
      timeout: 10000,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    })
    proc.stdout.on('data', (c: Buffer) => { stdout += c.toString() })
    proc.stderr.on('data', (c: Buffer) => { stderr += c.toString() })
    proc.on('close', () => {
      if (stderr.includes('No module named')) {
        resolve('Error: python-pptx not installed. Run: pip install python-pptx')
      } else if (stderr.trim() && !stdout.trim()) {
        resolve(`Error extracting .pptx: ${stderr.trim()}`)
      } else {
        resolve(stdout.trim() || '(Presentation is empty)')
      }
    })
    proc.on('error', () => resolve('Error: Python not found'))
  })
}

async function extractPdf(fullPath: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const buffer = await readFile(fullPath)
    const data = await pdfParse(buffer)
    const text = data.text.trim()
    return text || '(PDF is empty)'
  } catch (err) {
    return `Error extracting .pdf: ${err instanceof Error ? err.message : 'unknown'}`
  }
}
