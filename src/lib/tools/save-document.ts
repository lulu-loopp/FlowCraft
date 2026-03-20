/**
 * save_document — Built-in tool that converts Markdown content to .docx or .pdf.
 * Agent writes content in Markdown, this tool handles the conversion via pandoc.
 * Much more reliable than having agents generate python-docx/pptxgenjs code.
 */

import type { Tool } from '@/types/tool'
import { writeFileSync, mkdirSync, existsSync, statSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { execFileSync } from 'child_process'

export function createSaveDocumentTool(): Tool {
  return {
    definition: {
      name: 'save_document',
      description: '将 Markdown 内容保存为 .docx 或 .pdf 文件。你只需提供 Markdown 格式的内容和文件名，工具会自动转换格式。支持标题、列表、表格、粗体/斜体等 Markdown 语法。这比手写 python-docx 代码更快更可靠。',
      inputSchema: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: '输出文件名，如 "report.docx" 或 "analysis.pdf"。支持 .docx 和 .pdf 格式。',
          },
          content: {
            type: 'string',
            description: 'Markdown 格式的文档内容。支持标题(#)、列表(-)、表格(|)、粗体(**)、斜体(*)等语法。',
          },
          title: {
            type: 'string',
            description: '文档标题（可选，会显示在文档属性中）',
          },
        },
        required: ['filename', 'content'],
      },
    },
    execute: async () => {
      throw new Error('save_document must run server-side')
    },
  }
}

export async function runSaveDocument(input: Record<string, unknown>): Promise<string> {
  const filename = input.filename as string
  const content = input.content as string
  const title = (input.title as string) || ''
  const cwd = (input._cwd as string) || process.cwd()

  if (!filename || !content) {
    return 'Error: filename and content are required'
  }

  const ext = filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'

  // Write markdown to temp file
  const tmpMd = join(tmpdir(), `flowcraft_doc_${Date.now()}.md`)
  writeFileSync(tmpMd, content, 'utf-8')

  // Ensure output directory exists
  const outPath = join(cwd, filename)
  mkdirSync(dirname(outPath), { recursive: true })

  try {
    // Use pandoc to convert
    const args = [tmpMd, '-o', outPath, '--standalone']
    if (title) args.push('--metadata', `title=${title}`)
    if (ext === 'docx') {
      args.push('--reference-doc=' + join(tmpdir(), 'nonexistent.docx')) // will use default if not found
    }

    try {
      execFileSync('pandoc', [tmpMd, '-o', outPath, '--standalone',
        ...(title ? ['--metadata', `title=${title}`] : []),
      ], {
        timeout: 30000,
        stdio: 'pipe',
      })
    } catch (err) {
      const e = err as { stderr?: Buffer; status?: number }
      const stderr = e.stderr?.toString() || ''
      // pandoc might warn but still succeed
      if (e.status !== 0 && !existsSync(outPath)) {
        return `Error: pandoc conversion failed: ${stderr.slice(0, 300)}`
      }
    }

    // Verify output exists
    const stat = statSync(outPath)
    return `Document saved: ${filename} (${(stat.size / 1024).toFixed(1)} KB)\nFormat: ${ext}\nPath: ${outPath}`
  } catch (err) {
    return `Error saving document: ${err instanceof Error ? err.message : 'unknown'}`
  } finally {
    try { unlinkSync(tmpMd) } catch { /* ignore */ }
  }
}
